import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { refresh } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addMonths, formatDay, todayInBrazil } from "@/lib/format";
import { subscriptionState } from "@/lib/subscription";

export const metadata: Metadata = { title: "Admin" };

type AdminGroup = { id: string; name: string; owner_email: string; members_count: number; paid_until: string; created_at: string };

async function setPaidUntil(fd: FormData) {
  "use server";
  const user = await requireUser("/admin");
  if (!user.isAdmin) return;
  const current = String(fd.get("paid_until"));
  const months = Number(fd.get("months") ?? 0);
  const today = todayInBrazil();
  // Renovação conta a partir do vencimento (ou de hoje, se já venceu).
  const date = months ? addMonths(current > today ? current : today, months) : String(fd.get("date"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const supabase = await createClient();
  await supabase.rpc("admin_set_paid_until", { p_group_id: String(fd.get("group_id")), p_paid_until: date });
  refresh();
}

const tones = { ok: "green", due_soon: "amber", grace: "red", free: "neutral" } as const;
const labels = { ok: "em dia", due_soon: "vence logo", grace: "vencido", free: "plano grátis" } as const;

export default async function AdminPage() {
  const user = await requireUser("/admin");
  if (!user.isAdmin) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_list_groups");
  const groups = (data ?? []) as AdminGroup[];
  const today = todayInBrazil();
  const paying = groups.filter((g) => subscriptionState(g.paid_until, today).status !== "free").length;

  return (
    <AppShell admin>
      <PageHeader title="Admin" subtitle={`${groups.length} grupos · ${paying} no plano completo`} />
      {groups.map((g) => {
        const state = subscriptionState(g.paid_until, today);
        return (
          <Card key={g.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{g.name}</p>
                <p className="text-sm text-neutral-600">
                  {g.owner_email} · {g.members_count} jogadores
                </p>
                <p className="text-sm">Pago até <strong>{formatDay(g.paid_until)}</strong></p>
              </div>
              <Badge tone={tones[state.status]}>{labels[state.status]}</Badge>
            </div>
            <form action={setPaidUntil} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="group_id" value={g.id} />
              <input type="hidden" name="paid_until" value={g.paid_until} />
              <Button name="months" value="1" className="px-3 py-1.5">+1 mês</Button>
              <Button name="months" value="12" variant="secondary" className="px-3 py-1.5">+12 meses</Button>
              <Input name="date" type="date" defaultValue={g.paid_until} className="w-auto py-1.5" />
              <Button name="months" value="0" variant="ghost" className="px-3 py-1.5">Definir data</Button>
            </form>
          </Card>
        );
      })}
    </AppShell>
  );
}
