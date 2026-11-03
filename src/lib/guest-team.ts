import type { Team, TeamPlayer } from "./types";

/**
 * Põe o jogador num time já montado: no time escolhido ou, sem escolha (ou nome que não existe),
 * no time com menos gente. Tira antes de qualquer outro time, para não duplicar.
 */
export function addToTeam(teams: Team[], player: TeamPlayer, teamName: string): Team[] {
  const without = removeFromTeams(teams, player.member_id);
  if (without.length === 0) return without;
  let index = without.findIndex((t) => t.name === teamName);
  if (index < 0) {
    index = without.reduce((best, t, i) => (t.players.length < without[best].players.length ? i : best), 0);
  }
  return without.map((t, i) => (i === index ? { ...t, players: [...t.players, player] } : t));
}

export function removeFromTeams(teams: Team[], memberId: string): Team[] {
  return teams.map((t) => ({ ...t, players: t.players.filter((p) => p.member_id !== memberId) }));
}
