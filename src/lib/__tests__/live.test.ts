import { describe, expect, it } from "vitest";
import { applyLiveGoal, opponents } from "../live";
import type { Position, Team } from "../types";

const p = (member_id: string) => ({ member_id, name: member_id, position: "linha" as Position });
const teams: Team[] = [
  { name: "Azul", players: [p("a"), p("b")] },
  { name: "Branco", players: [p("c")] },
];

describe("applyLiveGoal", () => {
  it("soma o gol no jogador e no time dele", () => {
    const s = applyLiveGoal({ scores: null, goals: {}, ownGoals: {} }, teams, 1, { memberId: "c" });
    expect(s).toEqual({ scores: [0, 1], goals: { c: 1 }, ownGoals: {} });
    expect(applyLiveGoal(s, teams, 1, { memberId: "c" })).toEqual({ scores: [0, 2], goals: { c: 2 }, ownGoals: {} });
  });

  it("desfaz um gol e some com o jogador quando chega a zero", () => {
    const s = applyLiveGoal({ scores: [2, 1], goals: { a: 1, c: 1 }, ownGoals: {} }, teams, -1, { memberId: "a" });
    expect(s).toEqual({ scores: [1, 1], goals: { c: 1 }, ownGoals: {} });
  });

  it("tirar gol de quem não tem gol não muda nada", () => {
    const s = { scores: [3, 0], goals: {}, ownGoals: {} };
    expect(applyLiveGoal(s, teams, -1, { memberId: "b" })).toBe(s);
  });

  it("gol sem autor mexe só no placar, sem passar de zero", () => {
    expect(applyLiveGoal({ scores: [0, 0], goals: {}, ownGoals: {} }, teams, 1, { team: 1 })).toEqual({ scores: [0, 1], goals: {}, ownGoals: {} });
    expect(applyLiveGoal({ scores: [0, 0], goals: {}, ownGoals: {} }, teams, -1, { team: 0 })).toEqual({ scores: [0, 0], goals: {}, ownGoals: {} });
  });

  it("gol contra vai para o outro time e não conta como gol do jogador", () => {
    const s = applyLiveGoal({ scores: [0, 0], goals: {}, ownGoals: {} }, teams, 1, { ownGoal: "a", team: 1 });
    expect(s).toEqual({ scores: [0, 1], goals: {}, ownGoals: { a: 1 } });
    expect(applyLiveGoal(s, teams, -1, { ownGoal: "a", team: 1 })).toEqual({ scores: [0, 0], goals: {}, ownGoals: {} });
  });

  it("gol contra não pode ir para o time do próprio jogador", () => {
    const s = { scores: [0, 0], goals: {}, ownGoals: {} };
    expect(applyLiveGoal(s, teams, 1, { ownGoal: "a", team: 0 })).toBe(s);
    expect(opponents(teams, "c")).toEqual([0]);
  });

  it("jogo sem times só conta os gols de cada um", () => {
    expect(applyLiveGoal({ scores: null, goals: {}, ownGoals: {} }, null, 1, { memberId: "x" })).toEqual({ scores: null, goals: { x: 1 }, ownGoals: {} });
  });
});
