import { describe, expect, it } from "vitest";
import { cleanDietPlan, compareOptions, daySummary, optionProtein, swapsFor, weekOfPlan, type DayLog } from "./diet-plan";
import { DIET_RECOMP } from "./diet-recomp";

const log = (o: Partial<DayLog>): DayLog => ({ date: "2026-11-20", optionId: "A", mealsDone: [], extraProteinG: null, waterMl: null, energy: null, fullness: null, difficulty: null, training: null, discomfort: null, bowel: null, notes: "", ...o });

describe("diet plan", () => {
  const plan = DIET_RECOMP();
  it("template survives cleaning", () => { const c = cleanDietPlan(JSON.parse(JSON.stringify(plan))); expect(c?.opcoes).toHaveLength(2); expect(c?.grupos).toHaveLength(11); expect(c?.opcoes[1]?.recomendada).toBe(true); });
  it("rejects junk", () => { expect(cleanDietPlan(null)).toBeNull(); expect(cleanDietPlan({ opcoes: [] })).toBeNull(); });
  it("protein of each option lands in the 115–130 g band", () => { for (const o of plan.opcoes) { const p = optionProtein(o); expect(p).toBeGreaterThanOrEqual(108); expect(p).toBeLessThanOrEqual(135); } });
  it("day summary counts eaten meals + extra protein", () => { const s = daySummary(plan, log({ optionId: "B", mealsDone: ["b-lanche"], extraProteinG: 10 })); expect(s.done).toBe(1); expect(s.total).toBe(3); expect(s.protein).toBeGreaterThanOrEqual(35); expect(s.protein).toBeLessThanOrEqual(37); });
  it("compares options by averages", () => { const r = compareOptions(plan, [log({ optionId: "A", fullness: 4 }), log({ date: "2026-11-21", optionId: "A", fullness: 2 }), log({ date: "2026-11-22", optionId: "B", fullness: 1 })]); expect(r[0]?.fullness).toBe(3); expect(r[1]?.fullness).toBe(1); expect(r[0]?.dias).toBe(2); });
  it("finds swaps", () => { const s = swapsFor(plan, "Arroz"); expect(s.tabela.join()).toMatch(/batata/); expect(s.grupo?.nome).toBe("Energéticos"); });
  it("week of plan", () => { expect(weekOfPlan("2026-11-16", "2026-11-16")).toBe(1); expect(weekOfPlan("2026-11-16", "2026-11-23")).toBe(2); expect(weekOfPlan("2026-11-16", "2026-11-10")).toBe(0); });
});
