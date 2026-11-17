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

describe("sobra de caixa (o caso real: salário 1.500, casa 500, faturas 1.113,56 + 435, saldo R$ 0,40)", () => {
  it("desconta as faturas dos cartões e dá falta, não sobra", async () => {
    const { monthClose } = await import("@/lib/finance/calc");
    const today = new Date(2026, 10, 17);
    const st: FinanceState = { ...EMPTY_STATE, onboarded: true,
      accounts: [{ id: "a", name: "Nubank", kind: "banco", tone: "roxo", balanceBase: 0.4, baseDate: "2026-11-17" }],
      cards: [
        { id: "n", name: "Nubank", brand: "mastercard", last4: "1", tone: "roxo", limit: 5000, availableBase: 3886.44, baseDate: "2026-11-17", closingDay: 28, dueDay: 5, adjustments: { "2026-12": 1113.56 } },
        { id: "m", name: "Mercado Pago", brand: "mastercard", last4: "2", tone: "azul", limit: 3000, availableBase: 2565, baseDate: "2026-11-17", closingDay: 9, dueDay: 15, adjustments: { "2026-12": 435 } },
      ],
      recurring: [
        { id: "s", kind: "receita", desc: "Salário", amount: 1500, day: 30, category: "salario", method: "pix", accountId: "a", startYm: "2026-01" },
        { id: "c", kind: "despesa", desc: "Moradia", amount: 500, day: 30, category: "moradia", method: "pix", accountId: "a", startYm: "2026-01" },
      ] };
    const c = monthClose(st, today);
    expect(c.aReceber).toBe(1500); expect(c.aPagarConta).toBe(500); expect(c.faturas).toBeCloseTo(1548.56, 2);
    expect(c.sobra).toBeCloseTo(0.4 + 1500 - 500 - 1548.56, 2); // ≈ −548,16
    expect(c.sobra).toBeLessThan(0);
  });
});

describe("fatura com total informado: cadastrar as compras não duplica", () => {
  const mk = (declared?: number, adjustments: Record<string, number> = {}): FinanceState => ({ ...EMPTY_STATE, onboarded: true,
    cards: [{ id: "n", name: "Nubank", brand: "mastercard", last4: "1", tone: "roxo", limit: 5000, availableBase: 4000, baseDate: "2026-11-17", closingDay: 28, dueDay: 5, adjustments, declared: declared === undefined ? undefined : { "2026-12": declared } }] });
  const plan = (n: string, per: number): Plan => ({ id: n, desc: n, cardId: "n", total: per * 3, count: 3, per, purchaseYm: "2026-11", first: "2026-12", category: "compras", createdAt: "2026-11-10" });
  it("o total do banco é o total; os itens abatem e o resto fica 'a detalhar'", async () => {
    const { invoiceFor } = await import("@/lib/finance/calc");
    const c = mk(1113.56).cards[0]!;
    expect(invoiceFor(mk(1113.56), c, "2026-12").total).toBe(1113.56);
    const st = { ...mk(1113.56), plans: [plan("Tênis", 189.9), plan("Sofá", 300)] };
    const inv = invoiceFor(st, st.cards[0]!, "2026-12");
    expect(inv.total).toBe(1113.56); expect(inv.adjustment).toBeCloseTo(1113.56 - 489.9, 2); expect(inv.over).toBe(0);
    expect(inv.lines.filter((l) => l.source === "parcela")).toHaveLength(2);
  });
  it("itens que passam do total informado avisam e o total é o dos itens", async () => {
    const { invoiceFor } = await import("@/lib/finance/calc");
    const st = { ...mk(300), plans: [plan("A", 200), plan("B", 200)] };
    const inv = invoiceFor(st, st.cards[0]!, "2026-12");
    expect(inv.total).toBe(400); expect(inv.over).toBe(100); expect(inv.adjustment).toBe(0);
  });
  it("sem total informado, tudo continua como antes", async () => {
    const { invoiceFor } = await import("@/lib/finance/calc");
    const st = { ...mk(undefined, { "2026-12": 300 }), plans: [plan("A", 100)] };
    expect(invoiceFor(st, st.cards[0]!, "2026-12").total).toBe(400);
  });
  it("migra o ajuste antigo para total informado sem mudar o total que já aparecia, e depois não duplica", async () => {
    const { invoiceFor, migrateInvoiceTotals } = await import("@/lib/finance/calc");
    const antigo = { ...mk(undefined, { "2026-12": 1113.56 }), plans: [plan("Tênis", 189.9)] };
    const antes = invoiceFor(antigo, antigo.cards[0]!, "2026-12").total; // 189,90 + 1.113,56
    const novo = migrateInvoiceTotals(antigo);
    expect(novo.cards[0]!.adjustments).toEqual({}); expect(invoiceFor(novo, novo.cards[0]!, "2026-12").total).toBeCloseTo(antes, 2);
    const depois = { ...novo, plans: [...novo.plans, plan("Sofá", 300)] };
    expect(invoiceFor(depois, depois.cards[0]!, "2026-12").total).toBeCloseTo(antes, 2); // cadastrar o sofá não aumentou
  });
  it("informar e limpar o total", async () => {
    const { withDeclaredTotal } = await import("@/lib/finance/calc");
    const c = mk(undefined, { "2026-12": 50 }).cards[0]!;
    const a = withDeclaredTotal(c, "2026-12", 900); expect(a.declared).toEqual({ "2026-12": 900 }); expect(a.adjustments).toEqual({});
    expect(withDeclaredTotal(a, "2026-12", undefined).declared).toEqual({});
  });
});

describe("em qual fatura cada compra cai", () => {
  const today = new Date(2026, 10, 17); // 17/11/2026
  const nu = { id: "n", name: "Nubank", brand: "mastercard" as const, last4: "1", tone: "roxo" as const, limit: 5000, availableBase: 4000, baseDate: "2026-11-17", closingDay: 28, dueDay: 5, adjustments: {} };
  const st = (over: Partial<FinanceState> = {}): FinanceState => ({ ...EMPTY_STATE, onboarded: true, cards: [nu], ...over });
  it("compra de hoje cai na fatura aberta (fecha 28/11, vence 05/12); depois do fechamento, na seguinte", async () => {
    const { invoiceMonthOf, invoiceFor } = await import("@/lib/finance/calc");
    expect(invoiceMonthOf(nu, "2026-11-17")).toBe("2026-12");
    expect(invoiceMonthOf(nu, "2026-11-28")).toBe("2026-12");
    expect(invoiceMonthOf(nu, "2026-11-29")).toBe("2027-01");
    const tx = { id: "t", kind: "despesa" as const, desc: "Livro", amount: 30, date: "2026-11-17", method: "credito" as const, cardId: "n", category: "educacao" };
    expect(invoiceFor(st({ transactions: [tx] }), nu, "2026-12").total).toBe(30);
    expect(invoiceFor(st({ transactions: [tx] }), nu, "2027-01").total).toBe(0);
  });
  it("compra parcelada de meses atrás: só a parcela de cada mês entra na fatura daquele mês", async () => {
    const { invoiceFor, planInfo } = await import("@/lib/finance/calc");
    // comprada em agosto (1ª parcela vence 05/09), 10 parcelas de 100: dez e as seguintes ainda faltam
    const p: Plan = { id: "p", desc: "Notebook", cardId: "n", total: 1000, count: 10, per: 100, purchaseYm: "2026-08", first: "2026-09", category: "compras", createdAt: "2026-08-10" };
    const s = st({ plans: [p] });
    expect(invoiceFor(s, nu, "2026-12").lines.filter((l) => l.source === "parcela").map((l) => l.parcel)).toEqual(["4/10"]);
    expect(invoiceFor(s, nu, "2026-11").lines.filter((l) => l.parcel).map((l) => l.parcel)).toEqual(["3/10"]); // a de novembro (já vencida) não conta na de dezembro
    expect(planInfo(p, nu, today).paid).toBe(3);
  });
  it("'já paguei N parcelas' alinha o contador e a fatura: a próxima parcela cai na próxima fatura a vencer", async () => {
    const { migratePaidManual, invoiceFor, planInfo, firstFromPaid } = await import("@/lib/finance/calc");
    expect(firstFromPaid(nu, today, 3)).toBe("2026-09"); // próxima a vencer é 05/12; 3 pagas → 1ª foi em setembro
    // o calendário dizia outra coisa (1ª em jun = 5 pagas), mas ela informou 3
    const p: Plan = { id: "p", desc: "Sofá", cardId: "n", total: 1000, count: 10, per: 100, purchaseYm: "2026-05", first: "2026-06", category: "moradia", paidManual: 3, createdAt: "2026-05-10" };
    const m = migratePaidManual(st({ plans: [p] }), today), q = m.plans[0]!;
    expect(q.paidManual).toBeUndefined(); expect(q.first).toBe("2026-09");
    expect(planInfo(q, nu, today).paid).toBe(3);
    expect(invoiceFor(m, nu, "2026-12").lines.find((l) => l.source === "parcela")?.parcel).toBe("4/10");
    expect(migratePaidManual(m, today)).toBe(m); // idempotente
  });
  it("depois do vencimento deste mês, a próxima a vencer passa para o mês seguinte", async () => {
    const { nextUnpaidYm } = await import("@/lib/finance/calc");
    expect(nextUnpaidYm(nu, new Date(2026, 10, 3))).toBe("2026-11");
    expect(nextUnpaidYm(nu, new Date(2026, 10, 5))).toBe("2026-12"); // vence hoje = já tratada como paga
    expect(nextUnpaidYm(nu, new Date(2026, 10, 30))).toBe("2026-12");
  });
});

import * as calcMod from "@/lib/finance/calc";

describe("detalhamento da sobra prevista", () => {
  const st = (): FinanceState => ({ ...EMPTY_STATE, onboarded: true,
    cards: [{ id: "c", name: "Nubank", brand: "visa", last4: "1234", tone: "roxo", limit: 5000, availableBase: 5000, baseDate: "2026-11-01", closingDay: 25, dueDay: 5, adjustments: {} }],
    recurring: [
      { id: "sal", kind: "receita", desc: "Salário", amount: 5000, day: 5, category: "salario", method: "pix", startYm: "2026-01" },
      { id: "alu", kind: "despesa", desc: "Aluguel", amount: 1500, day: 10, category: "moradia", method: "pix", startYm: "2026-01" },
      { id: "net", kind: "despesa", desc: "Netflix", amount: 55.9, day: 20, category: "assinaturas", method: "credito", cardId: "c", startYm: "2026-01" },
      { id: "dis", kind: "despesa", desc: "Disney+", amount: 40, day: 20, category: "lazer", method: "credito", cardId: "c", startYm: "2026-01", subscription: true, pauses: [{ from: "2026-11" }] },
    ],
    plans: [plan({ id: "tv", desc: "TV", cardId: "c", total: 1200, count: 12, per: 100, first: "2026-08" })],
    transactions: [
      { id: "t1", kind: "despesa", desc: "Mercado", amount: 300, date: "2026-11-12", method: "pix", category: "mercado" },
      { id: "t2", kind: "despesa", desc: "Tênis", amount: 250, date: "2026-11-20", method: "credito", cardId: "c", category: "compras" },
    ],
  });
  const b = calcMod.monthBreakdown(st(), "2026-11", "2026-11-17");
  const g = (id: string) => b.groups.find((x) => x.id === id)?.total ?? 0;
  it("os grupos somam exatamente a sobra prevista do mês", () => {
    expect(b.previsto).toBe(monthSummary(st(), "2026-11", "2026-11-17").previsto);
    expect(b.previsto).toBe(5000 - 1500 - 55.9 - 100 - 300 - 250);
  });
  it("separa contas fixas, assinaturas, parcelas, compras no cartão e gastos do dia a dia", () => {
    expect(g("fixas")).toBe(1500); expect(g("assinaturas")).toBe(55.9); expect(g("parcelas")).toBe(100); expect(g("cartao")).toBe(250); expect(g("avulsas")).toBe(300);
  });
  it("assinatura pausada não entra no detalhamento", () => {
    expect(b.groups.flatMap((x) => x.items).some((e) => e.desc === "Disney+")).toBe(false);
  });
  it("separa o que já saiu do que ainda vai sair", () => {
    const card = b.groups.find((x) => x.id === "cartao")!;
    expect(card.done).toBe(0); expect(card.later).toBe(250);
    expect(b.income.done).toBe(5000);
  });
});


describe("detalhamento da sobra de caixa (a conta que aparece na bola da visão geral)", () => {
  const today = new Date(2026, 10, 17);
  const st = (): FinanceState => ({ ...EMPTY_STATE, onboarded: true,
    accounts: [{ id: "a", name: "Nubank", kind: "banco", tone: "roxo", balanceBase: 0.4, baseDate: "2026-11-17" }],
    cards: [
      { id: "n", name: "Nubank", brand: "mastercard", last4: "1", tone: "roxo", limit: 5000, availableBase: 3886.44, baseDate: "2026-11-17", closingDay: 28, dueDay: 5, adjustments: {}, declared: { "2026-12": 1113.56 } },
      { id: "m", name: "Mercado Pago", brand: "mastercard", last4: "2", tone: "azul", limit: 3000, availableBase: 2565, baseDate: "2026-11-17", closingDay: 9, dueDay: 15, adjustments: {}, declared: { "2026-12": 435 } },
    ],
    recurring: [
      { id: "s", kind: "receita", desc: "Salário", amount: 1500, day: 30, category: "salario", method: "pix", accountId: "a", startYm: "2026-01" },
      { id: "c", kind: "despesa", desc: "Moradia", amount: 500, day: 30, category: "moradia", method: "pix", accountId: "a", startYm: "2026-01" },
      { id: "net", kind: "despesa", desc: "Netflix", amount: 55.9, day: 20, category: "assinaturas", method: "credito", cardId: "n", startYm: "2026-01" },
    ] });
  it("o resultado é exatamente a sobra de caixa (a mesma de monthClose)", () => {
    const b = calcMod.cashBreakdown(st(), today), c = calcMod.monthClose(st(), today);
    expect(b.previsto).toBeCloseTo(c.sobra, 2); expect(b.previsto).toBeLessThan(0);
    expect(b.income.total).toBeCloseTo(0.4 + 1500, 2);
  });
  it("faturas aparecem por cartão e compras no crédito não contam duas vezes", () => {
    const b = calcMod.cashBreakdown(st(), today), f = b.groups.find((g) => g.id === "faturas")!;
    expect(f.items.map((i) => i.cardId).sort()).toEqual(["m", "n"]); expect(f.total).toBeCloseTo(1548.56, 2);
    expect(b.groups.find((g) => g.id === "assinaturas")).toBeUndefined(); // Netflix está dentro da fatura do Nubank
    expect(b.groups.find((g) => g.id === "fixas")!.total).toBe(500);
    expect(b.expenses).toBeCloseTo(2048.56, 2);
  });
  it("categorias consideram o que há dentro das faturas", () => {
    const b = calcMod.cashBreakdown(st(), today);
    expect(b.catItems!.some((e) => e.desc === "Netflix")).toBe(true);
  });
});
