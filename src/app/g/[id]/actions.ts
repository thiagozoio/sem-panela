"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getGroupContext } from "@/lib/groups";
import { createClient } from "@/lib/supabase/server";
import { splitList } from "@/lib/attendance";
import { drawTeams } from "@/lib/draw";
import { teamsFromFixed, toDrawPlayer } from "@/lib/fixed-teams";
import { addToTeam, removeFromTeams } from "@/lib/guest-team";
import { addMonths, monthOf, parseMoney } from "@/lib/format";
import { ALL_POSITIONS, positionOf, sportOf } from "@/lib/sports";
import { brazilDateTime } from "@/lib/matches";
import {
  decidedByOf,
  finalGameIds,
  finalTeamIds,
  rankingOf,
  seasonChampionships,
  standings,
  tableGames,
  turnsOf,
  type Championship,
  type ResultGame,
} from "@/lib/standings";
import { siteUrl } from "@/lib/site";
import { notifyGroup, notifyPending, notifyPromotions, notifyTeamsDrawn } from "@/lib/push-events";
import type { Attendance, FixedTeam, Game, Member, MemberKind, Position } from "@/lib/types";

// As permissões (só o organizador, grupo com assinatura em dia, o próprio jogador na presença)
// são garantidas pela RLS do banco; as ações só carregam o grupo inteiro quando precisam dos dados.

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

const isMonth = (v: string) => /^\d{4}-\d{2}-01$/.test(v);

function clampInt(value: string, min: number, max: number, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

// ---------------------------------------------------------------------------
// Presença
// ---------------------------------------------------------------------------

export async function setAttendance(fd: FormData) {
  const groupId = str(fd, "group_id");
  const gameId = str(fd, "game_id");
  const memberId = str(fd, "member_id");
  const going = str(fd, "going") === "1";
  if (!groupId) return;
  // Sem carregar o grupo inteiro: a RLS garante que só o próprio jogador ou o organizador mudam.
  const supabase = await createClient();

  const before = await gameAttendances(supabase, gameId);
  const current = before.find((a) => a.member_id === memberId);

  if (!current) {
    await supabase.from("attendances").insert({ game_id: gameId, member_id: memberId, going });
  } else if (current.going !== going) {
    // Voltar a confirmar vai para o fim da fila.
    const { error } = await supabase
      .from("attendances")
      .update({ going, confirmed_at: new Date().toISOString() })
      .eq("game_id", gameId)
      .eq("member_id", memberId);
    // Desistiu: o primeiro da lista de espera sobe e recebe o aviso.
    if (!error && current.going) after(() => notifyPromotions(groupId, gameId, before));
  }
  refresh();
}

export async function clearAttendance(fd: FormData) {
  const groupId = str(fd, "group_id");
  const gameId = str(fd, "game_id");
  const memberId = str(fd, "member_id");
  const supabase = await createClient();
  const before = await gameAttendances(supabase, gameId);
  const { error } = await supabase.from("attendances").delete().eq("game_id", gameId).eq("member_id", memberId);
  if (!error && groupId && before.some((a) => a.member_id === memberId && a.going)) {
    after(() => notifyPromotions(groupId, gameId, before));
  }
  refresh();
}

export type GuestState = { error?: string; added?: string };

/**
 * Põe um convidado só neste jogo (quando faltar gente). Ele não entra em Jogadores e não paga
 * (fica isento). Entra no time escolhido: nos times do jogo, se já estão montados, ou nos times
 * fixos do mês, para já entrar no time certo quando o organizador usar os times fixos.
 * Se já veio como convidado antes com o mesmo nome, reaproveita (gols e notas ficam juntos).
 */
export async function addGuest(_prev: GuestState, fd: FormData): Promise<GuestState> {
  const groupId = str(fd, "group_id");
  const gameId = str(fd, "game_id");
  const name = str(fd, "name").slice(0, 60);
  if (!name) return { error: "Escreva o nome do convidado." };
  const ctx = await getGroupContext(groupId);
  if (!ctx.isOrganizer || ctx.readOnly) return { error: "Só o organizador pode pôr convidados." };
  const { supabase, members, group } = ctx;
  const value = str(fd, "position");
  const position: Position = ALL_POSITIONS.includes(value as Position) ? (value as Position) : "linha";
  const key = name.toLocaleLowerCase("pt-BR");
  if (members.some((m) => !m.guest && m.active && m.name.toLocaleLowerCase("pt-BR") === key)) {
    return { error: `${name} já é do grupo. Marque a presença em “Marcar presença de outros jogadores”.` };
  }

  let memberId = members.find((m) => m.guest && m.name.toLocaleLowerCase("pt-BR") === key)?.id;
  if (memberId) {
    await supabase.from("members").update({ position, active: true, exempt: true }).eq("id", memberId).eq("group_id", groupId);
  } else {
    const { data, error } = await supabase
      .from("members")
      .insert({ group_id: groupId, name, position, kind: "avulso", guest: true, exempt: true })
      .select("id")
      .single();
    if (error || !data) {
      return { error: error?.message.includes("guest") ? "Falta rodar a atualização do banco (convidados) no Supabase." : "Não deu para pôr o convidado. Tente de novo." };
    }
    memberId = data.id as string;
  }
  await saveSkill(supabase, groupId, memberId, clampInt(str(fd, "skill"), 1, 5, 3));

  const { data: current } = await supabase
    .from("attendances")
    .select("going")
    .eq("game_id", gameId)
    .eq("member_id", memberId)
    .maybeSingle<{ going: boolean }>();
  if (!current) await supabase.from("attendances").insert({ game_id: gameId, member_id: memberId, going: true });
  else if (!current.going) {
    await supabase
      .from("attendances")
      .update({ going: true, confirmed_at: new Date().toISOString() })
      .eq("game_id", gameId)
      .eq("member_id", memberId);
  }

  const team = str(fd, "team");
  const { data: game } = await supabase.from("games").select("teams, starts_at").eq("id", gameId).single<Pick<Game, "teams" | "starts_at">>();
  let joined = "";
  if (game?.teams?.length) {
    // Times do jogo já montados: entra direto no time escolhido.
    const player = { member_id: memberId, name, position: positionOf(sportOf(group.sport), position) };
    await supabase.from("games").update({ teams: addToTeam(game.teams, player, team) }).eq("id", gameId);
    joined = team;
  } else if (team && game) {
    // Ainda sem sorteio: entra no time fixo do mês, para já cair nele em "Usar times fixos".
    joined = (await putInFixedTeam(supabase, groupId, monthOf(game.starts_at), memberId, team)) ? team : "";
  }
  refresh();
  return { added: joined ? `${name} entrou no ${joined}` : `${name} entrou na lista` };
}

/** Põe o convidado num time fixo do mês (e tira dos outros). Devolve false se o time não existe. */
async function putInFixedTeam(supabase: Client, groupId: string, month: string, memberId: string, team: string) {
  const { data: fixed } = await supabase
    .from("fixed_teams")
    .select("id, name, member_ids")
    .eq("group_id", groupId)
    .eq("month", month)
    .returns<Pick<FixedTeam, "id" | "name" | "member_ids">[]>();
  const target = (fixed ?? []).find((t) => t.name === team);
  if (!target) return false;
  for (const t of fixed ?? []) {
    const ids = t.id === target.id ? [...new Set([...t.member_ids, memberId])] : t.member_ids.filter((id) => id !== memberId);
    if (ids.length !== t.member_ids.length) await supabase.from("fixed_teams").update({ member_ids: ids }).eq("id", t.id);
  }
  return true;
}

/** Tira o convidado da lista e do time deste jogo. */
export async function removeGuest(fd: FormData) {
  const gameId = str(fd, "game_id");
  const memberId = str(fd, "member_id");
  const supabase = await createClient();
  const { data: game } = await supabase.from("games").select("teams, starts_at").eq("id", gameId).single<Pick<Game, "teams" | "starts_at">>();
  if (game?.teams?.length) {
    await supabase.from("games").update({ teams: removeFromTeams(game.teams, memberId) }).eq("id", gameId);
  }
  // Também sai dos times fixos do mês, onde só convidados entram por aqui.
  if (game) await putInFixedTeam(supabase, str(fd, "group_id"), monthOf(game.starts_at), memberId, "");
  await clearAttendance(fd);
}

async function gameAttendances(supabase: Client, gameId: string) {
  const { data } = await supabase.from("attendances").select("*").eq("game_id", gameId).returns<Attendance[]>();
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Avisos no celular (organizador)
// ---------------------------------------------------------------------------

export type PushState = { message?: string; error?: string };

async function organizerOf(groupId: string) {
  const ctx = await getGroupContext(groupId);
  return ctx.isOrganizer && !ctx.readOnly ? ctx : null;
}

/** Lembra quem ainda não respondeu se vai ao jogo. */
export async function pushPending(_prev: PushState, fd: FormData): Promise<PushState> {
  const groupId = str(fd, "group_id");
  if (!(await organizerOf(groupId))) return { error: "Só o organizador pode mandar avisos." };
  const sent = await notifyPending(groupId, str(fd, "game_id"));
  return sent ? { message: `Aviso enviado para ${sent} celular${sent > 1 ? "es" : ""}.` } : { error: "Ninguém pendente está com os avisos ativados." };
}

/** Recado livre para todos os jogadores (ex.: "jogo cancelado por causa da chuva"). */
export async function pushMessage(_prev: PushState, fd: FormData): Promise<PushState> {
  const groupId = str(fd, "group_id");
  const text = str(fd, "text").slice(0, 200);
  if (!text) return { error: "Escreva o recado." };
  const ctx = await organizerOf(groupId);
  if (!ctx) return { error: "Só o organizador pode mandar avisos." };
  const sent = await notifyGroup(groupId, text, ctx.user.id);
  return sent ? { message: `Recado enviado para ${sent} celular${sent > 1 ? "es" : ""}.` } : { error: "Nenhum jogador está com os avisos ativados ainda." };
}

// ---------------------------------------------------------------------------
// Sorteio
// ---------------------------------------------------------------------------

async function confirmedForGame(groupId: string, gameId: string) {
  const ctx = await getGroupContext(groupId);
  if (!ctx.isOrganizer) return null;
  const { supabase, group, members } = ctx;
  const [{ data: game }, { data: attendances }] = await Promise.all([
    supabase.from("games").select("*").eq("id", gameId).single<Game>(),
    supabase.from("attendances").select("*").eq("game_id", gameId).returns<Attendance[]>(),
  ]);
  if (!game) return null;
  const { confirmed } = splitList(attendances ?? [], members, group.max_players, game.starts_at, group.priority_hours);
  const sport = sportOf(group.sport);
  return {
    supabase,
    game,
    userId: ctx.user.id,
    players: confirmed.map(({ member }) => toDrawPlayer(sport, member)),
    guestIds: new Set(confirmed.filter((e) => e.member.guest).map((e) => e.member.id)),
  };
}

export async function drawTeamsAction(fd: FormData) {
  const gameId = str(fd, "game_id");
  const data = await confirmedForGame(str(fd, "group_id"), gameId);
  if (!data) return;
  const teams = drawTeams(data.players, clampInt(str(fd, "teams"), 2, 8, 2));
  const { error } = await data.supabase.from("games").update({ teams }).eq("id", gameId);
  if (!error) after(() => notifyTeamsDrawn(data.game.group_id, gameId, data.userId));
  refresh();
}

/** Times do jogo montados com os times fixos do mês (null se o mês não tem times fixos). */
async function fixedTeamsForGame(groupId: string, data: NonNullable<Awaited<ReturnType<typeof confirmedForGame>>>) {
  const { data: fixed } = await data.supabase
    .from("fixed_teams")
    .select("*")
    .eq("group_id", groupId)
    .eq("month", monthOf(data.game.starts_at))
    .order("sort")
    .returns<FixedTeam[]>();
  if (!fixed?.length) return null;
  // Convidado que já foi posto num time continua nele.
  const guestTeam = new Map<string, string>();
  for (const t of data.game.teams ?? []) for (const p of t.players) if (data.guestIds.has(p.member_id)) guestTeam.set(p.member_id, t.name);
  const withGuests = fixed.map((t) => ({
    ...t,
    member_ids: [...t.member_ids, ...[...guestTeam].filter(([, name]) => name === t.name).map(([id]) => id)],
  }));
  return teamsFromFixed(withGuests, data.players);
}

/** Monta os times do jogo com os times fixos do mês. */
export async function applyFixedTeams(fd: FormData) {
  const groupId = str(fd, "group_id");
  const gameId = str(fd, "game_id");
  const data = await confirmedForGame(groupId, gameId);
  if (!data) return;
  const teams = await fixedTeamsForGame(groupId, data);
  if (!teams) return;
  const { error } = await data.supabase.from("games").update({ teams }).eq("id", gameId);
  if (!error) after(() => notifyTeamsDrawn(groupId, gameId, data.userId));
  refresh();
}

export async function clearTeams(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("games").update({ teams: null }).eq("id", str(fd, "game_id"));
  refresh();
}

// ---------------------------------------------------------------------------
// Depois do jogo: placar, gols e notas
// ---------------------------------------------------------------------------

/** Placar por time e gols por jogador; campos "score_<i>" e "goals_<member_id>". */
export async function saveResult(fd: FormData) {
  const gameId = str(fd, "game_id");
  const supabase = await createClient();
  const scores: number[] = [];
  for (let i = 0; fd.has(`score_${i}`); i++) scores.push(clampInt(str(fd, `score_${i}`), 0, 99, 0));
  const goals = [...fd.keys()]
    .filter((k) => k.startsWith("goals_"))
    .map((k) => ({ game_id: gameId, member_id: k.slice(6), goals: clampInt(str(fd, k), 0, 50, 0) }));

  // Jogo sem times salvos, mas com times fixos no mês: o placar é dos times fixos,
  // então eles passam a ser os times do jogo (sem avisar ninguém, o jogo já foi).
  let teamsUpdate = {};
  if (scores.length && fd.get("use_fixed") === "1") {
    const groupId = str(fd, "group_id");
    const data = await confirmedForGame(groupId, gameId);
    if (!data) return;
    if (!data.game.teams) {
      const teams = await fixedTeamsForGame(groupId, data);
      if (!teams || teams.length !== scores.length) return;
      teamsUpdate = { teams };
    }
  }

  const { error } = await supabase
    .from("games")
    .update({ scores: scores.length ? scores : null, ...teamsUpdate })
    .eq("id", gameId);
  if (error) return;
  await supabase.from("game_goals").delete().eq("game_id", gameId);
  const scored = goals.filter((g) => g.goals > 0);
  if (scored.length) await supabase.from("game_goals").insert(scored);
  refresh();
}

/** Notas que o jogador logado deu; campos "rating_<member_id>" (vazio = sem nota). */
export async function saveRatings(fd: FormData) {
  const gameId = str(fd, "game_id");
  const raterId = str(fd, "rater_id");
  const supabase = await createClient();
  const ratings = [...fd.keys()]
    .filter((k) => k.startsWith("rating_") && str(fd, k))
    .map((k) => ({ game_id: gameId, rater_id: raterId, rated_id: k.slice(7), rating: clampInt(str(fd, k), 1, 10, 5) }));
  await supabase.from("game_ratings").delete().eq("game_id", gameId).eq("rater_id", raterId);
  if (ratings.length) await supabase.from("game_ratings").insert(ratings);
  refresh();
}

/** Voto do jogador logado no craque do jogo; campo "voted_id" (vazio = tira o voto). */
export async function saveMvpVote(fd: FormData) {
  const gameId = str(fd, "game_id");
  const voterId = str(fd, "voter_id");
  const votedId = str(fd, "voted_id");
  const supabase = await createClient();
  await supabase.from("game_mvp_votes").delete().eq("game_id", gameId).eq("voter_id", voterId);
  if (votedId && votedId !== voterId) {
    await supabase.from("game_mvp_votes").insert({ game_id: gameId, voter_id: voterId, voted_id: votedId });
  }
  refresh();
}

// ---------------------------------------------------------------------------
// Jogadores
// ---------------------------------------------------------------------------

/** À parte: sem a migração 20261031000000 a coluna não existe e o resto já foi salvo. */
async function saveExempt(supabase: Client, groupId: string, memberId: string, fd: FormData) {
  if (!fd.has("exempt")) return;
  await supabase.from("members").update({ exempt: str(fd, "exempt") === "1" }).eq("id", memberId).eq("group_id", groupId);
}

function memberFields(fd: FormData) {
  const value = str(fd, "position");
  const position: Position = ALL_POSITIONS.includes(value as Position) ? (value as Position) : "linha";
  const kindValue = str(fd, "kind");
  const kind: MemberKind = kindValue === "mensalista" || kindValue === "socio" ? kindValue : "avulso";
  return { name: str(fd, "name").slice(0, 60), position, kind };
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function saveSkill(supabase: Client, groupId: string, memberId: string, skill: number) {
  const { data } = await supabase.from("member_skills").select("member_id").eq("member_id", memberId).maybeSingle();
  if (data) await supabase.from("member_skills").update({ skill }).eq("member_id", memberId);
  else await supabase.from("member_skills").insert({ member_id: memberId, group_id: groupId, skill });
}

/** Telefone do jogador (só o organizador vê). Sem a migração 20261020000000 não faz nada. */
async function savePhone(supabase: Client, groupId: string, memberId: string, phone: string) {
  const { data, error } = await supabase.from("member_contacts").select("member_id").eq("member_id", memberId).maybeSingle();
  if (error) return;
  if (data) await supabase.from("member_contacts").update({ phone }).eq("member_id", memberId);
  else if (phone) await supabase.from("member_contacts").insert({ member_id: memberId, group_id: groupId, phone });
}

export async function addMember(fd: FormData) {
  const groupId = str(fd, "group_id");
  const supabase = await createClient();
  // "Convidado" escolhido em Jogadores: vai como convidado do próximo jogo, não como jogador do grupo.
  if (str(fd, "kind") === "convidado") {
    const { data: gameId } = await supabase.rpc("ensure_next_game", { p_group_id: groupId });
    if (typeof gameId !== "string") return;
    fd.set("game_id", gameId);
    const result = await addGuest({}, fd);
    if (result.error) return;
    redirect(`/g/${groupId}?convidado=${encodeURIComponent(str(fd, "name").slice(0, 60))}`);
  }
  const fields = memberFields(fd);
  if (!fields.name) return;
  const { data } = await supabase.from("members").insert({ group_id: groupId, ...fields }).select("id").single();
  if (data) {
    await saveExempt(supabase, groupId, data.id, fd);
    await saveSkill(supabase, groupId, data.id, clampInt(str(fd, "skill"), 1, 5, 3));
    await savePhone(supabase, groupId, data.id, str(fd, "phone").slice(0, 30));
  }
  refresh();
}

export async function updateMember(fd: FormData) {
  const groupId = str(fd, "group_id");
  const memberId = str(fd, "member_id");
  const supabase = await createClient();
  const fields = memberFields(fd);
  if (!fields.name) return;
  await supabase.from("members").update(fields).eq("id", memberId).eq("group_id", groupId);
  await saveExempt(supabase, groupId, memberId, fd);
  await saveSkill(supabase, groupId, memberId, clampInt(str(fd, "skill"), 1, 5, 3));
  await savePhone(supabase, groupId, memberId, str(fd, "phone").slice(0, 30));
  refresh();
}

export async function setMemberActive(fd: FormData) {
  const groupId = str(fd, "group_id");
  const supabase = await createClient();
  await supabase
    .from("members")
    .update({ active: str(fd, "active") === "1" })
    .eq("id", str(fd, "member_id"))
    .eq("group_id", groupId)
    .eq("is_organizer", false);
  refresh();
}

export type OrganizerState = { error?: string };

export async function setOrganizer(_prev: OrganizerState, fd: FormData): Promise<OrganizerState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_organizer", {
    p_member_id: str(fd, "member_id"),
    p_value: str(fd, "value") === "1",
  });
  if (error) {
    if (error.message.includes("pelo menos um")) return { error: "O grupo precisa de pelo menos um organizador. Promova outra pessoa antes." };
    if (error.message.includes("convite")) return { error: "A pessoa precisa entrar pelo link de convite antes de virar organizador." };
    return { error: "Não deu para mudar. Se a assinatura venceu, o grupo está só leitura." };
  }
  refresh();
  return {};
}

export type AccessLinkState = { url?: string; error?: string };

/** Gera o link pessoal de acesso do jogador (o anterior deixa de valer). */
export async function createAccessLink(_prev: AccessLinkState, fd: FormData): Promise<AccessLinkState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_member_link", { p_member_id: str(fd, "member_id") });
  if (error || typeof data !== "string") {
    if (error?.message.includes("e-mail")) return { error: "Essa pessoa já entra com e-mail. Ela continua entrando do mesmo jeito." };
    return { error: "Não deu para gerar o link. Se a assinatura venceu, o grupo está só leitura." };
  }
  return { url: `${await siteUrl()}/entrar/${data}` };
}

// ---------------------------------------------------------------------------
// Times fixos do mês
// ---------------------------------------------------------------------------

export async function createFixedTeams(fd: FormData) {
  const groupId = str(fd, "group_id");
  const month = str(fd, "month");
  if (!isMonth(month)) return;
  const { supabase, group, members, isOrganizer } = await getGroupContext(groupId);
  if (!isOrganizer) return;
  const count = clampInt(str(fd, "teams"), 2, 8, 2);
  const sport = sportOf(group.sport);
  const mensalistas = members
    .filter((m) => m.active && m.kind === "mensalista")
    .map((m) => toDrawPlayer(sport, m));
  const drawn = str(fd, "fill") === "1" && mensalistas.length >= 2 ? drawTeams(mensalistas, count) : [];
  await supabase.from("fixed_teams").insert(
    Array.from({ length: count }, (_, i) => ({
      group_id: groupId,
      month,
      name: `Time ${i + 1}`,
      sort: i,
      member_ids: drawn[i]?.players.map((p) => p.member_id) ?? [],
    })),
  );
  refresh();
}

export async function copyFixedTeams(fd: FormData) {
  const groupId = str(fd, "group_id");
  const month = str(fd, "month");
  if (!isMonth(month)) return;
  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("fixed_teams")
    .select("*")
    .eq("group_id", groupId)
    .eq("month", addMonths(month, -1))
    .order("sort")
    .returns<FixedTeam[]>();
  if (!previous?.length) return;
  await supabase
    .from("fixed_teams")
    .insert(previous.map(({ name, sort, member_ids }) => ({ group_id: groupId, month, name, sort, member_ids })));
  refresh();
}

export async function addFixedTeam(fd: FormData) {
  const groupId = str(fd, "group_id");
  const month = str(fd, "month");
  if (!isMonth(month)) return;
  const supabase = await createClient();
  const { data: teams } = await supabase.from("fixed_teams").select("sort").eq("group_id", groupId).eq("month", month);
  const count = teams?.length ?? 0;
  if (count >= 8) return;
  const sort = Math.max(-1, ...(teams ?? []).map((t) => t.sort)) + 1;
  await supabase.from("fixed_teams").insert({ group_id: groupId, month, name: `Time ${count + 1}`, sort });
  refresh();
}

export async function renameFixedTeam(fd: FormData) {
  const name = str(fd, "name").slice(0, 30);
  if (!name) return;
  const supabase = await createClient();
  await supabase.from("fixed_teams").update({ name }).eq("id", str(fd, "team_id")).eq("group_id", str(fd, "group_id"));
  refresh();
}

export async function deleteFixedTeam(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("fixed_teams").delete().eq("id", str(fd, "team_id")).eq("group_id", str(fd, "group_id"));
  refresh();
}

/** Põe o jogador num time do mês (ou em nenhum, com team_id vazio), tirando dos outros. */
export async function setPlayerTeam(fd: FormData) {
  const groupId = str(fd, "group_id");
  const month = str(fd, "month");
  const memberId = str(fd, "member_id");
  const teamId = str(fd, "team_id");
  if (!isMonth(month) || !memberId) return;
  const supabase = await createClient();
  const { data: teams } = await supabase
    .from("fixed_teams")
    .select("*")
    .eq("group_id", groupId)
    .eq("month", month)
    .returns<FixedTeam[]>();
  for (const t of teams ?? []) {
    const has = t.member_ids.includes(memberId);
    const want = t.id === teamId;
    if (has === want) continue;
    const member_ids = want ? [...t.member_ids, memberId] : t.member_ids.filter((id) => id !== memberId);
    await supabase.from("fixed_teams").update({ member_ids }).eq("id", t.id);
  }
  refresh();
}

// ---------------------------------------------------------------------------
// Classificação: campeonatos com datas
// ---------------------------------------------------------------------------

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export type ChampionshipState = { ok?: boolean; error?: string };

/** Cria um campeonato (ou muda, com championship_id): nome, início e fim. */
export async function saveChampionship(_prev: ChampionshipState, fd: FormData): Promise<ChampionshipState> {
  const groupId = str(fd, "group_id");
  const id = str(fd, "championship_id");
  const name = str(fd, "name").slice(0, 60);
  const starts_on = str(fd, "starts_on");
  const ends_on = str(fd, "ends_on");
  if (!name) return { error: "Dê um nome, como “1º turno 2026”." };
  if (!isDay(starts_on) || !isDay(ends_on)) return { error: "Escolha as datas de início e fim." };
  if (ends_on < starts_on) return { error: "O fim precisa ser depois do início." };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("championships").update({ name, starts_on, ends_on }).eq("id", id).eq("group_id", groupId)
    : await supabase.from("championships").insert({ group_id: groupId, name, starts_on, ends_on });
  if (error) return { error: "Não deu para salvar. Se a assinatura venceu, o grupo está só leitura." };
  const billingStart = str(fd, "billing_start");
  if (fd.has("billing_start") && (!billingStart || isMonth(billingStart))) {
    // À parte: sem a migração 20261031000000 a coluna não existe e o resto já foi salvo.
    const { error: billingError } = await supabase.from("groups").update({ billing_start: billingStart || null }).eq("id", groupId);
    if (billingError) return { error: "Salvo, menos o início da cobrança: falta rodar a atualização do banco." };
  }
  refresh();
  return { ok: true };
}

/** Cria 1º turno, 2º turno e anual do ano escolhido. */
export async function createSeason(fd: FormData) {
  const year = clampInt(str(fd, "year"), 2000, 2100, new Date().getFullYear());
  const list = seasonChampionships(year, str(fd, "first_ends"));
  if (!list) return;
  const groupId = str(fd, "group_id");
  const supabase = await createClient();
  await supabase.from("championships").insert(list.map((c) => ({ group_id: groupId, ...c })));
  refresh();
}

/** Como sai o campeão: decided_by, final_game_id e champion_ids (caixas marcadas). */
export async function saveChampionshipFinal(_prev: ChampionshipState, fd: FormData): Promise<ChampionshipState> {
  const decided_by = decidedByOf(str(fd, "decided_by"));
  const finalGame = str(fd, "final_game_id");
  const champion_ids = fd.getAll("champion_ids").map(String).filter(Boolean);
  if (decided_by === "final" && !finalGame) return { error: "Escolha qual jogo vai ser a final." };
  if (decided_by === "manual" && !champion_ids.length) return { error: "Marque quem é o campeão." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("championships")
    .update({ decided_by, final_game_id: finalGame || null, champion_ids })
    .eq("id", str(fd, "championship_id"))
    .eq("group_id", str(fd, "group_id"));
  if (error) return { error: "Não deu para salvar. Se ainda não rodou a atualização do banco da final, rode antes." };
  refresh();
  return { ok: true };
}

/** Põe no jogo final os melhores de cada turno: um time com os do 1º turno, outro com os do 2º. */
export async function buildFinalTeams(fd: FormData) {
  const groupId = str(fd, "group_id");
  const { supabase, group, members, isOrganizer } = await getGroupContext(groupId);
  if (!isOrganizer) return;
  const [{ data: list }, { data: games }] = await Promise.all([
    supabase.from("championships").select("*").eq("group_id", groupId).returns<Championship[]>(),
    supabase
      .from("games")
      .select("id, starts_at, teams, scores")
      .eq("group_id", groupId)
      .not("scores", "is", null)
      .returns<ResultGame[]>(),
  ]);
  const champ = (list ?? []).find((c) => c.id === str(fd, "championship_id"));
  if (!champ?.final_game_id) return;
  const turns = turnsOf(champ, list ?? []);
  if (turns.length < 2) return;
  const byId = new Map(members.map((m) => [m.id, m]));
  const nameOf = (id: string, fallback: string) => byId.get(id)?.name ?? fallback;
  const finals = finalGameIds(list ?? []);
  const [first, second] = turns.map((t) => standings(tableGames(games ?? [], t, finals), nameOf).players);
  const ids = finalTeamIds(first, second, group.players_per_team);
  const sport = sportOf(group.sport);
  const teams = turns.map((t, i) => ({
    name: t.name.slice(0, 30),
    players: ids[i]
      .map((id) => byId.get(id))
      .filter((m): m is Member => !!m)
      .map((m) => ({ member_id: m.id, name: m.name, position: positionOf(sport, m.position) })),
  }));
  await supabase.from("games").update({ teams }).eq("id", champ.final_game_id).eq("group_id", groupId);
  refresh();
}

export async function deleteChampionship(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("championships").delete().eq("id", str(fd, "championship_id")).eq("group_id", str(fd, "group_id"));
  refresh();
}

// ---------------------------------------------------------------------------
// Amistosos: jogos contra outros times
// ---------------------------------------------------------------------------

export type MatchState = { ok?: boolean; error?: string };

/** Marca um amistoso (ou muda, com match_id): data, adversário, local e contato de lá. */
export async function saveMatch(_prev: MatchState, fd: FormData): Promise<MatchState> {
  const groupId = str(fd, "group_id");
  const id = str(fd, "match_id");
  const opponent = str(fd, "opponent").slice(0, 60);
  const starts_at = brazilDateTime(str(fd, "day"), str(fd, "time"));
  if (!opponent) return { error: "Coloque o nome do time adversário." };
  if (!starts_at) return { error: "Escolha o dia e o horário do jogo." };
  const fields = {
    opponent,
    starts_at,
    location: str(fd, "location").slice(0, 120),
    contact_name: str(fd, "contact_name").slice(0, 60),
    contact_phone: str(fd, "contact_phone").slice(0, 30),
    notes: str(fd, "notes").slice(0, 280),
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("matches").update(fields).eq("id", id).eq("group_id", groupId)
    : await supabase.from("matches").insert({ group_id: groupId, ...fields });
  if (error) return { error: "Não deu para salvar. Se a assinatura venceu, o grupo está só leitura." };
  const billingStart = str(fd, "billing_start");
  if (fd.has("billing_start") && (!billingStart || isMonth(billingStart))) {
    // À parte: sem a migração 20261031000000 a coluna não existe e o resto já foi salvo.
    const { error: billingError } = await supabase.from("groups").update({ billing_start: billingStart || null }).eq("id", groupId);
    if (billingError) return { error: "Salvo, menos o início da cobrança: falta rodar a atualização do banco." };
  }
  refresh();
  return { ok: true };
}

/** Placar do amistoso; os dois campos vazios apagam o placar. */
export async function saveMatchScore(fd: FormData) {
  const ours = str(fd, "our_score");
  const theirs = str(fd, "their_score");
  const both = ours !== "" && theirs !== "";
  const supabase = await createClient();
  await supabase
    .from("matches")
    .update({
      our_score: both ? clampInt(ours, 0, 99, 0) : null,
      their_score: both ? clampInt(theirs, 0, 99, 0) : null,
    })
    .eq("id", str(fd, "match_id"))
    .eq("group_id", str(fd, "group_id"));
  refresh();
}

export async function deleteMatch(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("matches").delete().eq("id", str(fd, "match_id")).eq("group_id", str(fd, "group_id"));
  refresh();
}

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------

export async function togglePayment(fd: FormData) {
  const groupId = str(fd, "group_id");
  const supabase = await createClient();

  const paymentId = str(fd, "payment_id");
  if (paymentId) {
    await supabase.from("payments").delete().eq("id", paymentId).eq("group_id", groupId);
  } else {
    const kind = str(fd, "kind") === "avulso" ? "avulso" : "mensal";
    // O valor vem do campo (pode ter multa ou desconto); vazio usa o valor padrão.
    const typed = str(fd, "amount");
    const payment = {
      group_id: groupId,
      member_id: str(fd, "member_id"),
      kind,
      month: kind === "mensal" ? str(fd, "month") : null,
      game_id: kind === "avulso" ? str(fd, "game_id") : null,
      amount_cents: typed ? parseMoney(typed) : Number.parseInt(str(fd, "amount_cents"), 10) || 0,
    };
    const note = str(fd, "note").slice(0, 60);
    const { error } = await supabase.from("payments").insert({ ...payment, note });
    // Banco ainda sem a coluna "note" (migração de 18/10 não rodada): registra sem a observação.
    if (error?.message.includes("note")) await supabase.from("payments").insert(payment);
  }
  refresh();
}

/** Saldo do caixa antes de começar a usar o app; aceita negativo ("-50"). */
export async function setCashStart(fd: FormData) {
  const typed = str(fd, "cash_start");
  // O teclado numérico do iPhone não tem o sinal de menos: a escolha "estava devendo" faz o papel dele.
  const negative = typed.startsWith("-") || str(fd, "cash_sign") === "-";
  const cents = parseMoney(typed) * (negative ? -1 : 1);
  const supabase = await createClient();
  await supabase.from("groups").update({ cash_start_cents: cents }).eq("id", str(fd, "group_id"));
  refresh();
}

/** Mês em que a cobrança começa (AAAA-MM-01), ou vazio para cobrar desde sempre. */
export async function setBillingStart(fd: FormData) {
  const month = str(fd, "billing_start");
  if (month && !isMonth(month)) return;
  const supabase = await createClient();
  await supabase.from("groups").update({ billing_start: month || null }).eq("id", str(fd, "group_id"));
  refresh();
}

export async function addExpense(fd: FormData) {
  const month = str(fd, "month");
  const description = str(fd, "description").slice(0, 80);
  const amount_cents = parseMoney(str(fd, "amount"));
  if (!isMonth(month) || !description || !amount_cents) return;
  const supabase = await createClient();
  await supabase.from("expenses").insert({ group_id: str(fd, "group_id"), month, description, amount_cents });
  refresh();
}

export async function deleteExpense(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("expenses").delete().eq("id", str(fd, "expense_id")).eq("group_id", str(fd, "group_id"));
  refresh();
}

export async function copyExpenses(fd: FormData) {
  const groupId = str(fd, "group_id");
  const month = str(fd, "month");
  if (!isMonth(month)) return;
  const supabase = await createClient();
  const { data: previous } = await supabase
    .from("expenses")
    .select("description, amount_cents")
    .eq("group_id", groupId)
    .eq("month", addMonths(month, -1))
    .order("created_at");
  if (!previous?.length) return;
  await supabase.from("expenses").insert(previous.map((e) => ({ ...e, group_id: groupId, month })));
  refresh();
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

export type SettingsState = { ok?: boolean; error?: string };

export async function saveSettings(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const groupId = str(fd, "group_id");
  const { supabase, isOrganizer } = await getGroupContext(groupId);
  if (!isOrganizer) return { error: "Só o organizador pode mudar os ajustes." };

  const name = str(fd, "name");
  if (name.length < 2) return { error: "O nome precisa ter pelo menos 2 letras." };
  const fields = {
    name: name.slice(0, 60),
    location: str(fd, "location").slice(0, 120),
    weekday: clampInt(str(fd, "weekday"), 0, 6, 4),
    start_time: str(fd, "start_time") || "20:00",
    max_players: clampInt(str(fd, "max_players"), 4, 80, 18),
    players_per_team: clampInt(str(fd, "players_per_team"), 2, 11, 6),
    priority_hours: clampInt(str(fd, "priority_hours"), 0, 168, 24),
    monthly_fee_cents: parseMoney(str(fd, "monthly_fee")),
    single_fee_cents: parseMoney(str(fd, "single_fee")),
    pix_key: str(fd, "pix_key").slice(0, 140),
  };
  const sport = sportOf(str(fd, "sport"));
  const ranking = rankingOf(str(fd, "ranking"));
  let { error } = await supabase
    .from("groups")
    .update({ ...fields, sport, ranking, matches: str(fd, "matches") === "1" })
    .eq("id", groupId);
  // Sem as migrações dos amistosos, da classificação ou das modalidades a coluna não existe: salva o resto.
  if (error) ({ error } = await supabase.from("groups").update({ ...fields, sport, ranking }).eq("id", groupId));
  if (error) ({ error } = await supabase.from("groups").update({ ...fields, sport }).eq("id", groupId));
  if (error) ({ error } = await supabase.from("groups").update(fields).eq("id", groupId));
  if (error) return { error: "Não deu para salvar. Se a assinatura venceu, o grupo está só leitura." };
  const billingStart = str(fd, "billing_start");
  if (fd.has("billing_start") && (!billingStart || isMonth(billingStart))) {
    // À parte: sem a migração 20261031000000 a coluna não existe e o resto já foi salvo.
    const { error: billingError } = await supabase.from("groups").update({ billing_start: billingStart || null }).eq("id", groupId);
    if (billingError) return { error: "Salvo, menos o início da cobrança: falta rodar a atualização do banco." };
  }
  refresh();
  return { ok: true };
}
