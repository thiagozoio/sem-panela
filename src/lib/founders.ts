import type { SupabaseClient } from "@supabase/supabase-js";

// Preço de fundador: os 10 primeiros grupos que assinam pagam R$ 19,90 para sempre.
// Quem decide a vaga é o banco (billing_claim_founder, com trava), pela migração 20261123000000.

/** Vagas de fundador que sobram. Sem a migração (ou com erro) devolve 0 e a oferta some. */
export async function founderSpotsLeft(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("founder_spots_left");
  return error || typeof data !== "number" ? 0 : data;
}

/** O grupo já tem uma vaga de fundador? */
export async function isFounder(supabase: SupabaseClient, groupId: string): Promise<boolean> {
  const { data } = await supabase.from("billing_founders").select("group_id").eq("group_id", groupId).maybeSingle();
  return !!data;
}

export function spotsText(left: number): string {
  return left === 1 ? "resta 1 vaga" : `restam ${left} vagas`;
}
