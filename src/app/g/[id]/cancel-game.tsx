"use client";

import { useActionState } from "react";
import { Card, ErrorText, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { cancelGame, restoreGame } from "./actions";

type Props = { groupId: string; gameId: string; push: boolean };

/** Organizador: cancelar o jogo (chuva, quadra fechada, pouca gente). */
export function CancelGameForm({ groupId, gameId, push }: Props) {
  const [state, action] = useActionState(cancelGame, {});
  return (
    <Card>
      <details>
        <summary className="cursor-pointer font-semibold">❌ Cancelar este jogo</summary>
        <form action={action} className="mt-3 space-y-3 text-sm">
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="game_id" value={gameId} />
          <p className="text-neutral-600">
            A lista fecha, o jogo não conta na tabela e ninguém paga avulso por ele. A presença de quem já confirmou fica
            guardada: se o jogo voltar, é só desfazer.
          </p>
          <label className="block">
            <span className="block text-neutral-600">Motivo (opcional)</span>
            <Input name="reason" maxLength={120} placeholder="Ex.: chuva, quadra fechada, pouca gente" />
          </label>
          {push && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="notify" value="1" defaultChecked className="size-4 accent-pitch-700" />
              Avisar os jogadores no celular
            </label>
          )}
          <SubmitButton variant="danger" pendingText="Cancelando…">
            Cancelar o jogo
          </SubmitButton>
          <ErrorText>{state.error}</ErrorText>
        </form>
      </details>
    </Card>
  );
}

/** Organizador: o jogo voltou. */
export function RestoreGameForm({ groupId, gameId, push }: Props) {
  const [state, action] = useActionState(restoreGame, {});
  return (
    <form action={action} className="space-y-2 border-t border-red-100 pt-3 text-sm">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="game_id" value={gameId} />
      {push && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="notify" value="1" defaultChecked className="size-4 accent-pitch-700" />
          Avisar os jogadores que o jogo voltou
        </label>
      )}
      <SubmitButton variant="secondary" pendingText="Desfazendo…">
        Desfazer cancelamento
      </SubmitButton>
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
