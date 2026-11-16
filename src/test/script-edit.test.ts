import { describe, expect, it } from "vitest";
import { editScript } from "@/lib/script-edit";
import { seedLibrary } from "@/lib/training-library";

const lib = () => seedLibrary();

describe("roteiros por voz", () => {
  it("cria um roteiro com blocos completos", () => {
    const e = editScript(lib(), { acao: "criar", titulo: "Etiquetas avançadas", publico: "Consultores", blocos: [{ titulo: "Criar etiqueta", minutos: 12, mostrar: ["Abrir Configurações", "Novo"], dica: "Use nomes curtos", perguntas: [{ pergunta: "Posso mudar a cor?", resposta: "Sim." }] }] });
    expect(e.result["ok"]).toBe(true);
    const s = e.lib!.scripts.at(-1)!;
    expect(s.title).toBe("Etiquetas avançadas"); expect(s.blocks[0]).toMatchObject({ title: "Criar etiqueta", minutes: 12, show: ["Abrir Configurações", "Novo"], tip: "Use nomes curtos" });
    expect(s.blocks[0]!.faq).toEqual([{ q: "Posso mudar a cor?", a: "Sim." }]);
    expect(e.lib!.scripts.length).toBe(lib().scripts.length + 1);
  });
  it("não duplica roteiro com o mesmo nome", () => { expect(editScript(lib(), { acao: "criar", titulo: "Disparo em massa" }).result["ok"]).toBe(false); });
  it("adiciona bloco no fim ou depois de um bloco", () => {
    const fim = editScript(lib(), { acao: "adicionar_bloco", roteiro: "disparo", blocos: [{ titulo: "Boas práticas", mostrar: ["Horário ideal"] }] });
    expect(fim.script!.blocks.map((b) => b.title).at(-1)).toBe("Boas práticas");
    const meio = editScript(lib(), { acao: "adicionar_bloco", roteiro: "disparo", depois_de: "escolha do template", blocos: [{ titulo: "Aprovação do template" }] });
    expect(meio.script!.blocks.map((b) => b.title)).toEqual(["Escolha do template", "Aprovação do template", "Executar o disparo", "Acompanhar respostas"]);
  });
  it("não repete bloco que já existe", () => { expect(editScript(lib(), { acao: "adicionar_bloco", roteiro: "disparo", blocos: [{ titulo: "Escolha do template" }] }).result["ok"]).toBe(false); });
  it("edita um bloco: passos, dica, minutos, perguntas", () => {
    const e = editScript(lib(), { acao: "editar_bloco", roteiro: "primeiros passos", bloco: "etiquetas nos leads", minutos: 25, mostrar_incluir: ["Etiquetas em massa"], mostrar_tirar: ["adicionar e remover"], dica: "Treine duas vezes", perguntas_incluir: [{ pergunta: "Dá para importar?", resposta: "Sim, por planilha." }] });
    expect(e.result["ok"]).toBe(true);
    const b = e.script!.blocks.find((x) => x.title === "Etiquetas nos leads")!;
    expect(b.minutes).toBe(25); expect(b.show).toContain("Etiquetas em massa"); expect(b.show).not.toContain("Adicionar e remover uma etiqueta");
    expect(b.tip).toBe("Treine duas vezes"); expect(b.faq!.at(-1)!.q).toBe("Dá para importar?");
  });
  it("mudar um bloco não mexe nos outros roteiros", () => {
    const a = lib(), e = editScript(a, { acao: "editar_bloco", roteiro: "primeiros passos", bloco: "prática", minutos: 99 });
    expect(e.lib!.scripts.filter((s) => s.title !== "Primeiros passos no CRM")).toEqual(a.scripts.filter((s) => s.title !== "Primeiros passos no CRM"));
  });
  it("pergunta quando há dúvida e nunca adivinha", () => {
    expect(editScript(lib(), { acao: "mostrar", roteiro: "zzz" }).result["ok"]).toBe(false);
    expect(editScript(lib(), { acao: "editar_bloco", roteiro: "disparo", bloco: "inexistente", minutos: 5 }).result["ok"]).toBe(false);
  });
  it("tirar bloco e excluir roteiro pedem confirmação", () => {
    expect(editScript(lib(), { acao: "remover_bloco", roteiro: "disparo", bloco: "executar" }).result["precisa_confirmar"]).toBe(true);
    expect(editScript(lib(), { acao: "excluir", roteiro: "disparo" }).result["precisa_confirmar"]).toBe(true);
    const ok = editScript(lib(), { acao: "remover_bloco", roteiro: "disparo", bloco: "executar", confirmado: true });
    expect(ok.script!.blocks.map((b) => b.title)).toEqual(["Escolha do template", "Acompanhar respostas"]);
    expect(editScript(lib(), { acao: "excluir", roteiro: "disparo", confirmado: true }).lib!.scripts.some((s) => s.title === "Disparo em massa")).toBe(false);
  });
  it("edita título, público e objetivo", () => {
    const e = editScript(lib(), { acao: "editar", roteiro: "administração", novo_titulo: "Gestão do polo", publico: "Coordenadores" });
    expect(e.script).toMatchObject({ title: "Gestão do polo", audience: "Coordenadores" });
  });
});
