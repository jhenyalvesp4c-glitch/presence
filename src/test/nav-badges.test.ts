import { describe, expect, it } from "vitest";
import { financeBadge, habitBadge, ideaBadge, taskBadge } from "@/lib/nav-badges";
import { EMPTY_STATE, type Card, type FinanceState } from "@/lib/finance/types";
import type { Idea } from "@/lib/ideas";

const nu: Card = { id: "nu", name: "Nubank", brand: "mastercard", last4: "1111", tone: "roxo", limit: 8000, availableBase: 8000, baseDate: "2026-11-01", closingDay: 28, dueDay: 5, adjustments: {}, declared: { "2026-12": 1113.56 }, payAfterClose: 1 };
const mp: Card = { id: "mp", name: "Mercado Pago", brand: "visa", last4: "2222", tone: "azul", limit: 5000, availableBase: 5000, baseDate: "2026-11-01", closingDay: 29, dueDay: 4, adjustments: {}, declared: { "2026-12": 435.8 }, payAfterClose: 1 };
const s: FinanceState = { ...EMPTY_STATE, onboarded: true, cards: [nu, mp] };
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("Indicador de tarefas", () => {
  it("conta as de hoje e as atrasadas; concluídas e sem data não contam", () => {
    const t = [{ done: false, due_date: "2026-11-20" }, { done: false, due_date: "2026-11-20" }, { done: false, due_date: "2026-11-18" }, { done: true, due_date: "2026-11-20" }, { done: false, due_date: null }, { done: false, due_date: "2026-11-25" }];
    expect(taskBadge(t, "2026-11-20")).toEqual({ n: 3, text: "2 tarefas para hoje · 1 atrasada", tone: "amber" });
    expect(taskBadge([{ done: false, due_date: "2026-11-20" }], "2026-11-20")).toEqual({ n: 1, text: "1 tarefa para hoje", tone: "cyan" });
    expect(taskBadge([{ done: false, due_date: "2026-12-01" }], "2026-11-20")).toBeNull();
  });
});

describe("Indicador do financeiro", () => {
  it("não avisa quando falta muito para fechar", () => { expect(financeBadge(s, d(2026, 11, 20))).toBeNull(); expect(financeBadge(null, d(2026, 11, 20))).toBeNull(); });
  it("avisa quando a fatura fecha nos próximos 3 dias, com o valor", () => {
    const b = financeBadge(s, d(2026, 11, 26))!; // Nubank fecha 28 (em 2 dias), Mercado Pago 29 (em 3)
    expect(b.n).toBe(2); expect(b.tone).toBe("amber");
    expect(b.text).toContain("Nubank fecha em 2 dias"); expect(b.text).toContain("Mercado Pago fecha em 3 dias"); expect(b.text).toContain("1.113,56");
  });
  it("urgente (rosa) quando fecha hoje ou amanhã", () => {
    const b = financeBadge(s, d(2026, 11, 27))!; expect(b.tone).toBe("rose"); expect(b.text).toContain("Nubank fecha amanhã");
  });
  it("no dia de pagar (paga no fechamento) avisa para pagar hoje", () => {
    const b = financeBadge(s, d(2026, 11, 29))!;
    expect(b.text).toContain("Pagar a fatura do Nubank hoje"); expect(b.tone).toBe("rose");
  });
  it("depois de pagar, deixa de avisar até o próximo fechamento", () => { expect(financeBadge(s, d(2026, 12, 2))).toBeNull(); });
});

describe("Indicador de ideias e hábitos", () => {
  const now = new Date("2026-11-20T12:00:00Z"), idea = (id: string, ago: number, status: Idea["status"] = "solta"): Idea => ({ id, title: id, body: "", kind: "ideia", area: "pessoal", status, tags: [], links: [], attachments: [], plan: null, budget: [], converted: [], source: "texto", touchedAt: new Date(now.getTime() - ago * 86_400_000).toISOString(), createdAt: new Date(now.getTime() - ago * 86_400_000).toISOString() });
  it("ideias paradas há 30+ dias, só as em aberto", () => {
    expect(ideaBadge([idea("a", 45), idea("b", 31), idea("c", 5), idea("d", 90, "arquivada")], now)).toEqual({ n: 2, text: "2 ideias paradas há mais de 30 dias", tone: "amber" });
    expect(ideaBadge([idea("c", 5)], now)).toBeNull();
  });
  it("hábitos que faltam hoje", () => {
    const h = [{ id: "1" }, { id: "2" }, { id: "3" }], c = [{ habit_id: "1", completed_on: "2026-11-20" }, { habit_id: "2", completed_on: "2026-11-19" }];
    expect(habitBadge(h, c, "2026-11-20")).toEqual({ n: 2, text: "Faltam 2 hábitos hoje", tone: "cyan" });
    expect(habitBadge([{ id: "1" }], [{ habit_id: "1", completed_on: "2026-11-20" }], "2026-11-20")).toBeNull();
  });
});
