import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Perfil" };

async function saveProfile(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const next = safeNext(formData.get("next"));
  if (!name) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  await supabase.from("profiles").update({ name }).eq("id", data.user.id);
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
    </AppShell>
  );
}
