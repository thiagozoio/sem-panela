import { describe, expect, it } from "vitest";
import {
  championshipChampions,
  currentChampionship,
  goalDiff,
  inChampionship,
  leaders,
  monthlyChampions,
  monthlyTeamChampions,
  outcomes,
  points,
  rankingOf,
  decideChampion,
  finalTeamIds,
  turnsOf,
  seasonChampionships,
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

describe("times sorteados a cada mês", () => {
  // "Time 1" de outubro e de novembro têm jogadores diferentes.
  const games = [
    game("2026-10-01T23:00:00Z", ["Time 1", "Time 2"], [["a", "b"], ["c", "d"]], [3, 0]),
    game("2026-11-05T23:00:00Z", ["Time 1", "Time 2"], [["a", "c"], ["b", "d"]], [0, 2]),
  ];
  const fixed = () => new Set(["Time 1", "Time 2"]);

  it("campeão de time por mês, sem somar meses", () => {
    expect(monthlyTeamChampions(games, nameOf, fixed).map((t) => [t.month, t.teams.map((r) => r.name)])).toEqual([
      ["2026-10-01", ["Time 1"]],
      ["2026-11-01", ["Time 2"]],
    ]);
  });

  it("campeonato encerrado não tem time campeão", () => {
    const list = [{ id: "1", group_id: "g", name: "2º turno", starts_on: "2026-10-01", ends_on: "2026-11-30" }];
    const [title] = championshipChampions(list, games, "2026-12-10", nameOf);
    expect(title.teams).toEqual([]);
    expect(title.players.map((r) => r.key)).toEqual(["b"]);
  });
});

describe("seasonChampionships", () => {
  it("1º turno, 2º turno no dia seguinte e anual", () => {
    expect(seasonChampionships(2027, "2027-06-30")).toEqual([
      { name: "1º turno 2027", starts_on: "2027-01-01", ends_on: "2027-06-30" },
      { name: "2º turno 2027", starts_on: "2027-07-01", ends_on: "2027-12-31" },
      { name: "Anual 2027", starts_on: "2027-01-01", ends_on: "2027-12-31" },
    ]);
  });
  it("fim do 1º turno fora do ano não cria nada", () => {
    expect(seasonChampionships(2027, "2026-12-31")).toBeNull();
    expect(seasonChampionships(2027, "2027-12-31")).toBeNull();
    expect(seasonChampionships(2027, "")).toBeNull();
  });
});

describe("final e campeão à mão", () => {
  const base = { group_id: "g", starts_on: "2026-01-01", ends_on: "2026-12-31" };
  const final = { ...game("2026-12-20T23:00:00Z", ["1º turno", "2º turno"], [["a", "b"], ["c", "d"]], [1, 2]), id: "f" };
  const regular = { ...game("2026-03-01T23:00:00Z", ["A", "B"], [["a", "b"], ["c", "d"]], [5, 0]), id: "r" };

  it("na final, campeão é o time que venceu o jogo final", () => {
    const c = { ...base, id: "anual", name: "Anual", decided_by: "final" as const, final_game_id: "f" };
    expect(decideChampion(c, [], final, "2026-12-21", nameOf).champions.map((r) => r.key)).toEqual(["c", "d"]);
    expect(decideChampion(c, [], undefined, "2026-12-21", nameOf).pending).toBe("sem-placar");
    expect(decideChampion({ ...c, final_game_id: null }, [], undefined, "2026-12-21", nameOf).pending).toBe("sem-jogo");
    const tie = { ...final, scores: [2, 2] };
    expect(decideChampion(c, [], tie, "2026-12-21", nameOf).pending).toBe("empate");
  });

  it("jogo final não conta pontos e define o histórico", () => {
    const list = [{ ...base, id: "anual", name: "Anual", decided_by: "final" as const, final_game_id: "f" }];
    const [title] = championshipChampions(list, [regular, final], "2026-12-21", nameOf);
    expect(title.players.map((r) => r.key)).toEqual(["c", "d"]);
  });

  it("à mão: quem o organizador marcou, mesmo antes do fim", () => {
    const c = { ...base, id: "x", name: "Anual", decided_by: "manual" as const, champion_ids: ["b"] };
    expect(decideChampion(c, [], undefined, "2026-06-01", nameOf).champions.map((r) => r.key)).toEqual(["b"]);
    expect(decideChampion({ ...c, champion_ids: [] }, [], undefined, "2026-06-01", nameOf).pending).toBe("manual");
  });

  it("pela tabela: só depois que acaba", () => {
    const c = { ...base, id: "x", name: "Anual" };
    const { players } = standings([regular], nameOf);
    expect(decideChampion(c, players, undefined, "2026-06-01", nameOf).pending).toBe("tabela");
    expect(decideChampion(c, players, undefined, "2027-01-01", nameOf).champions.map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("turnos dentro do anual e times da final sem repetir jogador", () => {
    const list = [
      { ...base, id: "anual", name: "Anual" },
      { ...base, id: "t2", name: "2º turno", starts_on: "2026-07-01" },
      { ...base, id: "t1", name: "1º turno", ends_on: "2026-06-30" },
    ];
    expect(turnsOf(list[0], list).map((t) => t.id)).toEqual(["t1", "t2"]);
    const row = (key: string) => ({ key, name: key, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 });
    expect(finalTeamIds(["a", "b", "c"].map(row), ["b", "d", "e", "f"].map(row), 2)).toEqual([
      ["a", "b"],
      ["d", "e"],
    ]);
  });
});
