"use server";

import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLinkEmail } from "@/lib/player-link";
import { checkNewPassword } from "@/lib/password";

export type PasswordState = { ok?: boolean; error?: string };

/** Cria ou troca a senha de quem já está conectado (pelo código, Google ou senha antiga). */
export async function savePassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const problem = checkNewPassword(password, confirm);
  if (problem) return { error: problem };

  const session = await getSessionUser();
  if (!session) return { error: "Sua sessão expirou. Entre de novo." };
  // Quem entra pelo link do WhatsApp tem um e-mail interno, que não serve para entrar com senha.
  if (!session.email || isLinkEmail(session.email)) return { error: "Para criar senha, entre com o seu e-mail." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Essa já é a sua senha atual." };
    if (error.code === "weak_password") return { error: "Senha fraca. Use pelo menos 8 caracteres, misturando letras e números." };
    if (error.code === "reauthentication_needed") return { error: "Por segurança, saia e entre de novo pelo código antes de trocar a senha." };
    return { error: "Não deu para salvar a senha. Tente de novo." };
  }
  return { ok: true };
}
