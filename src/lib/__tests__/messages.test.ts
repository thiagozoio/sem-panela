import { describe, expect, it } from "vitest";
import { listMessage, teamNames } from "../messages";
import type { ListEntry } from "../attendance";
import type { Member } from "../types";

const entry = (id: string, name: string, position = "linha"): ListEntry => ({
  member: { id, name, position } as Member,
  confirmedAt: "2026-11-01T10:00:00Z",
  priority: false,
});

describe("listMessage", () => {
  const confirmed = [entry("a", "Ana", "goleiro"), entry("b", "Beto"), entry("c", "Caio")];

  it("sem times, lista só os nomes", () => {
    const msg = listMessage("Pelada", "2026-11-05T22:00:00Z", confirmed, [], 10, "https://x/g/1", "society");
    expect(msg).toContain("1. Ana 🧤\n");
    expect(msg).not.toContain("·");
  });

  it("com times, mostra o time de cada jogador", () => {
    const teamOf = teamNames([
      { name: "Azul", member_ids: ["a", "b"] },
      { name: "Branco", member_ids: ["x"] },
    ]);
    const msg = listMessage("Pelada", "2026-11-05T22:00:00Z", confirmed, [], 10, "https://x/g/1", "society", teamOf);
    expect(msg).toContain("1. Ana 🧤 · Azul");
    expect(msg).toContain("2. Beto");
    expect(msg).toMatch(/2\. Beto.* · Azul/);
    expect(msg).toMatch(/3\. Caio[^\n·]*\n/);
  });
});
