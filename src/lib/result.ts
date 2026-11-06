import { formatGameDate } from "./format";
import type { GameGoal, MvpSummary, RatingSummary, Team } from "./types";

/** Craque do jogo: maior média com pelo menos 2 votos (no empate, mais votos). */
export function bestPlayer(summary: RatingSummary[]): RatingSummary | null {
  const ranked = rankRatings(summary).filter((r) => r.votes >= 2);
  return ranked[0] ?? null;
}

/** A votação do craque fica aberta por 48 horas a partir do início do jogo. */
export const MVP_VOTE_HOURS = 48;

export function mvpVoteOpen(startsAt: string, now = new Date()): boolean {
  const start = new Date(startsAt).getTime();
  return start <= now.getTime() && now.getTime() < start + MVP_VOTE_HOURS * 3600_000;
}

/** Votação do craque: mais votado primeiro (no empate, ordem do nome fica para a tela). */
export function rankMvpVotes(summary: MvpSummary[]): MvpSummary[] {
  return summary.filter((v) => v.votes > 0).sort((a, b) => b.votes - a.votes);
}

/** Craque(s) da votação: todos os empatados com mais votos. Vazio se ninguém votou. */
export function mvpWinners(summary: MvpSummary[]): MvpSummary[] {
  const ranked = rankMvpVotes(summary);
  return ranked.filter((v) => v.votes === ranked[0]?.votes);
}

export function rankRatings(summary: RatingSummary[]): RatingSummary[] {
  return [...summary].sort((a, b) => Number(b.average) - Number(a.average) || b.votes - a.votes);
}

export function scorers(goals: GameGoal[], nameOf: (memberId: string) => string) {
  return goals
    .filter((g) => g.goals > 0)
    .map((g) => ({ name: nameOf(g.member_id), goals: g.goals }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, "pt-BR"));
}

/** Gols contra de cada jogador (só quem tem), mais gols primeiro. */
export function ownGoalScorers(goals: GameGoal[], nameOf: (memberId: string) => string) {
  return scorers(
    goals.map((g) => ({ ...g, goals: g.own_goals ?? 0 })),
    nameOf,
  );
}

const ownLabel = (n: number) => (n > 1 ? `(${n} contra)` : "(contra)");
export { ownLabel as ownGoalLabel };

export function resultMessage(
  groupName: string,
  startsAt: string,
  teams: Team[] | null,
  scores: number[] | null,
  goalList: { name: string; goals: number }[],
  best: string | null,
  ownGoalList: { name: string; goals: number }[] = [],
): string {
  const lines = [`⚽ *${groupName}*: resultado`, formatGameDate(startsAt)];
  if (teams && scores?.length) {
    lines.push("", ...teams.map((t, i) => `*${t.name}* ${scores[i] ?? 0}`));
  }
  if (goalList.length || ownGoalList.length) {
    lines.push(
      "",
      "*Gols*",
      ...goalList.map((g) => `⚽ ${g.name}${g.goals > 1 ? ` (${g.goals})` : ""}`),
      ...ownGoalList.map((g) => `⚽ ${g.name} ${ownLabel(g.goals)}`),
    );
  }
  if (best) lines.push("", `⭐ Craque do jogo: *${best}*`);
  return lines.join("\n");
}
