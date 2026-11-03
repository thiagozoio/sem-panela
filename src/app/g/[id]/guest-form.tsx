"use client";

import { useActionState } from "react";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { addGuest } from "./actions";

const SKILLS = ["1 · Iniciante", "2 · Fraco", "3 · Médio", "4 · Bom", "5 · Craque"];

/** Formulário para pôr um convidado só neste jogo. */
export function GuestForm({
  groupId,
  gameId,
  positions,
  singleFee,
}: {
  groupId: string;
  gameId: string;
  positions: { value: string; label: string }[];
  singleFee: string;
}) {
  const [state, action] = useActionState(addGuest, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="game_id" value={gameId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Nome do convidado">
            <Input name="name" maxLength={60} placeholder="Ex.: Pedro (amigo do João)" required />
          </Field>
        </div>
        <Field label="Posição">
          <Select name="position" defaultValue="linha">
            {positions.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Nível">
          <Select name="skill" defaultValue={3}>
            {SKILLS.map((l, i) => (
              <option key={l} value={i + 1}>{l}</option>
            ))}
          </Select>
        </Field>
        <div className="col-span-2">
          <Field label="Pagamento">
            <Select name="exempt" defaultValue="0">
              <option value="0">Paga o avulso do jogo{singleFee ? ` (${singleFee})` : ""}</option>
              <option value="1">Não paga (isento)</option>
            </Select>
          </Field>
        </div>
      </div>
      <SubmitButton pendingText="Adicionando…">Adicionar convidado</SubmitButton>
      {state.added && <p className="text-sm text-pitch-700">{state.added} entrou na lista ✅</p>}
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
