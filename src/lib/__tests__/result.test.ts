import { describe, expect, it } from "vitest";
import { bestPlayer, resultMessage, scorers } from "../result";

describe("bestPlayer", () => {
  it("pega a maior média com pelo menos 2 votos", () => {
    const best = bestPlayer([
      { member_id: "a", average: 9.5, votes: 1 },
      { member_id: "b", average: 8.2, votes: 5 },
      { member_id: "c", average: 8.2, votes: 7 },
    ]);
    expect(best?.member_id).toBe("c");
  });

  it("sem votos suficientes, ninguém", () => {
    expect(bestPlayer([{ member_id: "a", average: 10, votes: 1 }])).toBeNull();
  });
});

describe("resultMessage", () => {
  it("mostra placar, gols e craque", () => {
    const goals = scorers(
      [
        { game_id: "g", member_id: "1", goals: 2 },
        { game_id: "g", member_id: "2", goals: 1 },
      ],
      (id) => (id === "1" ? "Pedro" : "Zé"),
    );
    const text = resultMessage(
      "Pelada",
      "2026-10-22T23:00:00Z",
      [
        { name: "Azul", players: [] },
        { name: "Branco", players: [] },
      ],
      [3, 2],
      goals,
      "Pedro",
    );
    expect(text).toContain("*Azul* 3");
    expect(text).toContain("*Branco* 2");
    expect(text).toContain("⚽ Pedro (2)");
    expect(text).toContain("⚽ Zé\n");
    expect(text).toContain("Craque do jogo: *Pedro*");
  });
});
