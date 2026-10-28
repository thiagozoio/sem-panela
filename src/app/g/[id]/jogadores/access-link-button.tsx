"use client";

import { useActionState } from "react";
import { buttonStyles, ErrorText } from "@/components/ui";
import { CopyField } from "@/components/share";
import { SubmitButton } from "@/components/submit";
import { whatsappLink } from "@/lib/format";
import { whatsappTo } from "@/lib/matches";
import { accessMessage } from "@/lib/player-link";
import { createAccessLink } from "../actions";

/** Organizador manda ao jogador um link pessoal: ele entra sem e-mail nem código. */
export function AccessLinkButton({ memberId, memberName, groupName, phone }: { memberId: string; memberName: string; groupName: string; phone: string }) {
  const [state, action] = useActionState(createAccessLink, {});

  if (state.url) {
    const text = accessMessage(memberName, groupName, state.url);
    return (
      <div className="space-y-2">
        <a href={whatsappTo(phone, text) || whatsappLink(text)} target="_blank" rel="noreferrer" className={`${buttonStyles.primary} w-full`}>
          Mandar no WhatsApp{phone ? "" : " (escolha o contato)"}
        </a>
        <CopyField value={state.url} />
        <p className="text-xs text-neutral-500">Vale por 7 dias. Se gerar outro, este para de funcionar.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="member_id" value={memberId} />
      <SubmitButton variant="secondary" pendingText="Gerando…">📲 Enviar acesso pelo WhatsApp</SubmitButton>
      <p className="text-xs text-neutral-500">Um link só dessa pessoa: ela toca e já entra, sem e-mail nem código.</p>
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
