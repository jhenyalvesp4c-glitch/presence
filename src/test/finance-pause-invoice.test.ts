import { describe, expect, it } from "vitest";
import { invoiceFor, pauseRecurring, subscriptionForInvoice } from "@/lib/finance/calc";
import { EMPTY_STATE, type Card, type FinanceState, type Recurring } from "@/lib/finance/types";

// cartão que fecha dia 3 e vence dia 10: uma cobrança do dia 17 de novembro entra na fatura que FECHA em 3/12 (vence 10/12)
const card: Card = { id: "c1", name: "Nubank", brand: "mastercard", last4: "4617", tone: "roxo", limit: 5000, availableBase: 5000, baseDate: "2026-01-01", closingDay: 3, dueDay: 10, adjustments: {} };
const sub = (id: string, desc: string, day: number, amount: number): Recurring => ({ id, kind: "despesa", desc, amount, day, category: "assinaturas", method: "credito", cardId: "c1", startYm: "2026-01", subscription: true });
const st = (recurring: Recurring[]): FinanceState => ({ ...EMPTY_STATE, onboarded: true, cards: [card], recurring });
const names = (s: FinanceState, due: string) => invoiceFor(s, card, due).lines.map((l) => l.desc).sort();
const hoje = new Date(2026, 10, 19); // 19/11/2026

describe("Pausar assinatura no cartão", () => {
  const chat = pauseRecurring(sub("a", "ChatGPT Go", 17, 39.9), hoje);   // já renovou dia 17: pausa a partir de dez
  const prime = pauseRecurring(sub("b", "Amazon Prime", 16, 19.9), hoje); // já renovou dia 16
  const cilios = pauseRecurring(sub("c", "Cílios", 30, 160), hoje);       // dia 30 ainda não chegou
  const s = st([chat, prime, cilios]);

  it("a pausa começa no mês certo (renovou → mês que vem; não renovou → este mês)", () => {
    expect(chat.pauses).toEqual([{ from: "2026-12" }]); expect(prime.pauses).toEqual([{ from: "2026-12" }]); expect(cilios.pauses).toEqual([{ from: "2026-11" }]);
  });
  it("a cobrança de novembro (dia 17/16) continua na fatura que a contém (vence 10/12)", () => {
    expect(names(s, "2026-12")).toEqual(["Amazon Prime", "ChatGPT Go"]); // Cílios de 30/11 ainda não foi cobrado: não entra
  });
  it("as próximas cobranças somem das faturas seguintes", () => {
    expect(names(s, "2027-01")).toEqual([]); expect(names(s, "2027-02")).toEqual([]);
  });
  it("o que já foi cobrado antes da pausa continua nas faturas antigas", () => {
    expect(names(s, "2026-11")).toEqual(["Amazon Prime", "ChatGPT Go", "Cílios"]); // cobranças de outubro (vencem 10/11); a de Cílios foi 30/10
  });
  it("sem pausa, uma cobrança por fatura, na data certa", () => {
    const livre = st([sub("a", "ChatGPT Go", 17, 39.9)]);
    for (const due of ["2026-10", "2026-11", "2026-12", "2027-01"]) expect(invoiceFor(livre, card, due).lines).toHaveLength(1);
    expect(invoiceFor(livre, card, "2026-12").lines[0]?.date).toBe("2026-11-17");
  });
  it("assinatura detalhada numa fatura nasce nessa fatura", () => {
    const r = subscriptionForInvoice(card, "2026-12", { id: "n", desc: "Netflix", amount: 55, day: 17 });
    expect(r.startYm).toBe("2026-11"); // 17/11 cai na fatura que vence em dezembro
    expect(invoiceFor(st([r]), card, "2026-12").lines.map((l) => l.desc)).toEqual(["Netflix"]);
    expect(invoiceFor(st([r]), card, "2026-11").lines).toHaveLength(0); // antes da 1ª cobrança
  });
});
