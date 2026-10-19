"use client";

import { useActionState } from "react";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { WEEKDAYS } from "@/lib/format";
import { SPORTS, sportOf } from "@/lib/sports";
import type { Group } from "@/lib/types";
import { saveSettings } from "../actions";

const money = (cents: number) => (cents ? (cents / 100).toFixed(2).replace(".", ",") : "");

export function SettingsForm({ group, disabled }: { group: Group; disabled: boolean }) {
  const [state, action] = useActionState(saveSettings, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="group_id" value={group.id} />
      <fieldset disabled={disabled} className="space-y-4">
        <Field label="Nome da pelada">
          <Input name="name" defaultValue={group.name} minLength={2} maxLength={60} required />
        </Field>
        <Field label="Local">
          <Input name="location" defaultValue={group.location} maxLength={120} />
        </Field>
        <Field label="Modalidade" hint="Muda as posições que aparecem para os jogadores.">
          <Select name="sport" defaultValue={sportOf(group.sport)}>
            {SPORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia">
            <Select name="weekday" defaultValue={group.weekday}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </Select>
          </Field>
          <Field label="Horário">
            <Input name="start_time" type="time" defaultValue={group.start_time.slice(0, 5)} required />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-neutral-500">Mudar dia ou horário abre uma lista nova para o próximo jogo.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vagas por jogo">
            <Input name="max_players" type="number" min={4} max={80} defaultValue={group.max_players} />
          </Field>
          <Field label="Jogadores por time" hint={sportOf(group.sport) === "volei" ? "Em quadra, por time." : "Com o goleiro."}>
            <Input name="players_per_team" type="number" min={2} max={11} defaultValue={group.players_per_team} />
          </Field>
        </div>
        <Field
          label="Prioridade dos mensalistas (horas antes do jogo)"
          hint="Mensalista que confirmar até esse prazo passa na frente dos avulsos. 0 = sem prioridade."
        >
          <Input name="priority_hours" type="number" min={0} max={168} defaultValue={group.priority_hours} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mensalidade (R$)">
            <Input name="monthly_fee" inputMode="decimal" placeholder="80,00" defaultValue={money(group.monthly_fee_cents)} />
          </Field>
          <Field label="Avulso por jogo (R$)">
            <Input name="single_fee" inputMode="decimal" placeholder="25,00" defaultValue={money(group.single_fee_cents)} />
          </Field>
        </div>
        <Field label="Sua chave Pix" hint="Vai na mensagem de cobrança da turma.">
          <Input name="pix_key" defaultValue={group.pix_key} maxLength={140} />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        {state.ok && <p className="rounded-xl bg-pitch-50 px-3 py-2 text-sm text-pitch-900">Salvo!</p>}
        <SubmitButton className="w-full">Salvar ajustes</SubmitButton>
      </fieldset>
    </form>
  );
}
