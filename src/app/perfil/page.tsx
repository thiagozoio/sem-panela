import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { PushToggle } from "@/components/push-toggle";
import { getCurrentUser, getSessionUser, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pushEnabled, VAPID_PUBLIC_KEY } from "@/lib/push";

export const metadata: Metadata = { title: "Perfil" };

async function saveProfile(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const next = safeNext(formData.get("next"));
  if (!name) return;
  const session = await getSessionUser();
  if (!session) redirect("/login");
  const supabase = await createClient();
  await supabase.from("profiles").update({ name }).eq("id", session.id);
  refresh();
  redirect(next);
}

export default async function ProfilePage({ searchParams }: PageProps<"/perfil">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/perfil");
  const { next } = await searchParams;

  return (
    <AppShell admin={user.isAdmin}>
      <PageHeader title={user.name ? "Seu perfil" : "Como te chamam na pelada?"} subtitle={user.email} />
      <Card>
        <form action={saveProfile} className="space-y-4">
          <input type="hidden" name="next" value={safeNext(next)} />
          <Field label="Nome ou apelido">
            <Input name="name" defaultValue={user.name} placeholder="Ex.: Juninho" maxLength={60} required autoFocus />
          </Field>
          <SubmitButton className="w-full">Salvar</SubmitButton>
        </form>
      </Card>
      {user.name && pushEnabled() && (
        <Card className="space-y-2">
          <h2 className="font-semibold">Avisos no celular</h2>
          <PushToggle publicKey={VAPID_PUBLIC_KEY} variant="settings" />
        </Card>
      )}
    </AppShell>
  );
}
