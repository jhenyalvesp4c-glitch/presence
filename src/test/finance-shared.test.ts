import { describe, expect, it } from "vitest";
import { invoiceFor, monthEntries, monthSummary, myPart, sharedPart } from "@/lib/finance/calc";
import { diffRows, fromRows, toRows } from "@/lib/finance/db-map";
import { EMPTY_STATE, type FinanceState } from "@/lib/finance/types";

const card = { id: "c1", name: "Nubank", brand: "mastercard" as const, last4: "1234", tone: "roxo" as const, limit: 10000, availableBase: 10000, baseDate: "2026-01-01", closingDay: 5, dueDay: 12, adjustments: {} };
const state = (extra: Partial<FinanceState>): FinanceState => ({ ...EMPTY_STATE, onboarded: true, cards: [card], ...extra });
// lava-louças: 10x de 300 no cartão, metade do marido; 1ª parcela na fatura de nov/26
const plan = { id: "p1", desc: "Lava-louças", cardId: "c1", total: 3000, count: 10, per: 300, purchaseYm: "2026-10", first: "2026-11", category: "casa", createdAt: "2026-10-20", shared: { person: "Marido", percent: 50 } };

describe("Gasto dividido com outra pessoa", () => {
  it("parte dele e a minha somam o valor, sem perder centavo", () => {
    expect(sharedPart(100.01, { percent: 50 })).toBe(50.01); expect(myPart(100.01, { percent: 50 })).toBe(50);
    expect(sharedPart(100, undefined)).toBe(0); expect(myPart(100, undefined)).toBe(100);
    expect(sharedPart(100, { percent: 150 })).toBe(100); // limita a 100%
  });
  it("a parcela entra como despesa cheia e a parte dele como receita a receber", () => {
    const es = monthEntries(state({ plans: [plan] }), "2026-11");
    const exp = es.find((e) => e.source === "parcela")!, inc = es.find((e) => e.source === "compartilhada")!;
    expect(exp.amount).toBe(300); expect(exp.kind).toBe("despesa");
    expect(inc).toMatchObject({ kind: "receita", amount: 150, person: "Marido", parcel: "1/10" }); expect(inc.desc).toContain("Marido");
    const sum = monthSummary(state({ plans: [plan] }), "2026-11", "2026-11-01");
    expect(sum.despesas + sum.aPagar).toBe(300); expect(sum.receitas + sum.aReceber).toBe(150); expect(sum.previsto).toBe(-150); // no fim, só a minha metade pesa
  });
  it("a fatura continua igual à do banco; mostra a minha parte e o que os outros devem", () => {
    const inv = invoiceFor(state({ plans: [plan], transactions: [{ id: "t1", kind: "despesa", desc: "Mercado", amount: 200, date: "2026-11-03", method: "credito", cardId: "c1", category: "mercado" }] }), card, "2026-11");
    expect(inv.total).toBe(500); expect(inv.othersOwe).toBe(150); expect(inv.mine).toBe(350);
    expect(inv.lines.find((l) => l.parcel === "1/10")?.shared).toMatchObject({ person: "Marido", percent: 50, part: 150 });
    expect(inv.lines.find((l) => l.desc === "Mercado")?.shared).toBeUndefined();
  });
  it("compra à vista e fixa também podem ser divididas", () => {
    const tx = { id: "t1", kind: "despesa" as const, desc: "Jantar", amount: 90, date: "2026-11-10", method: "credito" as const, cardId: "c1", category: "restaurantes", shared: { person: "Ana", percent: 50 } };
    const rec = { id: "r1", kind: "despesa" as const, desc: "Luz", amount: 300, day: 8, category: "moradia", method: "debito" as const, startYm: "2026-01", shared: { person: "Marido", percent: 40 } };
    const es = monthEntries(state({ transactions: [tx], recurring: [rec] }), "2026-11");
    expect(es.filter((e) => e.source === "compartilhada").map((e) => [e.person, e.amount]).sort()).toEqual([["Ana", 45], ["Marido", 120]]);
  });
  it("gasto sem divisão não gera receita", () => {
    expect(monthEntries(state({ plans: [{ ...plan, shared: undefined }] }), "2026-11").some((e) => e.source === "compartilhada")).toBe(false);
  });
  it("a divisão vai e volta do banco sem diferença", () => {
    const st = state({ plans: [plan] }), rows = toRows(st), back = fromRows(rows);
    expect(back.plans[0]?.shared).toEqual({ person: "Marido", percent: 50 });
    expect(diffRows(rows, toRows(back)).empty).toBe(true);
    const semDivisao = fromRows(toRows(state({ plans: [{ ...plan, shared: undefined }] })));
    expect(semDivisao.plans[0]?.shared).toBeUndefined();
  });
});

import { applyWrite, shareProp } from "@/lib/voice/finance-write";

describe("Orion divide compras (voz/chat)", () => {
  const hoje = new Date(2026, 10, 19);
  it("shareProp lê pessoa e porcentagem (padrão 50)", () => {
    expect(shareProp({ dividir_com: "Pedro" })).toEqual({ shared: { person: "Pedro", percent: 50 } });
    expect(shareProp({ dividir_com: "Pedro", percentual_dela: 30 })).toEqual({ shared: { person: "Pedro", percent: 30 } });
    expect(shareProp({})).toEqual({});
  });
  it("cadastrar parcelada já com divisão", () => {
    const out = applyWrite(state({}), { acao: "cadastrar_parcelada", cartao: "Nubank", descricao: "Lava-louças", valor: 300, parcelas_total: 10, dividir_com: "Pedro", percentual_dela: 50 }, hoje);
    expect(out.state?.plans[0]?.shared).toEqual({ person: "Pedro", percent: 50 });
  });
  it("dividir uma parcelada existente e remover a divisão", () => {
    const base = state({ plans: [{ ...plan, shared: undefined }] });
    const on = applyWrite(base, { acao: "dividir", alvo: "Lava-louças", tipo_alvo: "parcelada", pessoa: "Pedro", percentual_dela: 50 }, hoje);
    expect(on.state?.plans[0]?.shared).toEqual({ person: "Pedro", percent: 50 }); expect(on.result["parte_dela"]).toBe(150); expect(on.result["sua_parte"]).toBe(150);
    const off = applyWrite(on.state!, { acao: "dividir", alvo: "Lava-louças", tipo_alvo: "parcelada", pessoa: "remover" }, hoje);
    expect(off.state?.plans[0]?.shared).toBeUndefined(); expect(off.result["acao"]).toBe("divisao_removida");
  });
  it("não divide receita", () => {
    const base = state({ transactions: [{ id: "t9", kind: "receita", desc: "Freela", amount: 100, date: "2026-11-02", method: "pix", accountId: "a1", category: "outros" }] });
    expect(applyWrite(base, { acao: "dividir", alvo: "Freela", tipo_alvo: "movimentacao", pessoa: "Pedro" }, hoje).result["ok"]).toBe(false);
  });
});
