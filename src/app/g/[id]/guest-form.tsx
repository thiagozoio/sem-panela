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
  teams,
}: {
  groupId: string;
  gameId: string;
  positions: { value: string; label: string }[];
  /** Times já montados no jogo (vazio = ainda não sorteou). */
  teams: { name: string; count: number }[];
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
        {teams.length > 0 && (
          <div className="col-span-2">
            <Field label="Time" hint="Escolha o time que está faltando gente.">
              <Select name="team" defaultValue="">
                <option value="">O que tem menos gente</option>
                {teams.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.count})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </div>
      <SubmitButton pendingText="Adicionando…">Adicionar convidado</SubmitButton>
      {state.added && <p className="text-sm text-pitch-700">{state.added} ✅</p>}
      <ErrorText>{state.error}</ErrorText>
    </form>
  );
}
