import { describe, expect, it } from "vitest";
import { cleanDietPlan, mealMacros, macrosFor, groupKcal, compareOptions, daySummary, optionProtein, swapsFor, weekOfPlan, type DayLog } from "./diet-plan";
import { DIET_RECOMP } from "./diet-recomp";

const log = (o: Partial<DayLog>): DayLog => ({ customMeals: [], swaps: {}, extras: [], date: "2026-11-20", optionId: "A", mealsDone: [], extraProteinG: null, waterMl: null, energy: null, fullness: null, difficulty: null, training: null, discomfort: null, bowel: null, notes: "", ...o });

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

import { buildDietReport, dietReportText } from "./diet-report";
import { findFoods, foodForPlanItem, foodMacros, FOODS } from "./diet-foods";
describe("diet diary + report", () => {
  const plan = DIET_RECOMP();
  it("food search and macros by measure", () => {
    const arroz = findFoods("arroz")[0]!; expect(arroz.nome).toBe("Arroz branco");
    const m = foodMacros(arroz, 4, "col. sopa"); expect(Math.round(m.kcal)).toBe(130); // 100 g
    expect(foodForPlanItem("Carne moída magra ou frango")?.nome).toBe("Carne moída magra"); expect(FOODS.length).toBeGreaterThan(50);
  });
  it("logged meal replaces the planned portion", () => {
    const mk = (extras: DayLog["extras"]) => ({ customMeals: [], swaps: {}, extras, date: "2026-11-20", optionId: "A", mealsDone: ["a-almoco"], extraProteinG: null, waterMl: null, energy: null, fullness: null, difficulty: null, training: null, discomfort: null, bowel: null, notes: "" } as DayLog);
    const planned = daySummary(plan, mk([])).macros.kcal, logged = daySummary(plan, mk([{ id: "1", nome: "Ovo", kcal: 100, p: 8, c: 1, f: 7, meal: "a-almoco" }])).macros.kcal;
    expect(planned).toBeGreaterThan(500); expect(logged).toBe(100);
  });
  it("report sums days and renders text", () => {
    const l = { customMeals: [], swaps: {}, extras: [{ id: "1", nome: "Ovo", qtd: "2 unidade", kcal: 145, p: 12, c: 1, f: 10, meal: "outros" }], date: "2026-11-20", optionId: "B", mealsDone: [], extraProteinG: null, waterMl: 1500, energy: 4, fullness: 2, difficulty: null, training: null, discomfort: null, bowel: true, notes: "ok" } as DayLog;
    const r = buildDietReport(plan, "2026-11-14", "2026-11-20", "2026-11-20", [l], []);
    expect(r.dias[0]?.kcal).toBe(145); expect(r.media?.p).toBe(12);
    const t = dietReportText(r); expect(t).toMatch(/RELATÓRIO DE ALIMENTAÇÃO/); expect(t).toMatch(/Ovo \(2 unidade\)/);
  });
});

import { customFood } from "./diet-foods";
describe("custom foods", () => {
  it("per-portion macros scale to the portion", () => {
    const fd = customFood({ nome: "Barra X", kcal: 200, p: 15, c: 18, f: 7, base: "porcao", unidade: "barra", gramas: 50 });
    const m = foodMacros(fd, 2, "barra"); expect(Math.round(m.kcal)).toBe(400); expect(Math.round(m.p)).toBe(30);
    const g = foodMacros(fd, 100, "g"); expect(Math.round(g.kcal)).toBe(400);
  });
  it("portion without grams counts 1 unit as the typed values", () => { const fd = customFood({ nome: "Doce", kcal: 90, p: 1, c: 15, f: 3, base: "porcao", unidade: "unidade", gramas: 0 }); expect(Math.round(foodMacros(fd, 1, "unidade").kcal)).toBe(90); });
  it("per-100g keeps values", () => { const fd = customFood({ nome: "Pão", kcal: 250, p: 8, c: 50, f: 2, base: "100g", unidade: "", gramas: 0 }); expect(Math.round(foodMacros(fd, 40, "g").kcal)).toBe(100); });
});

import { cleanInterpretation, mealTarget, toEntries, totalOf } from "./diet-ai";
describe("diet ai", () => {
  const plan = DIET_RECOMP().opcoes[1]!.refeicoes;
  it("cleans the AI answer and computes kcal when missing", () => {
    const r = cleanInterpretation({ refeicoes: [{ refeicao: "Almoço", itens: [{ nome: "Arroz", qtd: "3 col. sopa", gramas: 75, kcal: 0, p: 1.9, c: 21, f: 0.2 }, { nome: "", qtd: "x" }] }, { refeicao: "Vazia", itens: [] }], aviso: "ok" })!;
    expect(r.refeicoes).toHaveLength(1); expect(r.refeicoes[0]!.itens).toHaveLength(1); expect(Math.round(r.refeicoes[0]!.itens[0]!.kcal)).toBe(93);
    expect(cleanInterpretation({ refeicoes: [] })).toBeNull(); expect(cleanInterpretation(null)).toBeNull();
  });
  it("maps meal names to plan meals, custom meals or new ones", () => {
    expect(mealTarget("Almoço", plan, []).id).toBe("b-almoco"); expect(mealTarget("lanche", plan, []).id).toBe("b-lanche"); expect(mealTarget("Jantar pós-treino", plan, []).id).toBe("b-jantar");
    expect(mealTarget("Café da manhã", plan, ["Café da manhã"])).toEqual({ id: "c:Café da manhã", nome: "Café da manhã", novo: false });
    expect(mealTarget("Ceia", plan, [])).toEqual({ id: "c:Ceia", nome: "Ceia", novo: true });
  });
  it("builds diary entries and totals", () => {
    const r = cleanInterpretation({ refeicoes: [{ refeicao: "Almoço", itens: [{ nome: "Arroz", qtd: "3 col.", kcal: 100, p: 2, c: 20, f: 0 }] }, { refeicao: "Ceia", itens: [{ nome: "Iogurte", qtd: "1", kcal: 60, p: 4, c: 6, f: 2 }] }] })!;
    let n = 0; const { extras, novas } = toEntries(r, plan, [], () => `id${n++}`);
    expect(extras.map((e) => e.meal)).toEqual(["b-almoco", "c:Ceia"]); expect(novas).toEqual(["Ceia"]); expect(totalOf(r).kcal).toBe(160);
  });
});

import { appliesOn, expandFixed, parseFixedKey, ruleLabel, type FixedTask } from "./fixed-tasks";
describe("fixed tasks", () => {
  const f = (o: Partial<FixedTask> = {}): FixedTask => ({ id: "11111111-1111-4111-8111-111111111111", title: "Skin care", category_id: null, priority: "media", due_time: null, weekdays: [0, 1, 2, 3, 4, 5, 6], active: true, position: 0, every_weeks: 1, start_date: "2026-11-01", times_per_week: null, ...o });
  it("applies on chosen weekdays only and ignores paused", () => {
    expect(appliesOn(f(), "2026-11-21")).toBe(true); // sábado
    expect(appliesOn(f({ weekdays: [1, 2, 3, 4, 5] }), "2026-11-21")).toBe(false); expect(appliesOn(f({ weekdays: [1, 2, 3, 4, 5] }), "2026-11-23")).toBe(true);
    expect(appliesOn(f({ active: false }), "2026-11-23")).toBe(false);
  });
  it("expands a range and marks done by date", () => {
    const occ = expandFixed([f()], new Set(["11111111-1111-4111-8111-111111111111|2026-11-22"]), "2026-11-21", "2026-11-23");
    expect(occ.map((o) => o.date)).toEqual(["2026-11-21", "2026-11-22", "2026-11-23"]); expect(occ.map((o) => o.done)).toEqual([false, true, false]);
    expect(parseFixedKey(occ[1]!.key)).toEqual({ id: "11111111-1111-4111-8111-111111111111", date: "2026-11-22" });
  });
  it("labels the rules", () => { expect(ruleLabel(f())).toBe("Todos os dias"); expect(ruleLabel(f({ weekdays: [1, 2, 3, 4, 5] }))).toBe("Dias úteis"); expect(ruleLabel(f({ weekdays: [3] }))).toBe("Qua · toda semana"); expect(ruleLabel(f({ weekdays: [3, 1], every_weeks: 2 }))).toBe("Seg · Qua · a cada 2 semanas"); expect(ruleLabel(f({ times_per_week: 2 }))).toBe("2× por semana"); });
  it("every 2 weeks counts from the start week", () => {
    const r = f({ weekdays: [1], every_weeks: 2, start_date: "2026-11-02" }); // segunda
    expect(appliesOn(r, "2026-11-02")).toBe(true); expect(appliesOn(r, "2026-11-09")).toBe(false); expect(appliesOn(r, "2026-11-16")).toBe(true); expect(appliesOn(r, "2026-10-26")).toBe(false);
  });
  it("N times per week disappears once the quota is met", () => {
    const id = "11111111-1111-4111-8111-111111111111", r = f({ times_per_week: 2, start_date: "2026-11-16" });
    const occ = expandFixed([r], new Set([`${id}|2026-11-16`, `${id}|2026-11-18`]), "2026-11-16", "2026-11-22");
    expect(occ.map((o) => o.date)).toEqual(["2026-11-16", "2026-11-18"]); // só os dias feitos; o resto da semana some
    const part = expandFixed([r], new Set([`${id}|2026-11-16`]), "2026-11-16", "2026-11-22");
    expect(part.length).toBe(7); // cota não batida: aparece todos os dias
  });
});
