import type { AsaasPayment } from "@/lib/asaas";
import { sameSecret, webhookAction } from "@/lib/billing";
import { accountForPayment, applyPayment, revertPayment } from "@/lib/billing-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Aviso do Asaas (Integrações > Webhooks): pagamento caiu, foi estornado ou a assinatura acabou.
// O Asaas manda o token cadastrado no cabeçalho asaas-access-token; sem ele, recusa.
// Responder rápido e com 200: se o endereço falhar muitas vezes o Asaas pausa a fila.

export const dynamic = "force-dynamic";

type AsaasEvent = {
  id?: string;
  event?: string;
  payment?: AsaasPayment;
  subscription?: { id: string; externalReference?: string | null };
};

export async function POST(request: Request) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN ?? "";
  if (!sameSecret(request.headers.get("asaas-access-token") ?? "", token)) {
    return new Response("não autorizado", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return new Response("falta SUPABASE_SECRET_KEY", { status: 500 });

  let body: AsaasEvent;
  try {
    body = (await request.json()) as AsaasEvent;
  } catch {
    return new Response("json inválido", { status: 400 });
  }
  const type = body.event ?? "";
  const eventId = body.id ?? `${type}:${body.payment?.id ?? body.subscription?.id ?? Date.now()}`;

  // Aviso repetido (o Asaas reenvia quando não recebe 200): já tratado.
  const { data: seen } = await admin.from("billing_events").select("event_id").eq("event_id", eventId).maybeSingle();
  if (seen) return Response.json({ ok: true, repetido: true });

  let groupId: string | null = null;
  try {
    const action = webhookAction(type);
    if ((action === "apply" || action === "revert") && body.payment) {
      const found = await accountForPayment(admin, body.payment);
      groupId = found?.groupId ?? null;
      if (found && action === "apply") await applyPayment(admin, found.groupId, found.account, body.payment);
      if (action === "revert") await revertPayment(admin, body.payment.id);
    } else if (action === "cancel" && body.subscription?.id) {
      const { data } = await admin
        .from("billing_accounts")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("asaas_subscription_id", body.subscription.id)
        .select("group_id")
        .maybeSingle<{ group_id: string }>();
      groupId = data?.group_id ?? null;
    }
  } catch (e) {
    // Sem gravar o aviso: o Asaas manda de novo e a conferência diária também pega.
    console.error("webhook asaas", type, e);
    return new Response("erro ao processar", { status: 500 });
  }

  await admin.from("billing_events").insert({
    event_id: eventId,
    type,
    payment_id: body.payment?.id ?? null,
    group_id: groupId,
    payload: body,
  });
  return Response.json({ ok: true });
}
