import { formatDay, formatMoney } from "@/lib/format";
import { CopyField } from "@/components/share";
import { GRACE_DAYS, PRICE_CENTS, type SubscriptionState } from "@/lib/subscription";

// Chave Pix (aleatória) e WhatsApp do Thiago para a mensalidade; as variáveis de ambiente sobrescrevem.
export const BILLING_PIX_KEY = process.env.NEXT_PUBLIC_BILLING_PIX_KEY || "5ea585c2-560c-46f8-9a9b-c5228f365c99";
export const BILLING_WHATSAPP = process.env.NEXT_PUBLIC_BILLING_WHATSAPP || "5547992037481";

/** "5547992037481" -> "(47) 99203-7481" */
function formatPhone(digits: string) {
  const local = digits.replace(/^55/, "");
  const m = local.match(/^(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : digits;
}

export function PayInstructions({ groupName }: { groupName: string }) {
  const text = `Oi! Segue o comprovante da mensalidade do Sem Panela do grupo "${groupName}".`;
  return (
    <div className="space-y-2">
      <p>
        Faça um Pix de <strong>{formatMoney(PRICE_CENTS)}</strong>
        {BILLING_PIX_KEY ? " para a chave abaixo" : ""}
        {BILLING_WHATSAPP ? (
          <>
            {" "}e mande o comprovante no WhatsApp <strong className="whitespace-nowrap">{formatPhone(BILLING_WHATSAPP)}</strong>
          </>
        ) : null}
        . Plano anual: 12 meses pelo preço de 10.
      </p>
      {BILLING_PIX_KEY && <CopyField value={BILLING_PIX_KEY} />}
      {BILLING_WHATSAPP && (
        <a
          className="inline-block font-semibold underline"
          target="_blank"
          rel="noreferrer"
          href={`https://wa.me/${BILLING_WHATSAPP}?text=${encodeURIComponent(text)}`}
        >
          Mandar comprovante no WhatsApp
        </a>
      )}
    </div>
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
      <PayInstructions groupName={groupName} />
    </div>
  );
}
