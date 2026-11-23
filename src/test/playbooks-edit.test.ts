import { describe, expect, it } from "vitest";
import { PLAYBOOKS, mergePlaybooks, sanitizeDocs, type PlaybookRow } from "@/lib/playbooks";

const row = (p: Partial<PlaybookRow> & { id: string }): PlaybookRow => ({ name: "Meu playbook", tagline: "", tone: "violet", docs: [], checklist: [], steps: [], deleted: false, position: 1, ...p });

describe("playbooks da pessoa", () => {
  it("sem linhas no banco, vale o modelo do Orion", () => { expect(mergePlaybooks(PLAYBOOKS, []).map((p) => p.id)).toEqual(["onboarding-cliente"]); });
  it("editar o modelo do Orion substitui o texto e mantém os passos se não houver outros", () => {
    const out = mergePlaybooks(PLAYBOOKS, [row({ id: "onboarding-cliente", name: "Onboarding VIP", steps: [{ id: "a", kind: "tarefa", title: "Ligar", days: 1, priority: "alta", on: true }], checklist: ["Contrato", " "] })]);
    expect(out).toHaveLength(1); expect(out[0]!.name).toBe("Onboarding VIP"); expect(out[0]!.steps.map((s) => s.title)).toEqual(["Ligar"]); expect(out[0]!.checklist).toEqual(["Contrato"]);
  });
  it("excluir o modelo do Orion o esconde; criar adiciona", () => {
    const out = mergePlaybooks(PLAYBOOKS, [row({ id: "onboarding-cliente", deleted: true }), row({ id: "renovacao-ab12", name: "Renovação", position: 2 })]);
    expect(out.map((p) => p.id)).toEqual(["renovacao-ab12"]);
  });
  it("documentos inválidos são ignorados", () => { expect(sanitizeDocs([{ title: "Ficha", desc: "x", rules: ["a", ""] }, { title: "" }, null, 3])).toEqual([{ kind: "Documento", title: "Ficha", desc: "x", rules: ["a"] }]); });
});
