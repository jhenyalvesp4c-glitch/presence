import { describe, expect, it } from "vitest";
import { bodyData, fmtDelta, totalChange } from "@/lib/body";
import type { MeasurementSheet } from "@/lib/health-preview";

const m = (data: string, valores: Record<string, string>): MeasurementSheet => ({ nome: "x", data, altura: "1,70", peso: "70", valores, obs: "", fotos: {} });
describe("Mapa do corpo", () => {
  const h = [m("2026-11-01", { cintura: "90", abdomen: "100", gluteo: "100", braco: "30", coxa: "55" }), m("2026-11-15", { cintura: "87,5", abdomen: "100", gluteo: "102", braco_d: "31", braco_e: "30,5", coxa_d: "56" })];
  const d = bodyData(h);
  it("última medida, primeira e variação", () => { expect(d.cintura).toMatchObject({ current: 87.5, first: 90, delta: -2.5 }); expect(d.gluteo.delta).toBe(2); expect(d.abdomen.delta).toBe(0); });
  it("medidas antigas de braço e coxa (lado único) valem para os dois lados", () => { expect(d.braco_d.first).toBe(30); expect(d.braco_e.first).toBe(30); expect(d.braco_d.current).toBe(31); expect(d.coxa_e.current).toBe(55); expect(d.coxa_d.delta).toBe(1); });
  it("cor pela direção do objetivo: cintura descer e glúteo subir são bons; subir a cintura não", () => {
    expect(d.cintura.tone).toBe("good"); expect(d.gluteo.tone).toBe("good"); expect(d.abdomen.tone).toBe("neutral");
    expect(bodyData([m("2026-11-01", { cintura: "80" }), m("2026-11-15", { cintura: "83" })]).cintura.tone).toBe("bad");
  });
  it("uma medida só não tem variação; o que não foi medido fica vazio", () => { const one = bodyData([m("2026-11-01", { cintura: "90" })]); expect(one.cintura.delta).toBeNull(); expect(one.peito.current).toBeNull(); expect(one.peito.tone).toBe("none"); });
  it("o que está sendo digitado aparece na hora e já mostra a variação", () => { const l = bodyData([m("2026-11-01", { cintura: "90" })], { cintura: "88,5", peito: "100" }); expect(l.cintura).toMatchObject({ current: 88.5, delta: -1.5 }); expect(l.peito.current).toBe(100); });
  it("formatação e soma", () => { expect(fmtDelta(-2.5)).toBe("−2,5"); expect(fmtDelta(0)).toBe(""); expect(totalChange(d)).toMatchObject({ n: 6 }); });
});
