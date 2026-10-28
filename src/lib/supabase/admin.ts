import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// Chave secreta do Supabase (Project Settings > API Keys > Secret key). Só no servidor.
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Cliente com a chave secreta (ignora a RLS). Só para o login pelo link do jogador. */
export function createAdminClient() {
  if (!SECRET_KEY) return null;
  return createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
