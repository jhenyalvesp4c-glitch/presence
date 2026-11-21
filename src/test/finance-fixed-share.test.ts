import { describe, expect, it } from "vitest";
import { fixedCoverage, invoiceFor, planShare, round2 } from "@/lib/finance/calc";
import type { Plan } from "@/lib/finance/types";

describe("ajuda de valor fixo em compra parcelada (Kindle 10x de 70,90, ajuda de 400)", () => {
  const plan = { id: "k", desc: "Kindle", cardId: "c1", total: 709, count: 10, per: 70.9, purchaseYm: "2026-10", first: "2026-11", category: "compras", createdAt: "2026-10-01", shared: { person: "Marido", percent: 56, fixed: 400 } } as Plan;
  it("cobre as primeiras parcelas até a ajuda acabar", () => {
    const parts = Array.from({ length: 10 }, (_, i) => planShare(plan, i + 1));
    for (let i = 0; i < 5; i++) expect(parts[i]?.percent).toBeCloseTo(100, 5);
    expect(round2(70.9 * (parts[5]!.percent / 100))).toBe(45.5);
    for (let i = 6; i < 10; i++) expect(parts[i]).toBeUndefined();
  });
  it("sem fixed mantém a fatia percentual", () => {
    expect(planShare({ ...plan, shared: { person: "M", percent: 30 } }, 3)).toEqual({ person: "M", percent: 30 });
  });
  it("prévia: 5 parcelas inteiras, 45,50 da 6ª e você paga 309", () => {
    const c = fixedCoverage(709, 70.9, 10, 400);
    expect(c).toMatchObject({ full: 5, partial: 45.5, partialN: 6, covered: 400, mine: 309 });
  });
});
