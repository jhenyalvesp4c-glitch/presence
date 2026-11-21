import { describe, expect, it } from "vitest";
import { PLAYBOOKS, buildPlan, deadlineLabel, slugOf, summarizePlan } from "@/lib/playbooks";

const input = { clientName: "  Clínica Vida Plena ", contactName: "", email: "", phone: "", monthlyValue: 0, contractEnd: null, start: "2026-11-21" };
describe("playbooks", () => {
  const p = PLAYBOOKS[0]!;
  it("datas relativas ao início, em ordem", () => {
    const plan = buildPlan(p, input);
    expect(plan.clientName).toBe("Clínica Vida Plena");
    expect(plan.slug).toBe("clinica-vida-plena");
    expect(plan.steps[0]).toMatchObject({ id: "boasvindas", date: "2026-11-21" });
    expect(plan.steps.find((x) => x.id === "revisao")?.date).toBe("2026-12-21");
    expect(plan.steps.map((x) => x.date)).toEqual([...plan.steps.map((x) => x.date)].sort());
  });
  it("respeita passos desmarcados e títulos vazios", () => {
    const steps = p.steps.map((x) => (x.id === "checkin" ? { ...x, on: false } : x.id === "contas" ? { ...x, title: "  " } : x));
    const plan = buildPlan(p, input, steps);
    expect(plan.steps.some((x) => x.id === "checkin" || x.id === "contas")).toBe(false);
  });
  it("resumo e utilidades", () => {
    const r = summarizePlan(buildPlan(p, input));
    expect(r).toMatchObject({ tarefas: 5, demandas: 4, documentos: 4, ultimaData: "2026-12-21" });
    expect(deadlineLabel("2026-12-05")).toBe("05/12");
    expect(slugOf("Açaí & Cia!")).toBe("acai-cia");
  });
});
