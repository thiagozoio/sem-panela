import "server-only";
import { splitList } from "./attendance";
import { notify, promotedMembers } from "./notifications";
import { sendPush } from "./push";
import { createAdminClient } from "./supabase/admin";
import type { Attendance, Game, Group, Member } from "./types";

// Avisos disparados pelo que acontece no app. Rodam depois da resposta (after) com a chave
// secreta, porque precisam achar os aparelhos de outros jogadores.

async function load(groupId: string, gameId: string) {
  const admin = createAdminClient();
  if (!admin) return null;
  const [{ data: group }, { data: members }, { data: game }, { data: attendances }] = await Promise.all([
    admin.from("groups").select("*").eq("id", groupId).single<Group>(),
    admin.from("members").select("*").eq("group_id", groupId).returns<Member[]>(),
    admin.from("games").select("*").eq("id", gameId).eq("group_id", groupId).single<Game>(),
    admin.from("attendances").select("*").eq("game_id", gameId).returns<Attendance[]>(),
  ]);
  if (!group || !game) return null;
  return { admin, group, game, members: members ?? [], attendances: attendances ?? [] };
}

/** Cada jogador sorteado recebe o nome do próprio time. */
export async function notifyTeamsDrawn(groupId: string, gameId: string, actorUserId: string) {
  const data = await load(groupId, gameId);
  if (!data?.game.teams) return;
  const { group, game, members, admin } = data;
  const teamOf = new Map<string, string>();
  for (const team of game.teams!) {
    for (const p of team.players) {
      const userId = members.find((m) => m.id === p.member_id)?.user_id;
      if (userId && userId !== actorUserId) teamOf.set(userId, team.name);
    }
  }
  await sendPush(
    [...teamOf.keys()],
    (userId) => notify.teamsDrawn(group.id, group.name, game.starts_at, teamOf.get(userId) ?? "seu time"),
    admin,
  );
}

/** Quem saiu da lista de espera porque alguém desistiu. `before` = presenças antes da mudança. */
export async function notifyPromotions(groupId: string, gameId: string, before: Attendance[]) {
  const data = await load(groupId, gameId);
  if (!data) return;
  const { group, game, members, attendances, admin } = data;
  if (new Date(game.starts_at).getTime() < Date.now()) return;
  const split = (rows: Attendance[]) => splitList(rows, members, group.max_players, game.starts_at, group.priority_hours);
  const old = split(before);
  const waiting = new Set(old.waitlist.map((e) => e.member.id));
  const promoted = promotedMembers(old.confirmed, split(attendances).confirmed).filter((id) => waiting.has(id));
  const userIds = members.filter((m) => promoted.includes(m.id) && m.user_id).map((m) => m.user_id!);
  await sendPush(userIds, notify.promoted(group.id, group.name, game.starts_at), admin);
}

/** Jogadores ativos (com conta) que ainda não responderam se vão ao jogo. */
export async function notifyPending(groupId: string, gameId: string): Promise<number> {
  const data = await load(groupId, gameId);
  if (!data) return 0;
  const { group, game, members, attendances, admin } = data;
  const answered = new Set(attendances.map((a) => a.member_id));
  const userIds = members.filter((m) => m.active && m.user_id && !answered.has(m.id)).map((m) => m.user_id!);
  return sendPush(userIds, notify.pendingReminder(group.id, group.name, game.starts_at), admin);
}

/** Recado livre do organizador para todos os jogadores ativos. */
export async function notifyGroup(groupId: string, text: string, actorUserId: string): Promise<number> {
  const admin = createAdminClient();
  if (!admin) return 0;
  const [{ data: group }, { data: members }] = await Promise.all([
    admin.from("groups").select("id, name").eq("id", groupId).single<Pick<Group, "id" | "name">>(),
    admin.from("members").select("user_id").eq("group_id", groupId).eq("active", true).not("user_id", "is", null),
  ]);
  if (!group) return 0;
  const userIds = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== actorUserId);
  return sendPush(userIds, notify.broadcast(group.id, group.name, text), admin);
}
