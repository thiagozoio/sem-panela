import { describe, expect, it } from "vitest";
import { accessMessage, isLinkEmail, isLinkToken, linkEmail } from "../player-link";

describe("player-link", () => {
  it("monta e reconhece o e-mail interno", () => {
    const email = linkEmail("abc");
    expect(email).toBe("abc@jogador.sempanela.app.br");
    expect(isLinkEmail(email)).toBe(true);
    expect(isLinkEmail("ze@gmail.com")).toBe(false);
  });

  it("aceita só o token no formato do banco", () => {
    expect(isLinkToken("a".repeat(64))).toBe(true);
    expect(isLinkToken("a".repeat(63))).toBe(false);
    expect(isLinkToken("../" + "a".repeat(61))).toBe(false);
  });

  it("usa o primeiro nome na mensagem", () => {
    const text = accessMessage("João da Silva", "Pelada de Quinta", "https://x/entrar/1");
    expect(text).toContain("Oi, João!");
    expect(text).toContain("Pelada de Quinta");
    expect(text).toContain("https://x/entrar/1");
  });
});
