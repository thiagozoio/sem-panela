import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { CopyField, ShareButtons } from "@/components/share";
import { PayInstructions } from "@/components/billing-banner";
import { getGroupContext } from "@/lib/groups";
import { formatDay } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage({ params, searchParams }: PageProps<"/g/[id]/config">) {
  const { id } = await params;
  const { novo } = await searchParams;
  const { group, isOrganizer, readOnly, subscription } = await getGroupContext(id);
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

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold">Assinatura do Sem Panela</h2>
        <p>
          {subscription.status === "read_only" ? "Venceu em " : "Paga até "}
          <strong>{formatDay(group.paid_until)}</strong>.
        </p>
        <div className="space-y-2 text-neutral-600">
          <p>Para renovar:</p>
          <PayInstructions groupName={group.name} />
          <p>A liberação é feita à mão em até 1 dia útil.</p>
        </div>
      </Card>
    </div>
  );
}
