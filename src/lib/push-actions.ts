"use server";

import { getSessionUser } from "./auth";
import { createClient } from "./supabase/server";
import { sendPush } from "./push";

type BrowserSubscription = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Liga os avisos deste aparelho para o usuário logado. */
export async function savePushSubscription(sub: BrowserSubscription, userAgent: string): Promise<boolean> {
  const session = await getSessionUser();
  if (!session || !sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) return false;
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
    p_user_agent: userAgent.slice(0, 300),
  });
  return !error;
}

/** Desliga os avisos deste aparelho (a RLS só deixa apagar as próprias inscrições). */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

/** Notificação de teste para os aparelhos do próprio usuário. */
export async function sendTestPush(): Promise<boolean> {
  const session = await getSessionUser();
  if (!session) return false;
  const sent = await sendPush([session.id], {
    title: "Sem Panela",
    body: "Pronto! Os avisos da pelada vão chegar assim. ⚽",
    url: "/grupos",
    tag: "teste",
  });
  return sent > 0;
}
