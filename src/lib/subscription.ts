import { daysBetween, todayInBrazil } from "./format";

export const PRICE_CENTS = 1990;
export const GRACE_DAYS = 7;
export const TRIAL_DAYS = 30;

/** O que o plano completo libera além do grátis (lista de presença e sorteio dos times). */
export const PREMIUM_FEATURES = [
  "Financeiro: mensalidades, avulsos, gastos e caixa",
  "Times fixos do mês",
  "Placar, gols e notas dos jogadores",
  "Tabela de classificação e campeões",
  "Amistosos contra outros times",
];

export type SubscriptionState =
  | { status: "ok"; daysLeft: number }
  | { status: "due_soon"; daysLeft: number }
  | { status: "grace"; daysLeft: number }
  | { status: "free"; daysLeft: number };

/**
 * Plano do grupo a partir do "pago até" (mesma regra do banco, is_premium: 7 dias de carência).
 * Depois disso o grupo fica no plano grátis: só lista de presença e sorteio.
 */
export function subscriptionState(paidUntil: string, today: string): SubscriptionState {
  const daysLeft = daysBetween(today, paidUntil);
  if (daysLeft >= 7) return { status: "ok", daysLeft };
  if (daysLeft >= 0) return { status: "due_soon", daysLeft };
  if (daysLeft >= -GRACE_DAYS) return { status: "grace", daysLeft };
  return { status: "free", daysLeft };
}

/** Ainda nos 30 dias de teste: o "pago até" nunca foi estendido desde a criação do grupo. */
export function isTrial(createdAt: string, paidUntil: string): boolean {
  return daysBetween(todayInBrazil(new Date(createdAt)), paidUntil) <= TRIAL_DAYS;
}
