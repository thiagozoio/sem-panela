import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card, Input } from "@/components/ui";
import { MonthNav } from "@/components/month-nav";
import { SubmitButton } from "@/components/submit";
import { ShareButtons } from "@/components/share";
import { getGroupContext } from "@/lib/groups";
import { splitList } from "@/lib/attendance";
import { addMonths, formatGameDate, formatMoney, monthLabel, monthParam } from "@/lib/format";
import { debtorsMessage } from "@/lib/messages";
import type { Attendance, Expense, Game, Member, Payment } from "@/lib/types";
import { addExpense, copyExpenses, deleteExpense, setCashStart, togglePayment } from "../actions";

export const metadata: Metadata = { title: "Financeiro" };

type Row = {
  member: Member;
  amountCents: number;
  payment?: Payment;
  kind: "mensal" | "avulso";
  game?: Game;
};

export default async function FinancePage({ params, searchParams }: PageProps<"/g/[id]/financeiro">) {
  const { id } = await params;
  const { mes } = await searchParams;
  const { supabase, group, members, isOrganizer, readOnly } = await getGroupContext(id);
  if (!isOrganizer) notFound();

  const month = monthParam(mes);
  const nextMonth = addMonths(month, 1);
  // Brasil sem horário de verão desde 2019: -03:00 fixo.
  const from = `${month}T00:00:00-03:00`;
  const to = `${nextMonth}T00:00:00-03:00`;

  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("group_id", group.id)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at")
    .returns<Game[]>();
  const gameIds = (games ?? []).map((g) => g.id);

  const [{ data: attendances }, { data: payments }, { data: expenseRows }] = await Promise.all([
    gameIds.length
      ? supabase.from("attendances").select("*").in("game_id", gameIds).returns<Attendance[]>()
      : Promise.resolve({ data: [] as Attendance[] }),
    supabase.from("payments").select("*").eq("group_id", group.id).returns<Payment[]>(),
    supabase.from("expenses").select("*").eq("group_id", group.id).order("created_at").returns<Expense[]>(),
  ]);
  const expenses = (expenseRows ?? []).filter((e) => e.month === month);
  const hasPreviousExpenses = (expenseRows ?? []).some((e) => e.month === addMonths(month, -1));
  // Caixa: saldo inicial + tudo que entrou - tudo que saiu, desde o começo.
  const cash =
    (group.cash_start_cents ?? 0) +
    (payments ?? []).reduce((n, p) => n + p.amount_cents, 0) -
    (expenseRows ?? []).reduce((n, e) => n + e.amount_cents, 0);
  const spent = expenses.reduce((n, e) => n + e.amount_cents, 0);

  const monthly: Row[] = members
    .filter((m) => m.active && m.kind === "mensalista")
    .map((m) => ({
      member: m,
      kind: "mensal",
      amountCents: group.monthly_fee_cents,
      payment: payments?.find((p) => p.member_id === m.id && p.kind === "mensal" && p.month === month),
    }));

  const perGame = (games ?? []).map((game) => {
    const { confirmed } = splitList(
      (attendances ?? []).filter((a) => a.game_id === game.id),
      members,
      group.max_players,
      game.starts_at,
      group.priority_hours,
    );
    const rows: Row[] = confirmed
      .filter((e) => e.member.kind === "avulso")
      .map((e) => ({
        member: e.member,
        kind: "avulso",
        game,
        amountCents: group.single_fee_cents,
        payment: payments?.find((p) => p.member_id === e.member.id && p.game_id === game.id),
      }));
    return { game, rows };
  });

  const all = [...monthly, ...perGame.flatMap((g) => g.rows)];
  const received = all.reduce((n, r) => n + (r.payment?.amount_cents ?? 0), 0);
  const open = all.filter((r) => !r.payment);
  const openTotal = open.reduce((n, r) => n + r.amountCents, 0);
  const name = monthLabel(month);
  const debtors = open.map((r) => ({
    name: r.member.name,
    amountCents: r.amountCents,
    what: r.kind === "mensal" ? "mensalidade" : `avulso ${formatGameDate(r.game!.starts_at).split(",")[1]?.trim() ?? ""}`,
  }));

  const PayRow = ({ row }: { row: Row }) => (
    <li className="space-y-1.5 py-2 text-sm">
      <form action={togglePayment} className="space-y-1.5">
        <input type="hidden" name="group_id" value={group.id} />
        <input type="hidden" name="member_id" value={row.member.id} />
        <input type="hidden" name="kind" value={row.kind} />
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="game_id" value={row.game?.id ?? ""} />
        <input type="hidden" name="amount_cents" value={row.amountCents} />
        <input type="hidden" name="payment_id" value={row.payment?.id ?? ""} />
        <div className="flex items-center justify-between gap-2">
          <span>
            {row.member.name}
            {!row.member.active && <span className="text-neutral-400"> (fora do grupo)</span>}
          </span>
          {row.payment ? (
            <span className="flex items-center gap-2">
              <span className="text-right text-neutral-500">
                {formatMoney(row.payment.amount_cents)}
                {row.payment.note && <span className="block text-xs">{row.payment.note}</span>}
              </span>
              <Button className="w-28 whitespace-nowrap px-2 py-1.5" disabled={readOnly} title="Clique para desfazer">
                Pago ✓
              </Button>
            </span>
          ) : (
            <Button variant="secondary" className="w-28 whitespace-nowrap px-2 py-1.5" disabled={readOnly}>
              Marcar pago
            </Button>
          )}
        </div>
        {!row.payment && !readOnly && (
          <details className="group">
            <summary className="w-fit cursor-pointer list-none text-xs text-pitch-700">Outro valor (multa, desconto)</summary>
            <div className="mt-1.5 flex gap-2">
              <Input
                name="amount"
                inputMode="decimal"
                placeholder={formatMoney(row.amountCents)}
                aria-label={`Valor pago por ${row.member.name}`}
                className="w-28 px-2 py-1.5 text-sm"
              />
              <Input
                name="note"
                maxLength={60}
                placeholder="Obs.: multa por atraso"
                aria-label="Observação"
                className="px-2 py-1.5 text-sm"
              />
            </div>
          </details>
        )}
      </form>
    </li>
  );

  return (
    <div className="space-y-4">
      <MonthNav month={month} />

      {(group.monthly_fee_cents === 0 || group.single_fee_cents === 0) && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Defina o valor da mensalidade e do avulso em{" "}
          <Link className="font-semibold underline" href={`/g/${group.id}/config`}>
            Ajustes
          </Link>
          .
        </p>
      )}

      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-neutral-500">Caixa da pelada (hoje)</p>
            <p className={`text-2xl font-extrabold ${cash < 0 ? "text-red-700" : "text-pitch-700"}`}>{formatMoney(cash)}</p>
          </div>
          <p className="text-right text-xs text-neutral-500">
            saldo inicial
            <br />
            {formatMoney(group.cash_start_cents)}
          </p>
        </div>
        {!readOnly && (
          <details>
            <summary className="w-fit cursor-pointer list-none text-xs text-pitch-700">Mudar saldo inicial</summary>
            <form action={setCashStart} className="mt-2 flex gap-2">
              <input type="hidden" name="group_id" value={group.id} />
              <Input
                name="cash_start"
                inputMode="decimal"
                defaultValue={group.cash_start_cents ? (group.cash_start_cents / 100).toFixed(2).replace(".", ",") : ""}
                placeholder="Quanto tinha no caixa"
                aria-label="Saldo inicial do caixa"
              />
              <SubmitButton pendingText="…">Salvar</SubmitButton>
            </form>
            <p className="mt-1 text-xs text-neutral-500">O dinheiro que já estava no caixa antes de usar o app. Se estava devendo, use o sinal de menos.</p>
          </details>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-neutral-500">Recebido</p>
          <p className="text-lg font-bold text-pitch-700">{formatMoney(received)}</p>
        </Card>
        <Card>
          <p className="text-xs text-neutral-500">Gastos</p>
          <p className="text-lg font-bold">{formatMoney(spent)}</p>
        </Card>
        <Card>
          <p className="text-xs text-neutral-500">Saldo do mês</p>
          <p className={`text-lg font-bold ${received - spent < 0 ? "text-red-700" : "text-pitch-700"}`}>
            {formatMoney(received - spent)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-neutral-500">Em aberto</p>
          <p className="text-lg font-bold text-red-700">{formatMoney(openTotal)}</p>
        </Card>
      </div>

      {open.length > 0 && (
        <Card className="space-y-3">
          <h3 className="font-semibold">Cobrar quem deve ({open.length})</h3>
          <p className="text-sm text-neutral-600">Mensagem pronta com a lista e o seu Pix, sem constrangimento.</p>
          <ShareButtons label="Mandar cobrança no WhatsApp" text={debtorsMessage(group.name, name, debtors, group.pix_key)} />
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Mensalistas</h3>
          <Badge>
            {monthly.filter((r) => r.payment).length}/{monthly.length} pagos
          </Badge>
        </div>
        {monthly.length === 0 ? (
          <p className="pt-2 text-sm text-neutral-500">Nenhum mensalista. Marque em Jogadores.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {monthly.map((r) => (
              <PayRow key={r.member.id} row={r} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold">Avulsos por jogo</h3>
        {perGame.every((g) => g.rows.length === 0) && (
          <p className="pt-2 text-sm text-neutral-500">Nenhum avulso confirmado nos jogos deste mês.</p>
        )}
        {perGame
          .filter((g) => g.rows.length > 0)
          .map(({ game, rows }) => (
            <div key={game.id} className="pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{formatGameDate(game.starts_at)}</p>
              <ul className="divide-y divide-neutral-100">
                {rows.map((r) => (
                  <PayRow key={r.member.id} row={r} />
                ))}
              </ul>
            </div>
          ))}
      </Card>

      <Card className="space-y-2">
        <h3 className="font-semibold">Gastos do mês</h3>
        {expenses.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum gasto lançado. Coloque aqui quadra, bola, juiz, colete…</p>
        ) : (
          <ul className="divide-y divide-neutral-100 text-sm">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <span>{e.description}</span>
                <form action={deleteExpense} className="flex items-center gap-2">
                  <input type="hidden" name="group_id" value={group.id} />
                  <input type="hidden" name="expense_id" value={e.id} />
                  <span className="text-neutral-500">{formatMoney(e.amount_cents)}</span>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-red-700"
                      title="Apagar gasto"
                      aria-label={`Apagar ${e.description}`}
                    >
                      ✕
                    </Button>
                  )}
                </form>
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <>
            <form action={addExpense} className="grid grid-cols-[1fr_auto] gap-2 border-t border-neutral-100 pt-3">
              <input type="hidden" name="group_id" value={group.id} />
              <input type="hidden" name="month" value={month} />
              <Input
                name="description"
                maxLength={80}
                placeholder="Ex.: Aluguel da quadra"
                required
                aria-label="Descrição do gasto"
                className="col-span-2"
              />
              <Input name="amount" inputMode="decimal" placeholder="Valor (R$)" required aria-label="Valor do gasto" />
              <SubmitButton pendingText="…">Lançar gasto</SubmitButton>
            </form>
            {expenses.length === 0 && hasPreviousExpenses && (
              <form action={copyExpenses}>
                <input type="hidden" name="group_id" value={group.id} />
                <input type="hidden" name="month" value={month} />
                <SubmitButton variant="secondary" className="w-full" pendingText="Copiando…">
                  Repetir os gastos de {monthLabel(addMonths(month, -1))}
                </SubmitButton>
              </form>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
