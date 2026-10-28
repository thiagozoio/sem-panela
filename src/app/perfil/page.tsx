import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { getCurrentUser, getSessionUser, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLinkEmail } from "@/lib/player-link";

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
  // Quem entrou com Google já chega com o nome da conta como sugestão.
  let suggested = user.name;
  if (!suggested) {
    const { data } = await (await createClient()).auth.getClaims();
    const meta = data?.claims?.user_metadata as { full_name?: string; name?: string } | undefined;
    suggested = (meta?.full_name ?? meta?.name ?? "").slice(0, 60);
  }

  return (
    <AppShell admin={user.isAdmin}>
      <PageHeader title={user.name ? "Seu perfil" : "Como te chamam na pelada?"} subtitle={isLinkEmail(user.email) ? "Você entra pelo link que o organizador mandou." : user.email} />
      <Card>
        <form action={saveProfile} className="space-y-4">
          <input type="hidden" name="next" value={safeNext(next)} />
          <Field label="Nome ou apelido">
            <Input name="name" defaultValue={suggested} placeholder="Ex.: Juninho" maxLength={60} required autoFocus />
          </Field>
          <SubmitButton className="w-full">Salvar</SubmitButton>
        </form>
      </Card>
    </AppShell>
  );
}
