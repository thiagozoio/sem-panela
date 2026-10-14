import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import { ShareButtons } from "@/components/share";
import { getGroupContext } from "@/lib/groups";
import { splitList } from "@/lib/attendance";
import { addMonths, formatGameDate, formatMoney, monthLabel, monthStart, todayInBrazil } from "@/lib/format";
import { debtorsMessage } from "@/lib/messages";
import type { Attendance, Game, Member, Payment } from "@/lib/types";
import { togglePayment } from "../actions";

export const metadata: Metadata = { title: "Financeiro" };

type Row = { member: Member; amountCents: number; payment?: Payment; kind: "mensal" | "avulso"; game?: Game };

export default async function FinancePage({ params, searchParams }: PageProps<"/g/[id]/financeiro">) {
  const { id } = await params;
  const { mes } = await searchParams;
  const { supabase, group, members, isOrganizer, readOnly } = await getGroupContext(id);
  if (!isOrganizer) notFound();

  const month = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : monthStart(todayInBrazil());
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

  const [{ data: attendances }, { data: payments }] = await Promise.all([
    gameIds.length
      ? supabase.from("attendances").select("*").in("game_id", gameIds).returns<Attendance[]>()
      : Promise.resolve({ data: [] as Attendance[] }),
    supabase.from("payments").select("*").eq("group_id", group.id).returns<Payment[]>(),
  ]);

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
    <li className="flex items-center justify-between gap-2 py-2 text-sm">
      <span>
        {row.member.name}
        {!row.member.active && <span className="text-neutral-400"> (fora do grupo)</span>}
      </span>
      <form action={togglePayment} className="flex items-center gap-2">
        <input type="hidden" name="group_id" value={group.id} />
        <input type="hidden" name="member_id" value={row.member.id} />
        <input type="hidden" name="kind" value={row.kind} />
        <input type="hidden" name="month" value={month} />
        <input type="hidden" name="game_id" value={row.game?.id ?? ""} />
        <input type="hidden" name="amount_cents" value={row.amountCents} />
        <input type="hidden" name="payment_id" value={row.payment?.id ?? ""} />
        <span className="text-neutral-500">{formatMoney(row.payment?.amount_cents ?? row.amountCents)}</span>
        <Button variant={row.payment ? "primary" : "secondary"} className="w-28 whitespace-nowrap px-2 py-1.5" disabled={readOnly}>
          {row.payment ? "Pago ✓" : "Marcar pago"}
        </Button>
      </form>
    </li>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link className="rounded-xl px-3 py-2 text-pitch-700 hover:bg-pitch-50" href={`?mes=${addMonths(month, -1).slice(0, 7)}`}>
          ‹
        </Link>
        <h2 className="font-semibold">{name}</h2>
        <Link className="rounded-xl px-3 py-2 text-pitch-700 hover:bg-pitch-50" href={`?mes=${nextMonth.slice(0, 7)}`}>
          ›
        </Link>
      </div>

      {(group.monthly_fee_cents === 0 || group.single_fee_cents === 0) && (
        <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          Defina o valor da mensalidade e do avulso em <Link className="font-semibold underline" href={`/g/${group.id}/config`}>Ajustes</Link>.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-neutral-500">Recebido</p>
          <p className="text-lg font-bold text-pitch-700">{formatMoney(received)}</p>
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
          <Badge>{monthly.filter((r) => r.payment).length}/{monthly.length} pagos</Badge>
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
    </div>
  );
}
