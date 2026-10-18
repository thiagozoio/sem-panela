import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUser } from "./auth";
import { createClient } from "./supabase/server";
import { subscriptionState } from "./subscription";
import { todayInBrazil } from "./format";
import type { Group, Member } from "./types";

/** Carrega o grupo e os jogadores; 404 para quem não é membro (a RLS esconde o grupo). */
export const getGroupContext = cache(async (groupId: string) => {
  const supabase = await createClient();
  // Tudo em paralelo: perfil, grupo, jogadores e níveis (a RLS só devolve níveis ao organizador).
  const [user, { data: group }, { data: rows }, { data: skills }] = await Promise.all([
    requireUser(`/g/${groupId}`),
    supabase.from("groups").select("*").eq("id", groupId).maybeSingle<Group>(),
    supabase.from("members").select("*").eq("group_id", groupId).order("name").returns<Omit<Member, "skill">[]>(),
    supabase.from("member_skills").select("member_id, skill").eq("group_id", groupId),
  ]);
  if (!group) notFound();
  const me = (rows ?? []).find((m) => m.user_id === user.id) ?? null;
  if (!me && !user.isAdmin) notFound();
  const skillOf = new Map((skills ?? []).map((s) => [s.member_id, s.skill]));
  const members: Member[] = (rows ?? []).map((m) => ({ ...m, skill: skillOf.get(m.id) ?? 3 }));
  const subscription = subscriptionState(group.paid_until, todayInBrazil());
  return {
    supabase,
    user,
    group,
    members,
    me: me ? members.find((m) => m.id === me.id)! : null,
    isOrganizer: !!me?.is_organizer,
    subscription,
    readOnly: subscription.status === "read_only",
  };
});
