import { describe, expect, it } from "vitest";
import { gamesToRemind, nextDay, notify, promotedMembers, weekdayOf } from "../notifications";
import type { ListEntry } from "../attendance";
import type { Member } from "../types";

const entry = (id: string): ListEntry => ({ member: { id } as Member, confirmedAt: "", priority: false });

describe("notifications", () => {
  it("weekdayOf e nextDay", () => {
    expect(weekdayOf("2026-10-31")).toBe(6); // sábado
    expect(nextDay("2026-10-31")).toBe("2026-11-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
  });

  it("lembra o jogo de amanhã no horário de Brasília", () => {
    const now = new Date("2026-10-30T13:00:00Z"); // sexta, 10h em SP
    expect(gamesToRemind({ weekday: 6, start_time: "20:00:00" }, "2026-10-30", now)).toEqual([
      { startsAt: "2026-10-31T23:00:00.000Z", when: "amanhã" },
    ]);
    expect(gamesToRemind({ weekday: 3, start_time: "20:00:00" }, "2026-10-30", now)).toEqual([]);
  });

  it("lembra o jogo de hoje só se ainda não começou", () => {
    const now = new Date("2026-10-31T13:00:00Z"); // sábado, 10h em SP
    expect(gamesToRemind({ weekday: 6, start_time: "20:00:00" }, "2026-10-31", now)).toEqual([
      { startsAt: "2026-10-31T23:00:00.000Z", when: "hoje" },
    ]);
    expect(gamesToRemind({ weekday: 6, start_time: "08:00:00" }, "2026-10-31", now)).toEqual([]);
  });

  it("promotedMembers devolve só quem entrou na lista principal", () => {
    expect(promotedMembers([entry("a"), entry("b")], [entry("a"), entry("c")])).toEqual(["c"]);
    expect(promotedMembers([entry("a")], [entry("a")])).toEqual([]);
  });

  it("textos", () => {
    expect(notify.gameReminder("g1", "Pelada", "2026-10-31T23:00:00.000Z", "amanhã")).toMatchObject({
      title: "Pelada",
      body: "Tem pelada amanhã às 20:00. Você vai? Toque para confirmar na lista.",
      url: "/g/g1",
    });
    expect(notify.subscription("g1", "Pelada", 3).body).toContain("vence em 3 dias");
    expect(notify.subscription("g1", "Pelada", -1).body).toContain("Em 7 dias");
    const fee = notify.monthlyFee("g1", "Pelada", "Outubro de 2026", 8000, "chave").body;
    expect(fee).toMatch(/^Sua mensalidade de outubro de 2026 \(R\$\s80,00\) ainda está em aberto\. Pix: chave$/);
  });
});
