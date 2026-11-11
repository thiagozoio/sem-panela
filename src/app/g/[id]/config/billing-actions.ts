"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  AsaasError,
  asaasEnabled,
  cancelSubscription,
  createCustomer,
  createSubscription,
  subscriptionPayments,
  updateCustomer,
} from "@/lib/asaas";
import { firstDueDate, isValidCpfCnpj, onlyDigits, openPayment, type BillingAccount, type BillingType } from "@/lib/billing";
import { todayInBrazil } from "@/lib/format";
import { getGroupContext } from "@/lib/groups";
import { PRICE_CENTS } from "@/lib/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

export type SubscribeState = { error?: string };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/** "Assinar": cria o cliente e a assinatura no Asaas e leva o organizador à página de pagamento. */
export async function subscribe(_prev: SubscribeState, fd: FormData): Promise<SubscribeState> {
  const groupId = str(fd, "group_id");
  const name = str(fd, "payer_name");
  const doc = onlyDigits(str(fd, "payer_doc"));
  const billingType: BillingType = str(fd, "billing_type") === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX";

  const { group, isOrganizer, user } = await getGroupContext(groupId);
  if (!isOrganizer) return { error: "Só o organizador assina." };
  if (name.length < 3) return { error: "Informe o nome completo de quem paga." };
  if (!isValidCpfCnpj(doc)) return { error: "CPF ou CNPJ inválido." };
  const admin = createAdminClient();
  if (!asaasEnabled() || !admin) return { error: "Pagamento automático ainda não está ligado. Use o Pix abaixo." };

  let invoiceUrl: string | null = null;
  try {
    const { data: existing } = await admin
      .from("billing_accounts")
      .select("*")
      .eq("group_id", group.id)
      .maybeSingle<BillingAccount>();

    // Já tem assinatura ativa: só abre a cobrança em aberto.
    if (existing?.status === "active" && existing.asaas_subscription_id) {
      invoiceUrl = openPayment(await subscriptionPayments(existing.asaas_subscription_id), todayInBrazil())?.invoiceUrl ?? null;
    } else {
      const customer = existing?.asaas_customer_id
        ? (await updateCustomer(existing.asaas_customer_id, { name, cpfCnpj: doc, email: user.email })).id
        : (await createCustomer({ name, cpfCnpj: doc, email: user.email, externalReference: group.id })).id;

      const sub = await createSubscription({
        customer,
        billingType,
        value: PRICE_CENTS / 100,
        nextDueDate: firstDueDate(group.paid_until, todayInBrazil()),
        cycle: "MONTHLY",
        description: `Sem Panela · ${group.name}`,
        externalReference: group.id,
      });

      const { error } = await admin.from("billing_accounts").upsert({
        group_id: group.id,
        asaas_customer_id: customer,
        asaas_subscription_id: sub.id,
        billing_type: billingType,
        cycle: "MONTHLY",
        status: "active",
        payer_name: name,
        payer_doc: doc,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        // Sem salvar não dá para ligar o pagamento ao grupo: desfaz no Asaas.
        await cancelSubscription(sub.id).catch(() => {});
        throw new Error(error.message);
      }
      invoiceUrl = openPayment(await subscriptionPayments(sub.id), todayInBrazil())?.invoiceUrl ?? null;
    }
  } catch (e) {
    console.error("assinar", group.id, e);
    return { error: e instanceof AsaasError ? `O Asaas recusou: ${e.message}` : "Não deu para criar a assinatura. Tente de novo." };
  }

  if (invoiceUrl) redirect(invoiceUrl);
  refresh();
  return {};
}

/** Cancela a assinatura: o grupo segue liberado até o "pago até" e depois fica só leitura. */
export async function cancelBilling(fd: FormData) {
  const groupId = str(fd, "group_id");
  const { group, isOrganizer } = await getGroupContext(groupId);
  const admin = createAdminClient();
  if (!isOrganizer || !admin) return;
  const { data: account } = await admin
    .from("billing_accounts")
    .select("*")
    .eq("group_id", group.id)
    .maybeSingle<BillingAccount>();
  if (!account?.asaas_subscription_id || account.status !== "active") return;
  try {
    await cancelSubscription(account.asaas_subscription_id);
  } catch (e) {
    // Já apagada no Asaas: segue e marca como cancelada aqui.
    if (!(e instanceof AsaasError && e.status === 404)) throw e;
  }
  await admin
    .from("billing_accounts")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("group_id", group.id);
  refresh();
}
