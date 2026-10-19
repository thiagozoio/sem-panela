"use client";

import { useActionState } from "react";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import type { Championship } from "@/lib/standings";
import { saveChampionship } from "../actions";

/** Cria um campeonato ou, com `championship`, muda nome e datas. */
export function ChampionshipForm({
  groupId,
  championship,
  suggestion,
}: {
  groupId: string;
  championship?: Championship;
  suggestion?: { name: string; starts_on: string; ends_on: string };
}) {
  const [state, action] = useActionState(saveChampionship, {});
  const initial = championship ?? suggestion;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="group_id" value={groupId} />
      {championship && <input type="hidden" name="championship_id" value={championship.id} />}
      <Field label="Nome">
        <Input name="name" defaultValue={initial?.name} placeholder="1º turno 2026" maxLength={60} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Começa em">
          <Input name="starts_on" type="date" defaultValue={initial?.starts_on} required />
        </Field>
        <Field label="Termina em">
          <Input name="ends_on" type="date" defaultValue={initial?.ends_on} required />
        </Field>
      </div>
      <ErrorText>{state.error}</ErrorText>
      {state.ok && championship && <p className="rounded-xl bg-pitch-50 px-3 py-2 text-sm text-pitch-900">Salvo!</p>}
      <SubmitButton className="w-full">{championship ? "Salvar campeonato" : "Criar campeonato"}</SubmitButton>
    </form>
  );
}
