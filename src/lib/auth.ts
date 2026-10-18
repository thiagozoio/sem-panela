import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type CurrentUser = { id: string; email: string; name: string; isAdmin: boolean };

/** Usuário da sessão, só pelo token (sem ida ao servidor de login). */
export const getSessionUser = cache(async (): Promise<{ id: string; email: string } | null> => {
  const supabase = await createClient();
  // getClaims confere a assinatura do token localmente (chaves assimétricas do Supabase),
  // evitando a ida e volta ao servidor de login que o getUser faria em toda página.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSessionUser();
  if (!session) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, is_admin")
    .eq("id", session.id)
    .maybeSingle();
  return {
    ...session,
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
