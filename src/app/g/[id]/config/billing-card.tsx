import { Badge, Button, Card } from "@/components/ui";
import { PayInstructions } from "@/components/billing-banner";
import { asaasEnabled, asaasSandbox, subscriptionPayments, type AsaasPayment } from "@/lib/asaas";
import { openPayment, type BillingAccount } from "@/lib/billing";
import { formatDay, formatMoney, todayInBrazil } from "@/lib/format";
import { PRICE_CENTS, type SubscriptionState } from "@/lib/subscription";
import type { Group } from "@/lib/types";
import type { createClient } from "@/lib/supabase/server";
import { cancelBilling } from "./billing-actions";
import { SubscribeForm } from "./subscribe-form";

/** Cartão "Assinatura do Sem Panela" nos ajustes: Pix manual ou a assinatura automática do Asaas. */
export async function BillingCard({
  supabase,
  group,
  subscription,
  userName,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  group: Group;
  subscription: SubscriptionState;
  userName: string;
}) {
  const paidLine = (
    <p>
      {subscription.status === "read_only" ? "Venceu em " : "Paga até "}
      <strong>{formatDay(group.paid_until)}</strong>.
    </p>
  );

  if (!asaasEnabled()) {
    return (
      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold">Assinatura do Sem Panela</h2>
        {paidLine}
        <p className="text-neutral-600">
          Para renovar: <PayInstructions groupName={group.name} /> A liberação é feita à mão em até 1 dia útil.
        </p>
      </Card>
    );
  }

  // Antes da migração 20261108120000 a tabela não existe e vem vazio.
  const { data: account } = await supabase
    .from("billing_accounts")
    .select("*")
    .eq("group_id", group.id)
    .maybeSingle<BillingAccount>();
  const active = account?.status === "active" && !!account.asaas_subscription_id;

  let pending: AsaasPayment | null = null;
  if (active) {
    try {
      pending = openPayment(await subscriptionPayments(account.asaas_subscription_id!), todayInBrazil());
    } catch {
      pending = null;
    }
  }

  return (
    <Card className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Assinatura do Sem Panela</h2>
        {active ? <Badge tone="green">Ativa</Badge> : <Badge tone="amber">Sem assinatura</Badge>}
      </div>
      {asaasSandbox() && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">Modo de teste: nenhum pagamento é de verdade.</p>
      )}
      {paidLine}

      {active ? (
        <>
          <p className="text-neutral-600">
            {formatMoney(PRICE_CENTS)} por mês no {account.billing_type === "CREDIT_CARD" ? "cartão de crédito" : "Pix"}, em nome de{" "}
            {account.payer_name}. Quando o pagamento cai, o grupo é liberado na hora.
          </p>
          {pending && (
            <div className="space-y-2 rounded-xl bg-pitch-50 p-3 ring-1 ring-pitch-100">
              <p>
                Cobrança de {formatMoney(Math.round(pending.value * 100))}{" "}
                {pending.status === "OVERDUE" ? "venceu" : "vence"} em <strong>{formatDay(pending.dueDate)}</strong>.
              </p>
              <a className="inline-flex w-full items-center justify-center rounded-xl bg-pitch-700 px-4 py-2.5 font-semibold text-white" href={pending.invoiceUrl}>
                Pagar agora
              </a>
            </div>
          )}
          <details className="text-neutral-600">
            <summary className="cursor-pointer">Trocar forma de pagamento ou cancelar</summary>
            <div className="mt-2 space-y-2">
              <p>
                Para trocar entre Pix e cartão, cancele e assine de novo: o que já foi pago continua valendo. Cancelando, o grupo segue
                liberado até {formatDay(group.paid_until)} e depois fica só leitura.
              </p>
              <form action={cancelBilling}>
                <input type="hidden" name="group_id" value={group.id} />
                <Button variant="danger" type="submit" className="w-full">
                  Cancelar assinatura
                </Button>
              </form>
            </div>
          </details>
        </>
      ) : (
        <>
          <p className="text-neutral-600">
            {formatMoney(PRICE_CENTS)} por mês, por Pix ou cartão. O primeiro vencimento é no fim do período já pago, e o grupo é liberado
            assim que o pagamento cai.
          </p>
          <SubscribeForm
            groupId={group.id}
            defaultName={account?.payer_name || userName}
            label={subscription.status === "read_only" ? "Pagar e liberar o grupo" : `Assinar por ${formatMoney(PRICE_CENTS)}/mês`}
          />
        </>
      )}
    </Card>
  );
}
