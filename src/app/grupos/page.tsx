import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS } from "@/lib/format";
import type { Group } from "@/lib/types";

export const metadata: Metadata = { title: "Minhas peladas" };

export default async function GroupsPage() {
  const user = await requireUser("/grupos");
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("is_organizer, groups(*)")
    .eq("user_id", user.id)
    .eq("active", true)
    .returns<{ is_organizer: boolean; groups: Group }[]>();
  const groups = (data ?? []).filter((r) => r.groups).sort((a, b) => a.groups.name.localeCompare(b.groups.name, "pt-BR"));

  return (
    <AppShell admin={user.isAdmin}>
      <PageHeader
        title={`Fala, ${user.name}!`}
        subtitle="Suas peladas"
        action={<LinkButton href="/grupos/novo">+ Nova pelada</LinkButton>}
      />
      {groups.length === 0 && (
        <Card className="space-y-2 text-sm text-neutral-700">
          <p>Você ainda não está em nenhuma pelada.</p>
          <p>
            Se você <strong>organiza</strong> a pelada, crie o grupo e mande o link de convite no WhatsApp. Se você{" "}
            <strong>joga</strong>, peça o link de convite para o organizador.
          </p>
        </Card>
      )}
      <div className="space-y-3">
        {groups.map(({ groups: g, is_organizer }) => (
          <Link key={g.id} href={`/g/${g.id}`} className="block">
            <Card className="flex items-center justify-between hover:ring-pitch-500">
              <div>
                <p className="font-semibold">{g.name}</p>
                <p className="text-sm text-neutral-600">
                  {WEEKDAYS[g.weekday]}, {g.start_time.slice(0, 5)}
                  {g.location && ` · ${g.location}`}
                </p>
              </div>
              {is_organizer && <Badge tone="green">Organizador</Badge>}
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
