import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { CopyField, ShareButtons } from "@/components/share";
import { getGroupContext } from "@/lib/groups";
import { siteUrl } from "@/lib/site";
import { SettingsForm } from "./settings-form";
import { BillingCard } from "./billing-card";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage({ params, searchParams }: PageProps<"/g/[id]/config">) {
  const { id } = await params;
  const { novo } = await searchParams;
  const { supabase, user, group, isOrganizer, readOnly, subscription } = await getGroupContext(id);
  if (!isOrganizer) notFound();

  const inviteUrl = `${await siteUrl()}/convite/${group.invite_code}`;
  const inviteText = `⚽ Entrem na lista da *${group.name}* pelo Sem Panela: ${inviteUrl}`;

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

      <div id="assinatura" className="scroll-mt-4">
        <BillingCard supabase={supabase} group={group} subscription={subscription} userName={user.name} />
      </div>
    </div>
  );
}
