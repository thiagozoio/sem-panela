import "server-only";
import { headers } from "next/headers";

/** URL pública do app (NEXT_PUBLIC_SITE_URL ou o host da requisição). */
export async function siteUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  return requestOrigin();
}

/**
 * Endereço que a pessoa está usando agora (ex.: o app antigo instalado em sempanela.app.br).
 * O login com Google guarda um cookie neste endereço e precisa voltar para o mesmo lugar.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
