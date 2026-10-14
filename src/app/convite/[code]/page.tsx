import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Convite" };

type InviteInfo = { group_id: string; group_name: string; already_member: boolean; unclaimed: { id: string; name: string }[] };

async function join(formData: FormData) {
  "use server";
  const code = String(formData.get("code"));
  await requireUser(`/convite/${code}`);
  const claim = String(formData.get("member_id") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_group", {
    p_code: code,
    p_name: String(formData.get("name") ?? "").trim().slice(0, 60) || "Jogador",
    p_member_id: claim && claim !== "novo" ? claim : null,
  });
  if (error || !data) redirect(`/convite/${code}?erro=1`);
  redirect(`/g/${data}`);
}

export default async function InvitePage({ params, searchParams }: PageProps<"/convite/[code]">) {
  const { code } = await params;
  const { erro } = await searchParams;
  const user = await requireUser(`/convite/${code}`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_info", { p_code: code }).maybeSingle<InviteInfo>();

  if (!data) {
    return (
      <AppShell admin={user.isAdmin}>
        <Card>Esse convite não existe mais. Peça um link novo para o organizador.</Card>
      </AppShell>
    );
  }
  if (data.already_member) redirect(`/g/${data.group_id}`);

  return (
    <AppShell admin={user.isAdmin}>
      <PageHeader title={data.group_name} subtitle="Você foi convidado para essa pelada." />
      <Card>
        <form action={join} className="space-y-4">
          {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">Não deu para entrar. Tente de novo.</p>}
          <input type="hidden" name="code" value={code} />
          {data.unclaimed.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-neutral-700">O organizador já te cadastrou? Escolha seu nome:</legend>
              {data.unclaimed.map((m) => (
                <label key={m.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-pitch-50">
                  <input type="radio" name="member_id" value={m.id} /> {m.name}
                </label>
              ))}
              <label className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-pitch-50">
                <input type="radio" name="member_id" value="novo" defaultChecked /> Não estou na lista
              </label>
            </fieldset>
          )}
          <Field label="Seu nome na pelada" hint="Usado só se você não estiver na lista acima.">
            <Input name="name" defaultValue={user.name} maxLength={60} required />
          </Field>
          <SubmitButton className="w-full" pendingText="Entrando…">Entrar na pelada</SubmitButton>
        </form>
      </Card>
    </AppShell>
  );
}
