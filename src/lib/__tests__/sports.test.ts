import { describe, expect, it } from "vitest";
import { byPosition, positionOf, positionOptions, sportOf } from "../sports";

describe("modalidades", () => {
  it("grupo sem modalidade é society", () => {
    expect(sportOf(undefined)).toBe("society");
    expect(sportOf("volei")).toBe("volei");
  });

  it("posição de outra modalidade vira coringa", () => {
    expect(positionOf("futsal", "pivo")).toBe("pivo");
    expect(positionOf("futsal", "zagueiro")).toBe("linha");
    expect(positionOf("volei", "goleiro")).toBe("linha");
  });

  it("opções começam pela coringa", () => {
    expect(positionOptions("campo").map((p) => p.value)).toEqual([
      "linha", "goleiro", "zagueiro", "lateral", "volante", "meio", "atacante",
    ]);
  });

  it("ordena goleiro, defesa, ataque, coringas", () => {
    const ps = [
      { name: "A", position: "linha" },
      { name: "B", position: "pivo" },
      { name: "C", position: "goleiro" },
      { name: "D", position: "fixo" },
    ];
    expect(ps.sort(byPosition("futsal")).map((p) => p.name)).toEqual(["C", "D", "B", "A"]);
  });
});
