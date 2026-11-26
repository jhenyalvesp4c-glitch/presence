import { describe, expect, it } from "vitest";
import { cleanTemplate, missingTitles, SEED_DEFAULT_TASKS } from "@/lib/default-tasks";

describe("Tarefas padrão dos clientes", () => {
  it("o modelo que já vem tem as etapas na ordem de sempre", () => {
    expect(SEED_DEFAULT_TASKS).toEqual(["Realizar a implantação das configurações", "Enviar os acessos ao gestor", "Criar usuários", "Perguntar quais são os gestores e vendedores"]);
  });
  it("só cria o que o cliente ainda não tem (sem diferenciar maiúsculas e espaços), mantendo a ordem", () => {
    expect(missingTitles(SEED_DEFAULT_TASKS, ["criar  USUÁRIOS".replace("USUÁRIOS", "usuários"), "outra coisa"])).toEqual(["Realizar a implantação das configurações", "Enviar os acessos ao gestor", "Perguntar quais são os gestores e vendedores"]);
    expect(missingTitles(SEED_DEFAULT_TASKS, SEED_DEFAULT_TASKS)).toEqual([]);
  });
  it("ao salvar, tira vazios e repetidos e corta títulos enormes", () => {
    expect(cleanTemplate(["  A ", "", "a", "B", "   "])).toEqual(["A", "B"]);
    expect(cleanTemplate(["x".repeat(300)])[0]).toHaveLength(200);
  });
});

import { planApply } from "@/lib/default-tasks";

describe("Aplicar o padrão num cliente que já tem tarefas", () => {
  const existing = [{ id: "1", title: "Criar usuários" }, { id: "2", title: "Implementar configurações no CRM" }, { id: "3", title: "ENVIAR os acessos ao gestor" }];
  it("cria só o que falta e mostra as do cliente que não estão no padrão", () => {
    const p = planApply(SEED_DEFAULT_TASKS, existing);
    expect(p.toCreate).toEqual(["Realizar a implantação das configurações", "Perguntar quais são os gestores e vendedores"]);
    expect(p.extras.map((e) => e.id)).toEqual(["2"]);
  });
  it("cliente igual ao padrão: nada a criar e nada sobrando", () => {
    const p = planApply(SEED_DEFAULT_TASKS, SEED_DEFAULT_TASKS.map((title, i) => ({ id: String(i), title })));
    expect(p).toEqual({ toCreate: [], extras: [] });
  });
});
