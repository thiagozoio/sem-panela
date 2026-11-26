import { describe, expect, it } from "vitest";
import { dayTable, formatOf, roundGoalsOf, roundLines, roundTotals, suggestNext, type RoundScore } from "../rounds";
import { applyLiveGoal, opponents, type LiveRound, type LiveState } from "../live";
import { standings } from "../standings";
import type { Position, Team } from "../types";

const r = (home: number, away: number, home_score: number, away_score: number): RoundScore => ({ home, away, home_score, away_score });

describe("formato", () => {
  it("valor desconhecido vira jogo único", () => {
    expect(formatOf(undefined)).toBe("unico");
    expect(formatOf("xx")).toBe("unico");
    expect(formatOf("fica")).toBe("fica");
  });
  it("limite de gols de 1 a 20, senão sem limite", () => {
    expect(roundGoalsOf("2")).toBe(2);
    expect(roundGoalsOf("")).toBeNull();
    expect(roundGoalsOf(0)).toBeNull();
    expect(roundGoalsOf(null)).toBeNull();
  });
});

describe("suggestNext", () => {
  it("todos contra todos com 3 times: vencedor x C, depois C x perdedor", () => {
    // A (0) ganha de B (1): próxima é A x C.
    expect(suggestNext("todos", 3, [r(0, 1, 2, 1)])).toEqual([0, 2]);
    // B ganhou a primeira: próxima é B x C.
    expect(suggestNext("todos", 3, [r(0, 1, 0, 1)]).sort()).toEqual([1, 2]);
    // Depois de A x B e A x C, falta B x C (C contra o perdedor do primeiro).
    expect(suggestNext("todos", 3, [r(0, 1, 2, 1), r(0, 2, 0, 3)]).sort()).toEqual([1, 2]);
  });

  it("quem ganha fica: o vencedor contra quem está esperando há mais tempo", () => {
    expect(suggestNext("fica", 3, [r(0, 1, 2, 0)])).toEqual([0, 2]);
    expect(suggestNext("fica", 3, [r(0, 1, 2, 0), r(0, 2, 1, 2)])).toEqual([2, 1]);
    // 4 times: entra o que espera há mais tempo (o 3 nunca jogou).
    expect(suggestNext("fica", 4, [r(0, 1, 2, 0), r(0, 2, 2, 1)])).toEqual([0, 3]);
  });

  it("quem ganha fica, empate com 3 times: sai quem estava há mais partidas seguidas", () => {
    // 0 jogou as duas: no empate da segunda, fica o 2 (entrou por último) e entra o 1.
    expect(suggestNext("fica", 3, [r(0, 1, 2, 0), r(0, 2, 1, 1)])).toEqual([2, 1]);
  });

  it("empate com 4 times: entram os dois que esperam", () => {
    expect(suggestNext("fica", 4, [r(0, 1, 1, 1)])).toEqual([2, 3]);
  });

  it("2 times: sempre os mesmos", () => {
    expect(suggestNext("fica", 2, [])).toEqual([0, 1]);
    expect(suggestNext("todos", 2, [r(1, 0, 1, 0)])).toEqual([1, 0]);
  });
});

describe("tabela do dia", () => {
  it("3 pontos por vitória e 1 por empate, ordenada", () => {
    const t = dayTable(3, [r(0, 1, 2, 1), r(0, 2, 0, 0), r(2, 1, 1, 0)]);
    expect(t.map((x) => [x.team, x.points, x.played])).toEqual([
      [0, 4, 2],
      [2, 4, 2],
      [1, 0, 2],
    ]);
    expect(roundTotals(3, [r(0, 1, 2, 1), r(2, 1, 1, 0)])).toEqual([2, 1, 1]);
    expect(roundLines(["Azul", "Branco", "Verde"], [r(0, 1, 2, 1)])).toEqual(["1. Azul 2 x 1 Branco"]);
  });
});

const p = (member_id: string) => ({ member_id, name: member_id, position: "linha" as Position });
const teams: Team[] = [
  { name: "Azul", players: [p("a"), p("b")] },
  { name: "Branco", players: [p("c")] },
  { name: "Verde", players: [p("d")] },
];
const round = (over: Partial<LiveRound> = {}): LiveRound => ({
  id: "r1",
  home: 0,
  away: 1,
  home_score: 0,
  away_score: 0,
  goals: {},
  own_goals: {},
  finished: false,
  ...over,
});
const state = (over: Partial<LiveState> = {}): LiveState => ({ scores: [0, 0, 0], goals: {}, ownGoals: {}, round: round(), ...over });

describe("gol ao vivo com partidas", () => {
  it("soma na partida, no total do time e no jogador", () => {
    const s = applyLiveGoal(state(), teams, 1, { memberId: "a" });
    expect(s.round).toMatchObject({ home_score: 1, away_score: 0, goals: { a: 1 } });
    expect(s.scores).toEqual([1, 0, 0]);
    expect(s.goals).toEqual({ a: 1 });
  });

  it("quem não está na partida não marca", () => {
    const s = state();
    expect(applyLiveGoal(s, teams, 1, { memberId: "d" })).toBe(s);
    expect(applyLiveGoal(s, teams, 1, { team: 2 })).toBe(s);
  });

  it("sem partida começada não marca", () => {
    const s = state({ round: null });
    expect(applyLiveGoal(s, teams, 1, { memberId: "a" })).toBe(s);
  });

  it("chegou ao limite, a partida acaba; tirar o gol reabre", () => {
    const s = applyLiveGoal(state({ round: round({ home_score: 1, goals: { a: 1 } }), scores: [1, 0, 0], goals: { a: 1 } }), teams, 1, { memberId: "b" }, 2);
    expect(s.round).toMatchObject({ home_score: 2, finished: true });
    expect(applyLiveGoal(s, teams, 1, { memberId: "c" }, 2)).toBe(s);
    const back = applyLiveGoal(s, teams, -1, { memberId: "b" }, 2);
    expect(back.round).toMatchObject({ home_score: 1, finished: false });
    expect(back.goals).toEqual({ a: 1 });
  });

  it("tirar gol só do que foi marcado nesta partida", () => {
    // "a" tem 3 gols no dia, mas nenhum nesta partida.
    const s = state({ goals: { a: 3 }, scores: [3, 0, 0] });
    expect(applyLiveGoal(s, teams, -1, { memberId: "a" })).toBe(s);
  });

  it("gol contra vai para o adversário da partida", () => {
    expect(opponents(teams, "c", round())).toEqual([0]);
    expect(opponents(teams, "d", round())).toEqual([]);
    const s = applyLiveGoal(state(), teams, 1, { ownGoal: "c", team: 0 });
    expect(s.round).toMatchObject({ home_score: 1, own_goals: { c: 1 } });
    expect(applyLiveGoal(state(), teams, 1, { ownGoal: "c", team: 2 }).round).toMatchObject({ home_score: 0 });
  });
});

describe("classificação com partidas", () => {
  it("cada partida conta como um jogo para os jogadores dos dois times", () => {
    const game = {
      starts_at: "2026-11-20T23:00:00Z",
      teams,
      scores: [2, 1, 1],
      rounds: [r(0, 1, 2, 1), r(0, 2, 0, 1)],
    };
    const t = standings([game], (id) => id);
    const row = (k: string) => t.players.find((x) => x.key === k)!;
    expect(row("a")).toMatchObject({ played: 2, wins: 1, losses: 1, goalsFor: 2, goalsAgainst: 2 });
    expect(row("c")).toMatchObject({ played: 1, losses: 1 });
    expect(row("d")).toMatchObject({ played: 1, wins: 1 });
  });
});
