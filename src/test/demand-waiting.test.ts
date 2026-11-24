import { describe, expect, it } from "vitest";
import { demandToRows, rowsToDemands, type Demand } from "@/lib/demands";

const d: Demand = { id: "#P059", type: "polo", polo: "Maceió", title: "Disparo", desc: "", priority: "media", status: "todo", deadline: "", history: [], notes: [],
  checklist: [{ text: "Criar template", done: true }, { text: "Fazer o disparo", done: false, wait: { from: "Daniel", note: "Falta a planilha da base", since: "2026-11-23" } }, { text: "Passo antigo", done: true, wait: { from: "X", note: "", since: "2026-11-20" } }] };

describe("aguardando retorno no checklist", () => {
  it("vai para as linhas do banco (só passo aberto aguarda) e volta igual", () => {
    const r = demandToRows("p4c", d);
    expect(r.checklist.map((c) => c.waiting)).toEqual([false, true, false]);
    expect(r.checklist[1]).toMatchObject({ waiting_from: "Daniel", waiting_note: "Falta a planilha da base", waiting_since: "2026-11-23" });
    const back = rowsToDemands([r.demand], r.executions, r.history, r.notes, r.checklist)[0]!;
    expect(back.checklist![1]!.wait).toEqual({ from: "Daniel", note: "Falta a planilha da base", since: "2026-11-23" });
    expect(back.checklist![0]!.wait).toBeUndefined(); expect(back.checklist![2]!.wait).toBeUndefined();
  });
});
