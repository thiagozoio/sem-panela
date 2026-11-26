import type { Team } from "./types";
import { reachedLimit, type Round } from "./rounds";

/**
 * Durante o jogo, qualquer jogador do grupo marca os gols ao vivo: do horário do jogo
 * até PLAYERS_LIVE_HOURS depois (o mesmo tempo que a home mostra o jogo). Depois disso,
 * só o organizador mexe (corrige).
 */
export const PLAYERS_LIVE_HOURS = 3;

/** O jogo começou e ainda está na janela em que todos podem marcar gols. */
export function liveOpenForPlayers(startsAt: string, now = Date.now()): boolean {
  const start = new Date(startsAt).getTime();
  return now >= start && now < start + PLAYERS_LIVE_HOURS * 3600_000;
}

/**
 * Estado do placar ao vivo: gols por time (na ordem dos times), gols por jogador
 * e gols contra por jogador.
 */
export type LiveState = {
  scores: number[] | null;
  goals: Record<string, number>;
  ownGoals: Record<string, number>;
  /**
   * Formato com várias partidas no dia: a última partida (ou null antes da primeira).
   * Fica de fora (undefined) no jogo único. Gol só entra na partida que está rolando.
   */
  round?: LiveRound | null;
};

export type LiveRound = Pick<Round, "id" | "home" | "away" | "home_score" | "away_score" | "goals" | "own_goals" | "finished">;

/** Gol do jogador, gol contra do jogador (para o time `team`) ou gol sem autor do time. */
export type LiveTarget = { memberId: string } | { ownGoal: string; team: number } | { team: number };

/**
 * Times que podem receber o gol contra do jogador: todos menos o dele.
 * Com partida rolando, só o adversário dele nessa partida.
 */
export function opponents(teams: Team[] | null, memberId: string, round?: LiveRound | null): number[] {
  if (!teams) return [];
  const own = teamOf(teams, memberId);
  if (round !== undefined) {
    if (!round) return [];
    if (own === round.home) return [round.away];
    if (own === round.away) return [round.home];
    return [];
  }
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
export function applyLiveGoal(
  state: LiveState,
  teams: Team[] | null,
  delta: 1 | -1,
  target: LiveTarget,
  /** Formato com partidas: a partida acaba quando um time chega a esse número de gols. */
  roundGoals: number | null = null,
): LiveState {
  if (state.round !== undefined) return applyRoundGoal(state, teams, delta, target, roundGoals);
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

/**
 * Gol numa partida do dia. Só vale para os dois times da última partida: o +1 só com a
 * partida rolando; o −1 também logo depois que ela acabou (corrigir o último gol),
 * e só tira o que foi marcado nela. Chegou ao limite de gols, a partida acaba sozinha;
 * tirou o gol que fechou, ela volta a rolar.
 */
function applyRoundGoal(state: LiveState, teams: Team[] | null, delta: 1 | -1, target: LiveTarget, roundGoals: number | null): LiveState {
  const round = state.round;
  if (!teams || !round) return state;
  if (delta === 1 && round.finished) return state;
  let { goals, ownGoals } = state;
  let { goals: roundGoalsBy, own_goals: roundOwn } = round;
  let team: number;
  if ("memberId" in target) {
    team = teamOf(teams, target.memberId);
    if (team !== round.home && team !== round.away) return state;
    const inRound = bump(roundGoalsBy, target.memberId, delta);
    const total = bump(goals, target.memberId, delta);
    if (!inRound || !total) return state;
    roundGoalsBy = inRound;
    goals = total;
  } else if ("ownGoal" in target) {
    if (!opponents(teams, target.ownGoal, round).includes(target.team)) return state;
    const inRound = bump(roundOwn, target.ownGoal, delta);
    const total = bump(ownGoals, target.ownGoal, delta);
    if (!inRound || !total) return state;
    roundOwn = inRound;
    ownGoals = total;
    team = target.team;
  } else {
    team = target.team;
    if (team !== round.home && team !== round.away) return state;
  }
  const side = team === round.home ? "home_score" : "away_score";
  const value = Math.min(99, Math.max(0, round[side] + delta));
  if (value === round[side]) return state;
  const next = { ...round, [side]: value, goals: roundGoalsBy, own_goals: roundOwn };
  if (roundGoals != null) {
    if (delta === 1 && reachedLimit(next, roundGoals)) next.finished = true;
    if (delta === -1 && round.finished && reachedLimit(round, roundGoals) && !reachedLimit(next, roundGoals)) next.finished = false;
  }
  const scores = teams.map((_, i) => state.scores?.[i] ?? 0);
  scores[team] = Math.min(99, Math.max(0, scores[team] + delta));
  return { scores, goals, ownGoals, round: next };
}
