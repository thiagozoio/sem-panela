import { formatDay, monthLabel, monthOf, monthStart, todayInBrazil } from "./format";
import type { Sport } from "./sports";
import type { Game, GameGoal } from "./types";

/** Opção do organizador: sem classificação, campeão do mês ou campeonatos com datas. */
export type RankingMode = "off" | "mensal" | "campeonato";

export const RANKING_MODES: { value: RankingMode; label: string }[] = [
  { value: "off", label: "Desligada" },
  { value: "mensal", label: "Campeão do mês" },
  { value: "campeonato", label: "Campeonato com datas (turnos, anual)" },
];

export function rankingOf(value: string | null | undefined): RankingMode {
  return value === "mensal" || value === "campeonato" ? value : "off";
}

export type Championship = {
  id: string;
  group_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
};

export type ResultGame = Pick<Game, "starts_at" | "teams" | "scores"> & {
  game_goals?: Pick<GameGoal, "member_id" | "goals">[];
};

export type Row = {
  key: string;
  name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

export const goalDiff = (r: Row) => r.goalsFor - r.goalsAgainst;
/** 3 pontos por vitória e 1 por empate, como no Brasileirão (vale para o vôlei também). */
export const points = (r: Row) => r.wins * 3 + r.draws;

/** Dia (AAAA-MM-DD) do jogo no fuso de São Paulo. */
export const gameDay = (g: Pick<Game, "starts_at">) => todayInBrazil(new Date(g.starts_at));

/** Só conta jogo com 2 times ou mais e placar de todos eles. */
export function hasResult(g: ResultGame): g is ResultGame & { teams: NonNullable<Game["teams"]>; scores: number[] } {
  return !!g.teams && g.teams.length >= 2 && !!g.scores && g.scores.length === g.teams.length;
}

/**
 * Resultado de cada time no jogo. Com 2 times é o placar normal; com 3 ou mais,
 * quem fez mais gols vence (empate se dividir o topo) e os outros perdem,
 * e os gols contra são a soma dos gols dos outros times.
 */
export function outcomes(scores: number[]): { result: "V" | "E" | "D"; goalsFor: number; goalsAgainst: number }[] {
  const total = scores.reduce((a, b) => a + b, 0);
  const top = Math.max(...scores);
  const leaders = scores.filter((s) => s === top).length;
  return scores.map((s) => ({
    result: s < top ? "D" : leaders > 1 ? "E" : "V",
    goalsFor: s,
    goalsAgainst: total - s,
  }));
}

function emptyRow(key: string, name: string): Row {
  return { key, name, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
}

function add(row: Row, o: ReturnType<typeof outcomes>[number]) {
  row.played++;
  if (o.result === "V") row.wins++;
  else if (o.result === "E") row.draws++;
  else row.losses++;
  row.goalsFor += o.goalsFor;
  row.goalsAgainst += o.goalsAgainst;
}

/** Pontos, vitórias, saldo, gols pró; quem empata em tudo fica na ordem do nome. */
export function compareRows(a: Row, b: Row): number {
  return tiebreak(a, b) || a.name.localeCompare(b.name, "pt-BR");
}

function tiebreak(a: Row, b: Row): number {
  return points(b) - points(a) || b.wins - a.wins || goalDiff(b) - goalDiff(a) || b.goalsFor - a.goalsFor;
}

/**
 * Tabela dos jogadores e dos times fixos nos jogos dados.
 * `fixedNames(mês)` diz quais nomes de time são times fixos naquele mês:
 * só eles entram na tabela de times (times sorteados mudam toda semana).
 */
export function standings(
  games: ResultGame[],
  nameOf: (memberId: string, fallback: string) => string,
  fixedNames: (month: string) => Set<string> = () => new Set(),
): { players: Row[]; teams: Row[] } {
  const players = new Map<string, Row>();
  const teams = new Map<string, Row>();
  for (const g of games) {
    if (!hasResult(g)) continue;
    const result = outcomes(g.scores);
    const fixed = fixedNames(monthOf(g.starts_at));
    g.teams.forEach((team, i) => {
      for (const p of team.players) {
        const row = players.get(p.member_id) ?? emptyRow(p.member_id, nameOf(p.member_id, p.name));
        add(row, result[i]);
        players.set(p.member_id, row);
      }
      if (fixed.has(team.name)) {
        const row = teams.get(team.name) ?? emptyRow(team.name, team.name);
        add(row, result[i]);
        teams.set(team.name, row);
      }
    });
  }
  return { players: [...players.values()].sort(compareRows), teams: [...teams.values()].sort(compareRows) };
}

/** Quem está em 1º (mais de um se empatarem em todos os critérios). */
export function leaders(rows: Row[]): Row[] {
  if (!rows.length) return [];
  return rows.filter((r) => tiebreak(r, rows[0]) === 0);
}

/** Artilharia: gols de cada jogador nos jogos dados, do maior para o menor. */
export function topScorers(games: ResultGame[], nameOf: (memberId: string) => string) {
  const goals = new Map<string, number>();
  for (const g of games) for (const s of g.game_goals ?? []) goals.set(s.member_id, (goals.get(s.member_id) ?? 0) + s.goals);
  return [...goals]
    .map(([member_id, total]) => ({ member_id, name: nameOf(member_id), goals: total }))
    .filter((s) => s.goals > 0)
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, "pt-BR"));
}

export const inMonth = (games: ResultGame[], month: string) => games.filter((g) => monthOf(g.starts_at) === month);

export const inChampionship = (games: ResultGame[], c: Pick<Championship, "starts_on" | "ends_on">) =>
  games.filter((g) => {
    const day = gameDay(g);
    return day >= c.starts_on && day <= c.ends_on;
  });

/** Campeonato aberto hoje; senão o último que começou; senão o primeiro que vai começar. */
export function currentChampionship<C extends Championship>(list: C[], today: string): C | null {
  const started = list.filter((c) => c.starts_on <= today).sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  return started.find((c) => c.ends_on >= today) ?? started[0] ?? [...list].sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? null;
}

export function championshipPeriod(c: Pick<Championship, "starts_on" | "ends_on">): string {
  return `${formatDay(c.starts_on)} a ${formatDay(c.ends_on)}`;
}

export type Title = { key: string; label: string; players: Row[]; teams: Row[] };

/** Campeões dos meses que já acabaram, do mais recente para o mais antigo. */
export function monthlyChampions(games: ResultGame[], today: string, nameOf: Parameters<typeof standings>[1], fixedNames?: Parameters<typeof standings>[2]): Title[] {
  const current = monthStart(today);
  const months = [...new Set(games.filter(hasResult).map((g) => monthOf(g.starts_at)))].filter((m) => m < current).sort().reverse();
  return months.map((m) => {
    const t = standings(inMonth(games, m), nameOf, fixedNames);
    return { key: m, label: monthLabel(m), players: leaders(t.players), teams: leaders(t.teams) };
  });
}

/** Campeões dos campeonatos que já acabaram (com algum jogo), do mais recente para o mais antigo. */
export function championshipChampions(
  list: Championship[],
  games: ResultGame[],
  today: string,
  nameOf: Parameters<typeof standings>[1],
  fixedNames?: Parameters<typeof standings>[2],
): Title[] {
  return list
    .filter((c) => c.ends_on < today)
    .sort((a, b) => b.ends_on.localeCompare(a.ends_on))
    .map((c) => {
      const t = standings(inChampionship(games, c), nameOf, fixedNames);
      return { key: c.id, label: c.name, players: leaders(t.players), teams: leaders(t.teams) };
    })
    .filter((t) => t.players.length > 0);
}

/** Texto da tabela para mandar no WhatsApp (os 10 primeiros). */
export function standingsMessage(groupName: string, title: string, rows: Row[], teams: Row[], sport: Sport): string {
  const volei = sport === "volei";
  const line = (r: Row, i: number) =>
    `${i + 1}. ${r.name}: *${points(r)} pts* (${r.played}J ${r.wins}V${volei && !r.draws ? "" : ` ${r.draws}E`} ${r.losses}D, saldo ${goalDiff(r) > 0 ? "+" : ""}${goalDiff(r)})`;
  const lines = [`🏆 *${groupName}*: classificação`, title];
  if (teams.length) lines.push("", "*Times*", ...teams.map(line));
  if (rows.length) lines.push("", "*Jogadores*", ...rows.slice(0, 10).map(line));
  return lines.join("\n");
}
