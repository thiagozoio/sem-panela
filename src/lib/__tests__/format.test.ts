import { describe, expect, it } from "vitest";
import { addMonths, parseMoney, todayInBrazil } from "../format";
import { isTrial, subscriptionState } from "../subscription";

describe("format", () => {
  it("addMonths segura fim de mês", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-10-14", 1)).toBe("2026-11-14");
    expect(addMonths("2026-12-10", 12)).toBe("2027-12-10");
  });
  it("parseMoney", () => {
    expect(parseMoney("80")).toBe(8000);
    expect(parseMoney("R$ 1.080,50")).toBe(108050);
    expect(parseMoney("abc")).toBe(0);
  });
  it("todayInBrazil usa o fuso de SP", () => {
    expect(todayInBrazil(new Date("2026-10-15T02:00:00Z"))).toBe("2026-10-14");
  });
});

describe("subscriptionState", () => {
  it("estados", () => {
    expect(subscriptionState("2026-11-13", "2026-10-14").status).toBe("ok");
    expect(subscriptionState("2026-10-16", "2026-10-14").status).toBe("due_soon");
    expect(subscriptionState("2026-10-10", "2026-10-14").status).toBe("grace");
    expect(subscriptionState("2026-10-07", "2026-10-14").status).toBe("grace");
    expect(subscriptionState("2026-10-06", "2026-10-14").status).toBe("free");
  });
  it("teste grátis até o admin estender o pago até", () => {
    expect(isTrial("2026-10-14T23:30:00Z", "2026-11-13")).toBe(true);
    expect(isTrial("2026-10-14T23:30:00Z", "2026-12-13")).toBe(false);
  });
});
