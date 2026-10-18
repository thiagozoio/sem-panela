"use server";

import { refresh } from "next/cache";
import { getGroupContext } from "@/lib/groups";
import { createClient } from "@/lib/supabase/server";
import { splitList } from "@/lib/attendance";
import { drawTeams } from "@/lib/draw";
import { parseMoney } from "@/lib/format";
import type { Attendance, Game, MemberKind, Position } from "@/lib/types";

// As permissões (só o organizador, grupo com assinatura em dia, o próprio jogador na presença)
// são garantidas pela RLS do banco; as ações só carregam o grupo inteiro quando precisam dos dados.

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

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

export async function drawTeamsAction(fd: FormData) {
  const groupId = str(fd, "group_id");
  const gameId = str(fd, "game_id");
  const { supabase, group, members, isOrganizer } = await getGroupContext(groupId);
  if (!isOrganizer) return;

  const [{ data: game }, { data: attendances }] = await Promise.all([
    supabase.from("games").select("*").eq("id", gameId).single<Game>(),
    supabase.from("attendances").select("*").eq("game_id", gameId).returns<Attendance[]>(),
  ]);
  if (!game) return;

  const { confirmed } = splitList(attendances ?? [], members, group.max_players, game.starts_at, group.priority_hours);
  const numTeams = clampInt(str(fd, "teams"), 2, 8, 2);
  const teams = drawTeams(
    confirmed.map(({ member }) => ({
      member_id: member.id,
      name: member.name,
      position: member.position,
      skill: member.skill,
    })),
    numTeams,
  );
  await supabase.from("games").update({ teams }).eq("id", gameId);
  refresh();
}

export async function clearTeams(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("games").update({ teams: null }).eq("id", str(fd, "game_id"));
  refresh();
}

// ---------------------------------------------------------------------------
// Jogadores
// ---------------------------------------------------------------------------

function memberFields(fd: FormData) {
  const position: Position = str(fd, "position") === "goleiro" ? "goleiro" : "linha";
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
    await supabase.from("payments").insert({
      group_id: groupId,
      member_id: str(fd, "member_id"),
      kind,
      month: kind === "mensal" ? str(fd, "month") : null,
      game_id: kind === "avulso" ? str(fd, "game_id") : null,
      amount_cents: Number.parseInt(str(fd, "amount_cents"), 10) || 0,
    });
  }
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
  const { error } = await supabase
    .from("groups")
    .update({
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
    })
    .eq("id", groupId);
  if (error) return { error: "Não deu para salvar. Se a assinatura venceu, o grupo está só leitura." };
  refresh();
  return { ok: true };
}
