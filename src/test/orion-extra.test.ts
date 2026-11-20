import { describe, expect, it } from "vitest";
import { rank } from "@/lib/orion";
import { extraDocs, type ExtraRaw } from "@/lib/orion-extra";
import { EMPTY_STATE, type FinanceState } from "@/lib/finance/types";

const hoje = new Date(2026, 10, 20);
const raw: ExtraRaw = {
  memories: [{ id: "m1", text: "Prefere reuniões à tarde", kind: "preferencia", created_at: "2026-11-10T12:00:00Z" }],
  habits: [{ id: "h1", name: "Leitura 20 min", active: true }],
  completions: [{ habit_id: "h1", completed_on: "2026-11-19" }, { habit_id: "h1", completed_on: "2026-11-20" }],
  measurements: [{ id: "a", name: "f", measured_on: "2026-03-01", height_m: 1.7, weight_kg: 83.8, values: { cintura: "87" }, notes: "" }, { id: "b", name: "f", measured_on: "2026-11-17", height_m: 1.7, weight_kg: 72.6, values: { cintura: "80" }, notes: "" }],
  diet: [{ id: "d1", name: "Cutting", goal: "perder gordura", calories: 1650, protein: 120, carbs: 170, fat: 55, notes: "", active: true }],
  meals: [{ sheet_id: "d1", name: "Café", meal_time: "07:30", foods: [] }],
  workoutSplit: [{ weekday: 1, title: "Peito e tríceps" }],
  lists: [{ id: "l1", title: "Mercado", updated_at: "2026-11-19T10:00:00Z" }],
  listItems: [{ list_id: "l1", section: null, label: "Leite", done: true }, { list_id: "l1", section: null, label: "Pão", done: false }],
  schedule: [{ plan_date: "2026-11-20", time: "09:00:00", title: "Reunião Itanhaém", done: false, kind: "compromisso" }],
  settlements: [{ id: "s1", person: "Ana", closed: false, default_share: 50 }],
  settleItems: [{ settlement_id: "s1", kind: "compra", item_date: "2026-11-10", description: "Mercado", amount: 200, payer: "eu", other_share: 100, installment: "" }, { settlement_id: "s1", kind: "compra", item_date: "2026-11-12", description: "Farmácia", amount: 60, payer: "outro", other_share: 0, installment: "" }],
};
const fin: FinanceState = { ...EMPTY_STATE, onboarded: true, accounts: [{ id: "a1", name: "Itaú", kind: "banco", tone: "grafite", balanceBase: 1000, baseDate: "2026-11-01" }], cards: [{ id: "c1", name: "Nubank", brand: "mastercard", last4: "4617", tone: "roxo", limit: 7800, availableBase: 7800, baseDate: "2026-11-01", closingDay: 28, dueDay: 5, adjustments: {} }],
  recurring: [{ id: "r1", kind: "despesa", desc: "Netflix", amount: 55.9, day: 10, category: "assinaturas", method: "credito", cardId: "c1", startYm: "2026-01", subscription: true }] };
const docs = extraDocs(raw, fin, hoje);
const find = (q: string) => rank(docs, q, "2026-11-20", 5).docs.map((d) => d.id);

describe("O Orion enxerga o sistema todo", () => {
  it("monta documentos de cada parte do sistema", () => {
    const kinds = new Set(docs.map((d) => d.kind));
    for (const k of ["memoria", "habito", "saude", "lista", "plano", "financeiro"]) expect(kinds.has(k as never)).toBe(true);
  });
  it("financeiro: saldo, fatura aberta e assinaturas num lugar só", () => {
    const f = docs.find((d) => d.id === "financeiro:resumo")!;
    expect(f.text).toContain("Itaú: R$"); expect(f.text).toContain("Nubank"); expect(f.text).toContain("Netflix");
  });
  it("acerto: o saldo final com a pessoa", () => {
    const a = docs.find((d) => d.id === "financeiro:acerto:s1")!;
    expect(a.text).toMatch(/Ana paga R\$\s?140,00 a você/); expect(a.text).toContain("Farmácia");
  });
  it("as perguntas encontram o que não é anotação", () => {
    expect(find("como está meu financeiro")[0]).toBe("financeiro:resumo");
    expect(find("quanto a Ana me deve")).toContain("financeiro:acerto:s1");
    expect(find("o que tenho no plano hoje")).toContain("plano:2026-11-20");
    expect(find("qual meu peso")).toContain("saude:evolucao");
    expect(find("o que tem na lista do mercado")).toContain("lista:l1");
    expect(find("como estão meus hábitos de leitura")).toContain("habito:resumo");
    expect(find("o que eu prefiro nas reuniões")).toContain("memoria:m1");
  });
  it("sem dados financeiros não inventa documento", () => {
    expect(extraDocs({ ...raw, settlements: [], settleItems: [] }, null, hoje).some((d) => d.kind === "financeiro")).toBe(false);
  });
});
