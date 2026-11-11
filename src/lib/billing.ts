// Regras da cobrança automática (Asaas) que não dependem de rede, para testar à parte.

export type BillingType = "PIX" | "CREDIT_CARD";
export type BillingCycle = "MONTHLY" | "YEARLY";

export type BillingAccount = {
  group_id: string;
  asaas_customer_id: string;
  asaas_subscription_id: string | null;
  billing_type: BillingType;
  cycle: BillingCycle;
  status: "active" | "canceled";
  payer_name: string;
  payer_doc: string;
};

/** Endereço da API pelo tipo da chave: `$aact_hmlg_` é do sandbox, o resto é produção. */
export function asaasBaseUrl(apiKey: string, override?: string): string {
  if (override) return override.replace(/\/$/, "");
  return apiKey.includes("_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
}

export const onlyDigits = (v: string) => v.replace(/\D/g, "");

/** CPF (11 dígitos) ou CNPJ (14) com dígitos verificadores válidos. */
export function isValidCpfCnpj(input: string): boolean {
  const d = onlyDigits(input);
  if (d.length === 11) return validCpf(d);
  if (d.length === 14) return validCnpj(d);
  return false;
}

function validCpf(d: string): boolean {
  if (/^(\d)\1{10}$/.test(d)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(d[9]) && digit(10) === Number(d[10]);
}

function validCnpj(d: string): boolean {
  if (/^(\d)\1{13}$/.test(d)) return false;
  const digit = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + Number(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return digit(12) === Number(d[12]) && digit(13) === Number(d[13]);
}

/** Meses que uma cobrança paga libera. */
export const cycleMonths = (cycle: BillingCycle) => (cycle === "YEARLY" ? 12 : 1);

/** O que o app faz com cada aviso do Asaas. */
export type WebhookAction = "apply" | "revert" | "cancel" | "ignore";

export function webhookAction(event: string): WebhookAction {
  switch (event) {
    case "PAYMENT_RECEIVED":
    case "PAYMENT_CONFIRMED":
      return "apply";
    case "PAYMENT_REFUNDED":
    case "PAYMENT_PARTIALLY_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_RECEIVED_IN_CASH_UNDONE":
    case "PAYMENT_DELETED":
      return "revert";
    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_INACTIVATED":
      return "cancel";
    default:
      return "ignore";
  }
}

/** Situações de cobrança que contam como paga (usadas na conferência diária). */
export const PAID_STATUSES = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

/** Primeiro vencimento de uma assinatura nova: o "pago até" atual, ou hoje se já venceu. */
export function firstDueDate(paidUntil: string, today: string): string {
  return paidUntil > today ? paidUntil : today;
}

/** Compara o token do webhook sem vazar o tamanho/conteúdo pelo tempo de resposta. */
export function sameSecret(a: string, b: string): boolean {
  if (!a || !b) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/**
 * A cobrança que o organizador deve pagar agora: a do ciclo atual (a mais recente já vencida
 * ou vencendo hoje) ou, se nenhuma venceu ainda, a próxima.
 */
export function openPayment<T extends { status: string; dueDate: string; deleted?: boolean }>(
  payments: T[],
  today: string,
): T | null {
  const open = payments
    .filter((p) => !p.deleted && (p.status === "PENDING" || p.status === "OVERDUE"))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const due = open.filter((p) => p.dueDate <= today);
  return due.at(-1) ?? open[0] ?? null;
}
