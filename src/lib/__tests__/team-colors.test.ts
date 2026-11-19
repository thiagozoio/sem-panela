import { describe, expect, it } from "vitest";
import { teamColors } from "../team-colors";

describe("teamColors", () => {
  it("usa a cor do nome do time", () => {
    const [azul, laranja, branco] = teamColors(["Time Azul", "LARANJA", "Branco"]);
    expect(azul.bg).toBe("#2563eb");
    expect(laranja.bg).toBe("#ea580c");
    expect(branco.plain).toBe(true);
  });

  it("times sem cor no nome ganham cores diferentes, sem repetir a de outro time", () => {
    const [t1, azul, t3] = teamColors(["Time 1", "Azul", "Time 3"]);
    expect(azul.bg).toBe("#2563eb");
    expect(t1.bg).not.toBe(azul.bg);
    expect(t3.bg).not.toBe(azul.bg);
    expect(t3.bg).not.toBe(t1.bg);
  });
});
