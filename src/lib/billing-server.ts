import "server-only";
import type { AsaasPayment } from "./asaas";
import { cycleMonths, type BillingAccount } from "./billing";
import type { AdminClient } from "./supabase/admin";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Acha o grupo de uma cobrança: pela assinatura salva, ou pelo externalReference (= id do grupo). */
export async function accountForPayment(
  admin: AdminClient,
  payment: Pick<AsaasPayment, "subscription" | "externalReference">,
): Promise<{ groupId: string; account: BillingAccount | null } | null> {
  if (payment.subscription) {
    const { data } = await admin
      .from("billing_accounts")
      .select("*")
      .eq("asaas_subscription_id", payment.subscription)
      .maybeSingle<BillingAccount>();
    if (data) return { groupId: data.group_id, account: data };
  }
  const ref = payment.externalReference ?? "";
  if (UUID.test(ref)) {
    const { data: group } = await admin.from("groups").select("id").eq("id", ref).maybeSingle<{ id: string }>();
    if (group) {
      const { data } = await admin.from("billing_accounts").select("*").eq("group_id", ref).maybeSingle<BillingAccount>();
      return { groupId: ref, account: data ?? null };
    }
  }
  return null;
}

/** Libera o grupo pela cobrança paga. Repetir com a mesma cobrança não faz nada. */
export async function applyPayment(admin: AdminClient, groupId: string, account: BillingAccount | null, payment: AsaasPayment) {
  const { data, error } = await admin.rpc("billing_apply_payment", {
    p_payment_id: payment.id,
    p_group_id: groupId,
    p_due_date: payment.dueDate,
    p_months: cycleMonths(account?.cycle ?? "MONTHLY"),
    p_value_cents: Math.round(payment.value * 100),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function revertPayment(admin: AdminClient, paymentId: string) {
  const { error } = await admin.rpc("billing_revert_payment", { p_payment_id: paymentId });
  if (error) throw new Error(error.message);
}
