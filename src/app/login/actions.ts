"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";
import { siteUrl } from "@/lib/site";

export type LoginState = { step: "email" | "code"; email?: string; error?: string; next: string };

export async function sendCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(prev.next);
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ...prev, error: "Digite um e-mail válido." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    return { ...prev, error: error.status === 429 ? "Muitas tentativas. Espere um minuto e tente de novo." : "Não deu para enviar o e-mail. Tente de novo." };
  }
  return { step: "code", email, next };
}

export async function verifyCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  const token = String(formData.get("token") ?? "").replace(/\D/g, "");
  if (!prev.email || token.length < 6) return { ...prev, error: "Digite o código que chegou no e-mail." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: prev.email, token, type: "email" });
  if (error) return { ...prev, error: "Código inválido ou expirado." };
  redirect(safeNext(prev.next));
}

/** Entrar com Google (só aparece com NEXT_PUBLIC_GOOGLE_LOGIN=1). Volta pelo /auth/confirm. */
export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteUrl()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/login?erro=1&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
