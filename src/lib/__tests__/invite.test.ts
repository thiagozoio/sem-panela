import { describe, expect, it } from "vitest";
import { inviteCodeFromPath, inviteCodeFromText, isInviteCode } from "../invite";

describe("invite", () => {
  it("aceita só códigos no formato do banco", () => {
    expect(isInviteCode("f84c1d2b06")).toBe(true);
    expect(isInviteCode("../x")).toBe(false);
    expect(isInviteCode("")).toBe(false);
    expect(isInviteCode(undefined)).toBe(false);
  });

  it("lê o código do caminho /convite/<código>", () => {
    expect(inviteCodeFromPath("/convite/f84c1d2b06")).toBe("f84c1d2b06");
    expect(inviteCodeFromPath("/convite/f84c1d2b06/")).toBe("f84c1d2b06");
    expect(inviteCodeFromPath("/convite/")).toBeNull();
    expect(inviteCodeFromPath("/grupos")).toBeNull();
    expect(inviteCodeFromPath("/convite/a%2Fb")).toBeNull();
  });

  it("lê o código do link colado ou do código solto", () => {
    expect(inviteCodeFromText("https://sempanela.app.br/convite/f84c1d2b06")).toBe("f84c1d2b06");
    expect(inviteCodeFromText(" sempanela.app.br/convite/f84c1d2b06?x=1 ")).toBe("f84c1d2b06");
    expect(inviteCodeFromText("f84c1d2b06")).toBe("f84c1d2b06");
    expect(inviteCodeFromText("oi, cadê o link?")).toBeNull();
  });
});
