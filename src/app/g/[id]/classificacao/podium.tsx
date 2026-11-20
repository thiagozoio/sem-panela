import { points, positions, winRate, type Row } from "@/lib/standings";
import { FormDots } from "./standings-table";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

const STYLE = {
  1: { ring: "ring-gold", soft: "bg-gold-soft", border: "border-gold", text: "text-gold", block: "h-20", avatar: "size-16 text-xl" },
  2: { ring: "ring-silver", soft: "bg-silver-soft", border: "border-silver", text: "text-silver", block: "h-14", avatar: "size-13 text-lg" },
  3: { ring: "ring-bronze", soft: "bg-bronze-soft", border: "border-bronze", text: "text-bronze", block: "h-10", avatar: "size-13 text-lg" },
} as const;

/** Pódio dos 3 primeiros (2º, 1º, 3º, como no pódio de verdade). Empatados dividem a posição. */
export function Podium({ rows, finished }: { rows: Row[]; finished: boolean }) {
  const pos = positions(rows);
  const top = rows.slice(0, 3).map((row, i) => ({ row, place: Math.min(pos[i], 3) as 1 | 2 | 3 }));
  if (top.length < 2) return null;
  // Ordem na tela: o 2º à esquerda, o 1º no meio e o 3º à direita.
  const order = top.length === 3 ? [top[1], top[0], top[2]] : [top[1], top[0]];
  return (
    <div className={`grid items-end gap-2 pt-2 ${top.length === 3 ? "grid-cols-3" : "mx-auto max-w-64 grid-cols-2"}`}>
      {order.map(({ row, place }) => {
        const s = STYLE[place];
        return (
          <div key={row.key} className="flex min-w-0 flex-col items-center text-center">
            {place === 1 && (
              <span className="text-xl leading-none" aria-hidden>
                {finished ? "🏆" : "👑"}
              </span>
            )}
            <span
              className={`mt-1 flex items-center justify-center rounded-full font-extrabold ring-4 ${s.ring} ${s.soft} ${s.avatar} text-[var(--app-fg)] shadow-md`}
            >
              {initials(row.name)}
            </span>
            <p className="mt-2 w-full truncate text-sm font-bold">{row.name}</p>
            <p className="text-xs text-neutral-500">
              <strong className={`${s.text} text-sm`}>{points(row)}</strong> pts · {winRate(row)}%
            </p>
            <div className="mt-1 h-3">
              <FormDots row={row} />
            </div>
            <div
              className={`mt-1 flex w-full items-start justify-center rounded-t-xl border-t-4 pt-1 ${s.border} ${s.soft} ${s.block}`}
            >
              <span className={`text-2xl font-black ${s.text}`}>{place}º</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
