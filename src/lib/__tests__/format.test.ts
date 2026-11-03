import { describe, expect, it } from "vitest";
import { addMonths, isBillingMonth, parseMoney, todayInBrazil, whatsappAppUrl, whatsappLink } from "../format";
import { subscriptionState } from "../subscription";

describe("format", () => {
  it("isBillingMonth: meses antes do início não são cobrados", () => {
    expect(isBillingMonth(null, "2026-10-01")).toBe(true);
    expect(isBillingMonth(undefined, "2026-10-01")).toBe(true);
    expect(isBillingMonth("2026-11-01", "2026-10-01")).toBe(false);
    expect(isBillingMonth("2026-11-01", "2026-11-01")).toBe(true);
    expect(isBillingMonth("2026-11-01", "2027-01-01")).toBe(true);
  });

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
    expect(subscriptionState("2026-10-06", "2026-10-14").status).toBe("read_only");
  });
});

describe("whatsappAppUrl", () => {
  it("abre o app com o texto, mantendo quebras de linha e emojis", () => {
    const text = "⚽ *Pelada*\n1. João & Zé";
    expect(whatsappAppUrl(whatsappLink(text))).toBe(`whatsapp://send?text=${encodeURIComponent(text)}`);
  });
  it("leva o telefone quando o link é para um contato", () => {
    expect(whatsappAppUrl("https://wa.me/5511999998888?text=oi%20tudo")).toBe("whatsapp://send?phone=5511999998888&text=oi%20tudo");
    expect(whatsappAppUrl("https://wa.me/5511999998888")).toBe("whatsapp://send?phone=5511999998888");
  });
});
