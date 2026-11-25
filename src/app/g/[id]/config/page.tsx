import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, LinkButton } from "@/components/ui";
import { CopyField, ShareButtons } from "@/components/share";
import { SupportCard } from "@/components/support";
import { formatDay } from "@/lib/format";
import { getGroupContext } from "@/lib/groups";
import { siteUrl } from "@/lib/site";
import { SettingsForm } from "./settings-form";
import { BillingCard } from "./billing-card";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage({ params, searchParams }: PageProps<"/g/[id]/config">) {
  const { id } = await params;
  const { novo } = await searchParams;
  const { supabase, user, group, isOrganizer, readOnly, subscription } = await getGroupContext(id);
  if (!isOrganizer) notFound();

  const inviteUrl = `${await siteUrl()}/convite/${group.invite_code}`;
  const inviteText = `⚽ Entrem na lista da *${group.name}* pelo ${APP_NAME}: ${inviteUrl}`;

  return (
    <div className="space-y-4">
      {novo && (
        <p className="rounded-2xl bg-pitch-50 p-3 text-sm text-pitch-900 ring-1 ring-pitch-100">
          Pelada criada! Agora mande o link de convite no grupo do WhatsApp e defina os valores da mensalidade.
        </p>
      )}

      <Card className="space-y-3">
        <h2 className="font-semibold">Convite</h2>
        <p className="text-sm text-neutral-600">Quem entrar pelo link vira jogador da pelada.</p>
        <CopyField value={inviteUrl} />
        <ShareButtons label="Mandar convite no WhatsApp" text={inviteText} />
      </Card>

      <Card>
        <SettingsForm group={group} disabled={readOnly} />
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Histórico de alterações</h2>
        <p className="text-sm text-neutral-600">
          Veja o que foi mudado (pagamentos, placar, times, jogadores…), por quem e quando, e desfaça se precisar.
        </p>
        <LinkButton variant="secondary" href={`/g/${group.id}/historico`}>
          Ver histórico
        </LinkButton>
      </Card>

      <div id="assinatura" className="scroll-mt-4">
        <div className="play-hide">
          <BillingCard supabase={supabase} group={group} subscription={subscription} userName={user.name} />
        </div>
        {/* No app Android da Google Play a assinatura não é vendida (ver src/lib/android-app.ts). */}
        <Card className="play-only space-y-2 text-sm">
          <h2 className="font-semibold">Assinatura do {APP_NAME}</h2>
          <p>
            {subscription.status === "read_only" ? "Venceu em " : "Paga até "}
            <strong>{formatDay(group.paid_until)}</strong>.
          </p>
          <p className="text-neutral-600">A assinatura não é feita pelo app Android.</p>
        </Card>
      </div>

      <SupportCard groupName={group.name} />
    </div>
  );
}
