import type { Team } from "./types";

/**
 * Estado do placar ao vivo: gols por time (na ordem dos times), gols por jogador
 * e gols contra por jogador.
 */
export type LiveState = { scores: number[] | null; goals: Record<string, number>; ownGoals: Record<string, number> };

/** Gol do jogador, gol contra do jogador (para o time `team`) ou gol sem autor do time. */
export type LiveTarget = { memberId: string } | { ownGoal: string; team: number } | { team: number };

/** Times que podem receber o gol contra do jogador: todos menos o dele. */
export function opponents(teams: Team[] | null, memberId: string): number[] {
  if (!teams) return [];
  const own = teamOf(teams, memberId);
  return teams.map((_, i) => i).filter((i) => i !== own);
}

function teamOf(teams: Team[] | null, memberId: string): number {
  return teams?.findIndex((t) => t.players.some((p) => p.member_id === memberId)) ?? -1;
}

const bump = (map: Record<string, number>, id: string, delta: number) => {
  const current = map[id] ?? 0;
  const next = Math.min(50, Math.max(0, current + delta));
  if (next === current) return null;
  const copy = { ...map };
  if (next) copy[id] = next;
  else delete copy[id];
  return copy;
};

/**
 * Aplica um gol a mais (+1) ou a menos (-1). Gol do jogador mexe nos gols dele e no
 * placar do time dele; gol contra mexe nos gols contra dele e no placar do time
 * escolhido (que não pode ser o dele); gol sem autor só no placar do time.
 * Nada fica negativo, e tirar gol de quem não tem gol não muda o placar.
 */
export function applyLiveGoal(state: LiveState, teams: Team[] | null, delta: 1 | -1, target: LiveTarget): LiveState {
  const scores = teams ? teams.map((_, i) => state.scores?.[i] ?? 0) : null;
  let { goals, ownGoals } = state;
  let team: number;
  if ("memberId" in target) {
    const next = bump(goals, target.memberId, delta);
    if (!next) return state;
    goals = next;
    team = teamOf(teams, target.memberId);
  } else if ("ownGoal" in target) {
    if (teams && !opponents(teams, target.ownGoal).includes(target.team)) return state;
    const next = bump(ownGoals, target.ownGoal, delta);
    if (!next) return state;
    ownGoals = next;
    team = target.team;
  } else {
    team = target.team;
  }
  if (scores && team >= 0 && team < scores.length) scores[team] = Math.min(99, Math.max(0, scores[team] + delta));
  return { scores, goals, ownGoals };
}
