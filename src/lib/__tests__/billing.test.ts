import { describe, expect, it } from "vitest";
import {
  asaasBaseUrl,
  cycleMonths,
  firstDueDate,
  isValidCpfCnpj,
  openPayment,
  sameSecret,
  webhookAction,
} from "../billing";

describe("asaasBaseUrl", () => {
  it("usa o sandbox para chave de homologação", () => {
    expect(asaasBaseUrl("$aact_hmlg_abc")).toBe("https://api-sandbox.asaas.com/v3");
    expect(asaasBaseUrl("$aact_prod_abc")).toBe("https://api.asaas.com/v3");
    expect(asaasBaseUrl("x", "https://outro/v3/")).toBe("https://outro/v3");
  });
});

describe("isValidCpfCnpj", () => {
  it("aceita CPF e CNPJ válidos, com ou sem máscara", () => {
    expect(isValidCpfCnpj("529.982.247-25")).toBe(true);
    expect(isValidCpfCnpj("52998224725")).toBe(true);
    expect(isValidCpfCnpj("11.222.333/0001-81")).toBe(true);
  });
  it("recusa dígito errado, repetidos e tamanho errado", () => {
    expect(isValidCpfCnpj("529.982.247-24")).toBe(false);
    expect(isValidCpfCnpj("111.111.111-11")).toBe(false);
    expect(isValidCpfCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCpfCnpj("1234")).toBe(false);
  });
});

describe("webhookAction", () => {
  it("libera no recebido/confirmado, desfaz no estorno, cancela na assinatura apagada", () => {
    expect(webhookAction("PAYMENT_RECEIVED")).toBe("apply");
    expect(webhookAction("PAYMENT_CONFIRMED")).toBe("apply");
    expect(webhookAction("PAYMENT_REFUNDED")).toBe("revert");
    expect(webhookAction("PAYMENT_CHARGEBACK_REQUESTED")).toBe("revert");
    expect(webhookAction("SUBSCRIPTION_DELETED")).toBe("cancel");
    expect(webhookAction("PAYMENT_OVERDUE")).toBe("ignore");
    expect(webhookAction("PAYMENT_CREATED")).toBe("ignore");
  });
});

describe("regras de data e ciclo", () => {
  it("primeiro vencimento é o pago até, ou hoje se já venceu", () => {
    expect(firstDueDate("2026-12-01", "2026-11-08")).toBe("2026-12-01");
    expect(firstDueDate("2026-10-01", "2026-11-08")).toBe("2026-11-08");
  });
  it("meses por ciclo", () => {
    expect(cycleMonths("MONTHLY")).toBe(1);
    expect(cycleMonths("YEARLY")).toBe(12);
  });
});

describe("openPayment", () => {
  const list = [
    { id: "a", status: "RECEIVED", dueDate: "2026-10-01" },
    { id: "b", status: "PENDING", dueDate: "2026-12-01" },
    { id: "c", status: "OVERDUE", dueDate: "2026-11-01" },
    { id: "e", status: "OVERDUE", dueDate: "2026-10-15" },
    { id: "d", status: "PENDING", dueDate: "2026-09-01", deleted: true },
  ];
  it("pega a cobrança do ciclo atual (a mais recente já vencida)", () => {
    expect(openPayment(list, "2026-11-08")?.id).toBe("c");
  });
  it("sem nada vencido, pega a próxima", () => {
    expect(openPayment(list, "2026-09-10")?.id).toBe("e");
    expect(openPayment([{ status: "RECEIVED", dueDate: "2026-10-01" }], "2026-11-08")).toBeNull();
  });
});

describe("sameSecret", () => {
  it("compara o token do webhook", () => {
    expect(sameSecret("abc", "abc")).toBe(true);
    expect(sameSecret("abc", "abd")).toBe(false);
    expect(sameSecret("abc", "abcd")).toBe(false);
    expect(sameSecret("", "")).toBe(false);
  });
});
