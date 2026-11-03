import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, ErrorText, Input, LinkButton, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS } from "@/lib/format";
import type { Group } from "@/lib/types";
import { INVITE_COOKIE, inviteCodeFromText, isInviteCode } from "@/lib/invite";
import { isLinkEmail } from "@/lib/player-link";

export const metadata: Metadata = { title: "Minhas peladas" };

async function openInvite(formData: FormData) {
  "use server";
  const code = inviteCodeFromText(String(formData.get("invite") ?? ""));
  redirect(code ? `/convite/${code}` : "/grupos?convite=invalido");
}

export default async function GroupsPage({ searchParams }: PageProps<"/grupos">) {
  const user = await requireUser("/grupos");
  const { convite } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("is_organizer, groups(*)")
    .eq("user_id", user.id)
    .eq("active", true)
    .returns<{ is_organizer: boolean; groups: Group }[]>();
  const groups = (data ?? []).filter((r) => r.groups).sort((a, b) => a.groups.name.localeCompare(b.groups.name, "pt-BR"));

  // Abriu um convite antes de entrar e ainda não está em nenhuma pelada: volta para ele.
  if (groups.length === 0) {
    const pending = (await cookies()).get(INVITE_COOKIE)?.value;
    if (isInviteCode(pending)) {
      const { data: invite } = await supabase
        .rpc("invite_info", { p_code: pending })
        .maybeSingle<{ already_member: boolean }>();
      if (invite && !invite.already_member) redirect(`/convite/${pending}`);
    }
  }

  return (
    <AppShell admin={user.isAdmin}>
      <PageHeader
        title={`Fala, ${user.name}!`}
        subtitle="Suas peladas"
        action={<LinkButton href="/grupos/novo">+ Nova pelada</LinkButton>}
      />
      {groups.length === 0 && (
        <Card className="space-y-3 text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">Você ainda não está em nenhuma pelada.</p>
          <p>
            <strong>Joga numa pelada?</strong> Toque de novo no link de convite que o organizador mandou no WhatsApp
            (ele termina em <span className="whitespace-nowrap">/convite/…</span>) ou cole o link aqui:
          </p>
          <form action={openInvite} className="flex gap-2">
            <Input name="invite" placeholder="sempanela.app.br/convite/…" aria-label="Link de convite" required />
            <SubmitButton pendingText="Abrindo…">Entrar</SubmitButton>
          </form>
          {convite === "invalido" && <ErrorText>Esse não parece um link de convite. Confira com o organizador.</ErrorText>}
          {user.email && !isLinkEmail(user.email) && (
            <p className="text-xs text-neutral-500">
              Você entrou como <strong>{user.email}</strong>. Se já usou outro jeito de entrar (Google, outro e-mail ou o
              link pessoal do WhatsApp), a sua pelada pode estar naquela outra conta.
            </p>
          )}
          <p>
            <strong>Organiza a pelada?</strong> Crie o grupo em <em>+ Nova pelada</em> e mande o link de convite no
            WhatsApp.
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
