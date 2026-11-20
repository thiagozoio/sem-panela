import { describe, expect, it } from "vitest";
import { guestTeams, teamsFromFixed, withGuestTeams } from "../fixed-teams";
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

  it("avulso evita o time de quem ele não joga junto", () => {
    const teams = teamsFromFixed(
      [
        { name: "Azul", member_ids: ["a1", "a2"] },
        { name: "Branco", member_ids: ["b1", "b2"] },
      ],
      [p("a1", 1), p("a2", 1), p("b1", 5), p("b2", 5), p("x")],
      [["x", "a1"]],
    );
    expect(teams[1].players.map((q) => q.member_id)).toContain("x");
  });
});

describe("convidados nos times fixos", () => {
  const fixed = [
    { name: "Azul", member_ids: ["a1"] },
    { name: "Branco", member_ids: ["b1"] },
  ];

  it("guestTeams só pega convidados com time", () => {
    const map = guestTeams(
      [
        { member_id: "g1", team: "Azul" },
        { member_id: "g2", team: null },
        { member_id: "a1", team: "Branco" },
      ],
      [
        { id: "g1", guest: true },
        { id: "g2", guest: true },
        { id: "a1", guest: false },
      ],
    );
    expect([...map]).toEqual([["g1", "Azul"]]);
  });

  it("põe o convidado no time escolhido sem mexer no original", () => {
    const out = withGuestTeams(fixed, new Map([["g1", "Branco"]]));
    expect(out.map((t) => t.member_ids)).toEqual([["a1"], ["b1", "g1"]]);
    expect(fixed[1].member_ids).toEqual(["b1"]);
  });

  it("o mesmo convidado pode cair em outro time em outro jogo", () => {
    expect(withGuestTeams(fixed, new Map([["g1", "Azul"]]))[0].member_ids).toEqual(["a1", "g1"]);
    expect(withGuestTeams(fixed, new Map([["g1", "Branco"]]))[0].member_ids).toEqual(["a1"]);
  });
});
