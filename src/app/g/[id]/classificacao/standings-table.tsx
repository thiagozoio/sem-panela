import { goalDiff, points, positions, recentForm, winRate, type Outcome, type Row } from "@/lib/standings";
import type { Sport } from "@/lib/sports";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

const MEDAL = ["bg-gold text-white", "bg-silver text-white", "bg-bronze text-white"];
const DOT: Record<Outcome, string> = { V: "bg-win", E: "bg-draw", D: "bg-loss" };
const WORD: Record<Outcome, string> = { V: "vitória", E: "empate", D: "derrota" };

/** Bolinhas dos últimos jogos: verde vitória, cinza empate, vermelha derrota (mais recente à direita). */
export function FormDots({ row, n = 5 }: { row: Row; n?: number }) {
  const form = recentForm(row, n);
  if (!form.length) return null;
  return (
    <span className="inline-flex gap-1" title={`Últimos jogos: ${form.map((r) => WORD[r]).join(", ")}`}>
      {form.map((r, i) => (
        <span key={i} className={`size-2 rounded-full ${DOT[r]}`} aria-hidden />
      ))}
      <span className="sr-only">Últimos jogos: {form.map((r) => WORD[r]).join(", ")}</span>
    </span>
  );
}

/** Posição: 1º, 2º e 3º em medalha (ouro, prata, bronze); empatados dividem a posição. */
export function Position({ n }: { n: number }) {
  return n <= 3 ? (
    <span className={`inline-flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${MEDAL[n - 1]}`}>{n}</span>
  ) : (
    <span className="text-neutral-400">{n}</span>
  );
}

/** Tabela de classificação: P, J, V, E, D, gols (no vôlei, pontos ou sets) e aproveitamento, com a forma recente. */
export function StandingsTable({ rows, sport, label, leaders }: { rows: Row[]; sport: Sport; label: string; leaders: number }) {
  const volei = sport === "volei";
  // Vôlei não tem empate; a coluna só aparece se algum placar foi anotado empatado.
  const draws = !volei || rows.some((r) => r.draws > 0);
  const cols = ["P", "J", "V", ...(draws ? ["E"] : []), "D", ...(volei ? ["+", "−", "±"] : ["GP", "GC", "SG"]), "%"];
  const pos = positions(rows);
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[23rem] text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="w-7 py-1 text-center font-medium">#</th>
            <th className="py-1 pl-2 text-left font-medium">{label}</th>
            {cols.map((c) => (
              <th key={c} className={`w-8 py-1 text-center ${c === "P" ? "font-bold" : "font-medium"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((r, i) => {
            const values = [r.played, r.wins, ...(draws ? [r.draws] : []), r.losses, r.goalsFor, r.goalsAgainst, signed(goalDiff(r))];
            return (
              <tr key={r.key} className={i < leaders ? "bg-gold-soft" : ""}>
                <td className="py-1.5 text-center">
                  <Position n={pos[i]} />
                </td>
                <td className="max-w-36 py-1.5 pl-2">
                  <span className="block truncate font-medium">{r.name}</span>
                  <FormDots row={r} />
                </td>
                <td className="text-center font-bold">{points(r)}</td>
                {values.map((v, j) => (
                  <td key={j} className="text-center text-neutral-700">
                    {v}
                  </td>
                ))}
                <td className="text-center text-xs text-neutral-500">{winRate(r)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Legend({ sport }: { sport: Sport }) {
  return (
    <p className="text-xs text-neutral-500">
      {sport === "volei"
        ? "P pontos (3 por vitória) · J jogos · V vitórias · D derrotas · + e − pontos (ou sets) a favor e contra · ± saldo"
        : "P pontos (3 por vitória, 1 por empate) · J jogos · V vitórias · E empates · D derrotas · GP gols pró · GC gols contra · SG saldo de gols"}{" "}
      · % aproveitamento. Bolinhas: últimos 5 jogos (verde vitória, cinza empate, vermelha derrota). Desempate: vitórias, saldo e{" "}
      {sport === "volei" ? "pontos a favor" : "gols pró"}. Só contam jogos com placar anotado.
    </p>
  );
}
