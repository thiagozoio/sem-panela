"use client";

import { useActionState, useState } from "react";
import { ErrorText, Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { DECIDED_BY, decidedByOf, type Championship, type DecidedBy } from "@/lib/standings";
import { saveChampionshipFinal } from "../actions";

/** Como sai o campeão do campeonato: tabela, jogo final ou escolhido à mão. */
export function FinalForm({
  groupId,
  championship,
  games,
  players,
}: {
  groupId: string;
  championship: Championship;
  games: { id: string; label: string }[];
  players: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(saveChampionshipFinal, {});
  const [mode, setMode] = useState<DecidedBy>(decidedByOf(championship.decided_by));
  const chosen = new Set(championship.champion_ids ?? []);
  return (
    <form action={action} className="space-y-3 rounded-xl bg-neutral-50 p-3">
      <input type="hidden" name="group_id" value={groupId} />
      <input type="hidden" name="championship_id" value={championship.id} />
      <Field label="Como sai o campeão">
        <Select name="decided_by" value={mode} onChange={(e) => setMode(decidedByOf(e.target.value))}>
          {DECIDED_BY.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
      </Field>

      {mode === "final" && (
        <Field label="Jogo da final" hint="Quem vencer esse jogo é o campeão. O jogo final não conta pontos na tabela.">
          <Select name="final_game_id" defaultValue={championship.final_game_id ?? ""}>
            <option value="">Escolha o jogo</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {mode === "manual" && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-neutral-700">Campeão (pode marcar mais de um)</legend>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {players.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="champion_ids"
                  value={p.id}
                  defaultChecked={chosen.has(p.id)}
                  className="size-4 accent-pitch-700"
                />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <ErrorText>{state.error}</ErrorText>
      {state.ok && <p className="rounded-xl bg-pitch-50 px-3 py-2 text-sm text-pitch-900">Salvo!</p>}
      <SubmitButton variant="secondary" className="w-full">
        Salvar como sai o campeão
      </SubmitButton>
    </form>
  );
}
