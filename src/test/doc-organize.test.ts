import { describe, expect, it } from "vitest";
import { descOf, localOrganize, organizedSchema } from "@/lib/doc-organize";

describe("organizar passo a passo", () => {
  it("separa por linhas e tira numeração", () => {
    const r = localOrganize("1. abrir o módulo de disparo\n2) escolher o template\n- clicar em enviar");
    expect(r.passos).toEqual(["Abrir o módulo de disparo", "Escolher o template", "Clicar em enviar"]);
    expect(r.titulo).toBe("Abrir o módulo de disparo");
  });
  it("texto corrido vira passos por frase e conectores", () => {
    const r = localOrganize("Primeiro abre as configurações. Depois escolhe horário de atendimento, em seguida salva.");
    expect(r.passos.length).toBeGreaterThanOrEqual(3);
    expect(r.passos[0]).toBe("Abre as configurações");
  });
  it("sempre devolve ao menos um passo e respeita o esquema", () => {
    const r = localOrganize("fazer o login");
    expect(organizedSchema.safeParse(r).success).toBe(true);
    expect(localOrganize("x ").passos.length).toBe(1);
  });
  it("descrição inclui dicas", () => {
    expect(descOf({ titulo: "t", descricao: "Aprender a fazer.", antes: [], passos: ["a"], dicas: ["Cuidado com o fuso"] })).toBe("Aprender a fazer.\n\nDicas:\n• Cuidado com o fuso");
  });
});
