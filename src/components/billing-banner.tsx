import { formatDay, formatMoney } from "@/lib/format";
import { GRACE_DAYS, PRICE_CENTS, type SubscriptionState } from "@/lib/subscription";

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
  organizer,
  groupName,
}: {
  state: SubscriptionState;
  paidUntil: string;
  organizer: boolean;
  groupName: string;
}) {
  if (state.status === "ok") return null;

  if (!organizer) {
    if (state.status !== "read_only") return null;
    return (
      <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
        A pelada está pausada no app (só leitura). Fale com o organizador.
      </p>
    );
  }

  const tone =
    state.status === "due_soon" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-red-50 text-red-900 ring-red-200";
  const title =
    state.status === "due_soon"
      ? state.daysLeft === 0
        ? "Sua assinatura vence hoje."
        : `Sua assinatura vence em ${state.daysLeft} dia${state.daysLeft > 1 ? "s" : ""} (${formatDay(paidUntil)}).`
      : state.status === "grace"
        ? `Assinatura vencida em ${formatDay(paidUntil)}. Em ${GRACE_DAYS + state.daysLeft + 1} dia(s) o grupo fica só leitura.`
        : "Assinatura vencida: o grupo está em modo só leitura até o pagamento.";

  return (
    <div className={`space-y-1 rounded-2xl p-3 text-sm ring-1 ${tone}`}>
      <p className="font-semibold">{title}</p>
      <p>
        <PayInstructions groupName={groupName} />
      </p>
    </div>
  );
}
