import { daysBetween } from "./format";

export const PRICE_CENTS = 1990;
export const GRACE_DAYS = 7;

export type SubscriptionState =
  | { status: "ok"; daysLeft: number }
  | { status: "due_soon"; daysLeft: number }
  | { status: "grace"; daysLeft: number }
  | { status: "read_only"; daysLeft: number };

/** Estado da assinatura do grupo a partir do "pago até" (mesma regra do banco: 7 dias de carência). */
export function subscriptionState(paidUntil: string, today: string): SubscriptionState {
  const daysLeft = daysBetween(today, paidUntil);
  if (daysLeft >= 7) return { status: "ok", daysLeft };
  if (daysLeft >= 0) return { status: "due_soon", daysLeft };
  if (daysLeft >= -GRACE_DAYS) return { status: "grace", daysLeft };
  return { status: "read_only", daysLeft };
}
