import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui";
import { CopyField, ShareButtons } from "@/components/share";
import { PayInstructions } from "@/components/billing-banner";
import { PREMIUM_FEATURES } from "@/lib/subscription";
import { getGroupContext } from "@/lib/groups";
import { formatDay } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage({ params, searchParams }: PageProps<"/g/[id]/config">) {
  const { id } = await params;
  const { novo } = await searchParams;
  const { group, isOrganizer, locked, trial, subscription } = await getGroupContext(id);
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
        <SettingsForm group={group} locked={locked} />
      </Card>

      <Card className="space-y-2 text-sm">
        <h2 id="plano" className="scroll-mt-4 font-semibold">Plano do Sem Panela</h2>
        {locked ? (
          <p>
            Sua pelada está no <strong>plano grátis</strong>: lista de presença e sorteio dos times, para sempre.
          </p>
        ) : (
          <p>
            {trial ? "Teste grátis do plano completo até " : "Plano completo pago até "}
            <strong>{formatDay(group.paid_until)}</strong>
            {subscription.status === "grace" && " (venceu)"}. Depois disso a pelada volta para o plano grátis, só com lista e
            sorteio.
          </p>
        )}
        <p className="font-semibold">O plano completo libera:</p>
        <ul className="list-inside list-disc text-neutral-700">
          {PREMIUM_FEATURES.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="text-neutral-600">
          {locked ? "Para assinar: " : "Para renovar: "}
          <PayInstructions groupName={group.name} /> A liberação é feita à mão em até 1 dia útil.
        </p>
      </Card>
    </div>
  );
}
