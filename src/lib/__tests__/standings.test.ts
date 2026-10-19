import { describe, expect, it } from "vitest";
import {
  championshipChampions,
  currentChampionship,
  goalDiff,
  inChampionship,
  leaders,
  monthlyChampions,
  outcomes,
  points,
  rankingOf,
  standings,
  standingsMessage,
  topScorers,
  type ResultGame,
} from "../standings";

const p = (id: string) => ({ member_id: id, name: id.toUpperCase(), position: "linha" as const });
const game = (starts_at: string, names: string[], players: string[][], scores: number[] | null): ResultGame => ({
  starts_at,
  teams: names.map((name, i) => ({ name, players: players[i].map(p) })),
  scores,
});
const nameOf = (_id: string, fallback: string) => fallback;

describe("outcomes", () => {
  it("2 times: vitória, derrota e gols contra", () => {
    expect(outcomes([3, 1])).toEqual([
      { result: "V", goalsFor: 3, goalsAgainst: 1 },
      { result: "D", goalsFor: 1, goalsAgainst: 3 },
    ]);
  });
  it("empate", () => {
    expect(outcomes([2, 2]).map((o) => o.result)).toEqual(["E", "E"]);
  });
  it("3 times: quem fez mais vence, gols contra somam os outros", () => {
    expect(outcomes([5, 2, 1])).toEqual([
      { result: "V", goalsFor: 5, goalsAgainst: 3 },
      { result: "D", goalsFor: 2, goalsAgainst: 6 },
      { result: "D", goalsFor: 1, goalsAgainst: 7 },
    ]);
    expect(outcomes([4, 4, 1]).map((o) => o.result)).toEqual(["E", "E", "D"]);
  });
});

describe("standings", () => {
  const games = [
    game("2026-10-01T23:00:00Z", ["Azul", "Branco"], [["a", "b"], ["c", "d"]], [3, 1]),
    game("2026-10-08T23:00:00Z", ["Azul", "Branco"], [["a", "c"], ["b", "d"]], [2, 2]),
    game("2026-10-15T23:00:00Z", ["Azul", "Branco"], [["a"], ["b"]], null), // sem placar: não conta
  ];

  it("soma jogos, V/E/D, gols e ordena por pontos", () => {
    const { players } = standings(games, nameOf);
    expect(players.map((r) => r.key)).toEqual(["a", "b", "c", "d"]);
    const a = players[0];
    expect([a.played, a.wins, a.draws, a.losses, a.goalsFor, a.goalsAgainst]).toEqual([2, 1, 1, 0, 5, 3]);
    expect(points(a)).toBe(4);
    expect(goalDiff(a)).toBe(2);
    const d = players[3];
    expect([d.played, d.wins, d.draws, d.losses, points(d), goalDiff(d)]).toEqual([2, 0, 1, 1, 1, -2]);
  });

  it("tabela de times só com os times fixos do mês", () => {
    expect(standings(games, nameOf).teams).toEqual([]);
    const { teams } = standings(games, nameOf, (m) => new Set(m === "2026-10-01" ? ["Azul", "Branco"] : []));
    expect(teams.map((t) => [t.name, points(t)])).toEqual([
      ["Azul", 4],
      ["Branco", 1],
    ]);
  });

  it("usa o nome atual do jogador", () => {
    const { players } = standings(games, (id) => `Jogador ${id}`);
    expect(players[0].name).toBe("Jogador a");
  });

  it("empate em tudo: os dois são líderes", () => {
    const { players } = standings([game("2026-10-01T23:00:00Z", ["A", "B"], [["a", "b"], ["c"]], [1, 0])], nameOf);
    expect(leaders(players).map((r) => r.key)).toEqual(["a", "b"]);
    expect(leaders([])).toEqual([]);
  });
});

describe("períodos", () => {
  // 23h de 31/10 em São Paulo ainda é outubro, mesmo sendo 01/11 em UTC.
  const games = [
    game("2026-10-01T02:00:00Z", ["A", "B"], [["a"], ["b"]], [0, 1]), // 30/09 em SP
    game("2026-11-01T02:00:00Z", ["A", "B"], [["a"], ["b"]], [2, 0]), // 31/10 em SP
    game("2026-11-05T23:00:00Z", ["A", "B"], [["a"], ["b"]], [0, 1]),
  ];

  it("campeonato usa o dia de São Paulo", () => {
    expect(inChampionship(games, { starts_on: "2026-10-01", ends_on: "2026-10-31" })).toHaveLength(1);
  });

  it("campeões do mês só dos meses que acabaram", () => {
    const titles = monthlyChampions(games, "2026-11-10", nameOf);
    expect(titles.map((t) => [t.key, t.players.map((r) => r.key)])).toEqual([
      ["2026-10-01", ["a"]],
      ["2026-09-01", ["b"]],
    ]);
  });

  it("campeões dos campeonatos encerrados", () => {
    const list = [
      { id: "1", group_id: "g", name: "1º turno", starts_on: "2026-09-01", ends_on: "2026-10-31" },
      { id: "2", group_id: "g", name: "2º turno", starts_on: "2026-11-01", ends_on: "2026-12-31" },
      { id: "3", group_id: "g", name: "Vazio", starts_on: "2026-01-01", ends_on: "2026-01-31" },
    ];
    const titles = championshipChampions(list, games, "2026-11-10", nameOf);
    // 1º turno: a e b com 1 vitória cada; a tem saldo +1, b tem -1.
    expect(titles.map((t) => [t.label, t.players.map((r) => r.key)])).toEqual([["1º turno", ["a"]]]);
  });

  it("campeonato atual", () => {
    const list = [
      { id: "1", group_id: "g", name: "1º", starts_on: "2026-01-01", ends_on: "2026-06-30" },
      { id: "2", group_id: "g", name: "2º", starts_on: "2026-07-01", ends_on: "2026-12-31" },
    ];
    expect(currentChampionship(list, "2026-08-01")?.id).toBe("2");
    expect(currentChampionship(list.slice(0, 1), "2026-08-01")?.id).toBe("1");
    expect(currentChampionship(list, "2025-12-01")?.id).toBe("1");
    expect(currentChampionship([], "2026-08-01")).toBeNull();
  });
});

describe("topScorers", () => {
  it("soma os gols do período", () => {
    const games: ResultGame[] = [
      { ...game("2026-10-01T23:00:00Z", ["A", "B"], [["a"], ["b"]], [2, 1]), game_goals: [{ member_id: "a", goals: 2 }, { member_id: "b", goals: 1 }] },
      { ...game("2026-10-08T23:00:00Z", ["A", "B"], [["a"], ["b"]], [0, 3]), game_goals: [{ member_id: "b", goals: 3 }] },
    ];
    expect(topScorers(games, (id) => id)).toEqual([
      { member_id: "b", name: "b", goals: 4 },
      { member_id: "a", name: "a", goals: 2 },
    ]);
  });
});

describe("rankingOf e mensagem", () => {
  it("valor desconhecido vira desligada", () => {
    expect(rankingOf(undefined)).toBe("off");
    expect(rankingOf("mensal")).toBe("mensal");
  });

  it("mensagem com pontos e saldo", () => {
    const { players } = standings([game("2026-10-01T23:00:00Z", ["A", "B"], [["a"], ["b"]], [3, 1])], nameOf);
    const text = standingsMessage("Pelada", "Outubro de 2026", players, [], "society");
    expect(text).toContain("1. A: *3 pts* (1J 1V 0E 0D, saldo +2)");
    expect(standingsMessage("Pelada", "x", players, [], "volei")).toContain("(1J 1V 0D, saldo +2)");
  });
});
