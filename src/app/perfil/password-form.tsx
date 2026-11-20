"use client";

import { useActionState } from "react";
import { savePassword, type PasswordState } from "./actions";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { MIN_PASSWORD } from "@/lib/password";

export function PasswordForm({ email, focus }: { email: string; focus?: boolean }) {
  const [state, action] = useActionState<PasswordState, FormData>(savePassword, {});
  return (
    <form action={action} className="space-y-4" key={state.ok ? "ok" : "form"}>
      {/* Ajuda o gerenciador de senhas do celular a guardar a senha junto com o e-mail certo. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Field label="Senha nova" hint={`Pelo menos ${MIN_PASSWORD} caracteres, com letras e números.`}>
        <Input name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} maxLength={72} required autoFocus={focus} />
      </Field>
      <Field label="Repita a senha">
        <Input name="confirm" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} maxLength={72} required />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      {state.ok && (
        <p className="rounded-xl bg-pitch-50 px-3 py-2 text-sm text-pitch-900">
          Senha salva. Da próxima vez, toque em &quot;Entrar com senha&quot; na tela de login.
        </p>
      )}
      <SubmitButton className="w-full" variant="secondary">Salvar senha</SubmitButton>
    </form>
  );
}
