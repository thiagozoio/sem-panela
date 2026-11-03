import { describe, expect, it } from "vitest";
import { addToTeam, removeFromTeams } from "../guest-team";
import type { Team } from "../types";

const p = (id: string) => ({ member_id: id, name: id, position: "linha" as const });
const teams: Team[] = [
  { name: "Azul", players: [p("a"), p("b"), p("c")] },
  { name: "Branco", players: [p("d"), p("e")] },
];

describe("addToTeam", () => {
  it("põe no time escolhido", () => {
    const out = addToTeam(teams, p("g"), "Azul");
    expect(out[0].players.map((x) => x.member_id)).toEqual(["a", "b", "c", "g"]);
    expect(out[1].players).toHaveLength(2);
  });
  it("sem escolha, completa o time com menos gente", () => {
    const out = addToTeam(teams, p("g"), "");
    expect(out[1].players.map((x) => x.member_id)).toContain("g");
  });
  it("trocar de time não duplica", () => {
    const once = addToTeam(teams, p("g"), "Azul");
    const twice = addToTeam(once, p("g"), "Branco");
    expect(twice.flatMap((t) => t.players).filter((x) => x.member_id === "g")).toHaveLength(1);
    expect(twice[1].players.map((x) => x.member_id)).toContain("g");
  });
  it("removeFromTeams tira de todos", () => {
    expect(removeFromTeams(addToTeam(teams, p("g"), "Azul"), "g").flatMap((t) => t.players)).toHaveLength(5);
  });
});
