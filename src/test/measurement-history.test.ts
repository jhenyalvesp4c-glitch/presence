import { describe, it, expect } from "vitest";
import { addToHistory, type MeasurementSheet } from "@/lib/health-preview";
const m = (data: string, peso: string): MeasurementSheet => ({ nome: "x", data, altura: "1,70", peso, valores: {}, obs: "", fotos: {} });
describe("measurement history", () => {
  it("keeps every date, oldest first", () => {
    const h = addToHistory(addToHistory([], m("2026-11-10", "61")), m("2026-11-01", "63"));
    expect(h.map(x => x.data)).toEqual(["2026-11-01", "2026-11-10"]);
  });
  it("replaces an entry on the same date", () => {
    const h = addToHistory([m("2026-11-01", "63")], m("2026-11-01", "62"));
    expect(h).toHaveLength(1);
    expect(h[0]?.peso).toBe("62");
  });
});
