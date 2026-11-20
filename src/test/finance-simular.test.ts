import { describe, expect, it } from "vitest";
import { cashflow, dueYmPaidIn, invoiceFor, monthPlan, payDateOf, simulatePurchase } from "@/lib/finance/calc";
import { answer } from "@/lib/voice/finance-tool";
import { cleanPayAfter } from "@/lib/finance/db-map";
import { EMPTY_STATE, type Account, type Card, type FinanceState, type Recurring } from "@/lib/finance/types";

const hoje = new Date(2026, 10, 20); // 20/11/2026
// Nubank fecha 28 e vence 5; Mercado Pago fecha 29 e vence 4 — a pessoa paga 1 dia depois de fechar
const nu: Card = { id: "nu", name: "Nubank", brand: "mastercard", last4: "1111", tone: "roxo", limit: 8000, availableBase: 8000, baseDate: "2026-11-01", closingDay: 28, dueDay: 5, adjustments: {}, payAfterClose: 1 };
const mp: Card = { id: "mp", name: "Mercado Pago", brand: "visa", last4: "2222", tone: "azul", limit: 5000, availableBase: 5000, baseDate: "2026-11-01", closingDay: 29, dueDay: 4, adjustments: {}, payAfterClose: 1 };
const conta: Account = { id: "ct", name: "Conta", kind: "banco", tone: "verde", balanceBase: 1000, baseDate: "2026-11-01" };
const salario: Recurring = { id: "sal", kind: "receita", desc: "Salário", amount: 1500, day: 30, category: "salario", method: "pix", accountId: "ct", startYm: "2026-01" };
const base = (cards: Card[]): FinanceState => ({ ...EMPTY_STATE, onboarded: true, accounts: [conta], cards, recurring: [salario] });

describe("Paga a fatura no fechamento", () => {
  it("a data do pagamento é logo depois do fechamento, dentro do mês do fechamento", () => {
    expect(payDateOf(nu, "2026-12")).toBe("2026-11-29"); // fatura de novembro: fecha 28/11, vence 05/12, você paga 29/11
    expect(payDateOf(mp, "2026-12")).toBe("2026-11-30"); // fecha 29/11, vence 04/12, você paga 30/11
    expect(payDateOf({ ...nu, payAfterClose: undefined }, "2026-12")).toBe("2026-12-05"); // sem a regra: vencimento
  });
  it("nunca passa para o mês seguinte (fechamento dia 31 + 1 dia = último dia do mês)", () => {
    expect(payDateOf({ closingDay: 30, dueDay: 7, payAfterClose: 5 }, "2026-03")).toBe("2026-02-28");
    expect(payDateOf({ closingDay: 28, dueDay: 5, payAfterClose: 0 }, "2026-12")).toBe("2026-11-28");
  });
  it("o mês do calendário paga a fatura que FECHA nele", () => {
    expect(dueYmPaidIn(nu, "2026-11")).toBe("2026-12");
    expect(dueYmPaidIn({ ...nu, payAfterClose: undefined }, "2026-11")).toBe("2026-11");
  });
  it("a projeção põe a fatura no mês e no dia em que você paga, não no vencimento", () => {
    const s: FinanceState = { ...base([nu]), transactions: [{ id: "t1", kind: "despesa", desc: "Mercado", amount: 300, date: "2026-11-10", method: "credito", cardId: "nu", category: "mercado" }] };
    const nov = monthPlan(s, hoje, 3)[0]!, fat = nov.items.find((i) => i.group === "faturas")!;
    expect(fat.date).toBe("2026-11-29"); expect(fat.amount).toBe(300); expect(nov.faturas).toBe(300);
    expect(fat.detail).toContain("você paga 29/11");
    // com a regra antiga a mesma fatura só sairia em dezembro
    const antiga = monthPlan({ ...s, cards: [{ ...nu, payAfterClose: undefined }] }, hoje, 3);
    expect(antiga[0]!.faturas).toBe(0); expect(antiga[1]!.faturas).toBe(300);
  });
  it("o fluxo de caixa também usa o dia do pagamento", () => {
    const s: FinanceState = { ...base([nu]), transactions: [{ id: "t1", kind: "despesa", desc: "Mercado", amount: 300, date: "2026-11-10", method: "credito", cardId: "nu", category: "mercado" }] };
    const ev = cashflow(s, hoje, 30).events;
    expect(ev.find((e) => e.kind === "fatura")?.date).toBe("2026-11-29");
    expect(ev.map((e) => e.date)).toEqual(["2026-11-29", "2026-11-30"]); // a fatura (29) sai antes do salário (30)
  });
});

describe("E se eu comprar? (simulação)", () => {
  const s = base([nu, mp]);
  it("compra à vista na fatura de janeiro: sobe só a fatura que você paga em janeiro", () => {
    const sim = simulatePurchase(s, hoje, { cardId: "nu", amount: 900, closeYm: "2027-01", parcelas: 1 }, 10)!;
    expect(sim.pagaEm).toBe("2027-01-29"); expect(sim.faturaAntes).toBe(0); expect(sim.faturaDepois).toBe(900);
    const jan = sim.rows.find((r) => r.ym === "2027-01")!, fev = sim.rows.find((r) => r.ym === "2027-02")!;
    expect(jan.faturaDepois - jan.fatura).toBe(900); expect(fev.faturaDepois - fev.fatura).toBe(0);
    expect(jan.sobraDepois).toBe(jan.sobra - 900);
    expect(jan.saldoFimDepois).toBe(jan.saldoFim - 900); expect(fev.saldoFimDepois).toBe(fev.saldoFim - 900); // o rombo se mantém nos meses seguintes
  });
  it("parcelada em 3x: uma parcela por fatura, cada uma paga no seu mês", () => {
    const sim = simulatePurchase(s, hoje, { cardId: "mp", amount: 600, closeYm: "2027-01", parcelas: 3 }, 10)!;
    expect(sim.porParcela).toBe(200);
    const d = (ym: string) => { const r = sim.rows.find((x) => x.ym === ym)!; return r.faturaDepois - r.fatura; };
    expect([d("2027-01"), d("2027-02"), d("2027-03"), d("2027-04")]).toEqual([200, 200, 200, 0]);
    expect(sim.rows.find((r) => r.ym === "2027-01")!.pagaEm).toBe("2027-01-30");
  });
  it("não grava nada e avisa quando o saldo ficaria negativo", () => {
    const antes = JSON.stringify(s);
    const sim = simulatePurchase(s, hoje, { cardId: "nu", amount: 9000, closeYm: "2026-12", parcelas: 1 }, 6)!;
    expect(JSON.stringify(s)).toBe(antes);
    expect(sim.primeiroNegativo?.ym).toBe("2026-12");
    expect(simulatePurchase(s, hoje, { cardId: "x", amount: 10, closeYm: "2026-12" })).toBeNull();
    expect(simulatePurchase(s, hoje, { cardId: "nu", amount: 0, closeYm: "2026-12" })).toBeNull();
  });
  it("a simulação bate com cadastrar de verdade a compra", () => {
    const sim = simulatePurchase(s, hoje, { cardId: "nu", amount: 450, closeYm: "2026-12" }, 6)!;
    const real: FinanceState = { ...s, transactions: [{ id: "r", kind: "despesa", desc: "x", amount: 450, date: "2026-12-10", method: "credito", cardId: "nu", category: "outros" }] };
    expect(invoiceFor(real, nu, "2027-01").total).toBe(sim.faturaDepois);
    expect(monthPlan(real, hoje, 6).find((m) => m.ym === "2026-12")!.faturas).toBe(sim.rows.find((r) => r.ym === "2026-12")!.faturaDepois);
  });
});

describe("Orion: simular por voz/chat", () => {
  const s = base([nu, mp]);
  it("'janeiro' dito em novembro é o próximo janeiro; mostra fatura, sobra e saldo antes e depois", () => {
    const r = answer(s, { acao: "simular", valor: 900, cartao: "nubank", mes: "janeiro" }, hoje).result as any;
    expect(r.ok).toBe(true); expect(r.voce_paga_em).toBe("29/01/2027"); expect(r.paga_no).toBe("fechamento");
    expect(r.fatura_depois - r.fatura_antes).toBe(900);
    const jan = r.meses[0]; expect(jan.mes).toContain("janeiro de 2027");
    expect(jan.fatura_que_sai_nesse_mes.depois - jan.fatura_que_sai_nesse_mes.antes).toBe(900);
    expect(r.entradas_fixas).toEqual([{ descricao: "Salário", valor: 1500, dia: 30 }]);
  });
  it("com dois cartões e sem dizer qual, pergunta; sem valor, pergunta o valor", () => {
    expect((answer(s, { acao: "simular", valor: 100, mes: "janeiro" }, hoje).result as any).cartoes).toEqual(["Nubank", "Mercado Pago"]);
    expect((answer(s, { acao: "simular", cartao: "nubank" }, hoje).result as any).erro).toMatch(/valor/i);
  });
  it("parcelada mostra uma linha por mês de pagamento", () => {
    const r = answer(s, { acao: "simular", valor: 600, cartao: "mercado pago", mes: "fevereiro", parcelas_total: 3 }, hoje).result as any;
    expect(r.compra.por_parcela).toBe(200); expect(r.meses.length).toBe(3);
  });
});

describe("Salvar a regra no banco", () => {
  it("só aceita 0 a 10 dias; vazio vira 'paga no vencimento'", () => {
    expect(cleanPayAfter(1)).toBe(1); expect(cleanPayAfter("0")).toBe(0); expect(cleanPayAfter(null)).toBeUndefined();
    expect(cleanPayAfter(undefined)).toBeUndefined(); expect(cleanPayAfter(99)).toBe(10); expect(cleanPayAfter(-3)).toBe(0);
  });
});
