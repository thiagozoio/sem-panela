import { outcomes, type Outcome } from "./standings";

/**
 * Como o grupo joga no dia:
 * - "unico": um placar só (como sempre foi);
 * - "todos": várias partidas curtas, todos contra todos (ex.: A x B, vencedor x C, C x perdedor);
 * - "fica": várias partidas curtas, quem ganha fica e quem perde sai;
 * - "fora": o jogo é sempre contra um time de fora (a turma toda contra o adversário do dia).
 */
export type GameFormat = "unico" | "todos" | "fica" | "fora";

export const GAME_FORMATS: { value: GameFormat; label: string }[] = [
  { value: "unico", label: "Jogo único (um placar só)" },
  { value: "todos", label: "Várias partidas, todos contra todos" },
  { value: "fica", label: "Várias partidas, quem ganha fica" },
  { value: "fora", label: "Sempre contra um time de fora" },
];

export function formatOf(value: string | null | undefined): GameFormat {
  return value === "todos" || value === "fica" || value === "fora" ? value : "unico";
}

export const hasRounds = (format: GameFormat) => format === "todos" || format === "fica";

/** Gols para acabar a partida (1 a 20) ou null (sem limite, acaba no tempo). */
export function roundGoalsOf(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(n) && n >= 1 && n <= 20 ? n : null;
}

/** Uma partida do dia: dois times do jogo (posição em games.teams) e o placar dela. */
export type Round = {
  id: string;
  game_id: string;
  seq: number;
  home: number;
  away: number;
  home_score: number;
  away_score: number;
  /** Gols de cada jogador nesta partida. */
  goals: Record<string, number>;
  own_goals: Record<string, number>;
  finished: boolean;
};

export type RoundScore = Pick<Round, "home" | "away" | "home_score" | "away_score">;

/** Resultado de cada lado da partida. */
export function roundOutcome(r: RoundScore): [Outcome, Outcome] {
  const [h, a] = outcomes([r.home_score, r.away_score]);
  return [h.result, a.result];
}

/** Partida chegou ao limite de gols. */
export const reachedLimit = (r: RoundScore, limit: number | null) =>
  limit != null && (r.home_score >= limit || r.away_score >= limit);

export type DayRow = { team: number; played: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; points: number };

/** Tabela do dia: cada time com jogos, vitórias, empates, derrotas, gols e pontos (3 por vitória). */
export function dayTable(teamCount: number, rounds: RoundScore[]): DayRow[] {
  const rows: DayRow[] = Array.from({ length: teamCount }, (_, team) => ({
    team,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));
  for (const r of rounds) {
    const res = roundOutcome(r);
    const sides: [number, number, number, Outcome][] = [
      [r.home, r.home_score, r.away_score, res[0]],
      [r.away, r.away_score, r.home_score, res[1]],
    ];
    for (const [team, gf, ga, o] of sides) {
      const row = rows[team];
      if (!row) continue;
      row.played++;
      row.goalsFor += gf;
      row.goalsAgainst += ga;
      if (o === "V") {
        row.wins++;
        row.points += 3;
      } else if (o === "E") {
        row.draws++;
        row.points += 1;
      } else row.losses++;
    }
  }
  return rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      a.team - b.team,
  );
}

/** Soma dos gols de cada time em todas as partidas (o placar geral do dia). */
export function roundTotals(teamCount: number, rounds: RoundScore[]): number[] {
  const totals = Array.from({ length: teamCount }, () => 0);
  for (const r of rounds) {
    if (r.home < teamCount) totals[r.home] += r.home_score;
    if (r.away < teamCount) totals[r.away] += r.away_score;
  }
  return totals.map((t) => Math.min(99, t));
}

/** Há quantas partidas cada time não joga (quem nunca jogou vem primeiro). */
function waiting(teamCount: number, rounds: RoundScore[]): number[] {
  const last = Array.from({ length: teamCount }, () => -1);
  rounds.forEach((r, i) => {
    if (r.home < teamCount) last[r.home] = i;
    if (r.away < teamCount) last[r.away] = i;
  });
  return last;
}

/**
 * Próxima partida sugerida (o organizador pode trocar).
 * Todos contra todos: o par que menos se enfrentou; no empate, o vencedor da última e quem está esperando há mais tempo.
 * Quem ganha fica: o vencedor da última contra quem está esperando há mais tempo.
 * Se a última empatou, saem os dois (com 3 times, sai quem estava há mais partidas seguidas em campo).
 */
export function suggestNext(format: GameFormat, teamCount: number, rounds: RoundScore[]): [number, number] {
  if (teamCount < 2) return [0, 1];
  if (!rounds.length || teamCount === 2) {
    const last = rounds.at(-1);
    return last && teamCount === 2 ? [last.home, last.away] : [0, 1];
  }
  const last = waiting(teamCount, rounds);
  const lastRound = rounds.at(-1)!;
  const byWait = (a: number, b: number) => last[a] - last[b] || a - b;

  if (format === "todos") {
    const met = new Map<string, number>();
    const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
    for (const r of rounds) met.set(key(r.home, r.away), (met.get(key(r.home, r.away)) ?? 0) + 1);
    const pairs: [number, number][] = [];
    for (let a = 0; a < teamCount; a++) for (let b = a + 1; b < teamCount; b++) pairs.push([a, b]);
    const isLast = (p: [number, number]) => key(p[0], p[1]) === key(lastRound.home, lastRound.away);
    // Como o grupo costuma fazer: o vencedor da última joga a próxima.
    const [lh, la] = roundOutcome(lastRound);
    const winner = lh === "V" ? lastRound.home : la === "V" ? lastRound.away : -1;
    const noWinner = (p: [number, number]) => Number(p[0] !== winner && p[1] !== winner);
    pairs.sort(
      ([a1, b1], [a2, b2]) =>
        (met.get(key(a1, b1)) ?? 0) - (met.get(key(a2, b2)) ?? 0) ||
        Number(isLast([a1, b1])) - Number(isLast([a2, b2])) ||
        noWinner([a1, b1]) - noWinner([a2, b2]) ||
        Math.min(last[a1], last[b1]) - Math.min(last[a2], last[b2]) ||
        last[a1] + last[b1] - (last[a2] + last[b2]),
    );
    return pairs[0];
  }

  const bench = Array.from({ length: teamCount }, (_, i) => i)
    .filter((t) => t !== lastRound.home && t !== lastRound.away)
    .sort(byWait);
  const [h, a] = roundOutcome(lastRound);
  if (h === "V") return [lastRound.home, bench[0]];
  if (a === "V") return [lastRound.away, bench[0]];
  // Empate: com 4 times ou mais entram os dois que esperam; com 3, fica quem entrou por último.
  if (bench.length >= 2) return [bench[0], bench[1]];
  const streak = (t: number) => {
    let n = 0;
    for (let i = rounds.length - 1; i >= 0 && (rounds[i].home === t || rounds[i].away === t); i--) n++;
    return n;
  };
  const stays = streak(lastRound.home) <= streak(lastRound.away) ? lastRound.home : lastRound.away;
  return [stays, bench[0]];
}

/** Texto das partidas para o WhatsApp: "1. Azul 2 x 1 Vermelho". */
export function roundLines(names: string[], rounds: RoundScore[]): string[] {
  return rounds.map((r, i) => `${i + 1}. ${names[r.home] ?? "?"} ${r.home_score} x ${r.away_score} ${names[r.away] ?? "?"}`);
}
