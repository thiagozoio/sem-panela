import Link from "next/link";
import { buttonStyles, Card } from "./ui";
import { WhatsAppLink } from "./share";
import { SUPPORT_EMAIL, supportMailto, supportSubject, supportWhatsAppLink } from "@/lib/support";

/** Cartão "Ajuda e suporte" com botão de e-mail e, se configurado, de WhatsApp. */
export function SupportCard({ groupName, text }: { groupName?: string; text?: string }) {
  const whatsapp = supportWhatsAppLink(groupName);
  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Ajuda e suporte</h2>
      <p className="text-sm text-neutral-600">
        {text ?? "Veja o passo a passo de como usar e instalar no celular. Dúvidas, problemas ou sugestões? Fale com a gente, respondemos o quanto antes."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link className={buttonStyles.secondary} href="/como-usar">
          📖 Como usar o app
        </Link>
        <a className={buttonStyles.secondary} href={supportMailto(supportSubject(groupName))}>
          ✉️ Falar com o suporte
        </a>
        {whatsapp && (
          <WhatsAppLink href={whatsapp} className={buttonStyles.secondary}>
            💬 WhatsApp do suporte
          </WhatsAppLink>
        )}
      </div>
      <p className="text-xs text-neutral-500">
        Ou escreva para <span className="font-medium">{SUPPORT_EMAIL}</span>.
      </p>
    </Card>
  );
}

/** Link curto para rodapés ("Dúvidas e sugestões"). */
export function SupportFooterLink({ groupName, label = "Dúvidas e sugestões" }: { groupName?: string; label?: string }) {
  return (
    <a href={supportMailto(supportSubject(groupName))} className="underline">
      {label}
    </a>
  );
}
