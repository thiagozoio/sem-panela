import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type CurrentUser = { id: string; email: string; name: string; isAdmin: boolean };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, is_admin")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    id: data.user.id,
    email: data.user.email ?? "",
    name: profile?.name ?? "",
    isAdmin: profile?.is_admin ?? false,
  };
});

/** Exige login; quem ainda não tem nome vai para o perfil primeiro. */
export async function requireUser(next = "/grupos"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!user.name) redirect(`/perfil?next=${encodeURIComponent(next)}`);
  return user;
}

/** Só aceita caminhos internos para evitar redirecionamento aberto. */
export function safeNext(next: unknown, fallback = "/grupos"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
