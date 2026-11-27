import { describe, expect, it } from "vitest";

import { weekPlan, workPanel } from "@/lib/work-panel";

const cl = [{ id: "a", name: "Alvorada", status: "ativo" }, { id: "b", name: "Bela", status: "ativo" }, { id: "c", name: "Cacau", status: "ativo" }, { id: "d", name: "Dona", status: "pausa" }];
const mk = (id: string, client_id: string, done: boolean, due_date: string | null = null, title = id) => ({ id, title, client_id, done, due_date });
const T = "2026-12-10";

describe("painel de trabalho dos clientes", () => {
  const tasks = [mk("1", "a", true, null, "Criar usuário"), mk("2", "a", false, "2026-12-08", "Enviar acessos"), mk("3", "b", false, T), mk("4", "b", true), mk("5", "d", false, "2026-12-01")];
  it("conta atrasadas, hoje e quem está sem próxima etapa (só clientes ativos)", () => {
    const p = workPanel(cl, tasks, T);
    expect([p.active, p.overdue, p.today, p.noNext]).toEqual([3, 1, 1, 1]);
    expect(p.total).toBe(4); expect(p.done).toBe(2); expect(p.pct).toBe(50);
  });
  it("ordena por urgência e mostra a etapa atual; quem não tem pendência vai por último", () => {
    const rows = workPanel(cl, tasks, T).rows;
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(rows[0]).toMatchObject({ level: "late", next: "Enviar acessos", overdue: 1 });
    expect(rows[2]?.level).toBe("idle");
  });
  it("esta semana: atrasadas primeiro, depois cada dia até 6 dias à frente", () => {
    const w = weekPlan(cl, [...tasks, mk("6", "c", false, "2026-12-14"), mk("7", "c", false, "2026-12-20")], T);
    expect(w.map((d) => d.date)).toEqual(["atrasadas", T, "2026-12-14"]);
    expect(w[0]?.items[0]?.clientName).toBe("Alvorada");
  });
});
