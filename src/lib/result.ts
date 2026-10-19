import { formatGameDate } from "./format";
import type { GameGoal, RatingSummary, Team } from "./types";

/** Craque do jogo: maior média com pelo menos 2 votos (no empate, mais votos). */
export function bestPlayer(summary: RatingSummary[]): RatingSummary | null {
  const ranked = rankRatings(summary).filter((r) => r.votes >= 2);
  return ranked[0] ?? null;
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

export function resultMessage(
  groupName: string,
  startsAt: string,
  teams: Team[] | null,
  scores: number[] | null,
  goalList: { name: string; goals: number }[],
  best: string | null,
): string {
  const lines = [`⚽ *${groupName}*: resultado`, formatGameDate(startsAt)];
  if (teams && scores?.length) {
    lines.push("", ...teams.map((t, i) => `*${t.name}* ${scores[i] ?? 0}`));
  }
  if (goalList.length) {
    lines.push("", "*Gols*", ...goalList.map((g) => `⚽ ${g.name}${g.goals > 1 ? ` (${g.goals})` : ""}`));
  }
  if (best) lines.push("", `⭐ Craque do jogo: *${best}*`);
  return lines.join("\n");
}
