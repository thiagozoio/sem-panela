import { describe, expect, it } from "vitest";
import { safeNext } from "../safe-next";

describe("safeNext", () => {
  it("aceita caminhos internos", () => {
    expect(safeNext("/g/abc?x=1")).toBe("/g/abc?x=1");
    expect(safeNext("/convite/123abc")).toBe("/convite/123abc");
  });

  it("barra links para outros sites", () => {
    for (const bad of ["https://mal.com", "//mal.com", "/\\mal.com", "/\\/mal.com", "/\tmal", "mal.com", "", null, 42]) {
      expect(safeNext(bad)).toBe("/grupos");
    }
  });

  it("o resultado nunca sai do domínio", () => {
    for (const v of ["/\\mal.com", "//mal.com", "/ok"]) {
      expect(new URL(safeNext(v), "https://sempanela.app.br").host).toBe("sempanela.app.br");
    }
  });
});
