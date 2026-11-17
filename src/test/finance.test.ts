import { describe, expect, it } from "vitest";
import { accountBalance, addMonths, cashflow, closingDateOf, invoiceLabel, monthSummary, totalBalance, alertsFor, cardAvailable, categoryTotals, commitments, invoiceFor, invoiceMonthOf, monthEntries, monthlySeries, openInvoice, planInfo, totalFutureParcels, whyChanged, ymOf, expensesOf, total, pauseRecurring, resumeRecurring, isPaused, recurringActiveIn, nextCharge } from "@/lib/finance/calc";
import { makeMock } from "@/lib/finance/mock";
import { parseNatural } from "@/lib/finance/parse";
import { normalizeState } from "@/lib/finance/repo";
import { EMPTY_STATE, type FinanceState, type Plan, type Recurring } from "@/lib/finance/types";

const TODAY = new Date(2026, 10, 17); // 17/11/2026
const mock = () => makeMock(TODAY);
const plan = (o: Partial<Plan> = {}): Plan => ({ id: "p", desc: "Compra", cardId: "c", total: 1200, count: 12, per: 100, purchaseYm: "2026-07", first: "2026-08", category: "compras", createdAt: "2026-07-10", ...o });

describe("fatura do cartão", () => {
  const nubank = { closingDay: 25, dueDay: 5 }, picpay = { closingDay: 20, dueDay: 28 }, mp = { closingDay: 10, dueDay: 17 };
  it("compra até o fechamento cai na fatura que vence no mês seguinte (vencimento antes do fechamento)", () => {
    expect(invoiceMonthOf(nubank, "2026-11-12")).toBe("2026-12");
    expect(invoiceMonthOf(nubank, "2026-11-25")).toBe("2026-12");
    expect(invoiceMonthOf(nubank, "2026-11-26")).toBe("2027-01");
  });
  it("vencimento depois do fechamento: a fatura vence no mesmo mês", () => {
    expect(invoiceMonthOf(picpay, "2026-11-12")).toBe("2026-11");
    expect(invoiceMonthOf(picpay, "2026-11-21")).toBe("2026-12");
    expect(invoiceMonthOf(mp, "2026-11-10")).toBe("2026-11");
    expect(invoiceMonthOf(mp, "2026-11-11")).toBe("2026-12");
  });
  it("vira o ano", () => { expect(invoiceMonthOf(nubank, "2026-12-30")).toBe("2027-02"); });
});

describe("rótulo da fatura (fechamento e vencimento)", () => {
  it("fecha em um mês e vence no seguinte: mostra as duas datas", () => {
    const c = { closingDay: 28, dueDay: 5 };
    expect(closingDateOf(c, "2026-12")).toBe("2026-11-28");
    expect(invoiceLabel(c, "2026-12")).toBe("fecha 28/11 · vence 05/12");
    expect(invoiceLabel(c, "2027-01")).toBe("fecha 28/12 · vence 05/01");
  });
  it("fecha e vence no mesmo mês", () => { expect(invoiceLabel({ closingDay: 20, dueDay: 28 }, "2026-11")).toBe("fecha 20/11 · vence 28/11"); });
});

describe("compras parceladas", () => {
  it("calcula pagas, restantes e o mês em que terminam", () => {
    const i = planInfo(plan(), { dueDay: 5 }, TODAY); // ago, set, out e nov (dia 5 já passou)
    expect(i.paid).toBe(4); expect(i.remaining).toBe(8); expect(i.currentIndex).toBe(5);
    expect(i.lastYm).toBe("2027-07"); expect(i.remainingAmount).toBe(800); expect(i.paidAmount).toBe(400); expect(i.pct).toBe(33);
  });
  it("o exemplo do pedido: 3 pagas de 12, 9 restantes", () => {
    const i = planInfo(plan({ paidManual: 3 }), { dueDay: 5 }, TODAY);
    expect(`${i.paid}/12`).toBe("3/12"); expect(i.remaining).toBe(9); expect(i.remainingAmount).toBe(900);
  });
  it("parcela do mês só conta como paga depois do vencimento", () => {
    expect(planInfo(plan({ first: "2026-11" }), { dueDay: 28 }, TODAY).paid).toBe(0);
    expect(planInfo(plan({ first: "2026-11" }), { dueDay: 10 }, TODAY).paid).toBe(1);
  });
  it("a última parcela absorve os centavos", () => {
    const i = planInfo(plan({ total: 1000, per: 83.33, count: 12 }), { dueDay: 5 }, TODAY);
    expect(i.schedule.at(-1)!.amount).toBe(83.37);
    expect(Math.round(i.schedule.reduce((a, p) => a + p.amount, 0) * 100) / 100).toBe(1000);
  });
  it("quitada quando todas passaram", () => { expect(planInfo(plan({ first: "2025-01", count: 6, total: 600 }), { dueDay: 5 }, TODAY)).toMatchObject({ done: true, remaining: 0, nextDue: null }); });
});

describe("projeção e lançamentos do mês", () => {
  it("projeta o comprometimento mês a mês e zera depois da última parcela", () => {
    const s = mock(), c = commitments(s, ymOf(TODAY), 12);
    expect(c).toHaveLength(12); expect(c[0]!.parcelas).toBeGreaterThan(0);
    const lisboaMonths = c.filter((m) => m.porCartao["card-nubank"]).length; expect(lisboaMonths).toBeGreaterThan(0);
    expect(c[11]!.parcelas).toBeLessThan(c[0]!.parcelas); // as compras vão terminando
  });
  it("total futuro bate com a soma das parcelas restantes", () => {
    const s = mock(), futuro = totalFutureParcels(s, TODAY);
    const proj = commitments(s, ymOf(TODAY), 40).reduce((a, m) => a + m.parcelas, 0);
    // a projeção começa no mês atual, que pode ter parcela já paga: diferença no máximo as parcelas do mês atual
    expect(proj + 0.01).toBeGreaterThanOrEqual(futuro);
  });
  it("parcela aparece só no mês certo e recorrente a partir do início", () => {
    const s = mock(), es = (ym: string) => monthEntries(s, ym);
    expect(es(addMonths(ymOf(TODAY), 1)).some((e) => e.desc === "Passagens Lisboa" && e.parcel === "1/6")).toBe(true);
    expect(es(ymOf(TODAY)).some((e) => e.desc === "Passagens Lisboa")).toBe(false);
    expect(es(addMonths(ymOf(TODAY), -20)).some((e) => e.source === "recorrente")).toBe(false);
    expect(es(ymOf(TODAY)).some((e) => e.source === "recorrente" && e.desc === "Aluguel")).toBe(true);
  });
  it("série mensal tem 6 pontos e o acumulado soma os saldos", () => {
    const sr = monthlySeries(mock(), ymOf(TODAY), 6);
    expect(sr).toHaveLength(6);
    expect(Math.round(sr.reduce((a, p) => a + p.saldo, 0) * 100) / 100).toBe(sr.at(-1)!.acumulado);
  });
});

describe("contas, limites e faturas", () => {
  it("débito reduz o saldo da conta, crédito não", () => {
    const s = mock(), acc = s.accounts[0]!;
    const base = accountBalance(s, acc, TODAY);
    s.transactions.push({ id: "n1", kind: "despesa", desc: "Teste", amount: 100, date: "2026-11-17", method: "debito", accountId: acc.id, category: "outros" });
    expect(accountBalance(s, acc, TODAY)).toBe(Math.round((base - 100) * 100) / 100);
    s.transactions.push({ id: "n2", kind: "despesa", desc: "Crédito", amount: 100, date: "2026-11-17", method: "credito", accountId: acc.id, cardId: "card-nubank", category: "outros" });
    expect(accountBalance(s, acc, TODAY)).toBe(Math.round((base - 100) * 100) / 100);
  });
  it("limite disponível cai com compra no crédito e com parcelamento novo", () => {
    const s = mock(), c = s.cards[0]!, a0 = cardAvailable(s, c);
    s.transactions.push({ id: "n3", kind: "despesa", desc: "Compra", amount: 250, date: "2026-11-17", method: "credito", cardId: c.id, category: "outros" });
    expect(cardAvailable(s, c)).toBeCloseTo(a0 - 250, 2);
    s.plans.push(plan({ id: "novo", cardId: c.id, total: 600, count: 6, per: 100, createdAt: "2026-11-17" }));
    expect(cardAvailable(s, c)).toBeCloseTo(a0 - 250 - 600, 2);
  });
  it("fatura junta compras do ciclo, parcelas, recorrentes e o ajuste informado", () => {
    const s = mock(), c = s.cards[0]!, ym = invoiceMonthOf(c, "2026-11-17");
    const base = invoiceFor(s, c, ym).total;
    c.adjustments[ym] = 300;
    const inv = invoiceFor(s, c, ym);
    expect(inv.total).toBe(Math.round((base + 300) * 100) / 100);
    expect(inv.lines.some((l) => l.source === "parcela")).toBe(true);
    expect(inv.lines.some((l) => l.source === "ajuste")).toBe(true);
    expect(openInvoice(s, c, TODAY).ym).toBe(ym);
  });
});

describe("categorias, alertas e por que aumentou", () => {
  it("o mês atual do exemplo tem restaurantes em alta e o painel avisa", () => {
    const s = mock(), cats = categoryTotals(s, ymOf(TODAY)), rest = cats.find((c) => c.id === "restaurantes")!;
    expect(rest.delta).toBeGreaterThan(0);
    expect(alertsFor(s, TODAY).some((a) => a.id === "cat:restaurantes" || a.id === "meta:goal-rest")).toBe(true);
  });
  it("explica o aumento com as categorias e as compras que mais pesaram", () => {
    const w = whyChanged(mock(), ymOf(TODAY));
    expect(w.top.length).toBeGreaterThan(0); expect(w.top[0]!.items.length).toBeGreaterThan(0);
    expect(w.top[0]!.cat.delta).toBeGreaterThanOrEqual(w.top.at(-1)!.cat.delta);
  });
  it("percentuais das categorias somam 100", () => {
    const cats = categoryTotals(mock(), addMonths(ymOf(TODAY), -1));
    expect(Math.round(cats.reduce((a, c) => a + c.pct, 0))).toBe(100);
    expect(cats.reduce((a, c) => a + c.value, 0)).toBeCloseTo(total(expensesOf(monthEntries(mock(), addMonths(ymOf(TODAY), -1)))), 1);
  });
});

describe("lançamento por frase", () => {
  const s = mock(), p = (t: string) => parseNatural(t, s, TODAY);
  it("compra no débito pelo banco", () => {
    expect(p("Hoje comprei um livro de R$ 30 no débito pelo Nubank")).toMatchObject({ amount: 30, method: "debito", accountId: "acc-nubank", category: "educacao", desc: "Livro", date: "2026-11-17", installments: 1, kind: "despesa" });
  });
  it("compra parcelada no cartão", () => {
    expect(p("Parcelei uma compra de R$ 600 em 6 vezes no PicPay")).toMatchObject({ amount: 600, installments: 6, method: "credito", cardId: "card-picpay" });
  });
  it("data relativa e pix", () => {
    expect(p("Ontem almocei por R$ 42,90 no pix")).toMatchObject({ amount: 42.9, method: "pix", date: "2026-11-16", category: "restaurantes" });
    expect(p("dia 3 paguei R$ 1.250,50 de aluguel no débito pelo Nubank")).toMatchObject({ amount: 1250.5, date: "2026-11-03" });
  });
  it("receita", () => { expect(p("Recebi R$ 800 de um freela no PicPay")).toMatchObject({ kind: "receita", amount: 800, accountId: "acc-picpay", category: "extra" }); });
  it("diz o que falta quando a frase é vaga", () => {
    const d = p("comprei um fone"); expect(d.missing).toEqual(expect.arrayContaining(["valor", "forma de pagamento"])); expect(d.confidence).toBeLessThan(0.7);
  });
  it("frase completa tem confiança alta", () => { expect(p("Hoje comprei um livro de R$ 30 no débito pelo Nubank").confidence).toBe(1); });
});

describe("armazenamento", () => {
  it("normaliza dados incompletos ou de outra versão", () => {
    expect(normalizeState(null).accounts).toEqual([]); expect(normalizeState({ version: 99, accounts: [{}] }).accounts).toEqual([]);
    const s = normalizeState({ version: 1, cards: [{ id: "c" }] }); expect(s.cards[0]!.adjustments).toEqual({}); expect(s.plans).toEqual([]);
  });
});


/** O caso real que apareceu: saldo zero, salário e aluguel no dia 30, duas faturas que vencem em dezembro. */
describe("fluxo de caixa: salário no dia 30 e faturas em dezembro", () => {
  const mk = (): FinanceState => ({
    ...structuredClone(EMPTY_STATE), onboarded: true,
    accounts: [{ id: "a", name: "Conta", kind: "banco", tone: "roxo", balanceBase: 0, baseDate: "2026-11-17" }],
    cards: [
      { id: "nu", name: "Nubank", brand: "mastercard", last4: "4617", tone: "roxo", limit: 7800, availableBase: 5272.79, baseDate: "2026-11-17", closingDay: 28, dueDay: 5, adjustments: { "2026-12": 1113.56 } },
      { id: "mp", name: "Mercado Pago", brand: "mastercard", last4: "1209", tone: "azul", limit: 3500, availableBase: 3000, baseDate: "2026-11-17", closingDay: 9, dueDay: 15, adjustments: { "2026-12": 435 } },
    ],
    recurring: [
      { id: "sal", kind: "receita", desc: "Salário", amount: 1500, day: 30, category: "salario", method: "pix", accountId: "a", startYm: "2026-11" },
      { id: "alu", kind: "despesa", desc: "Moradia", amount: 500, day: 30, category: "moradia", method: "debito", accountId: "a", startYm: "2026-11" },
    ],
  });
  it("antes do dia 30 o mês mostra R$ 0 realizado e o que ainda vem separado", () => {
    expect(monthSummary(mk(), "2026-11", "2026-11-17")).toEqual({ receitas: 0, despesas: 0, aReceber: 1500, aPagar: 500, resultado: 0, previsto: 1000 });
    expect(totalBalance(mk(), TODAY)).toBe(0);
  });
  it("as faturas aparecem com fechamento e vencimento corretos", () => {
    const s = mk();
    expect(openInvoice(s, s.cards[0]!, TODAY)).toMatchObject({ ym: "2026-12", due: "2026-12-05", total: 1113.56 });
    expect(openInvoice(s, s.cards[1]!, TODAY)).toMatchObject({ ym: "2026-12", due: "2026-12-15", total: 435 });
  });
  it("a projeção mostra o saldo ficando negativo no vencimento do Nubank", () => {
    const f = cashflow(mk(), TODAY, 30);
    expect(f.events.map((e) => [e.date, e.label, e.amount, e.balance])).toEqual([
      ["2026-11-30", "Salário", 1500, 1500], ["2026-11-30", "Moradia", -500, 1000], ["2026-12-05", "Fatura Nubank", -1113.56, -113.56], ["2026-12-15", "Fatura Mercado Pago", -435, -548.56],
    ]);
    expect(f.firstNegative?.date).toBe("2026-12-05"); expect(f.min).toBe(-548.56); expect(f.end).toBe(-548.56);
    // em 60 dias entram também o salário e o aluguel de dezembro (30/12) e o saldo volta a subir
    const f60 = cashflow(mk(), TODAY, 60);
    expect(f60.min).toBe(-548.56); expect(f60.end).toBe(451.44);
  });
  it("o alerta avisa que vai faltar dinheiro", () => { expect(alertsFor(mk(), TODAY).find((a) => a.id === "fluxo")?.level).toBe("danger"); });
  it("quando o dia 30 chega, salário e aluguel entram no saldo da conta", () => {
    const s = mk(), dia30 = new Date(2026, 10, 30);
    expect(accountBalance(s, s.accounts[0]!, dia30)).toBe(1000);
    expect(monthSummary(s, "2026-11", "2026-11-30")).toMatchObject({ receitas: 1500, despesas: 500, resultado: 1000, aReceber: 0, aPagar: 0 });
  });
  it("fixas pagas no cartão não são contadas duas vezes (já estão na fatura)", () => {
    const s = mk(); s.recurring.push({ id: "net", kind: "despesa", desc: "Netflix", amount: 55.9, day: 20, category: "assinaturas", method: "credito", cardId: "nu", startYm: "2026-11" });
    expect(cashflow(s, TODAY, 60).events.some((e) => e.label === "Netflix")).toBe(false);
    expect(openInvoice(s, s.cards[0]!, TODAY).total).toBe(1169.46);
  });
});

describe("assinaturas: pausar e reativar", () => {
  const card = { id: "c1", name: "Nubank", brand: "visa" as const, last4: "0001", tone: "roxo" as const, limit: 1000, availableBase: 1000, baseDate: "2026-01-01", closingDay: 25, dueDay: 5, adjustments: {} };
  const netflix: Recurring = { id: "r1", kind: "despesa", desc: "Netflix", amount: 50, day: 25, category: "assinaturas", method: "credito", cardId: "c1", startYm: "2026-01", subscription: true };
  const state = (r: Recurring): FinanceState => ({ ...EMPTY_STATE, onboarded: true, cards: [card], recurring: [r] });
  const inMonth = (s: FinanceState, ym: string) => monthEntries(s, ym).filter((e) => e.desc === "Netflix").length;

  it("pausada não aparece nas movimentações nem na fatura a partir da pausa", () => {
    const p = pauseRecurring(netflix, TODAY); // dia 17/11, cobrança dia 25 ainda não aconteceu
    expect(isPaused(p)).toBe(true);
    expect(inMonth(state(p), "2026-11")).toBe(0);
    expect(inMonth(state(p), "2027-02")).toBe(0);
    expect(invoiceFor(state(p), card, "2026-12").lines.some((l) => l.desc === "Netflix")).toBe(false);
    expect(commitments(state(p), "2026-11", 3).every((m) => m.recorrentes === 0)).toBe(true);
  });
  it("pausar não apaga a cobrança deste mês que já aconteceu", () => {
    const p = pauseRecurring({ ...netflix, day: 8 }, TODAY); // cobrou dia 8
    expect(recurringActiveIn(p, "2026-11")).toBe(true);
    expect(recurringActiveIn(p, "2026-12")).toBe(false);
  });
  it("os meses antes da pausa continuam no histórico", () => {
    const p = pauseRecurring(netflix, TODAY);
    expect(inMonth(state(p), "2026-10")).toBe(1);
  });
  it("reativar volta a mostrar nas movimentações a partir da próxima cobrança", () => {
    const paused = { ...netflix, pauses: [{ from: "2026-09" }] };
    const r = resumeRecurring(paused, TODAY);
    expect(isPaused(r)).toBe(false);
    expect(inMonth(state(r), "2026-11")).toBe(1); // dia 25 ainda vem
    expect(inMonth(state(r), "2026-10")).toBe(0); // período pausado fica fora
    expect(nextCharge(r, TODAY)).toBe("2026-11-25");
  });
  it("pausar e reativar no mesmo dia não deixa rastro", () => {
    const r = resumeRecurring(pauseRecurring(netflix, TODAY), TODAY);
    expect(r.pauses).toEqual([]);
    expect(inMonth(state(r), "2026-11")).toBe(1);
  });
});
