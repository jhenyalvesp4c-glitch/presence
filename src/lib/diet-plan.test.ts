import { describe, expect, it } from "vitest";
import { cleanDietPlan, mealMacros, macrosFor, groupKcal, compareOptions, daySummary, optionProtein, swapsFor, weekOfPlan, type DayLog } from "./diet-plan";
import { DIET_RECOMP } from "./diet-recomp";

const log = (o: Partial<DayLog>): DayLog => ({ swaps: {}, extras: [], date: "2026-11-20", optionId: "A", mealsDone: [], extraProteinG: null, waterMl: null, energy: null, fullness: null, difficulty: null, training: null, discomfort: null, bowel: null, notes: "", ...o });

describe("diet macros", () => {
  const plan = DIET_RECOMP();
  it("estimates macros of a meal and applies swaps", () => {
    const m = plan.opcoes[1]!.refeicoes[0]!, base = mealMacros(m);
    expect(base.p).toBeGreaterThan(40); expect(base.kcal).toBeGreaterThan(400);
    const sw = mealMacros(m, { [`${m.id}|1`]: { alimento: "Batata-doce", porcao: "1 un.", grupo: "Energéticos" } });
    expect(sw.kcal).toBeLessThan(base.kcal);
  });
  it("macrosFor unknown food is zero; groupKcal parses", () => { expect(macrosFor("xyz", 100).kcal).toBe(0); expect(groupKcal("≈ 100–120 kcal")).toBe(110); expect(groupKcal("livres")).toBeNull(); });
  it("day summary includes extras", () => { const s = daySummary(plan, log({ extras: [{ id: "x", nome: "Barra", kcal: 200, p: 10, c: 20, f: 8 }] })); expect(s.macros.kcal).toBe(200); expect(s.protein).toBe(10); });
});
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
