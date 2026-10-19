"use server";

import { refresh } from "next/cache";
import { getGroupContext } from "@/lib/groups";
import { createClient } from "@/lib/supabase/server";
import { splitList } from "@/lib/attendance";
import { drawTeams, type DrawPlayer } from "@/lib/draw";
import { teamsFromFixed } from "@/lib/fixed-teams";
import { addMonths, monthOf, parseMoney } from "@/lib/format";
import { ALL_POSITIONS, positionOf, sportOf, type Sport } from "@/lib/sports";
import { rankingOf } from "@/lib/standings";
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

  const { data: current } = await supabase
    .from("attendances")
    .select("going")
    .eq("game_id", gameId)
    .eq("member_id", memberId)
    .maybeSingle();

  if (!current) {
    await supabase.from("attendances").insert({ game_id: gameId, member_id: memberId, going });
  } else if (current.going !== going) {
    // Voltar a confirmar vai para o fim da fila.
    await supabase
      .from("attendances")
      .update({ going, confirmed_at: new Date().toISOString() })
      .eq("game_id", gameId)
      .eq("member_id", memberId);
  }
  refresh();
}

export async function clearAttendance(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("attendances").delete().eq("game_id", str(fd, "game_id")).eq("member_id", str(fd, "member_id"));
  refresh();
}

// ---------------------------------------------------------------------------
// Sorteio
// ---------------------------------------------------------------------------

const toDrawPlayer = (sport: Sport, member: Member): DrawPlayer => ({
  member_id: member.id,
  name: member.name,
  position: positionOf(sport, member.position),
  skill: member.skill,
});

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
  return { supabase, game, players: confirmed.map(({ member }) => toDrawPlayer(sport, member)) };
}

export async function drawTeamsAction(fd: FormData) {
  const gameId = str(fd, "game_id");
  const data = await confirmedForGame(str(fd, "group_id"), gameId);
  if (!data) return;
  const teams = drawTeams(data.players, clampInt(str(fd, "teams"), 2, 8, 2));
  await data.supabase.from("games").update({ teams }).eq("id", gameId);
  refresh();
}

/** Monta os times do jogo com os times fixos do mês. */
export async function applyFixedTeams(fd: FormData) {
  const groupId = str(fd, "group_id");
  const gameId = str(fd, "game_id");
  const data = await confirmedForGame(groupId, gameId);
  if (!data) return;
  const { data: fixed } = await data.supabase
    .from("fixed_teams")
    .select("*")
    .eq("group_id", groupId)
    .eq("month", monthOf(data.game.starts_at))
    .order("sort")
    .returns<FixedTeam[]>();
  if (!fixed?.length) return;
  await data.supabase.from("games").update({ teams: teamsFromFixed(fixed, data.players) }).eq("id", gameId);
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

  const { error } = await supabase.from("games").update({ scores: scores.length ? scores : null }).eq("id", gameId);
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

// ---------------------------------------------------------------------------
// Jogadores
// ---------------------------------------------------------------------------

function memberFields(fd: FormData) {
  const value = str(fd, "position");
  const position: Position = ALL_POSITIONS.includes(value as Position) ? (value as Position) : "linha";
  const kind: MemberKind = str(fd, "kind") === "mensalista" ? "mensalista" : "avulso";
  return { name: str(fd, "name").slice(0, 60), position, kind };
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function saveSkill(supabase: Client, groupId: string, memberId: string, skill: number) {
  const { data } = await supabase.from("member_skills").select("member_id").eq("member_id", memberId).maybeSingle();
  if (data) await supabase.from("member_skills").update({ skill }).eq("member_id", memberId);
  else await supabase.from("member_skills").insert({ member_id: memberId, group_id: groupId, skill });
}

export async function addMember(fd: FormData) {
  const groupId = str(fd, "group_id");
  const supabase = await createClient();
  const fields = memberFields(fd);
  if (!fields.name) return;
  const { data } = await supabase.from("members").insert({ group_id: groupId, ...fields }).select("id").single();
  if (data) await saveSkill(supabase, groupId, data.id, clampInt(str(fd, "skill"), 1, 5, 3));
  refresh();
}

export async function updateMember(fd: FormData) {
  const groupId = str(fd, "group_id");
  const memberId = str(fd, "member_id");
  const supabase = await createClient();
  const fields = memberFields(fd);
  if (!fields.name) return;
  await supabase.from("members").update(fields).eq("id", memberId).eq("group_id", groupId);
  await saveSkill(supabase, groupId, memberId, clampInt(str(fd, "skill"), 1, 5, 3));
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
  refresh();
  return { ok: true };
}

export async function deleteChampionship(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("championships").delete().eq("id", str(fd, "championship_id")).eq("group_id", str(fd, "group_id"));
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
  const cents = parseMoney(typed) * (typed.startsWith("-") ? -1 : 1);
  const supabase = await createClient();
  await supabase.from("groups").update({ cash_start_cents: cents }).eq("id", str(fd, "group_id"));
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
  let { error } = await supabase
    .from("groups")
    .update({ ...fields, sport, ranking: rankingOf(str(fd, "ranking")) })
    .eq("id", groupId);
  // Sem as migrações da classificação ou das modalidades a coluna não existe: salva o resto.
  if (error) ({ error } = await supabase.from("groups").update({ ...fields, sport }).eq("id", groupId));
  if (error) ({ error } = await supabase.from("groups").update(fields).eq("id", groupId));
  if (error) return { error: "Não deu para salvar. Se a assinatura venceu, o grupo está só leitura." };
  refresh();
  return { ok: true };
}
