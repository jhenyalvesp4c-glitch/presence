import { describe, expect, it } from "vitest";
import { applyMerges, findMergeGroups, mergeGroup } from "@/lib/demand-merge";
import { demandToRows, rowsToDemands, type Demand } from "@/lib/demands";

const d = (id: string, polo: string, title: string, extra: Partial<Demand> = {}): Demand => ({ id, type: "polo", polo, title, desc: "", priority: "media", status: "todo", deadline: "", history: [], notes: [], ...extra });

describe("juntar demandas do mesmo dossiê", () => {
  const all = [d("#P058", "Lauro", "Criar usuário para atendimento de renegociação"), d("#P059", "Lauro", "Criar fila de atendimento para renegociação", { priority: "alta", deadline: "25/11", desc: "Fila dedicada. Com regra de horário." }),
    d("#P060", "Maceió", "Acompanhar fila"), d("#P061", "Maceió", "Disparar template", { status: "doing" }), d("#P062", "Niterói", "Disparar o template"), d("#G041", "", "Geral", { type: "geral" }), d("#P050", "Lauro", "Já feita", { status: "done" })];
  it("acha só grupos abertos do mesmo dossiê com mais de uma", () => {
    const g = findMergeGroups(all);
    expect(g.map((x) => x.dossier).sort()).toEqual(["Lauro", "Maceió"]);
    expect(g.find((x) => x.dossier === "Lauro")!.items.map((x) => x.id)).toEqual(["#P058", "#P059"]);
    expect(findMergeGroups(all, "lauro")).toHaveLength(1);
  });
  it("une com checklist, maior prioridade, menor prazo e histórico", () => {
    const { merged, removed } = mergeGroup(findMergeGroups(all, "Lauro")[0]!, { today: new Date(2026, 10, 23) });
    expect(removed).toEqual(["#P059"]); expect(merged.id).toBe("#P058"); expect(merged.priority).toBe("alta"); expect(merged.deadline).toBe("25/11");
    expect(merged.title).toBe("Lauro: 2 pendências"); expect(merged.checklist).toHaveLength(2); expect(merged.checklist![1]!.text).toContain("Criar fila");
    expect(merged.checklist![1]!.text).toContain("Fila dedicada"); expect(merged.desc).toContain("#P059"); expect(merged.history.at(-1)!.text).toContain("#P058, #P059");
  });
  it("applyMerges tira as demandas absorvidas e mantém o resto", () => {
    const out = applyMerges(all, findMergeGroups(all));
    expect(out.map((x) => x.id)).toEqual(["#P058", "#P060", "#P062", "#G041", "#P050"]);
    expect(out.find((x) => x.id === "#P060")!.status).toBe("doing");
  });
  it("checklist vai e volta pelas linhas do banco", () => {
    const m = mergeGroup(findMergeGroups(all, "Lauro")[0]!).merged;
    const r = demandToRows("p1", m);
    expect(r.checklist).toHaveLength(2); expect(r.checklist[0]!.done).toBe(false);
    const back = rowsToDemands([r.demand], r.executions, r.history, r.notes, r.checklist)[0]!;
    expect(back.checklist).toEqual(m.checklist);
  });
});
