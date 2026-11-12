import { describe, expect, it } from "vitest";
import { addFolder, folderNames, removeFolder, renameFolder, seedLibrary, setShowItem, withMedia, mediaOf, shiftMedia } from "@/lib/training-library";
import { briefContent, buildScript, draftSchema, usedImages, type Draft } from "@/lib/training-ai";

const draft: Draft = {
  titulo: "Disparo em massa", publico: "Coordenadores", objetivo: "Fazer o disparo.", duvidas: ["Qual o menu?"],
  blocos: [
    { titulo: "Importar a base", minutos: 10, falar: "Vamos importar.", mostrar: ["Abrir Importações", "Conferir +55"], dica: "Avisar do +55.",
      imagens: [{ imagem: 1, titulo: "Importação", legenda: "Tela", pontos: [{ x: 30.04, y: 40, label: "Botão", text: "Clique." }, { x: 50, y: 50, label: "", text: "" }] }, { imagem: 2, titulo: "Sem arquivo", legenda: "", pontos: [] }],
      exemplos: [{ titulo: "Coluna curso", situacao: "Variável curso", texto: "Preencha a coluna.", categoria: "Disparo" }] },
    { titulo: "Criar o fluxo", minutos: 5, falar: "", mostrar: ["Criar o fluxo"] },
  ],
};

describe("Roteiro criado pela IA", () => {
  it("aceita o formato e recusa blocos vazios", () => {
    expect(draftSchema.safeParse(draft).success).toBe(true);
    expect(draftSchema.safeParse({ ...draft, blocos: [] }).success).toBe(false);
    expect(draftSchema.safeParse({ ...draft, blocos: [{ ...draft.blocos[0]!, mostrar: [] }] }).success).toBe(false);
  });

  it("converte em roteiro: blocos, fala, dica, imagem guardada e exemplo ligado", () => {
    const { script, examples } = buildScript(draft, { images: [{ path: "u/treinamentos/a.jpg", name: "a.jpg", mime: "image/jpeg", size: 10 }], folder: " Disparo ", color: "violet" });
    expect(script.title).toBe("Disparo em massa");
    expect(script.folder).toBe("Disparo");
    expect(script.blocks).toHaveLength(2);
    const b = script.blocks[0]!;
    expect(b.say).toBe("Vamos importar.");
    expect(b.tip).toBe("Avisar do +55.");
    expect(b.visuals).toHaveLength(1); // a imagem 2 não foi enviada: descartada
    expect(b.visuals![0]!.img).toBe("storage:u/treinamentos/a.jpg");
    expect(b.visuals![0]!.pins).toEqual([{ x: 30, y: 40, label: "Botão", text: "Clique." }]); // ponto vazio some
    expect(examples).toHaveLength(1);
    expect(b.examples).toEqual([examples[0]!.id]);
    expect(script.blocks[1]!.say).toBeUndefined();
  });

  it("nome e público digitados valem mais que os sugeridos", () => {
    const { script } = buildScript(draft, { images: [], title: "Meu nome", audience: "Gestores" });
    expect(script.title).toBe("Meu nome");
    expect(script.audience).toBe("Gestores");
    expect(script.blocks[0]!.visuals).toBeUndefined();
  });

  it("numera as imagens na ordem enviada", () => {
    const parts = briefContent("explicação longa o bastante", [
      { name: "a.png", mime: "image/png", data: "AAAA" }, { name: "n.txt", mime: "text/plain", data: btoa("oi") }, { name: "b.jpg", mime: "image/jpeg", data: "BBBB" },
    ], { title: "T" });
    const labels = parts.filter((p) => p.type === "input_text").map((p) => String(p["text"]));
    expect(labels[0]).toBe("Imagem 1: a.png");
    expect(labels.some((l) => l === "Imagem 2: b.jpg")).toBe(true);
    expect(labels[labels.length - 1]).toContain("Nome do roteiro: T");
    expect(parts.filter((p) => p.type === "input_image")).toHaveLength(2);
  });
});

describe("Passos com arquivo", () => {
  const d: Draft = { ...draft, blocos: [{ titulo: "B", minutos: 5, falar: "", mostrar: ["Abrir o menu", { passo: "Importar a planilha", imagem: 1 }, { passo: "Sem print", imagem: 3 }] }] };
  it("liga a imagem ao passo (vira botão) e ignora imagem inexistente", () => {
    const { script } = buildScript(d, { images: [{ path: "p/1.jpg", name: "1.jpg", mime: "image/jpeg", size: 5 }] });
    const b = script.blocks[0]!;
    expect(b.show).toEqual(["Abrir o menu", "Importar a planilha", "Sem print"]);
    expect(b.media).toEqual({ "1": [{ path: "p/1.jpg", name: "1.jpg", mime: "image/jpeg", size: 5 }] });
  });
  it("lista as imagens usadas, em passos e em imagens", () => {
    expect(usedImages(d)).toEqual([1, 3]);
    expect(usedImages(draft)).toEqual([1, 2]);
  });
});

describe("Pastas de roteiros", () => {
  it("cria, renomeia e apaga sem perder roteiros", () => {
    let lib = seedLibrary();
    lib = addFolder(lib, "Disparo");
    lib = addFolder(lib, "disparo"); // duplicada (sem diferenciar maiúsculas)
    expect(folderNames(lib)).toEqual(["Disparo"]);
    lib = { ...lib, scripts: lib.scripts.map((s, i) => (i === 0 ? { ...s, folder: "Disparo" } : s)) };
    lib = renameFolder(lib, "Disparo", "Disparos");
    expect(lib.scripts[0]!.folder).toBe("Disparos");
    lib = removeFolder(lib, "Disparos");
    expect(folderNames(lib)).toEqual([]);
    expect(lib.scripts).toHaveLength(3);
    expect(lib.scripts[0]!.folder).toBeUndefined();
  });
});

describe("Arquivos dos passos acompanham as mudanças", () => {
  const f = (n: string) => ({ path: n, name: n, mime: "image/png", size: 1 });
  it("apagar um passo faz os arquivos dos seguintes descerem", () => {
    let lib = seedLibrary();
    const sid = lib.scripts[0]!.id, blk = lib.scripts[0]!.blocks[1]!; // bloco com 4 passos
    lib = { ...lib, scripts: lib.scripts.map((s) => (s.id === sid ? { ...s, blocks: s.blocks.map((b) => (b.id === blk.id ? withMedia(withMedia(withMedia(b, 0, [f("a")]), 1, [f("b")]), 3, [f("d")]) : b)) } : s)) };
    lib = setShowItem(lib, sid, blk.id, 1, null); // apaga o passo 2 (arquivo "b")
    const b = lib.scripts[0]!.blocks[1]!;
    expect(mediaOf(b, 0).map((x) => x.path)).toEqual(["a"]);
    expect(mediaOf(b, 1)).toEqual([]);
    expect(mediaOf(b, 2).map((x) => x.path)).toEqual(["d"]);
    expect(shiftMedia(undefined, 0)).toBeUndefined();
  });
});
