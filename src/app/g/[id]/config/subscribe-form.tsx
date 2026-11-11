"use client";

import { useActionState } from "react";
import { ErrorText, Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { subscribe } from "./billing-actions";

export function SubscribeForm({ groupId, defaultName, label }: { groupId: string; defaultName: string; label: string }) {
  const [state, action] = useActionState(subscribe, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="group_id" value={groupId} />
      <Field label="Nome de quem paga">
        <Input name="payer_name" defaultValue={defaultName} minLength={3} maxLength={100} required autoComplete="name" />
      </Field>
      <Field label="CPF ou CNPJ" hint="O Asaas, que processa o pagamento, exige para emitir a cobrança.">
        <Input name="payer_doc" inputMode="numeric" required placeholder="000.000.000-00" maxLength={18} />
      </Field>
      <Field label="Forma de pagamento">
        <Select name="billing_type" defaultValue="PIX">
          <option value="PIX">Pix (todo mês chega um QR Code novo)</option>
          <option value="CREDIT_CARD">Cartão de crédito (cobra sozinho todo mês)</option>
        </Select>
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton className="w-full" pendingText="Abrindo o pagamento…">
        {label}
      </SubmitButton>
    </form>
  );
}
