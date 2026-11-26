import { describe, expect, it } from "vitest";
import { clientTaskProgress } from "@/lib/client-progress";

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
