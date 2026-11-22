import { describe, expect, it } from "vitest";
import { describeChange, groupChanges, undoableIds, undoErrorMessage, type ChangeEntry } from "../history";

let next = 1;
function entry(p: Partial<ChangeEntry>): ChangeEntry {
  return {
    id: next++,
    change_id: "c1",
    actor_id: "u1",
    table_name: "payments",
    op: "INSERT",
    row_key: { id: "x" },
    old_row: null,
    new_row: null,
    created_at: "2026-11-22T23:00:00Z",
    undone_at: null,
    undone_by: null,
    ...p,
  };
}

const names = {
  members: new Map([
    ["m1", "Rafa"],
    ["m2", "Bruno"],
  ]),
  games: new Map([["g1", "2026-11-19T23:00:00Z"]]),
};

describe("histórico", () => {
  it("junta por alteração, mais nova primeiro", () => {
    const rows = [
      entry({ change_id: "a" }),
      entry({ change_id: "b" }),
      entry({ change_id: "a" }),
      entry({ change_id: "c" }),
    ];
    const changes = groupChanges(rows);
    expect(changes.map((c) => c.id)).toEqual(["c", "a", "b"]);
    expect(changes[1].entries).toHaveLength(2);
  });

  it("descreve pagamento e placar com gols regravados", () => {
    const pay = groupChanges([
      entry({ new_row: { member_id: "m1", kind: "mensal", month: "2026-11-01" } }),
    ])[0];
    expect(describeChange(pay, names)).toEqual(["Marcou pagamento de Rafa (novembro de 2026)"]);

    const result = groupChanges([
      entry({
        change_id: "r",
        table_name: "games",
        op: "UPDATE",
        old_row: { starts_at: "2026-11-19T23:00:00Z", scores: null },
        new_row: { starts_at: "2026-11-19T23:00:00Z", scores: [3, 1] },
      }),
      entry({ change_id: "r", table_name: "game_goals", op: "DELETE", row_key: { game_id: "g1", member_id: "m1" }, old_row: { game_id: "g1", member_id: "m1", goals: 1 } }),
      entry({ change_id: "r", table_name: "game_goals", op: "DELETE", row_key: { game_id: "g1", member_id: "m2" }, old_row: { game_id: "g1", member_id: "m2", goals: 1 } }),
      entry({ change_id: "r", table_name: "game_goals", op: "INSERT", row_key: { game_id: "g1", member_id: "m1" }, new_row: { game_id: "g1", member_id: "m1", goals: 3 } }),
    ])[0];
    expect(describeChange(result, names)).toEqual([
      "Placar do jogo de 19/11: 3 x 1",
      "Tirou os gols de Bruno de 19/11",
      "Gols de Rafa de 19/11: 3 gols",
    ]);
  });

  it("descreve tirar do grupo", () => {
    const c = groupChanges([
      entry({ table_name: "members", op: "UPDATE", old_row: { name: "Bruno", active: true }, new_row: { name: "Bruno", active: false } }),
    ])[0];
    expect(describeChange(c, names)).toEqual(["Tirou Bruno do grupo"]);
  });

  it("só as 5 mais recentes não desfeitas podem ser desfeitas", () => {
    const rows = ["a", "b", "c", "d", "e", "f"].map((id) =>
      entry({ change_id: id, undone_at: id === "e" ? "2026-11-22T23:10:00Z" : null }),
    );
    const ids = undoableIds(groupChanges(rows));
    expect([...ids].sort()).toEqual(["b", "c", "d", "f"]);
  });

  it("traduz os erros do banco", () => {
    expect(undoErrorMessage("conflito: x")).toContain("mudado de novo");
    expect(undoErrorMessage("Só dá para desfazer as 5 alterações mais recentes")).toContain("5");
  });
});
