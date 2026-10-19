import type { Position, Team } from "./types";

export type DrawPlayer = { member_id: string; name: string; position: Position; skill: number };

type Slot = { keeper: DrawPlayer | null; field: DrawPlayer[]; total: number };

function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Diferença entre o time mais forte e o mais fraco (soma dos níveis). */
export function spread(totals: number[]): number {
  return Math.max(...totals) - Math.min(...totals);
}

/** Posições que o sorteio espalha entre os times; coringas e goleiros sobrando ficam de fora. */
const counted = (p: DrawPlayer) => p.position !== "linha" && p.position !== "goleiro";

/** Soma, por posição, da diferença entre o time com mais e o com menos jogadores dela. */
function positionSpread(slots: Slot[]): number {
  const positions = new Set(slots.flatMap((s) => s.field.filter(counted).map((p) => p.position)));
  let total = 0;
  for (const pos of positions) total += spread(slots.map((s) => s.field.filter((p) => p.position === pos).length));
  return total;
}

/**
 * Sorteio equilibrado:
 * 1. um goleiro por time (os melhores primeiro); goleiros sobrando jogam na linha;
 * 2. os outros jogadores, posição por posição (coringas por último) e em ordem de nível
 *    (empates embaralhados), vão para o time com menos jogadores, depois com menos gente
 *    daquela posição e, no empate, com menor soma de nível;
 * 3. trocas entre times enquanto diminuírem a diferença de força sem desequilibrar as posições.
 * As posições vêm já ajustadas à modalidade da pelada (ver `positionOf`).
 * O embaralhamento faz cada "refazer" sair diferente com o mesmo equilíbrio.
 */
export function drawTeams(
  players: DrawPlayer[],
  numTeams: number,
  random: () => number = Math.random,
): Team[] {
  const n = Math.max(2, Math.min(numTeams, Math.max(players.length, 2)));
  const slots: Slot[] = Array.from({ length: n }, () => ({ keeper: null, field: [], total: 0 }));

  const bySkill = (list: DrawPlayer[]) =>
    shuffle(list, random).sort((a, b) => b.skill - a.skill);

  const keepers = bySkill(players.filter((p) => p.position === "goleiro"));
  const field = players.filter((p) => p.position !== "goleiro");
  keepers.slice(0, n).forEach((gk, i) => {
    slots[i].keeper = gk;
    slots[i].total += gk.skill;
  });
  field.push(...keepers.slice(n));

  // Posições com menos gente primeiro, para caberem uma por time; coringas completam.
  const groups = new Map<string, DrawPlayer[]>();
  for (const p of field) {
    const key = counted(p) ? p.position : "";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const order = [...groups.keys()].sort(
    (a, b) => Number(a === "") - Number(b === "") || groups.get(a)!.length - groups.get(b)!.length || a.localeCompare(b),
  );

  const size = (s: Slot) => s.field.length + (s.keeper ? 1 : 0);
  for (const key of order) {
    const count = (s: Slot) => (key ? s.field.filter((p) => p.position === key).length : 0);
    for (const p of bySkill(groups.get(key)!)) {
      const target = [...slots].sort((a, b) => size(a) - size(b) || count(a) - count(b) || a.total - b.total)[0];
      target.field.push(p);
      target.total += p.skill;
    }
  }

  // Trocas 1x1 de jogadores de linha enquanto diminuírem a diferença de força.
  const trySwap = (): boolean => {
    const before = spread(slots.map((s) => s.total));
    const positionsBefore = positionSpread(slots);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let x = 0; x < slots[i].field.length; x++) {
          for (let y = 0; y < slots[j].field.length; y++) {
            const a = slots[i].field[x];
            const b = slots[j].field[y];
            if (a.skill === b.skill) continue;
            const totals = slots.map((s) => s.total);
            totals[i] += b.skill - a.skill;
            totals[j] += a.skill - b.skill;
            if (spread(totals) >= before) continue;
            slots[i].field[x] = b;
            slots[j].field[y] = a;
            if (a.position !== b.position && positionSpread(slots) > positionsBefore) {
              slots[i].field[x] = a;
              slots[j].field[y] = b;
              continue;
            }
            slots[i].total = totals[i];
            slots[j].total = totals[j];
            return true;
          }
        }
      }
    }
    return false;
  };
  for (let round = 0; round < 100 && trySwap(); round++);

  const byName = (a: DrawPlayer, b: DrawPlayer) => a.name.localeCompare(b.name, "pt-BR");
  return slots.map((s, i) => ({
    name: `Time ${i + 1}`,
    players: [...(s.keeper ? [s.keeper] : []), ...[...s.field].sort(byName)].map(
      ({ member_id, name, position }) => ({ member_id, name, position }),
    ),
  }));
}

/** Número de times sugerido: confirmados ÷ jogadores por time, no mínimo 2. */
export function suggestedTeams(confirmed: number, playersPerTeam: number): number {
  return Math.max(2, Math.floor(confirmed / Math.max(playersPerTeam, 1)));
}
