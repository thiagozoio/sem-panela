/** Contato do suporte do Sem Panela (e-mail sempre; WhatsApp só se a variável estiver preenchida). */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "suporte@sempanela.app.br";
/** Só números, com 55 e DDD (ex.: 5511999999999). Vazio = botão do WhatsApp escondido. */
export const SUPPORT_WHATSAPP = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");

/** Assunto do e-mail, com o nome da pelada quando houver. */
export function supportSubject(groupName?: string, topic = "Dúvida ou sugestão"): string {
  return groupName ? `${topic} - ${groupName}` : `${topic} - Sem Panela`;
}

export function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/** Link wa.me para o número do suporte, ou null se não houver número. */
export function supportWhatsAppLink(groupName?: string): string | null {
  if (!SUPPORT_WHATSAPP) return null;
  const text = groupName ? `Oi! Sou da pelada "${groupName}" no Sem Panela. ` : "Oi! Tenho uma dúvida sobre o Sem Panela. ";
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
}
