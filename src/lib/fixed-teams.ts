import { apartMap, type ApartPair, type DrawPlayer } from "./draw";
import { positionOf, type Sport } from "./sports";
import type { FixedTeam, Member, Team } from "./types";

/** Jogador no formato do sorteio (posição já ajustada para a modalidade). */
export const toDrawPlayer = (sport: Sport, member: Member): DrawPlayer => ({
  member_id: member.id,
  name: member.name,
  position: positionOf(sport, member.position),
  skill: member.skill,
});

type Slot = { name: string; players: DrawPlayer[]; total: number };

/**
 * Times do jogo a partir dos times fixos do mês:
 * cada confirmado joga no seu time fixo; times sem nenhum confirmado ficam de fora;
 * quem não tem time fixo (avulsos, convidados) completa o time menor e, no empate, o que não tem
 * ninguém com quem ele "não joga junto" e depois o mais fraco.
 */
export function teamsFromFixed(
  fixed: Pick<FixedTeam, "name" | "member_ids">[],
  players: DrawPlayer[],
  apart: readonly ApartPair[] = [],
): Team[] {
  const avoid = apartMap(apart);
  const clashes = (p: DrawPlayer, s: Slot) => s.players.filter((q) => avoid.get(p.member_id)?.has(q.member_id)).length;
  const teamOf = new Map<string, number>();
  fixed.forEach((t, i) => t.member_ids.forEach((id) => teamOf.set(id, i)));

  const slots: Slot[] = fixed.map((t) => ({ name: t.name, players: [], total: 0 }));
  const extras: DrawPlayer[] = [];
  for (const p of players) {
    const i = teamOf.get(p.member_id);
    if (i === undefined) {
      extras.push(p);
    } else {
      slots[i].players.push(p);
      slots[i].total += p.skill;
    }
  }

  const playing = slots.filter((s) => s.players.length > 0);
  const targets = playing.length >= 2 ? playing : slots.slice(0, Math.max(2, playing.length));
  for (const p of [...extras].sort((a, b) => b.skill - a.skill)) {
    const target = [...targets].sort(
      (a, b) => a.players.length - b.players.length || clashes(p, a) - clashes(p, b) || a.total - b.total,
    )[0];
    if (!target) break;
    target.players.push(p);
    target.total += p.skill;
  }

  const order = (a: DrawPlayer, b: DrawPlayer) =>
    Number(b.position === "goleiro") - Number(a.position === "goleiro") || a.name.localeCompare(b.name, "pt-BR");
  return targets
    .filter((s) => s.players.length > 0)
    .map((s) => ({
      name: s.name,
      players: [...s.players].sort(order).map(({ member_id, name, position }) => ({ member_id, name, position })),
    }));
}
