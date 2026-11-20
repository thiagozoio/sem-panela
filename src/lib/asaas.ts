import "server-only";
import { asaasBaseUrl, type BillingCycle, type BillingType } from "./billing";

// Cliente mínimo da API do Asaas (https://docs.asaas.com). A chave só existe no servidor.
// Sem ASAAS_API_KEY a cobrança automática fica desligada e o app mostra o Pix manual.

export function asaasEnabled(): boolean {
  return !!process.env.ASAAS_API_KEY;
}

export function asaasSandbox(): boolean {
  return (process.env.ASAAS_API_KEY ?? "").includes("_hmlg_");
}

export class AsaasError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new AsaasError("cobrança automática desligada (falta ASAAS_API_KEY)", 0);
  const res = await fetch(`${asaasBaseUrl(key, process.env.ASAAS_API_URL)}${path}`, {
    method,
    headers: {
      access_token: key,
      "Content-Type": "application/json",
      // O Asaas exige User-Agent nas contas novas.
      "User-Agent": "SemPanela",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = Array.isArray(data?.errors) && data.errors[0]?.description ? data.errors[0].description : `erro ${res.status}`;
    throw new AsaasError(msg, res.status);
  }
  return data as T;
}

export type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string | null;
  value: number;
  netValue?: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  invoiceUrl: string;
  externalReference?: string | null;
  deleted?: boolean;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  nextDueDate: string;
  externalReference?: string | null;
  deleted?: boolean;
};

type List<T> = { data: T[]; hasMore: boolean };

export function createCustomer(input: { name: string; cpfCnpj: string; email: string; externalReference: string }) {
  return call<{ id: string }>("POST", "/customers", { ...input, notificationDisabled: false });
}

export function updateCustomer(id: string, input: { name: string; cpfCnpj: string; email: string }) {
  return call<{ id: string }>("POST", `/customers/${encodeURIComponent(id)}`, input);
}

export function createSubscription(input: {
  customer: string;
  billingType: BillingType;
  value: number;
  nextDueDate: string;
  cycle: BillingCycle;
  description: string;
  externalReference: string;
}) {
  return call<AsaasSubscription>("POST", "/subscriptions", input);
}

export function cancelSubscription(id: string) {
  return call<{ deleted: boolean }>("DELETE", `/subscriptions/${encodeURIComponent(id)}`);
}

export async function subscriptionPayments(id: string): Promise<AsaasPayment[]> {
  const res = await call<List<AsaasPayment>>("GET", `/subscriptions/${encodeURIComponent(id)}/payments?limit=100`);
  return res.data ?? [];
}

export function getPayment(id: string) {
  return call<AsaasPayment>("GET", `/payments/${encodeURIComponent(id)}`);
}

