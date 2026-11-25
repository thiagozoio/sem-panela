import { APP_NAME } from "./brand";

/** Contato do suporte do Coletinho (e-mail sempre; WhatsApp só se a variável estiver preenchida). */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "suporte@coletinho.com.br";
/** Só números, com 55 e DDD (ex.: 5511999999999). Vazio = botão do WhatsApp escondido. */
export const SUPPORT_WHATSAPP = (process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "").replace(/\D/g, "");

/** Assunto do e-mail, com o nome da pelada quando houver. */
export function supportSubject(groupName?: string, topic = "Dúvida ou sugestão"): string {
  return groupName ? `${topic} - ${groupName}` : `${topic} - ${APP_NAME}`;
}

export function supportMailto(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/** Link wa.me para o número do suporte, ou null se não houver número. */
export function supportWhatsAppLink(groupName?: string): string | null {
  if (!SUPPORT_WHATSAPP) return null;
  const text = groupName ? `Oi! Sou da pelada "${groupName}" no ${APP_NAME}. ` : `Oi! Tenho uma dúvida sobre o ${APP_NAME}. `;
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}`;
}
