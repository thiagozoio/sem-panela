import { formatDay, formatMoney } from "@/lib/format";
import Link from "next/link";
import { GRACE_DAYS, PREMIUM_FEATURES, PRICE_CENTS, type SubscriptionState } from "@/lib/subscription";

export const BILLING_PIX_KEY = process.env.NEXT_PUBLIC_BILLING_PIX_KEY ?? "";
export const BILLING_WHATSAPP = process.env.NEXT_PUBLIC_BILLING_WHATSAPP ?? "";

export function PayInstructions({ groupName }: { groupName: string }) {
  const text = `Oi! Segue o comprovante da mensalidade do Sem Panela do grupo "${groupName}".`;
  return (
    <span>
      Faça um Pix de <strong>{formatMoney(PRICE_CENTS)}</strong>
      {BILLING_PIX_KEY && (
        <>
          {" "}para a chave <strong className="break-all">{BILLING_PIX_KEY}</strong>
        </>
      )}
      {BILLING_WHATSAPP ? (
        <>
          {" "}e{" "}
          <a className="font-semibold underline" target="_blank" rel="noreferrer" href={`https://wa.me/${BILLING_WHATSAPP}?text=${encodeURIComponent(text)}`}>
            mande o comprovante no WhatsApp
          </a>
        </>
      ) : null}
      . Plano anual: 12 meses pelo preço de 10.
    </span>
  );
}

export function BillingBanner({
  state,
  paidUntil,
  trial,
  organizer,
  groupId,
  groupName,
}: {
  state: SubscriptionState;
  paidUntil: string;
  trial: boolean;
  organizer: boolean;
  groupId: string;
  groupName: string;
}) {
  if (state.status === "ok" || !organizer) return null;

  if (state.status === "free") {
    return (
      <Link
        href={`/g/${groupId}/config#plano`}
        className="flex items-center justify-between gap-2 rounded-2xl bg-pitch-50 px-3 py-2 text-sm text-pitch-900 ring-1 ring-pitch-100"
      >
        <span>
          <strong>Plano grátis:</strong> lista e sorteio liberados.
        </span>
        <span className="whitespace-nowrap font-semibold">Conheça o completo ›</span>
      </Link>
    );
  }

  const what = trial ? "Seu teste grátis do plano completo" : "Sua assinatura";
  const tone =
    state.status === "due_soon" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-red-50 text-red-900 ring-red-200";
  const title =
    state.status === "due_soon"
      ? state.daysLeft === 0
        ? `${what} acaba hoje.`
        : `${what} acaba em ${state.daysLeft} dia${state.daysLeft > 1 ? "s" : ""} (${formatDay(paidUntil)}).`
      : `${what} acabou em ${formatDay(paidUntil)}. Em ${GRACE_DAYS + state.daysLeft + 1} dia(s) o grupo volta para o plano grátis.`;

  return (
    <div className={`space-y-1 rounded-2xl p-3 text-sm ring-1 ${tone}`}>
      <p className="font-semibold">{title}</p>
      <p>
        Lista de presença e sorteio continuam grátis; financeiro, placar, notas, tabela, times fixos e amistosos ficam
        bloqueados. Para continuar com tudo: <PayInstructions groupName={groupName} />
      </p>
    </div>
  );
}

/** Aviso no lugar de um recurso do plano completo quando o grupo está no plano grátis. */
export function UpgradeCard({
  feature,
  organizer,
  groupName,
}: {
  feature: string;
  organizer: boolean;
  groupName: string;
}) {
  return (
    <div className="space-y-2 rounded-2xl bg-pitch-50 p-4 text-sm text-pitch-900 ring-1 ring-pitch-100">
      <p className="font-semibold">🔒 {feature} faz parte do plano completo</p>
      {organizer ? (
        <>
          <p>
            No plano grátis a lista de presença e o sorteio dos times são liberados para sempre. Por{" "}
            <strong>{formatMoney(PRICE_CENTS)} por mês</strong> o grupo todo ganha:
          </p>
          <ul className="list-inside list-disc">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p>
            <PayInstructions groupName={groupName} /> A liberação é feita em até 1 dia útil, e tudo o que já foi lançado
            continua salvo.
          </p>
        </>
      ) : (
        <p>Peça para o organizador assinar o plano completo do Sem Panela ({formatMoney(PRICE_CENTS)} por mês para o grupo todo).</p>
      )}
    </div>
  );
}
