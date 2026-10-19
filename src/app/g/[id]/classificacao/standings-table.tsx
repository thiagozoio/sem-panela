import { goalDiff, points, type Row } from "@/lib/standings";
import type { Sport } from "@/lib/sports";

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Tabela de classificação: P, J, V, E, D e gols (no vôlei, pontos ou sets) pró, contra e saldo. */
export function StandingsTable({ rows, sport, label, leaders }: { rows: Row[]; sport: Sport; label: string; leaders: number }) {
  const volei = sport === "volei";
  // Vôlei não tem empate; a coluna só aparece se algum placar foi anotado empatado.
  const draws = !volei || rows.some((r) => r.draws > 0);
  const cols = ["P", "J", "V", ...(draws ? ["E"] : []), "D", ...(volei ? ["+", "−", "±"] : ["GP", "GC", "SG"])];
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[22rem] text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-neutral-500">
            <th className="w-6 py-1 text-right font-medium">#</th>
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
              <tr key={r.key} className={i < leaders ? "bg-amber-50" : ""}>
                <td className="py-1.5 text-right text-neutral-400">{i < leaders ? "🏆" : i + 1}</td>
                <td className="max-w-36 truncate py-1.5 pl-2 font-medium">{r.name}</td>
                <td className="text-center font-bold">{points(r)}</td>
                {values.map((v, j) => (
                  <td key={j} className="text-center text-neutral-700">
                    {v}
                  </td>
                ))}
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
        ? "P pontos (3 por vitória) · J jogos · V vitórias · D derrotas · + e − pontos (ou sets) a favor e contra · ± saldo."
        : "P pontos (3 por vitória, 1 por empate) · J jogos · V vitórias · E empates · D derrotas · GP gols pró · GC gols contra · SG saldo de gols."}{" "}
      Desempate: vitórias, saldo e {sport === "volei" ? "pontos a favor" : "gols pró"}. Só contam jogos com placar anotado.
    </p>
  );
}
