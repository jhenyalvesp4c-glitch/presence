import { describe, expect, it } from "vitest";
import { deadlineIso, type Demand } from "@/lib/demands";
import { taskFromDemand } from "@/lib/data/tasks";

const d = (extra: Partial<Demand> = {}): Demand => ({ id: "#P059", type: "polo", polo: "Lauro de Freitas", title: "Criar fila de atendimento", desc: "Fila dedicada.", priority: "alta", status: "todo", deadline: "25/11", history: [], notes: [], ...extra });

describe("demanda como tarefa", () => {
  it("prazo da demanda vira data", () => {
    const now = new Date(2026, 10, 23);
    expect(deadlineIso("25/11", now)).toBe("2026-11-25"); expect(deadlineIso("05/01", now)).toBe("2027-01-05"); expect(deadlineIso("20/11/2026", now)).toBe("2026-11-20");
    expect(deadlineIso("—", now)).toBeNull(); expect(deadlineIso("", now)).toBeNull(); expect(deadlineIso("31/13", now)).toBeNull();
  });
  it("monta a tarefa com código, dossiê, checklist, prioridade e prazo", () => {
    const t = taskFromDemand(d({ checklist: [{ text: "Criar usuário", done: true }, { text: "Criar fila", done: false }] }), new Date(2026, 10, 23));
    expect(t.title).toBe("P059 · Criar fila de atendimento"); expect(t.priority).toBe("alta"); expect(t.due_date).toBe("2026-11-25");
    expect(t.description).toContain("Dossiê: Lauro de Freitas"); expect(t.description).toContain("[x] Criar usuário"); expect(t.description).toContain("[ ] Criar fila");
  });
});
