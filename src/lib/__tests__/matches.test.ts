import { describe, expect, it } from "vitest";
import { brazilDateTime, formatPhone, matchRecord, phoneDigits, splitMatches, toBrazilInputs, whatsappTo } from "../matches";
import type { Match } from "../types";

const match = (id: string, starts_at: string, opponent: string, our: number | null = null, their: number | null = null): Match => ({
  id, group_id: "g", starts_at, opponent, location: "", contact_name: "", contact_phone: "", notes: "",
  our_score: our, their_score: their, created_at: starts_at,
});

describe("telefone", () => {
  it("normaliza e formata", () => {
    expect(phoneDigits("+55 (47) 99203-7481")).toBe("47992037481");
    expect(formatPhone("47992037481")).toBe("(47) 99203-7481");
    expect(formatPhone("4733334444")).toBe("(47) 3333-4444");
    expect(formatPhone(" 1234 ")).toBe("1234");
  });
  it("link do WhatsApp só com DDD", () => {
    expect(whatsappTo("47 992037481")).toBe("https://wa.me/5547992037481");
    expect(whatsappTo("992037481")).toBe("");
  });
});

describe("data e hora de Brasília", () => {
  it("ida e volta", () => {
    const iso = brazilDateTime("2026-10-25", "16:30")!;
    expect(iso).toBe("2026-10-25T19:30:00.000Z");
    expect(toBrazilInputs(iso)).toEqual(["2026-10-25", "16:30"]);
    expect(toBrazilInputs("2026-10-26T01:00:00Z")).toEqual(["2026-10-25", "22:00"]);
    expect(brazilDateTime("", "16:30")).toBeNull();
  });
});

describe("amistosos", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  it("separa próximos e histórico", () => {
    const { upcoming, past } = splitMatches(
      [
        match("futuro2", "2026-11-01T19:00:00Z", "B"),
        match("futuro1", "2026-10-25T19:00:00Z", "A"),
        match("hoje-sem-placar", "2026-10-20T10:00:00Z", "C"),
        match("hoje-com-placar", "2026-10-20T09:00:00Z", "C", 2, 1),
        match("antigo-sem-placar", "2026-10-10T19:00:00Z", "D"),
      ],
      now,
    );
    expect(upcoming.map((m) => m.id)).toEqual(["hoje-sem-placar", "futuro1", "futuro2"]);
    expect(past.map((m) => m.id)).toEqual(["hoje-com-placar", "antigo-sem-placar"]);
  });
  it("retrospecto geral e por adversário", () => {
    const { total, opponents } = matchRecord([
      match("1", "2026-10-01T19:00:00Z", "Amigos FC", 3, 1),
      match("2", "2026-10-08T19:00:00Z", "amigos fc ", 2, 2),
      match("3", "2026-10-15T19:00:00Z", "Vila", 0, 1),
      match("4", "2026-10-16T19:00:00Z", "Vila"),
    ]);
    expect(total).toMatchObject({ games: 3, wins: 1, draws: 1, losses: 1, scored: 5, conceded: 4 });
    expect(opponents.map((o) => [o.opponent, o.games])).toEqual([["Amigos FC", 2], ["Vila", 1]]);
  });
});
