"use client";

import { useActionState } from "react";
import { sendCode, signInWithPassword, verifyCode, type LoginState } from "./actions";
import { ErrorText, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit";

/** Depois de entrar pelo código por ter esquecido a senha, a pessoa cai no Perfil para criar outra. */
export function newPasswordNext(next: string) {
  return `/perfil?senha=1&next=${encodeURIComponent(next)}`;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(async (prev: LoginState, fd: FormData): Promise<LoginState> => {
    const intent = fd.get("intent");
    const email = String(fd.get("email") ?? prev.email ?? "").trim();
    if (intent === "reset") return { step: "email", email: prev.email, next };
    if (intent === "use-password") return { step: "password", email, next };
    if (intent === "use-code") return { step: "email", email, next };
    if (intent === "forgot") {
      const res = await sendCode({ step: "email", next: newPasswordNext(next) }, fd);
      return res.step === "code" ? res : { ...res, step: "password", email, next };
    }
    if (prev.step === "password") return signInWithPassword(prev, fd);
    return prev.step === "email" ? sendCode(prev, fd) : verifyCode(prev, fd);
  }, { step: "email", next });

  if (state.step === "code") {
    const forgot = state.next !== next;
    return (
      <form action={action} className="space-y-4" key="code">
        <p className="text-sm text-neutral-700">
          Mandamos um e-mail para <strong>{state.email}</strong>. Toque no link do e-mail <em>ou</em> digite aqui o
          código que veio nele.
        </p>
        <p className="text-xs text-neutral-500">
          {forgot
            ? "Depois de entrar, você cria uma senha nova."
            : "Não chegou? Olhe no spam ou na aba Promoções."}
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

  if (state.step === "password") {
    return (
      <form action={action} className="space-y-4" key="password">
        <Field label="Seu e-mail">
          <Input name="email" type="email" autoComplete="username" placeholder="voce@email.com" defaultValue={state.email} autoFocus={!state.email} required />
        </Field>
        <Field label="Senha">
          <Input name="password" type="password" autoComplete="current-password" autoFocus={!!state.email} />
        </Field>
        <ErrorText>{state.error}</ErrorText>
        <SubmitButton className="w-full" pendingText="Entrando…">Entrar</SubmitButton>
        <div className="flex justify-between gap-2 text-sm">
          <button name="intent" value="forgot" formNoValidate className="text-pitch-700">
            Esqueci minha senha
          </button>
          <button name="intent" value="use-code" formNoValidate className="text-pitch-700">
            Entrar sem senha
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4" key="email">
      <Field label="Seu e-mail" hint="Mandamos um link e um código para você entrar. Não precisa de cadastro.">
        <Input name="email" type="email" autoComplete="email" placeholder="voce@email.com" defaultValue={state.email} autoFocus required />
      </Field>
      <ErrorText>{state.error}</ErrorText>
      <SubmitButton className="w-full" pendingText="Enviando…">Receber link de acesso</SubmitButton>
      <button name="intent" value="use-password" formNoValidate className="w-full text-sm text-pitch-700">
        Já criou uma senha? Entrar com senha
      </button>
    </form>
  );
}
