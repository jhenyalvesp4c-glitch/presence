import { describe, expect, it } from "vitest";
import { SETUP_TEMPLATE, missingRows, progressOf, type SetupStatus, type SetupStep } from "@/lib/setup";

const mk = (over: Partial<SetupStep> & { key: string }): SetupStep => ({ id: over.key, title: over.key, hint: "", phase: "A", phaseIndex: 0, position: 0, status: "todo", note: "", doneAt: null, ...over });
describe("implantação", () => {
  it("o modelo cobre kanban, fluxo, horário e assinatura, com chaves únicas", () => {
    const keys = SETUP_TEMPLATE.flatMap((p) => p.steps.map((s) => s.key));
    expect(new Set(keys).size).toBe(keys.length);
    const all = SETUP_TEMPLATE.map((p) => p.name.toLowerCase() + " " + p.steps.map((s) => s.title.toLowerCase()).join(" ")).join(" ");
    for (const w of ["kanban", "fluxo", "horário", "assinatura"]) expect(all).toContain(w);
  });
  it("progresso: concluído e não se aplica contam; próximo prioriza 'fazendo'", () => {
    const steps = [mk({ key: "1", status: "done" }), mk({ key: "2", status: "na", position: 1 }), mk({ key: "3", status: "todo", position: 2 }), mk({ key: "4", status: "doing", position: 3 }), mk({ key: "5", phase: "B", phaseIndex: 1, status: "blocked" })];
    const p = progressOf(steps);
    expect(p).toMatchObject({ total: 5, finished: 2, pct: 40 });
    expect(p.next?.key).toBe("4");
    expect(p.blocked.map((s) => s.key)).toEqual(["5"]);
    expect(p.phases.map((x) => [x.id, x.pct])).toEqual([["A", 50], ["B", 0]]);
  });
  it("próximo ignora travados quando há algo a fazer; sem passos = 0%", () => {
    expect(progressOf([mk({ key: "a", status: "blocked" }), mk({ key: "b", status: "todo", position: 1 })]).next?.key).toBe("b");
    expect(progressOf([])).toMatchObject({ total: 0, pct: 0, next: null });
    const done: SetupStatus = "done"; expect(progressOf([mk({ key: "x", status: done })]).next).toBeNull();
  });
  it("missingRows só devolve o que falta", () => {
    const all = missingRows(SETUP_TEMPLATE, []);
    expect(all.length).toBe(SETUP_TEMPLATE.reduce((a, p) => a + p.steps.length, 0));
    expect(missingRows(SETUP_TEMPLATE, ["contrato", "kickoff"]).length).toBe(all.length - 2);
  });
});

import { sanitizeTemplate, templateFromSteps } from "@/lib/setup";
describe("modelo padrão do projeto", () => {
  it("valida e gera chaves únicas", () => {
    const t = sanitizeTemplate([{ name: " Base ", steps: [{ title: "Contrato", key: "a" }, { title: "Dados", key: "a" }, { title: "" }] }, { name: "Vazia", steps: [] }, 5]);
    expect(t).toHaveLength(1);
    expect(t![0]!.name).toBe("Base");
    expect(t![0]!.steps.map((s) => s.title)).toEqual(["Contrato", "Dados"]);
    expect(new Set(t![0]!.steps.map((s) => s.key)).size).toBe(2);
    expect(sanitizeTemplate("x")).toBeNull();
    expect(sanitizeTemplate([])).toBeNull();
  });
  it("transforma o roteiro de um cliente em modelo, sem status", () => {
    const steps = [mk({ key: "c1", title: "B", phase: "Fase 2", phaseIndex: 1, status: "done", note: "x" }), mk({ key: "custom-abc", title: "A", phase: "Fase 1", phaseIndex: 0, hint: "dica" })];
    const t = templateFromSteps(steps);
    expect(t.map((p) => p.name)).toEqual(["Fase 1", "Fase 2"]);
    expect(t[0]!.steps[0]).toMatchObject({ title: "A", hint: "dica" });
    expect(t[0]!.steps[0]!.key).toMatch(/^t-/);
    expect(t[1]!.steps[0]!.key).toBe("c1");
  });
});
