import { describe, expect, it } from "vitest";
import { categorySpent, spendGoals, spendMonthOf, accountBalance, cashBreakdown, cashflow, cashOut, reservesFor, round2, totalReserves, cofrinhoInfo, invAmount, invoiceFor, linesIn, monthClose, monthPlan, reservedBalance, sum, totalBalance } from "@/lib/finance/calc";
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

describe("Filtro: tudo, sem cofrinho, só cofrinho", () => {
  it("as três visões da fatura somam certo e as linhas batem com o total", () => {
    const inv = invoiceFor(state(), card, "2026-12"); // 450 no banco: A 100 (cofrinho), B 200 (bolso), L 150 (cofrinho, metade de outra pessoa)
    expect([invAmount(inv, "tudo"), invAmount(inv, "bolso"), invAmount(inv, "cofrinho")]).toEqual([450, 275, 175]);
    expect(sum(linesIn(inv.lines, "bolso").map((l) => l.amount))).toBe(275);       // B 200 + a metade do L que é de outra pessoa
    expect(sum(linesIn(inv.lines, "cofrinho").map((l) => l.amount))).toBe(175);    // A 100 + minha metade do L
    expect(sum(linesIn(inv.lines, "tudo").map((l) => l.amount))).toBe(450);
    expect(invAmount(inv, "bolso", true)).toBe(200); expect(invAmount(inv, "tudo", true)).toBe(375);
  });
  it("sobra de caixa e próximos meses mudam com a visão", () => {
    const s = state();
    expect(monthClose(s, today, "bolso")).toMatchObject({ saldo: 500, faturas: 275, sobra: 225 });
    expect(monthClose(s, today, "tudo")).toMatchObject({ saldo: 1500, faturas: 450, sobra: 1050 });
    expect(monthClose(s, today, "cofrinho")).toMatchObject({ saldo: 1000, faturas: 175, sobra: 825 });
    const dez = (v: "tudo" | "bolso" | "cofrinho") => monthPlan(s, today, 2, v).find((m) => m.ym === "2026-12")!;
    expect(dez("tudo").faturas).toBe(450); expect(dez("bolso").faturas).toBe(275); expect(dez("cofrinho").faturas).toBe(175);
    expect(dez("cofrinho").entradas).toBe(0);
    expect(cashflow(s, today, 40, "cofrinho").start).toBe(1000);
    expect(cashflow(s, today, 40, "tudo").start).toBe(1500);
  });
});

describe("Metas que descontam da sobra de caixa (liga e desliga)", () => {
  const goals = [
    { id: "g1", kind: "limite_categoria" as const, title: "iFood", target: 200, current: 0, category: "restaurantes", reserve: true },
    { id: "g2", kind: "guardar" as const, title: "Juntar", target: 5000, current: 4900, monthly: 300, reserve: true },
    { id: "g3", kind: "limite_categoria" as const, title: "Desligada", target: 999, current: 0, category: "compras" },
  ];
  const withGoals = (): FinanceState => ({ ...state(), goals, transactions: [{ id: "x", kind: "despesa", desc: "iFood", amount: 80, date: "2026-11-20", method: "debito", accountId: "acc", category: "restaurantes" }] });

  it("só as metas ligadas reservam: o limite que falta gastar e o valor por mês (até completar a meta)", () => {
    const s = withGoals();
    expect(reservesFor(s, "2026-11", today).map((r) => [r.title, r.amount])).toEqual([["iFood", 120], ["Juntar", 100]]); // 200−80 gastos · faltam 100 para os 5000
    expect(reservesFor(s, "2026-12", today).map((r) => [r.title, r.amount])).toEqual([["iFood", 200], ["Juntar", 100]]);
    expect(totalReserves(s, today)).toBe(220);
  });
  it("a sobra desconta quando ligado e volta ao valor de antes quando desligado", () => {
    const s = withGoals(), off = monthClose(s, today, "bolso", false), on = monthClose(s, today, "bolso", true);
    expect(off.reservas).toBe(0); expect(on.reservas).toBe(220); expect(on.reservasPossiveis).toBe(220);
    expect(round2(off.sobra - on.sobra)).toBe(220);
    expect(monthClose(s, today, "cofrinho", true).reservas).toBe(0);
  });
  it("próximos meses e o detalhe da sobra trazem as metas só quando ligado", () => {
    const s = withGoals();
    expect(monthPlan(s, today, 2, "bolso", false)[0]!.metas).toBe(0);
    const m = monthPlan(s, today, 3, "bolso", true);
    expect(m.map((x) => x.metas)).toEqual([220, 300, 300]);
    expect(m[1]!.items.filter((i) => i.group === "metas")).toHaveLength(2);
    expect(round2(monthPlan(s, today, 2, "bolso", false)[1]!.resultado - m[1]!.resultado)).toBe(300);
    const b = cashBreakdown(s, today, "bolso", true);
    expect(b.groups.find((g) => g.id === "metas")?.total).toBe(220);
    expect(cashBreakdown(s, today, "bolso", false).groups.find((g) => g.id === "metas")).toBeUndefined();
  });
  it("a meta guarda o liga/desliga no banco", () => {
    const back = fromRows(toRows(withGoals()));
    expect(back.goals.map((g) => !!g.reserve)).toEqual([true, true, false]);
  });
});

describe("Meta de gasto por categoria", () => {
  // cartão fecha dia 5: compra até o dia 5 entra na fatura do mês; depois do dia 5 vai para o mês seguinte
  const tx = (id: string, amount: number, date: string, method: "debito" | "credito" | "pix", extra: object = {}) => ({ id, kind: "despesa" as const, desc: id, amount, date, method, category: "ifood", ...(method === "credito" ? { cardId: "c1" } : { accountId: "acc" }), ...extra });
  const base = (): FinanceState => ({ ...state(), plans: [], goals: [{ id: "m", kind: "limite_categoria", title: "iFood", target: 200, current: 0, category: "ifood" }],
    transactions: [tx("d1", 60, "2026-11-10", "debito"), tx("p1", 40, "2026-11-12", "pix"), tx("c1", 30, "2026-11-04", "credito"), tx("c2", 50, "2026-11-06", "credito"), tx("outra", 999, "2026-11-10", "debito", { category: "mercado" })] });
  it("débito e Pix contam no mês da data; crédito conta no mês em que a fatura fecha", () => {
    const s = base();
    // 04/11 (antes de fechar dia 5) → novembro · 06/11 (depois) → dezembro
    expect(categorySpent(s, "ifood", "2026-11")).toBe(60 + 40 + 30);
    expect(categorySpent(s, "ifood", "2026-12")).toBe(50);
    expect(categorySpent(s, "mercado", "2026-11")).toBe(999);
  });
  it("mostra quanto falta, quando passa e como fica com a compra nova", () => {
    const s = base(), [g] = spendGoals(s, "2026-11");
    expect(g).toMatchObject({ spent: 130, left: 70, over: false });
    expect(spendGoals(s, "2026-11", { category: "ifood", amount: 50 })[0]).toMatchObject({ spent: 180, left: 20, over: false });
    expect(spendGoals(s, "2026-11", { category: "ifood", amount: 90 })[0]).toMatchObject({ spent: 220, left: 0, over: true });
    expect(spendMonthOf(s, { method: "credito", cardId: "c1", date: "2026-11-06" })).toBe("2026-12");
    expect(spendMonthOf(s, { method: "pix", date: "2026-11-30" })).toBe("2026-11");
  });
  it("conta só a sua parte de gasto dividido, parcelas no mês do fechamento e fixas", () => {
    const s: FinanceState = { ...base(), transactions: [tx("div", 100, "2026-11-10", "debito", { shared: { person: "Marido", percent: 50 } })],
      plans: [mk("par", 90, 3, "2026-12", { category: "ifood" })], recurring: [{ id: "r", kind: "despesa", desc: "iFood Club", amount: 20, day: 15, category: "ifood", method: "debito", accountId: "acc", startYm: "2026-01" }] };
    expect(categorySpent(s, "ifood", "2026-11")).toBe(50 + 20);       // minha metade + a fixa de novembro
    expect(categorySpent(s, "ifood", "2026-12")).toBe(90 + 20);       // a 1ª parcela entra na fatura que fecha em dezembro (dia 5) + a fixa
    expect(categorySpent(s, "ifood", "2027-01")).toBe(90 + 20);
  });
});

describe("Detalhes de cada item no 'por que sobra'", () => {
  it("a fatura lista as compras e parcelas que a formam, e a soma bate com o valor da visão", () => {
    const s = state();
    for (const [view, total] of [["tudo", 450], ["bolso", 275], ["cofrinho", 175]] as const) {
      const f = cashBreakdown(s, today, view, false).groups.find((g) => g.id === "faturas")!.items[0]!;
      expect(f.amount).toBe(total);
      expect(f.detail!.length).toBeGreaterThan(0);
      expect(sum(f.detail!.map((d) => d.amount))).toBe(total);
    }
    const tudo = cashBreakdown(s, today, "tudo", false).groups.find((g) => g.id === "faturas")!.items[0]!.detail!;
    expect(tudo.map((d) => d.desc)).toEqual(["B", "L", "A"]);                 // maior para a menor
    expect(tudo.find((d) => d.desc === "L")!.note).toContain("parcela 1/2");
    expect(tudo.find((d) => d.desc === "L")!.note).toContain("com Marido");
  });
  it("metas mostram como chegaram ao valor", () => {
    const s: FinanceState = { ...state(), goals: [{ id: "g", kind: "limite_categoria", title: "iFood", target: 200, current: 0, category: "ifood", reserve: true }],
      transactions: [{ id: "x", kind: "despesa", desc: "iFood", amount: 80, date: "2026-11-20", method: "debito", accountId: "acc", category: "ifood" }] };
    const m = cashBreakdown(s, today, "bolso", true).groups.find((g) => g.id === "metas")!.items[0]!;
    expect(m.detail!.map((d) => d.amount)).toEqual([200, -80, 120]);
  });
});

describe("Rótulo da parte do outro na visão sem cofrinho", () => {
  it("a metade do outro numa parcela do cofrinho aparece como parte dele, não como cofrinho", () => {
    const s = state();
    const bolso = cashBreakdown(s, today, "bolso", false).groups.find((g) => g.id === "faturas")!.items[0]!.detail!;
    const l = bolso.find((d) => d.desc === "L")!;
    expect(l.note).toContain("parte de Marido"); expect(l.note).not.toContain("cofrinho");
    const cof = cashBreakdown(s, today, "cofrinho", false).groups.find((g) => g.id === "faturas")!.items[0]!.detail!;
    expect(cof.find((d) => d.desc === "L")!.note).toContain("cofrinho");
  });
});
