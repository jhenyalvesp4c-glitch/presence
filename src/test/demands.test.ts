import { describe, expect, it } from "vitest";
import { demandToRows, diffDemands, nextCode, rowsToDemands, type Demand } from "@/lib/demands";

const multi: Demand = {
  id: "#M041", type: "multi", title: "Templates", desc: "d", priority: "alta", status: "doing", deadline: "15/11",
  polos: [{ name: "Niterói", status: "doing" }, { name: "Lauro", status: "done", date: "30/10", note: "ok" }],
  history: [{ d: "30/10", text: "Criada", s: "todo" }, { d: "31/10", text: "Iniciada", s: "doing" }],
  notes: ["primeira", "segunda"],
};
const single: Demand = { id: "#P040", type: "polo", polo: "Santos", title: "Leads", desc: "", priority: "baixa", status: "todo", deadline: "—", history: [], notes: [] };

describe("demandas no banco", () => {
  it("ida e volta: demanda -> linhas -> demanda", () => {
    for (const d of [multi, single]) {
      const r = demandToRows("p4c", d);
      const back = rowsToDemands([r.demand], r.executions, r.history, r.notes)[0]!;
      expect(back.id).toBe(d.id);
      expect(back.polo).toBe(d.polo);
      expect(back.polos).toEqual(d.polos?.map((p) => ({ date: undefined, note: undefined, ...p })));
      expect(back.history).toEqual(d.history);
      expect(back.notes).toEqual(d.notes);
    }
  });

  it("mantém a ordem dos andamentos, do histórico e das observações", () => {
    const r = demandToRows("p4c", multi);
    const shuffled = [...r.executions].reverse();
    const back = rowsToDemands([r.demand], shuffled, [...r.history].reverse(), [...r.notes].reverse())[0]!;
    expect(back.polos!.map((p) => p.name)).toEqual(["Niterói", "Lauro"]);
    expect(back.history.map((h) => h.text)).toEqual(["Criada", "Iniciada"]);
    expect(back.notes).toEqual(["primeira", "segunda"]);
  });

  it("só demandas de vários guardam andamento por dossiê", () => {
    expect(demandToRows("p4c", single).executions).toHaveLength(0);
    expect(rowsToDemands([demandToRows("p4c", single).demand], [], [], [])[0]!.polos).toBeUndefined();
  });

  it("diff: novas, alteradas e excluídas", () => {
    const edited = { ...single, status: "done" as const };
    const added: Demand = { ...single, id: "#P041" };
    const d = diffDemands([multi, single], [edited, added]);
    expect(d.upserts.map((x) => x.id).sort()).toEqual(["#P040", "#P041"]);
    expect(d.deletes).toEqual(["#M041"]);
    expect(diffDemands([multi], [multi])).toEqual({ upserts: [], deletes: [] });
  });

  it("código novo nunca repete, mesmo depois de excluir", () => {
    const list = [{ id: "#G044", type: "geral" as const }, { id: "#G041", type: "geral" as const }, { id: "#P050", type: "polo" as const }];
    expect(nextCode(list, "geral")).toBe("#G045");
    expect(nextCode(list, "polo")).toBe("#P051");
    expect(nextCode([], "multi")).toBe("#M040");
  });
});
