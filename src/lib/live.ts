import type { Team } from "./types";

/** Estado do placar ao vivo: gols por time (na ordem dos times) e gols por jogador. */
export type LiveState = { scores: number[] | null; goals: Record<string, number> };

/**
 * Aplica um gol a mais (+1) ou a menos (-1). Com jogador, mexe nos gols dele e no
 * placar do time dele; sem jogador (gol contra, gol de quem não está na lista), só no
 * placar do time. Nada fica negativo, e tirar gol de quem não tem gol não muda o placar.
 */
export function applyLiveGoal(
  state: LiveState,
  teams: Team[] | null,
  delta: 1 | -1,
  target: { memberId: string } | { team: number },
): LiveState {
  const scores = teams ? teams.map((_, i) => state.scores?.[i] ?? 0) : null;
  const goals = { ...state.goals };
  let team: number;
  if ("memberId" in target) {
    const current = goals[target.memberId] ?? 0;
    const next = Math.min(50, Math.max(0, current + delta));
    if (next === current) return state;
    if (next) goals[target.memberId] = next;
    else delete goals[target.memberId];
    team = teams?.findIndex((t) => t.players.some((p) => p.member_id === target.memberId)) ?? -1;
  } else {
    team = target.team;
  }
  if (scores && team >= 0 && team < scores.length) scores[team] = Math.min(99, Math.max(0, scores[team] + delta));
  return { scores, goals };
}
