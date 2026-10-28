import "server-only";
import webpush from "web-push";
import { createAdminClient, type AdminClient } from "./supabase/admin";
import type { PushPayload } from "./notifications";

export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

let configured = false;

/** Configura as chaves VAPID; false quando faltam variáveis (os avisos ficam desligados). */
function setup(): boolean {
  if (configured) return true;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!VAPID_PUBLIC_KEY || !privateKey) return false;
  const contact = process.env.VAPID_SUBJECT ?? "mailto:nao-responda@sempanela.app.br";
  webpush.setVapidDetails(contact, VAPID_PUBLIC_KEY, privateKey);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return !!VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY && !!createAdminClient();
}

type Subscription = { endpoint: string; user_id: string; p256dh: string; auth: string };

/**
 * Manda o aviso para todos os aparelhos dos usuários. Cada usuário pode receber um texto
 * diferente (payloadFor). Aparelhos que desinstalaram o app ou bloquearam os avisos são apagados.
 * Devolve quantos aparelhos receberam.
 */
export async function sendPush(
  userIds: string[],
  payloadFor: PushPayload | ((userId: string) => PushPayload | null),
  admin: AdminClient | null = createAdminClient(),
): Promise<number> {
  const ids = [...new Set(userIds)];
  if (!ids.length || !admin || !setup()) return 0;
  const { data } = await admin
    .from("push_subscriptions")
    .select("endpoint, user_id, p256dh, auth")
    .in("user_id", ids)
    .returns<Subscription[]>();
  if (!data?.length) return 0;

  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    data.map(async (sub) => {
      const payload = typeof payloadFor === "function" ? payloadFor(sub.user_id) : payloadFor;
      if (!payload) return;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12, urgency: "normal" },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(sub.endpoint);
        else console.error("push falhou", status, (err as Error).message);
      }
    }),
  );
  if (gone.length) await admin.from("push_subscriptions").delete().in("endpoint", gone);
  return sent;
}
