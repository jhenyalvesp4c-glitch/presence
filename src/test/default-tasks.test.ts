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
