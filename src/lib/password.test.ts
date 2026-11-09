import { describe, expect, it } from "vitest";
import { checkNewPassword } from "./password";

describe("checkNewPassword", () => {
  it("aceita senha com letras e números, confirmada", () => {
    expect(checkNewPassword("pelada2026", "pelada2026")).toBeNull();
  });
  it("barra senha curta, sem número ou sem letra", () => {
    expect(checkNewPassword("abc12", "abc12")).toMatch(/8 caracteres/);
    expect(checkNewPassword("peladaaaa", "peladaaaa")).toMatch(/letras e números/);
    expect(checkNewPassword("12345678", "12345678")).toMatch(/letras e números/);
  });
  it("barra confirmação diferente", () => {
    expect(checkNewPassword("pelada2026", "pelada2027")).toMatch(/não são iguais/);
  });
  it("barra senha acima do limite do Supabase", () => {
    expect(checkNewPassword("a1".repeat(40), "a1".repeat(40))).toMatch(/72/);
  });
});
