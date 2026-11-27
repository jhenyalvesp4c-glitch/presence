import { describe, expect, it } from "vitest";
import { clientTaskProgress, nextDated, peopleLabel } from "@/lib/client-progress";

describe("Porcentagem do cliente pelas tarefas", () => {
  const tasks = [{ client_id: "a", done: true }, { client_id: "a", done: false }, { client_id: "a", done: false }, { client_id: "b", done: true }, { client_id: null, done: true }];
  it("feitas ÷ criadas, só do cliente", () => {
    expect(clientTaskProgress(tasks, "a")).toEqual({ total: 3, done: 1, pct: 33 });
    expect(clientTaskProgress(tasks, "b")).toEqual({ total: 1, done: 1, pct: 100 });
  });
  it("sem tarefas não há porcentagem", () => { expect(clientTaskProgress(tasks, "c")).toEqual({ total: 0, done: 0, pct: 0 }); });
});

import { byAttention, clientSteps, clientTaskStats, matchesAttention } from "@/lib/client-progress";

describe("Etapa atual de cada cliente e filtro de atenção", () => {
  const t = (id: string, title: string, created: string, done: boolean, due?: string) => ({ id, title, client_id: "a", done, due_date: due ?? null, created_at: created });
  const tasks = [t("3", "Criar usuários", "2026-11-03", false), t("1", "Realizar a implantação", "2026-11-01", true), t("2", "Enviar os acessos ao gestor", "2026-11-02", true, "2026-11-20"),
    t("4", "Perguntar quem são os gestores", "2026-11-04", false, "2026-11-25"), { id: "9", title: "outro", client_id: "b", done: false, created_at: "2026-11-01" }];
  it("a etapa atual é a primeira não feita, na ordem de criação; o resto é o que falta", () => {
    const s = clientSteps(tasks, "a");
    expect(s.steps.map((x) => x.title)).toEqual(["Realizar a implantação", "Enviar os acessos ao gestor", "Criar usuários", "Perguntar quem são os gestores"]);
    expect(s).toMatchObject({ total: 4, done: 2, current: 3 });
    expect(s.next!.title).toBe("Criar usuários");
    expect(s.missing.map((x) => x.title)).toEqual(["Criar usuários", "Perguntar quem são os gestores"]);
    expect(clientSteps(tasks.map((x) => ({ ...x, done: true })), "a")).toMatchObject({ current: 0, next: null, done: 4 });
    expect(clientSteps(tasks, "zz")).toMatchObject({ total: 0, current: 0, next: null });
  });
  it("conta atrasadas (data já passou), para hoje e pendentes, e filtra e ordena quem precisa mais de você", () => {
    const a = clientTaskStats(tasks, "a", "2026-11-26"), b = clientTaskStats(tasks, "b", "2026-11-26"), z = clientTaskStats(tasks, "z", "2026-11-26");
    expect(a).toMatchObject({ total: 4, done: 2, pending: 2, overdue: 1, today: 0 });
    expect(matchesAttention(a, "atrasadas")).toBe(true); expect(matchesAttention(b, "atrasadas")).toBe(false);
    expect(matchesAttention(z, "sem")).toBe(true); expect(matchesAttention(a, "pendentes")).toBe(true);
    expect(matchesAttention(clientTaskStats(tasks.map((x) => ({ ...x, done: true })), "a", "2026-11-26"), "emdia")).toBe(true);
    expect([b, a, z].sort(byAttention)).toEqual([a, b, z]);
  });
});

import { moveItem, orderClientTasks } from "@/lib/client-progress";

describe("Ordem das tarefas do cliente", () => {
  const t = (id: string, created: string, order?: number | null) => ({ id, title: id, created_at: created, client_order: order ?? null, client_id: "a", done: false });
  it("sem ordem manual vale a de criação; com ordem manual vale a que você montou; as novas ficam no fim", () => {
    expect(orderClientTasks([t("c", "3"), t("a", "1"), t("b", "2")]).map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(orderClientTasks([t("a", "1", 2), t("b", "2", 0), t("c", "3", 1), t("nova", "9")]).map((x) => x.id)).toEqual(["b", "c", "a", "nova"]);
  });
  it("a etapa atual segue a ordem manual", () => {
    const tasks = [t("a", "1", 1), t("b", "2", 0), t("c", "3", 2)];
    expect(clientSteps(tasks, "a").next!.id).toBe("b");
  });
  it("move um item para cima ou para baixo sem mexer nos outros", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});

describe("card do cliente", () => {
  it("próxima tarefa com data: a mais cedo, ignorando feitas e sem data", () => {
    const l = [{ client_id: "a", done: false, due_date: "2026-12-12" }, { client_id: "a", done: false, due_date: "2026-12-09" }, { client_id: "a", done: true, due_date: "2026-12-01" }, { client_id: "a", done: false }, { client_id: "b", done: false, due_date: "2026-12-02" }];
    expect(nextDated(l, "a")?.due_date).toBe("2026-12-09"); expect(nextDated(l, "c")).toBeNull();
  });
  it("resume as pessoas", () => { expect(peopleLabel(["A", "B"])).toBe("A, B"); expect(peopleLabel(["A", "B", "C", "D"])).toBe("A, B +2"); });
});
