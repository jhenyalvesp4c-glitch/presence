import { describe, expect, it } from "vitest";

import { moveBlock, normalizeLibrary, removeBlock, removeExample, removeScript, seedLibrary, setShowItem, upsertExample, upsertScript } from "@/lib/training-library";

describe("roteiros e exemplos de treinamento", () => {
  it("excluir um exemplo tira ele de todos os blocos que o usavam", () => {
    const lib = removeExample(seedLibrary(), "e6");
    expect(lib.examples.some((e) => e.id === "e6")).toBe(false);
    expect(lib.scripts.flatMap((s) => s.blocks).some((b) => b.examples.includes("e6"))).toBe(false);
    // os outros exemplos do bloco continuam
    expect(lib.scripts[0]!.blocks.find((b) => b.id === "b3")!.examples).toEqual(["e1"]);
  });

  it("editar um exemplo troca só ele, sem duplicar", () => {
    const lib = seedLibrary();
    const e1 = { ...lib.examples[0]!, title: "Etiqueta certinha" };
    const out = upsertExample(lib, e1);
    expect(out.examples).toHaveLength(lib.examples.length);
    expect(out.examples[0]!.title).toBe("Etiqueta certinha");
  });

  it("excluir roteiro e bloco", () => {
    const lib = seedLibrary();
    expect(removeScript(lib, "s2").scripts.map((s) => s.id)).toEqual(["s1", "s3"]);
    expect(removeBlock(lib, "s1", "b3").scripts[0]!.blocks.map((b) => b.id)).toEqual(["b1", "b2", "b3f", "b4"]);
  });

  it("editar roteiro mantém a posição; novo roteiro vai para o fim", () => {
    const lib = seedLibrary();
    const edited = upsertScript(lib, { ...lib.scripts[1]!, title: "Disparos" });
    expect(edited.scripts[1]!.title).toBe("Disparos");
    const added = upsertScript(lib, { id: "novo", title: "Novo", audience: "", goal: "", color: "cyan", blocks: [] });
    expect(added.scripts.at(-1)!.id).toBe("novo");
  });

  it("itens de 'O que mostrar': editar, apagar e texto vazio apaga", () => {
    const lib = seedLibrary();
    const show = (l: typeof lib) => l.scripts[0]!.blocks[0]!.show;
    expect(show(setShowItem(lib, "s1", "b1", 1, "Caixa de entrada"))[1]).toBe("Caixa de entrada");
    expect(show(setShowItem(lib, "s1", "b1", 0, null))).toEqual(["Caixa de entrada do polo", "Onde ficam as notificações"]);
    expect(show(setShowItem(lib, "s1", "b1", 0, "  "))).toHaveLength(2);
  });

  it("mover bloco para cima e para baixo, sem passar das pontas", () => {
    const lib = seedLibrary();
    expect(moveBlock(lib, "s1", "b3", -1).scripts[0]!.blocks.map((b) => b.id).slice(1, 3)).toEqual(["b3", "b2"]);
    expect(moveBlock(lib, "s1", "b1", -1)).toEqual(lib);
  });

  it("biblioteca vazia ou estranha vinda do banco não quebra a tela", () => {
    expect(normalizeLibrary(null)).toEqual({ scripts: [], examples: [], folders: [] });
    expect(normalizeLibrary({ scripts: [{ id: "x", title: "X", blocks: [{ id: "b" }] }] }).scripts[0]!.blocks[0]!.show).toEqual([]);
  });
});

import { scriptFromLegacy } from "@/lib/data/training-library";

describe("roteiros antigos (tabela training_scripts)", () => {
  it("troca a chave curta da imagem pela nova e tira os campos que não existem mais", () => {
    const old = {
      id: "s1", title: "A", audience: "B", goal: "C", color: "cyan", lastClass: "05/11",
      blocks: [{ id: "b1", title: "T", minutes: 5, show: ["x"], examples: [], visuals: [{ key: "lead", src: "", title: "V", caption: "c", pins: [] }] }],
    };
    const s = scriptFromLegacy(old) as unknown as Record<string, unknown> & { blocks: { visuals: Record<string, unknown>[] }[] };
    expect(s["lastClass"]).toBeUndefined();
    expect(s.blocks[0]!.visuals[0]).toEqual({ img: "etiquetas-lead", title: "V", caption: "c", pins: [] });
  });
});
