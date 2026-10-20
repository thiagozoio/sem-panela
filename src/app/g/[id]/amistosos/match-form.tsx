"use client";

import { useActionState } from "react";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { toBrazilInputs } from "@/lib/matches";
import type { Match } from "@/lib/types";
import { saveMatch } from "../actions";

/** Marca um amistoso ou, com `match`, muda os dados dele. */
export function MatchForm({ groupId, match, defaultTime }: { groupId: string; match?: Match; defaultTime: string }) {
  const [state, action] = useActionState(saveMatch, {});
  const [day, time] = match ? toBrazilInputs(match.starts_at) : ["", defaultTime];
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="group_id" value={groupId} />
      {match && <input type="hidden" name="match_id" value={match.id} />}
      <Field label="Time adversário">
        <Input name="opponent" defaultValue={match?.opponent} placeholder="Amigos da Bola FC" maxLength={60} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia">
          <Input name="day" type="date" defaultValue={day} required />
        </Field>
        <Field label="Horário">
          <Input name="time" type="time" defaultValue={time} required />
        </Field>
      </div>
      <Field label="Local">
        <Input name="location" defaultValue={match?.location} placeholder="Campo do adversário, quadra..." maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contato do adversário">
          <Input name="contact_name" defaultValue={match?.contact_name} placeholder="Nome" maxLength={60} />
        </Field>
        <Field label="Telefone do contato">
          <Input
            name="contact_phone"
            type="tel"
            inputMode="tel"
            defaultValue={match?.contact_phone}
            placeholder="(47) 99999-9999"
            maxLength={30}
          />
        </Field>
      </div>
      <Field label="Observações">
        <Input name="notes" defaultValue={match?.notes} placeholder="Cada time leva um jogo de coletes" maxLength={280} />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      {state.ok && match && <p className="rounded-xl bg-pitch-50 px-3 py-2 text-sm text-pitch-900">Salvo!</p>}
      <SubmitButton className="w-full">{match ? "Salvar amistoso" : "Marcar amistoso"}</SubmitButton>
    </form>
  );
}
