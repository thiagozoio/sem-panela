import { describe, expect, it } from "vitest";
import { drawTeams, spread, suggestedTeams, type DrawPlayer } from "../draw";

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function players(skills: number[], keepers: number[] = []): DrawPlayer[] {
  return [
    ...skills.map((skill, i) => ({ member_id: `f${i}`, name: `Linha ${i}`, position: "linha" as const, skill })),
    ...keepers.map((skill, i) => ({ member_id: `g${i}`, name: `Goleiro ${i}`, position: "goleiro" as const, skill })),
  ];
}

const skillOf = (all: DrawPlayer[]) => new Map(all.map((p) => [p.member_id, p.skill]));

describe("drawTeams", () => {
  it("coloca todo mundo exatamente uma vez", () => {
    const all = players([5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 3, 4], [4, 2]);
    const teams = drawTeams(all, 2, seeded(1));
    const ids = teams.flatMap((t) => t.players.map((p) => p.member_id)).sort();
    expect(ids).toEqual(all.map((p) => p.member_id).sort());
  });

  it("dá um goleiro para cada time", () => {
    const all = players([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], [5, 1, 3]);
    const teams = drawTeams(all, 3, seeded(2));
    for (const t of teams) {
      expect(t.players.filter((p) => p.position === "goleiro")).toHaveLength(1);
      expect(t.players[0].position).toBe("goleiro");
    }
  });

  it("goleiro sobrando vai para a linha", () => {
    const all = players([3, 3, 3, 3, 3, 3, 3, 3], [5, 4, 3]);
    const teams = drawTeams(all, 2, seeded(3));
    const total = teams.reduce((n, t) => n + t.players.length, 0);
    expect(total).toBe(11);
    expect(Math.abs(teams[0].players.length - teams[1].players.length)).toBeLessThanOrEqual(1);
  });

  it("equilibra os níveis", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const all = players([5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1, 4, 2, 3, 5, 1, 2], [4, 3, 2]);
      const teams = drawTeams(all, 3, seeded(seed));
      const s = skillOf(all);
      const totals = teams.map((t) => t.players.reduce((n, p) => n + (s.get(p.member_id) ?? 0), 0));
      expect(spread(totals)).toBeLessThanOrEqual(1);
      const sizes = teams.map((t) => t.players.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    }
  });

  it("refazer gera sorteios diferentes", () => {
    const all = players([3, 3, 3, 3, 3, 3, 3, 3, 3, 3]);
    const a = JSON.stringify(drawTeams(all, 2, seeded(1)));
    const b = JSON.stringify(drawTeams(all, 2, seeded(99)));
    expect(a).not.toEqual(b);
  });
});

describe("suggestedTeams", () => {
  it("divide pelo tamanho do time, mínimo 2", () => {
    expect(suggestedTeams(18, 6)).toBe(3);
    expect(suggestedTeams(7, 6)).toBe(2);
    expect(suggestedTeams(25, 6)).toBe(4);
  });
});
