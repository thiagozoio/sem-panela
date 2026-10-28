"use client";

import { useActionState } from "react";
import { Card, ErrorText, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { pushMessage, pushPending } from "./actions";

/** Avisos no celular que o organizador manda na hora. */
export function OrganizerPush({ groupId, gameId, pending }: { groupId: string; gameId: string; pending: number }) {
  const [pendingState, pendingAction] = useActionState(pushPending, {});
  const [messageState, messageAction] = useActionState(pushMessage, {});
  return (
    <Card>
      <details>
        <summary className="cursor-pointer font-semibold">🔔 Avisar no celular</summary>
        <div className="mt-3 space-y-4 text-sm">
          <form action={pendingAction} className="space-y-2">
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="game_id" value={gameId} />
            <p className="text-neutral-600">Lembrete para quem ainda não disse se vai ({pending}).</p>
            <SubmitButton variant="secondary" pendingText="Enviando…" disabled={pending === 0}>
              Cobrar resposta
            </SubmitButton>
            {pendingState.message && <p className="text-pitch-700">{pendingState.message}</p>}
            <ErrorText>{pendingState.error}</ErrorText>
          </form>
          <form action={messageAction} className="space-y-2 border-t border-neutral-100 pt-3">
            <input type="hidden" name="group_id" value={groupId} />
            <p className="text-neutral-600">Recado para todos os jogadores.</p>
            <Input name="text" maxLength={200} placeholder="Ex.: Jogo cancelado por causa da chuva" required />
            <SubmitButton variant="secondary" pendingText="Enviando…">
              Mandar recado
            </SubmitButton>
            {messageState.message && <p className="text-pitch-700">{messageState.message}</p>}
            <ErrorText>{messageState.error}</ErrorText>
          </form>
          <p className="text-xs text-neutral-500">Só chega para quem ativou os avisos no Sem Panela.</p>
        </div>
      </details>
    </Card>
  );
}
