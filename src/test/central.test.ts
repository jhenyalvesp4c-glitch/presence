import { describe, expect, it } from "vitest";
import { dayProgress, deadlineBucket, greeting, invoiceAlerts, nextDayOfMonth, parseDeadline } from "@/lib/central";

const TODAY = "2026-11-21";
describe("central do dia", () => {
  it("saudação por hora", () => { expect(greeting(8)).toBe("Bom dia"); expect(greeting(15)).toBe("Boa tarde"); expect(greeting(21)).toBe("Boa noite"); });
  it("prazo da demanda em vários formatos", () => {
    expect(parseDeadline("30/11", TODAY)).toBe("2026-11-30");
    expect(parseDeadline("5/1/27", TODAY)).toBe("2027-01-05");
    expect(parseDeadline("2026-12-02", TODAY)).toBe("2026-12-02");
    expect(parseDeadline("—", TODAY)).toBeNull();
    expect(parseDeadline("31/13", TODAY)).toBeNull();
  });
  it("faixas de prazo", () => {
    expect(deadlineBucket("2026-11-20", TODAY)).toBe("late");
    expect(deadlineBucket("2026-11-21", TODAY)).toBe("today");
    expect(deadlineBucket("2026-11-24", TODAY)).toBe("soon");
    expect(deadlineBucket("2026-12-30", TODAY)).toBe("later");
    expect(deadlineBucket(null, TODAY)).toBe("none");
  });
  it("próximo dia do mês, inclusive virada de ano e mês curto", () => {
    expect(nextDayOfMonth(28, TODAY)).toBe("2026-11-28");
    expect(nextDayOfMonth(5, TODAY)).toBe("2026-12-05");
    expect(nextDayOfMonth(5, "2026-12-20")).toBe("2027-01-05");
    expect(nextDayOfMonth(31, "2026-02-10")).toBe("2026-02-28");
  });
  it("faturas que fecham ou vencem nos próximos dias", () => {
    const a = invoiceAlerts([{ name: "Nubank", closingDay: 28, dueDay: 5 }, { name: "Mercado Pago", closingDay: 29, dueDay: 4 }], TODAY, 8);
    expect(a.map((x) => `${x.card}:${x.kind}:${x.inDays}`)).toEqual(["Nubank:fecha:7", "Mercado Pago:fecha:8"]);
  });
  it("progresso soma as partes", () => { expect(dayProgress([{ done: 2, total: 4 }, { done: 1, total: 1 }, { done: 0, total: 0 }])).toEqual({ done: 3, total: 5, pct: 60 }); });
});

import { subscriptionRenewals } from "@/lib/central";
import { EMPTY_STATE, type FinanceState } from "@/lib/finance/types";

describe("assinaturas renovando na Central", () => {
  const rec = (o: Record<string, unknown>) => ({ id: "r", kind: "despesa", desc: "Netflix", amount: 55.9, day: 25, category: "assinaturas", method: "credito", startYm: "2026-01", subscription: true, ...o });
  const st = (recurring: unknown[]): FinanceState => ({ ...structuredClone(EMPTY_STATE), cards: [{ id: "c1", name: "Nubank", last4: "4821" }] as FinanceState["cards"], recurring: recurring as FinanceState["recurring"] });
  it("lista as que cobram nos próximos 30 dias, da mais próxima para a mais distante", () => {
    const out = subscriptionRenewals(st([rec({ id: "a", desc: "Spotify", day: 28, cardId: "c1" }), rec({ id: "b", desc: "Netflix", day: 24 })]), "2026-11-22");
    expect(out.map((r) => [r.name, r.inDays, r.date])).toEqual([["Netflix", 2, "2026-11-24"], ["Spotify", 6, "2026-11-28"]]);
    expect(out[1]!.where).toBe("Nubank •••• 4821");
  });
  it("ignora pausadas, despesas que não são assinatura e as que só cobram depois dos 30 dias", () => {
    const out = subscriptionRenewals(st([rec({ id: "p", pauses: [{ from: "2026-10" }] }), rec({ id: "x", desc: "Aluguel", subscription: false, category: "moradia" }), rec({ id: "l", desc: "Anual", day: 22, startYm: "2027-01" })]), "2026-11-22");
    expect(out).toEqual([]);
  });
  it("cobra hoje conta como 0 dias", () => { expect(subscriptionRenewals(st([rec({ day: 22 })]), "2026-11-22")[0]!.inDays).toBe(0); });
});
