import { describe, expect, it } from "vitest";
import { accountBalance, cashOut, cofrinhoInfo, invoiceFor, monthClose, monthPlan, reservedBalance, totalBalance } from "@/lib/finance/calc";
import { fromRows, toRows } from "@/lib/finance/db-map";
import { EMPTY_STATE, type FinanceState, type Plan } from "@/lib/finance/types";

// cartão fecha dia 5, vence dia 12; paga no vencimento
const card = { id: "c1", name: "Mercado Pago", brand: "visa" as const, last4: "1", tone: "azul" as const, limit: 5500, availableBase: 5500, baseDate: "2026-01-01", closingDay: 5, dueDay: 12, adjustments: {} };
const cofre = { id: "cof", name: "Cofrinho MP", kind: "cofrinho" as const, tone: "verde" as const, balanceBase: 1000, baseDate: "2026-11-25" };
const conta = { id: "acc", name: "Conta", kind: "banco" as const, tone: "roxo" as const, balanceBase: 500, baseDate: "2026-11-25" };
const mk = (id: string, per: number, count: number, first: string, extra: Partial<Plan> = {}): Plan => ({ id, desc: id, cardId: "c1", total: per * count, count, per, purchaseYm: "2026-09", first, category: "casa", createdAt: "2026-09-10", ...extra });
// A: 100 x3 (dez, jan, fev) paga pelo cofrinho · B: 200 x2 (dez, jan) do bolso · L: 150 x2 (dez, jan) cofrinho, metade do marido
const state = (): FinanceState => ({ ...EMPTY_STATE, onboarded: true, cards: [card], accounts: [conta, cofre], plans: [
  mk("A", 100, 3, "2026-12", { fundedBy: "cof" }), mk("B", 200, 2, "2026-12"), mk("L", 150, 2, "2026-12", { fundedBy: "cof", shared: { person: "Marido", percent: 50 } }),
] });
const today = new Date("2026-11-25T12:00:00");

describe("Cofrinho que paga parcelas", () => {
  it("a fatura mostra o total do banco, o que o cofrinho paga e o que sai do bolso", () => {
    const inv = invoiceFor(state(), card, "2026-12");
    expect(inv.total).toBe(450);            // 100 + 200 + 150
    expect(inv.othersOwe).toBe(75);          // metade do lava-louças
    expect(inv.mine).toBe(375);
    expect(inv.funded).toBe(175);            // 100 + a minha metade (75) do lava-louças
    expect(inv.own).toBe(200);               // só a compra B
    expect(inv.lines.filter((l) => l.funded)).toHaveLength(2);
  });

  it("resume o cofrinho: reservado, sobra e até quando cobre", () => {
    const i = cofrinhoInfo(state(), cofre, today);
    expect(i.balance).toBe(1000);
    expect(i.committed).toBe(100 + 100 + 100 + 75 + 75); // A (3) + minha metade de L (2)
    expect(i.sobra).toBe(550);
    expect(i.byMonth.map((m) => [m.ym, m.amount])).toEqual([["2026-12", 175], ["2027-01", 175], ["2027-02", 100]]);
    expect(i.lastYm).toBe("2027-02"); expect(i.shortYm).toBeNull();
    expect(cofrinhoInfo(state(), { ...cofre, balanceBase: 300 }, today).shortYm).toBe("2027-01");
  });

  it("as parcelas pagas saem do cofrinho sozinhas, e só do cofrinho", () => {
    const s = state();
    expect(accountBalance(s, cofre, today)).toBe(1000);
    const later = new Date("2027-01-15T12:00:00"); // venceu dez (12/12) e jan (12/01)
    expect(accountBalance(s, cofre, later)).toBe(1000 - 175 - 175);
    expect(accountBalance(s, conta, later)).toBe(500);
    expect(totalBalance(s, today)).toBe(500); expect(reservedBalance(s, today)).toBe(1000);
  });

  it("guarda e lê quem paga a compra no banco", () => {
    const back = fromRows(toRows(state()));
    expect(back.plans.find((p) => p.id === "A")?.fundedBy).toBe("cof");
    expect(back.plans.find((p) => p.id === "B")?.fundedBy).toBeUndefined();
    expect(back.accounts.find((a) => a.id === "cof")?.kind).toBe("cofrinho");
  });
});

describe("Cofrinho que cobre só a partir de certa parcela", () => {
  it("a parcela da fatura aberta sai do bolso e o cofrinho paga as seguintes", () => {
    const s: FinanceState = { ...state(), plans: [mk("P", 100, 4, "2026-12", { fundedBy: "cof", fundedFrom: 2 })] };
    const dez = invoiceFor(s, card, "2026-12"), jan = invoiceFor(s, card, "2027-01");
    expect(dez.funded).toBe(0); expect(dez.own).toBe(100);
    expect(jan.funded).toBe(100); expect(jan.own).toBe(0);
    const i = cofrinhoInfo(s, cofre, today);
    expect(i.committed).toBe(300);
    expect(accountBalance(s, cofre, new Date("2026-12-20T12:00:00"))).toBe(1000); // dez ainda é do bolso
    expect(accountBalance(s, cofre, new Date("2027-01-20T12:00:00"))).toBe(900);
    expect(fromRows(toRows(s)).plans[0]?.fundedFrom).toBe(2);
  });
});

describe("Saldo livre e sobra de caixa sem o dinheiro dos cofrinhos", () => {
  it("o saldo não soma o cofrinho e a sobra desconta só o que sai do bolso", () => {
    const s = state();
    expect(totalBalance(s, today)).toBe(500); expect(reservedBalance(s, today)).toBe(1000);
    const inv = invoiceFor(s, card, "2026-12");
    expect(cashOut(inv)).toBe(275);                    // 450 do banco − 175 do cofrinho
    const c = monthClose(s, today);
    expect(c.faturas).toBe(275); expect(c.cofrinhosPagam).toBe(175); expect(c.sobra).toBe(225); // 500 − 275
  });
  it("próximos meses: a fatura sai do saldo só pela parte do bolso e mostra o que o cofrinho paga", () => {
    const s = state();
    const dez = monthPlan(s, today, 3).find((m) => m.ym === "2026-12")!;
    expect(dez.faturas).toBe(275); expect(dez.cofrinhos).toBe(175);
    expect(dez.items.find((i) => i.group === "faturas")).toMatchObject({ amount: 275, funded: 175 });
    const jan = monthPlan(s, today, 3).find((m) => m.ym === "2027-01")!;
    expect(jan.faturas).toBe(275); expect(jan.cofrinhos).toBe(175);
  });
});
