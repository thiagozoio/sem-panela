// Link pessoal de acesso do jogador (sem e-mail). A conta criada pelo link usa um
// e-mail interno que nunca recebe mensagens; ele só serve de chave para o Supabase.

export const LINK_EMAIL_DOMAIN = "jogador.sempanela.app.br";

export function linkEmail(memberId: string): string {
  return `${memberId}@${LINK_EMAIL_DOMAIN}`;
}

export function isLinkEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${LINK_EMAIL_DOMAIN}`);
}

/** Só aceita o formato que o banco gera (64 caracteres hexadecimais). */
export function isLinkToken(token: string): boolean {
  return /^[0-9a-f]{64}$/.test(token);
}

/** Texto pronto para o organizador mandar no WhatsApp. */
export function accessMessage(memberName: string, groupName: string, url: string): string {
  const first = memberName.trim().split(/\s+/)[0] || "jogador";
  return (
    `Oi, ${first}! Esse é o seu acesso à pelada ${groupName} no Sem Panela. ` +
    `É só tocar no link, não precisa de senha nem e-mail:\n${url}\n\n` +
    `O link é só seu, não repasse. Vale por 7 dias.`
  );
}
