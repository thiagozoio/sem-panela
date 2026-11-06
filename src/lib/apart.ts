import type { createClient } from "./supabase/server";
import type { ApartPair } from "./draw";

type Client = Awaited<ReturnType<typeof createClient>>;

export type ApartRule = { id: string; member_a: string; member_b: string };

/** Regras "não jogam juntos" do grupo (vazio se a tabela ainda não existe no banco). Só organizador lê. */
export async function apartRules(supabase: Client, groupId: string): Promise<ApartRule[]> {
  const { data } = await supabase
    .from("member_apart")
    .select("id, member_a, member_b")
    .eq("group_id", groupId)
    .order("created_at")
    .returns<ApartRule[]>();
  return data ?? [];
}

export async function apartPairs(supabase: Client, groupId: string): Promise<ApartPair[]> {
  return (await apartRules(supabase, groupId)).map((r) => [r.member_a, r.member_b] as const);
}
