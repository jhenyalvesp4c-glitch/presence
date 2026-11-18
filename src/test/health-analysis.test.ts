import { describe, expect, it } from "vitest";
import { addDays, analyze, demoHistory, FAT_KEY, goalProgress, heightCm, periodSlice, rfm, slopePerDay } from "@/lib/health-analysis";
import { prefsFromRow } from "@/lib/data/analysis";
import type { MeasurementSheet } from "@/lib/health-preview";

const sheet = (data: string, peso: string, cintura: string, altura = "1,68"): MeasurementSheet => ({ nome: "t", data, altura, peso, valores: { cintura, quadril: "100" }, obs: "", fotos: {} });

describe("Análise de saúde", () => {
  it("altura aceita 1,68 ou 168", () => { expect(heightCm("1,68")).toBeCloseTo(168); expect(heightCm("168")).toBe(168); expect(heightCm("")).toBeNull(); });
  it("gordura estimada (RFM) por sexo e com limites", () => {
    expect(rfm("feminino", 168, 84)).toBeCloseTo(36); expect(rfm("masculino", 168, 84)).toBeCloseTo(24);
    expect(rfm("feminino", null, 84)).toBeNull(); expect(rfm("masculino", 168, 1)).toBe(3); expect(rfm("feminino", 168, 5000)).toBe(70);
  });
  it("recorte do período inclui a medição anterior como ponto de partida", () => {
    const h = [sheet("2026-01-01", "80", "90"), sheet("2026-10-20", "78", "88"), sheet("2026-11-10", "77", "87")];
    expect(periodSlice(h, "30", "2026-11-18").map((x) => x.data)).toEqual(["2026-01-01", "2026-10-20", "2026-11-10"]); // a anterior entra como ponto de partida
    expect(periodSlice(h, "30", "2026-12-15").map((x) => x.data)).toEqual(["2026-11-10"]);
    expect(periodSlice(h, "all", "2026-11-18")).toHaveLength(3);
  });
  it("tendência do peso e projeção", () => {
    expect(slopePerDay([{ date: "2026-11-01", value: 80 }, { date: "2026-11-11", value: 79 }])).toBeCloseTo(-0.1);
    const a = analyze([sheet("2026-11-01", "80", "90"), sheet("2026-11-11", "79", "89")], "feminino", "2026-11-18")!;
    expect(a.delta.weight).toBeCloseTo(-1); expect(a.projection30).toBeCloseTo(76); expect(a.sinceLast).toBe(7);
  });
  it("histórico de exemplo gera análise completa", () => {
    const a = analyze(demoHistory("2026-11-18"), "feminino", "2026-11-18")!;
    expect(a.entries).toHaveLength(7); expect(a.score).not.toBeNull(); expect(a.insights.length).toBeGreaterThan(2);
    expect(addDays("2026-11-18", -90)).toBe("2026-08-20");
  });
  it("sem medições não há análise", () => { expect(analyze([], "feminino", "2026-11-18")).toBeNull(); });

  it("gordura medida pela pessoa vale mais que a estimativa", () => {
    const m = { ...sheet("2026-11-01", "80", "90"), valores: { cintura: "90", [FAT_KEY]: "28,5" } };
    const a = analyze([m], "feminino", "2026-11-18")!;
    expect(a.last.fatManual).toBe(true); expect(a.last.fatPct).toBeCloseTo(28.5); expect(a.last.fatKg).toBeCloseTo(22.8); expect(a.last.leanKg).toBeCloseTo(57.2);
    const est = analyze([sheet("2026-11-01", "80", "90")], "feminino", "2026-11-18")!;
    expect(est.last.fatManual).toBe(false);
    const absurdo = analyze([{ ...m, valores: { cintura: "90", [FAT_KEY]: "2" } }], "feminino", "2026-11-18")!;
    expect(absurdo.last.fatManual).toBe(false); // fora de 3–70%: ignora
  });
  it("progresso até a meta", () => {
    const g = goalProgress(80, 74, 70, -0.5)!;
    expect(g.pct).toBeCloseTo(60); expect(g.remaining).toBeCloseTo(4); expect(g.reached).toBe(false); expect(g.etaDays).toBe(56);
    expect(goalProgress(80, 80.5, 70, 0.4)!.etaDays).toBeNull(); // está indo para o lado errado
    expect(goalProgress(80, 69, 70, -0.5)).toMatchObject({ reached: true, pct: 100, remaining: 0 });
    expect(goalProgress(60, 62, 65, 0.3)!.pct).toBeCloseTo(40); // meta de ganhar
    expect(goalProgress(80, 75, 80, null)).toBeNull(); expect(goalProgress(null, 75, 70, 0)).toBeNull();
  });
  it("preferências vêm do banco com padrões seguros", () => {
    expect(prefsFromRow(null)).toMatchObject({ sexo: "feminino", period: "90", hidden: ["abdomen", "gluteo"], goalWeight: null });
    expect(prefsFromRow({ analysis_sex: "masculino", analysis_period: "180", analysis_hidden: [], goal_weight_kg: "70.5", goal_waist_cm: null })).toEqual({ sexo: "masculino", period: "180", hidden: [], goalWeight: 70.5, goalWaist: null });
    expect(prefsFromRow({ analysis_sex: "x", analysis_period: "7", analysis_hidden: null, goal_weight_kg: null, goal_waist_cm: null }).period).toBe("90");
  });
});
