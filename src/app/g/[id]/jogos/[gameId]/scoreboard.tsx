import type { CSSProperties } from "react";
import type { Outcome } from "@/lib/standings";
import type { TeamColor } from "@/lib/team-colors";

export type BoardPlayer = {
  id: string;
  name: string;
  /** Sigla da posição (GOL, ZAG...); vazio para coringa. */
  short: string;
  goals: number;
  ownGoals: number;
  guest: boolean;
  craque: boolean;
};

export type BoardTeam = {
  name: string;
  color: TeamColor;
  score: number | null;
  result: Outcome | null;
  players: BoardPlayer[];
};

/** Cor do nome do time em texto: branco, amarelo e preto usam a cor do texto normal (sumiriam no fundo). */
const textColor = (c: TeamColor): CSSProperties => (c.plain ? {} : { color: c.bg });

function Ball({ team, big }: { team: BoardTeam; big: boolean }) {
  const { bg, fg, plain } = team.color;
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <div
        className={`flex items-center justify-center rounded-full font-black tabular-nums ${big ? "size-24 text-5xl" : "size-20 text-4xl"} ${
          plain ? "ring-2 ring-black/10" : ""
        }`}
        style={{
          background: `radial-gradient(circle at 35% 30%, color-mix(in srgb, ${bg} 55%, white) 0%, ${bg} 55%, color-mix(in srgb, ${bg} 70%, black) 100%)`,
          color: fg,
          boxShadow: `0 0 0 4px color-mix(in srgb, ${bg} 25%, transparent), 0 8px 28px color-mix(in srgb, ${bg} 45%, transparent)`,
          textShadow: fg === "#ffffff" ? "0 2px 4px rgb(0 0 0 / 0.3)" : undefined,
        }}
      >
        {team.score ?? "–"}
      </div>
      <p className="max-w-28 truncate text-sm font-extrabold uppercase tracking-wide" style={textColor(team.color)}>
        {team.name}
      </p>
    </div>
  );
}

/** Placar grande: uma bola com a cor de cada time e os gols dentro. */
export function Scoreboard({ teams }: { teams: BoardTeam[] }) {
  const two = teams.length === 2;
  const winner = teams.find((t) => t.result === "V");
  const draw = teams.length > 0 && teams.every((t) => t.result !== "V");
  return (
    <div className="space-y-3 py-1">
      <div className={`flex items-center justify-center ${two ? "gap-6" : "flex-wrap gap-4"}`}>
        {two ? (
          <>
            <Ball team={teams[0]} big />
            <span className="text-xl font-bold text-neutral-400">×</span>
            <Ball team={teams[1]} big />
          </>
        ) : (
          teams.map((t) => <Ball key={t.name} team={t} big={false} />)
        )}
      </div>
      {winner ? (
        <p className="text-center text-sm font-bold text-win">Vitória do {/^time\b/i.test(winner.name) ? winner.name : `time ${winner.name}`}</p>
      ) : (
        draw && <p className="text-center text-sm font-bold text-neutral-500">Empate</p>
      )}
    </div>
  );
}

const BADGE: Record<Outcome, { label: string; className: string }> = {
  V: { label: "Venceu", className: "text-win ring-win" },
  E: { label: "Empatou", className: "text-neutral-500 ring-neutral-300" },
  D: { label: "Perdeu", className: "text-loss ring-loss" },
};

function Chip({ p }: { p: BoardPlayer }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-2.5 py-1 text-sm ring-1 ring-black/10">
      {p.short && <span className="text-[10px] font-bold text-gold">{p.short}</span>}
      <span className="font-semibold">{p.name}</span>
      {p.goals > 0 && (
        <span className="text-xs" title={`${p.goals} ${p.goals === 1 ? "gol" : "gols"}`}>
          ⚽{p.goals > 1 && <span className="font-bold">{p.goals}</span>}
        </span>
      )}
      {p.ownGoals > 0 && (
        <span className="text-[10px] text-loss">
          {p.ownGoals > 1 ? `${p.ownGoals} ` : ""}contra
        </span>
      )}
      {p.craque && (
        <span title="Craque do jogo" aria-label="Craque do jogo">
          ⭐
        </span>
      )}
      {p.guest && <span className="text-[10px] font-semibold text-sky-600">conv.</span>}
    </li>
  );
}

/** Elenco de cada time em "fichas": posição, nome, gols, craque e convidado. */
export function TeamRosters({ teams }: { teams: BoardTeam[] }) {
  return (
    <div className="space-y-3">
      {teams.map((t) => (
        <div key={t.name} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 text-sm font-extrabold uppercase tracking-wide">
              <span
                className={`size-3 shrink-0 rounded-full ${t.color.plain ? "ring-1 ring-black/20" : ""}`}
                style={{ background: t.color.bg }}
                aria-hidden
              />
              <span className="truncate" style={textColor(t.color)}>
                {t.name}
              </span>
            </p>
            {t.result && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ring-1 ${BADGE[t.result].className}`}>
                {BADGE[t.result].label}
              </span>
            )}
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {t.players.map((p) => (
              <Chip key={p.id} p={p} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
