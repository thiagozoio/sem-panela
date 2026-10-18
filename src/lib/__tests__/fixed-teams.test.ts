import { describe, expect, it } from "vitest";
import { teamsFromFixed } from "../fixed-teams";
import type { DrawPlayer } from "../draw";

const p = (id: string, skill = 3, position: "linha" | "goleiro" = "linha"): DrawPlayer => ({
  member_id: id,
  name: id,
  position,
  skill,
});

describe("teamsFromFixed", () => {
  it("mantém cada confirmado no seu time fixo, com o nome do time", () => {
    const teams = teamsFromFixed(
      [
        { name: "Azul", member_ids: ["a1", "a2", "a3"] },
        { name: "Branco", member_ids: ["b1", "b2"] },
      ],
      [p("a1"), p("a2"), p("b1"), p("b2", 3, "goleiro")],
    );
    expect(teams.map((t) => t.name)).toEqual(["Azul", "Branco"]);
    expect(teams[0].players.map((x) => x.member_id)).toEqual(["a1", "a2"]);
    expect(teams[1].players.map((x) => x.member_id)).toEqual(["b2", "b1"]); // goleiro primeiro
  });

  it("completa o time menor com quem não tem time fixo", () => {
    const teams = teamsFromFixed(
      [
        { name: "Azul", member_ids: ["a1", "a2", "a3"] },
        { name: "Branco", member_ids: ["b1"] },
      ],
      [p("a1"), p("a2"), p("a3"), p("b1"), p("x1", 5), p("x2", 1)],
    );
    expect(teams[0].players).toHaveLength(3);
    expect(teams[1].players.map((x) => x.member_id).sort()).toEqual(["b1", "x1", "x2"]);
  });

  it("deixa de fora o time fixo sem ninguém confirmado", () => {
    const teams = teamsFromFixed(
      [
        { name: "Azul", member_ids: ["a1"] },
        { name: "Branco", member_ids: ["b1"] },
        { name: "Vermelho", member_ids: ["v1"] },
      ],
      [p("a1"), p("b1"), p("x1")],
    );
    expect(teams.map((t) => t.name)).toEqual(["Azul", "Branco"]);
    expect(teams.flatMap((t) => t.players)).toHaveLength(3);
  });
});
