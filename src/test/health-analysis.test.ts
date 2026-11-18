import { describe, expect, it } from "vitest";
import { addDays, analyze, demoHistory, heightCm, periodSlice, rfm, slopePerDay } from "@/lib/health-analysis";
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
});
