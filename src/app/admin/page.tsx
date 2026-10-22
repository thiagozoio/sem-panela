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
type Usage = {
  users_total: number; users_7d: number; users_new_30d: number;
  groups_total: number; groups_active_30d: number; members_total: number;
  members_with_account: number; games_total: number; attendances_30d: number;
};
type Activity = { group_id: string; games_count: number; last_game: string | null };

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

const tones = { ok: "green", due_soon: "amber", grace: "red", read_only: "red" } as const;
const labels = { ok: "em dia", due_soon: "vence logo", grace: "vencido", read_only: "bloqueado" } as const;

export default async function AdminPage() {
  const user = await requireUser("/admin");
  if (!user.isAdmin) notFound();
  const supabase = await createClient();
  // admin_usage/admin_group_activity vêm da migration 20261021; sem ela, o painel some.
  const [{ data }, { data: usageRows }, { data: activityRows }] = await Promise.all([
    supabase.rpc("admin_list_groups"),
    supabase.rpc("admin_usage"),
    supabase.rpc("admin_group_activity"),
  ]);
  const groups = (data ?? []) as AdminGroup[];
  const usage = (usageRows as Usage[] | null)?.[0];
  const activity = new Map(((activityRows ?? []) as Activity[]).map((a) => [a.group_id, a]));
  const today = todayInBrazil();
  const paying = groups.filter((g) => subscriptionState(g.paid_until, today).status !== "read_only").length;

  return (
    <AppShell admin>
      <PageHeader title="Admin" subtitle={`${groups.length} grupos · ${paying} ativos`} />
      {usage && (
        <Card className="space-y-3">
          <div>
            <p className="font-semibold">Uso do site</p>
            <p className="text-sm text-neutral-600">Sem contar os grupos de admins.</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Contas criadas" value={usage.users_total} hint={`+${usage.users_new_30d} em 30 dias`} />
            <Stat label="Entraram em 7 dias" value={usage.users_7d} />
            <Stat label="Grupos" value={usage.groups_total} hint={`${usage.groups_active_30d} com pelada em 30 dias`} />
            <Stat label="Jogadores" value={usage.members_total} hint={`${usage.members_with_account} com conta`} />
            <Stat label="Peladas criadas" value={usage.games_total} />
            <Stat label="Presenças em 30 dias" value={usage.attendances_30d} />
          </dl>
        </Card>
      )}
      {groups.map((g) => {
        const state = subscriptionState(g.paid_until, today);
        const act = activity.get(g.id);
        return (
          <Card key={g.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{g.name}</p>
                <p className="text-sm text-neutral-600">
                  {g.owner_email} · {g.members_count} jogadores
                </p>
                {usage && (
                  <p className="text-sm text-neutral-600">
                    {act?.last_game
                      ? `${act.games_count} peladas · última em ${formatDay(todayInBrazil(new Date(act.last_game)))}`
                      : "nenhuma pelada ainda"}
                  </p>
                )}
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

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <dt className="text-sm text-neutral-600">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-neutral-600">{hint}</dd>}
    </div>
  );
}
