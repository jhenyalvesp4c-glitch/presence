import { describe, expect, it } from "vitest";
import { desiredItems, planSync } from "@/lib/finance/settle-link";
import { EMPTY_STATE } from "@/lib/finance/types";
import type { FinanceState, Plan } from "@/lib/finance/types";

const card = { id: "c1", name: "Nubank", dueDay: 5, closingDay: 28 } as FinanceState["cards"][number];
const kindle = (shared: Plan["shared"]): Plan => ({ id: "k", desc: "Kindle", cardId: "c1", total: 709, count: 10, per: 70.9, purchaseYm: "2026-11", first: "2026-12", category: "compras", createdAt: "2026-11-21", shared } as Plan);
const st = (plans: Plan[], transactions: FinanceState["transactions"] = []): FinanceState => ({ ...EMPTY_STATE, cards: [card], plans, transactions });

describe("vínculo compras divididas ↔ acerto", () => {
  it("ajuda fixa de 400: 5 parcelas inteiras + 45,50 da sexta, tudo da pessoa", () => {
    const d = desiredItems(st([kindle({ person: "Felipe", percent: 56, fixed: 400 })]));
    expect(d.map((x) => x.draft.amount)).toEqual([70.9, 70.9, 70.9, 70.9, 70.9, 45.5]);
    expect(d[0]).toMatchObject({ ref: "plan:k:1", person: "Felipe", draft: { date: "2026-12-05", installment: "1/10", otherShare: 100, payer: "eu" } });
    expect(d[5]?.draft.date).toBe("2027-05-05");
  });
  it("fatia percentual: parcela inteira e a % da pessoa", () => {
    const d = desiredItems(st([kindle({ person: "Ana", percent: 30 })]));
    expect(d).toHaveLength(10);
    expect(d[0]?.draft).toMatchObject({ amount: 70.9, otherShare: 30 });
  });
  it("movimentação dividida entra; sem divisão ou receita não", () => {
    const tx = [{ id: "t1", kind: "despesa", desc: "Mercado", amount: 100, date: "2026-11-10", shared: { person: "Ana", percent: 50 } }, { id: "t2", kind: "despesa", desc: "X", amount: 10, date: "2026-11-10" }, { id: "t3", kind: "receita", desc: "Y", amount: 10, date: "2026-11-10", shared: { person: "Ana", percent: 50 } }] as FinanceState["transactions"];
    expect(desiredItems(st([], tx)).map((x) => x.ref)).toEqual(["tx:t1"]);
  });
  it("planSync: cria o acerto da pessoa nova, não duplica, atualiza e remove", () => {
    const d = desiredItems(st([kindle({ person: "Felipe", percent: 56, fixed: 400 })]));
    const first = planSync(d, [], []);
    expect(first.newPeople).toEqual(["Felipe"]);
    expect(first.create).toHaveLength(6);
    const settlements = [{ id: "s1", person: "felipe", closed: false }];
    const ex = d.map((x, i) => ({ id: `i${i}`, settlement_id: "s1", source_ref: x.ref, item_date: x.draft.date, description: x.draft.description, amount: x.draft.amount, other_share: x.draft.otherShare, installment: x.draft.installment }));
    const again = planSync(d, settlements, ex);
    expect(again).toMatchObject({ create: [], update: [], remove: [], newPeople: [] });
    const changed = planSync(desiredItems(st([kindle({ person: "Felipe", percent: 56, fixed: 300 })])), settlements, ex);
    expect(changed.update.length + changed.remove.length).toBeGreaterThan(0);
    expect(planSync([], settlements, ex).remove).toHaveLength(6);
  });
  it("acerto encerrado não é alterado", () => {
    const d = desiredItems(st([kindle({ person: "Felipe", percent: 56, fixed: 400 })]));
    const ex = d.map((x, i) => ({ id: `i${i}`, settlement_id: "s1", source_ref: x.ref, item_date: "2020-01-01", description: "velho", amount: 1, other_share: 5, installment: "" }));
    expect(planSync([], [{ id: "s1", person: "Felipe", closed: true }], ex).remove).toEqual([]);
    expect(planSync(d, [{ id: "s1", person: "Felipe", closed: true }], ex).update).toEqual([]);
  });
});
