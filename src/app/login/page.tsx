import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { SubmitButton } from "@/components/submit";
import { signInWithGoogle } from "./actions";
import { LoginForm } from "./login-form";

const GOOGLE_LOGIN = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, erro } = await searchParams;
  const target = safeNext(next);
  if (await getCurrentUser()) redirect(target);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="text-center">
        <p className="text-4xl">⚽</p>
        <h1 className="mt-2 text-2xl font-extrabold text-pitch-900">Sem Panela</h1>
        <p className="text-sm text-neutral-600">Entre para ver a lista da sua pelada.</p>
      </div>
      <Card>
        {erro && (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            O link expirou ou já foi usado. Peça um novo abaixo.
          </p>
        )}
        {GOOGLE_LOGIN && (
          <form action={signInWithGoogle} className="mb-4 space-y-4">
            <input type="hidden" name="next" value={target} />
            <SubmitButton variant="secondary" className="w-full" pendingText="Abrindo o Google…">
              <GoogleIcon /> Entrar com Google
            </SubmitButton>
            <p className="text-center text-xs text-neutral-500">ou use seu e-mail</p>
          </form>
        )}
        <LoginForm next={target} />
      </Card>
      <p className="text-center text-sm text-neutral-600">
        É jogador e não quer usar e-mail? Peça ao organizador o seu <strong>link de acesso</strong> pelo WhatsApp.
      </p>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="mr-2 inline h-5 w-5 align-[-4px]" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
