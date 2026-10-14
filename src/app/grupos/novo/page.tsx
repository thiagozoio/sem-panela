import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS } from "@/lib/format";

export const metadata: Metadata = { title: "Nova pelada" };

async function createGroup(formData: FormData) {
  "use server";
  const user = await requireUser("/grupos/novo");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: String(formData.get("name")).trim(),
    p_location: String(formData.get("location") ?? "").trim(),
    p_weekday: Number(formData.get("weekday")),
    p_start_time: String(formData.get("start_time")),
    p_max_players: Number(formData.get("max_players")),
    p_organizer_name: user.name,
  });
  if (error || !data) redirect("/grupos/novo?erro=1");
  redirect(`/g/${data}/config?novo=1`);
}

export default async function NewGroupPage({ searchParams }: PageProps<"/grupos/novo">) {
  const user = await requireUser("/grupos/novo");
  const { erro } = await searchParams;
  return (
    <AppShell admin={user.isAdmin}>
      <PageHeader title="Nova pelada" subtitle="30 dias grátis. Depois, R$ 19,90 por mês, jogadores ilimitados." />
      <Card>
        <form action={createGroup} className="space-y-4">
          {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">Não deu para criar. Confira os dados e tente de novo.</p>}
          <Field label="Nome da pelada">
            <Input name="name" placeholder="Ex.: Pelada de Quinta" minLength={2} maxLength={60} required />
          </Field>
          <Field label="Local">
            <Input name="location" placeholder="Ex.: Arena Society, quadra 2" maxLength={120} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia">
              <Select name="weekday" defaultValue="4">
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </Select>
            </Field>
            <Field label="Horário">
              <Input name="start_time" type="time" defaultValue="20:00" required />
            </Field>
          </div>
          <Field label="Vagas por jogo" hint="Quem confirmar depois de lotar vai para a lista de espera.">
            <Input name="max_players" type="number" min={4} max={80} defaultValue={18} required />
          </Field>
          <SubmitButton className="w-full" pendingText="Criando…">Criar pelada</SubmitButton>
        </form>
      </Card>
    </AppShell>
  );
}
