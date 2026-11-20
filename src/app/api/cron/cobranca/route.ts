import { asaasEnabled, subscriptionPayments } from "@/lib/asaas";
import { PAID_STATUSES, type BillingAccount } from "@/lib/billing";
import { applyPayment } from "@/lib/billing-server";
import { createAdminClient } from "@/lib/supabase/admin";

// Conferência diária (vercel.json): busca no Asaas as cobranças pagas de cada assinatura e
// aplica as que algum aviso (webhook) perdeu. Aplicar de novo uma já aplicada não muda nada.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("não autorizado", { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin || !asaasEnabled()) return Response.json({ ok: false, motivo: "cobrança automática desligada" });

  const { data: accounts } = await admin
    .from("billing_accounts")
    .select("*")
    .not("asaas_subscription_id", "is", null)
    .returns<BillingAccount[]>();

  const { data: done } = await admin.from("billing_payments").select("payment_id");
  const known = new Set((done ?? []).map((p) => p.payment_id as string));

  let aplicadas = 0;
  let erros = 0;
  for (const account of accounts ?? []) {
    try {
      const payments = await subscriptionPayments(account.asaas_subscription_id!);
      for (const p of payments) {
        if (p.deleted || !PAID_STATUSES.includes(p.status) || known.has(p.id)) continue;
        await applyPayment(admin, account.group_id, account, p);
        aplicadas++;
      }
    } catch (e) {
      erros++;
      console.error("conferência asaas", account.group_id, e);
    }
  }
  return Response.json({ ok: true, assinaturas: accounts?.length ?? 0, aplicadas, erros });
}
