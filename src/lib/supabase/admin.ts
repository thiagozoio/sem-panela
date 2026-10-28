import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Cliente com a chave secreta (ignora a RLS). Só para o servidor enviar avisos a outros
 * usuários, para a rotina diária e para o login pelo link do jogador; nunca use para ler dados que voltam para a tela.
 * Sem SUPABASE_SECRET_KEY devolve null e os avisos simplesmente não saem.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
