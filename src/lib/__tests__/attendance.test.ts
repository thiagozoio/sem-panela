import { describe, expect, it } from "vitest";
import { splitList } from "../attendance";
import type { Attendance, Member } from "../types";

const member = (id: string, kind: Member["kind"]): Member => ({
  id, group_id: "g", user_id: null, name: id, position: "linha", skill: 3, phone: "", kind,
  is_organizer: false, active: true, created_at: "",
});

const att = (member_id: string, confirmed_at: string, going = true): Attendance => ({
  game_id: "x", member_id, going, confirmed_at,
});

const START = "2026-10-15T23:00:00Z";

describe("splitList", () => {
  const members = [member("ana", "avulso"), member("bia", "mensalista"), member("caio", "mensalista"), member("duda", "avulso")];

  it("ordem de confirmação e lista de espera", () => {
    const r = splitList(
      [att("ana", "2026-10-13T10:00:00Z"), att("duda", "2026-10-13T11:00:00Z"), att("bia", "2026-10-15T22:00:00Z")],
      members, 2, START, 24,
    );
    expect(r.confirmed.map((e) => e.member.id)).toEqual(["ana", "duda"]);
    expect(r.waitlist.map((e) => e.member.id)).toEqual(["bia"]);
  });

  it("mensalista que confirma antes do prazo passa na frente", () => {
    const r = splitList(
      [att("ana", "2026-10-13T10:00:00Z"), att("duda", "2026-10-13T11:00:00Z"), att("bia", "2026-10-14T09:00:00Z")],
      members, 2, START, 24,
    );
    expect(r.confirmed.map((e) => e.member.id)).toEqual(["bia", "ana"]);
    expect(r.waitlist.map((e) => e.member.id)).toEqual(["duda"]);
  });

  it("quem desistiu sai da lista e libera vaga", () => {
    const r = splitList(
      [att("ana", "2026-10-13T10:00:00Z", false), att("duda", "2026-10-13T11:00:00Z"), att("caio", "2026-10-15T20:00:00Z")],
      members, 2, START, 24,
    );
    expect(r.confirmed.map((e) => e.member.id)).toEqual(["duda", "caio"]);
    expect(r.out.map((m) => m.id)).toEqual(["ana"]);
  });
});
