"use client";

import { useActionState } from "react";
import { sendCode, verifyCode, type LoginState } from "./actions";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(async (prev: LoginState, fd: FormData): Promise<LoginState> => {
    if (fd.get("intent") === "reset") return { step: "email", next };
    return prev.step === "email" ? sendCode(prev, fd) : verifyCode(prev, fd);
  }, { step: "email", next });

  if (state.step === "code") {
    return (
      <form action={action} className="space-y-4" key="code">
        <p className="text-sm text-neutral-700">
          Mandamos um e-mail para <strong>{state.email}</strong>. Toque no link do e-mail <em>ou</em> digite aqui o
          código que veio nele.
        </p>
        <Field label="Código">
          <Input name="token" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={10} autoFocus />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton className="w-full" pendingText="Entrando…">Entrar</SubmitButton>
        <button name="intent" value="reset" className="w-full text-sm text-pitch-700">
          Usar outro e-mail
        </button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4" key="email">
      <Field label="Seu e-mail" hint="Sem senha: mandamos um link e um código para você entrar.">
        <Input name="email" type="email" autoComplete="email" placeholder="voce@email.com" defaultValue={state.email} autoFocus required />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton className="w-full" pendingText="Enviando…">Receber link de acesso</SubmitButton>
    </form>
  );
}
