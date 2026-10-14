import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { LoginForm } from "./login-form";

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
        <LoginForm next={target} />
      </Card>
    </main>
  );
}
