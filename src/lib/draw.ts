import type { Position, Team } from "./types";

export type DrawPlayer = { member_id: string; name: string; position: Position; skill: number };

/** Par de jogadores que não podem cair no mesmo time (ids dos jogadores). */
export type ApartPair = readonly [string, string];

/** Mapa jogador -> com quem ele não pode jogar junto. */
export function apartMap(pairs: readonly ApartPair[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [a, b] of pairs) {
    if (a === b) continue;
    map.set(a, (map.get(a) ?? new Set()).add(b));
    map.set(b, (map.get(b) ?? new Set()).add(a));
  }
  return map;
}

/** Quantos pares proibidos estão juntos nos times. */
export function apartViolations(teams: { member_id: string }[][], pairs: readonly ApartPair[]): number {
  const teamOf = new Map<string, number>();
  teams.forEach((t, i) => t.forEach((p) => teamOf.set(p.member_id, i)));
  return pairs.filter(([a, b]) => a !== b && teamOf.has(a) && teamOf.get(a) === teamOf.get(b)).length;
}

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

const lexLess = (a: number[], b: number[]) => {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k];
  return false;
};

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
 * Regras "não jogam juntos" (`apart`): no passo 2 o jogador evita o time de quem ele não pode
 * encontrar; no passo 3 nenhuma troca junta um par; se ainda sobrar par junto (ex.: muitos
 * goleiros), trocas extras separam, mesmo custando um pouco de equilíbrio.
 * As posições vêm já ajustadas à modalidade da pelada (ver `positionOf`).
 * O embaralhamento faz cada "refazer" sair diferente com o mesmo equilíbrio.
 */
export function drawTeams(
  players: DrawPlayer[],
  numTeams: number,
  random: () => number = Math.random,
  apart: readonly ApartPair[] = [],
): Team[] {
  const avoid = apartMap(apart);
  const clashes = (p: DrawPlayer, s: Slot, skip?: DrawPlayer) => {
    const others = avoid.get(p.member_id);
    if (!others) return 0;
    let c = s.keeper && others.has(s.keeper.member_id) ? 1 : 0;
    for (const q of s.field) if (q !== skip && others.has(q.member_id)) c++;
    return c;
  };
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
      const target = [...slots].sort(
        (a, b) => size(a) - size(b) || clashes(p, a) - clashes(p, b) || count(a) - count(b) || a.total - b.total,
      )[0];
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
            if (avoid.size && clashes(a, slots[j], b) + clashes(b, slots[i], a) > clashes(a, slots[i]) + clashes(b, slots[j])) continue;
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

  // Se algum par proibido ficou junto, troca um deles com alguém de outro time:
  // a troca que separa com menos estrago nas posições e na força.
  const separate = (): boolean => {
    let best: { i: number; j: number; x: number; y: number; cost: number[] } | null = null;
    const positionsBefore = positionSpread(slots);
    for (let i = 0; i < n; i++) {
      for (let x = 0; x < slots[i].field.length; x++) {
        const a = slots[i].field[x];
        const here = clashes(a, slots[i]);
        if (!here) continue;
        for (let j = 0; j < n; j++) {
          if (j === i) continue;
          for (let y = 0; y < slots[j].field.length; y++) {
            const b = slots[j].field[y];
            const gain = here + clashes(b, slots[j]) - clashes(a, slots[j], b) - clashes(b, slots[i], a);
            if (gain <= 0) continue;
            const totals = slots.map((s) => s.total);
            totals[i] += b.skill - a.skill;
            totals[j] += a.skill - b.skill;
            slots[i].field[x] = b;
            slots[j].field[y] = a;
            const cost = [-gain, positionSpread(slots) - positionsBefore, spread(totals)];
            slots[i].field[x] = a;
            slots[j].field[y] = b;
            if (!best || lexLess(cost, best.cost)) best = { i, j, x, y, cost };
          }
        }
      }
    }
    if (!best) return false;
    const { i, j, x, y } = best;
    const a = slots[i].field[x];
    const b = slots[j].field[y];
    slots[i].field[x] = b;
    slots[j].field[y] = a;
    slots[i].total += b.skill - a.skill;
    slots[j].total += a.skill - b.skill;
    return true;
  };
  if (avoid.size) for (let round = 0; round < 50 && separate(); round++);

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
