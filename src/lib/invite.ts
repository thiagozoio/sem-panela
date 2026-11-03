// Convite para a pelada (/convite/<código>). Quem abre o link ainda sem login ganha
// um cookie com o código; assim, se o "next" se perder no caminho (e-mail aberto em
// outro navegador, app instalado, link pessoal do WhatsApp), o app ainda leva a
// pessoa de volta ao convite depois que ela entra.

export const INVITE_COOKIE = "sp_convite";
export const INVITE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

/** Códigos gerados pelo banco: 10 caracteres hexadecimais. Aceita um pouco de folga. */
export function isInviteCode(code: unknown): code is string {
  return typeof code === "string" && /^[0-9a-z]{6,32}$/i.test(code);
}

/** Código do convite no caminho /convite/<código>, ou null. */
export function inviteCodeFromPath(pathname: string): string | null {
  const m = /^\/convite\/([^/?#]+)\/?$/.exec(pathname);
  return m && isInviteCode(m[1]) ? m[1] : null;
}

/** Aceita o link inteiro colado (com ou sem https://) ou só o código. */
export function inviteCodeFromText(text: string): string | null {
  const t = text.trim();
  const m = /\/convite\/([0-9a-z]+)/i.exec(t);
  if (m) return isInviteCode(m[1]) ? m[1] : null;
  return isInviteCode(t) ? t : null;
}
