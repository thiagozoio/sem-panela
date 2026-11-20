/**
 * Só aceita caminhos internos para evitar redirecionamento aberto. Barra "//site" e
 * "/\site" (o navegador trata a barra invertida como "/"), além de caracteres de controle.
 */
export function safeNext(next: unknown, fallback = "/grupos"): string {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
