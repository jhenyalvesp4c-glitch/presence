import { describe, expect, it } from "vitest";

import { DESTINOS, buildRecords, convertTipo, itemsToMarkdown, messagesByIndex, withRefs, type InboxFile, type InboxItem } from "@/lib/inbox";
import { SYSTEM, TOOL_NAME, interpret, outputSchema, userContent, type Context, type Create } from "@/lib/mcp/interpret";

const ctx: Context = {
  today: "2026-11-12", weekday: "quinta-feira",
  projects: [{ id: "p4c", nome: "P4C", descricao: "", status: "Ativo", rotulo_dossie: { singular: "Polo", plural: "Polos" }, dossiers: [{ id: "d1", nome: "Niterói", descricao: "" }, { id: "d2", nome: "Santos", descricao: "" }] }],
  categories: [{ id: "c1", slug: "pes", nome: "Pessoal" }],
};
const tool = (input: unknown, id = "tu1") => ({ stop_reason: "tool_use", content: [{ type: "tool_use", id, name: TOOL_NAME, input }] });

describe("interpretação (cliente da IA simulado)", () => {
  it("devolve os itens e aceita rascunho incompleto (sem projeto) em vez de forçar um chute", async () => {
    const calls: Record<string, unknown>[] = [];
    const create: Create = async (p) => { calls.push(p); return tool({ resumo: "Uma demanda", itens: [{ registro: { tipo: "demanda", escopo: "geral", titulo: "Atualizar templates" }, motivo: "pedido de trabalho" }], duvidas: ["Qual projeto?"], pendencias: [] }); };
    const r = await interpret(create, { text: "atualizar templates", files: [] }, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.output.itens[0]!.registro).toMatchObject({ tipo: "demanda", titulo: "Atualizar templates" }); expect(r.output.duvidas).toEqual(["Qual projeto?"]); }
    expect(calls).toHaveLength(1);
  });

  it("monta a chamada com os dados reais, imagem e PDF, sem forçar a ferramenta e sem desligar o raciocínio", async () => {
    let params: Record<string, unknown> = {};
    const create: Create = async (p) => { params = p; return tool({ resumo: "", itens: [], duvidas: [], pendencias: [] }); };
    const files = [{ name: "print.jpg", mime: "image/jpeg", data: "AAAA" }, { name: "doc.pdf", mime: "application/pdf", data: "BBBB" }, { name: "n.txt", mime: "text/plain", data: Buffer.from("olá").toString("base64") }];
    await interpret(create, { text: "veja", files }, ctx);
    expect(params["model"]).toBe("claude-opus-5-5");
    expect(params).not.toHaveProperty("tool_choice"); // Opus 5.5 recusa tool_choice forçado
    expect(params).not.toHaveProperty("thinking");
    expect(params["output_config"]).toEqual({ effort: "low" });
    const system = JSON.stringify(params["system"]);
    expect(system).toContain("projeto_id: p4c");
    expect(system).toContain("Niterói; Santos");
    expect(system).toContain("Hoje: quinta-feira, 2026-11-12");
    const content = (params["messages"] as { content: { type: string }[] }[])[0]!.content;
    expect(content.map((b) => b.type)).toEqual(["image", "document", "text", "text"]);
    expect(JSON.stringify(content[2])).toContain("olá");
  });

  it("formato inválido volta para a IA corrigir; resposta sem ferramenta é cobrada", async () => {
    const seen: unknown[] = [];
    let n = 0;
    const create: Create = async (p) => {
      seen.push(JSON.parse(JSON.stringify(p["messages"])));
      n++;
      if (n === 1) return { stop_reason: "end_turn", content: [{ type: "text", text: "claro!" }] };
      if (n === 2) return tool({ resumo: "x", itens: "errado" });
      return tool({ resumo: "ok", itens: [], duvidas: [], pendencias: [] });
    };
    const r = await interpret(create, { text: "oi", files: [] }, ctx);
    expect(r.ok).toBe(true);
    expect(n).toBe(3);
    expect(JSON.stringify(seen[2])).toContain("Formato inválido");
  });

  it("recusa, corte por tamanho e falha repetida viram erro claro", async () => {
    const mk = (res: unknown): Create => async () => res as never;
    expect(await interpret(mk({ stop_reason: "refusal", content: [] }), { text: "x", files: [] }, ctx)).toMatchObject({ ok: false });
    expect(await interpret(mk({ stop_reason: "max_tokens", content: [] }), { text: "x", files: [] }, ctx)).toMatchObject({ ok: false, error: expect.stringContaining("grande demais") });
    expect(await interpret(mk({ stop_reason: "end_turn", content: [{ type: "text", text: "..." }] }), { text: "x", files: [] }, ctx)).toMatchObject({ ok: false });
  });

  it("o prompt proíbe chutar projeto/polo e manda perguntar", () => {
    expect(SYSTEM).toContain("Nunca invente");
    expect(SYSTEM).toContain("duvidas");
    expect(outputSchema.safeParse({ resumo: "", itens: [], duvidas: [], pendencias: [] }).success).toBe(true);
  });

  it("texto sem anexos: avisa a IA", () => {
    expect(JSON.stringify(userContent("", []))).toContain("sem texto digitado");
  });
});

describe("cartões da Central de entrada", () => {
  it("mudar o destino aproveita o que já estava preenchido", () => {
    const d = convertTipo({ tipo: "demanda", projeto_id: "p4c", escopo: "polo", dossie: "Niterói", titulo: "Reunião com polo", descricao: "pauta", prazo: "2026-12-02" }, "compromisso");
    expect(d).toMatchObject({ tipo: "compromisso", titulo: "Reunião com polo", projeto_id: "p4c", escopo: "profissional", dossie: "Niterói", data: "2026-12-02", descricao: "pauta" });
    const n = convertTipo({ tipo: "tarefa", titulo: "Comprar vitamina", data: "2026-12-03" }, "lembrete");
    expect(n).toMatchObject({ tipo: "lembrete", texto: "Comprar vitamina", data: "2026-12-03" });
    const a = convertTipo({ tipo: "lembrete", texto: "Ligar", projeto_id: "p4c" }, "anotacao");
    expect(a).toMatchObject({ tipo: "anotacao", texto: "Ligar", projeto_id: "p4c" });
    expect(convertTipo(n, "lembrete")).toBe(n);
  });

  it("anexos viram evidências ligadas à demanda; texto vai como texto", () => {
    const items: InboxItem[] = [{ key: "a", registro: { tipo: "demanda", projeto_id: "p4c", escopo: "geral", titulo: "T" }, anexos: ["print.jpg", "nota.txt", "nao-existe.png"] }, { key: "b", registro: { tipo: "tarefa", titulo: "x" } }];
    const files: InboxFile[] = [{ name: "print.jpg", mime: "image/jpeg", size: 3, data: "AAAA" }, { name: "nota.txt", mime: "text/plain", size: 3, data: Buffer.from("transcrição").toString("base64") }];
    const { records, owner } = buildRecords(items, files);
    expect(records.map((r) => r.tipo)).toEqual(["demanda", "evidencia", "evidencia", "tarefa"]);
    expect(owner).toEqual([0, 0, 0, 1]);
    expect(records[0]!["ref"]).toBe("dem1");
    expect(records[1]).toMatchObject({ demanda: "ref:dem1", nome: "print.jpg", conteudo_base64: "AAAA", projeto_id: "p4c" });
    expect(records[2]).toMatchObject({ texto: "transcrição" });
    expect(withRefs(items)[1]!.registro["ref"]).toBeUndefined();
  });

  it("'criar mesmo assim' marca permitir_duplicado", () => {
    const { records } = buildRecords([{ key: "a", registro: { tipo: "tarefa", titulo: "x" }, duplicadoOk: true }], []);
    expect(records[0]!["permitir_duplicado"]).toBe(true);
  });

  it("mensagens do servidor voltam para o cartão certo", () => {
    const { byIndex, general } = messagesByIndex(["#2 Demanda: projeto: obrigatório", "#2 Demanda: título: obrigatório", "#4 Calendário: data inválida: x", "Algo geral"]);
    expect(byIndex.get(1)).toEqual(["projeto: obrigatório", "título: obrigatório"]);
    expect(byIndex.get(3)).toEqual(["data inválida: x"]);
    expect(general).toEqual(["Algo geral"]);
  });

  it("copiar: texto organizado por destino", () => {
    const md = itemsToMarkdown([
      { key: "a", registro: { tipo: "demanda", projeto_id: "p4c", escopo: "multipolo", dossies: ["Niterói", "Santos"], titulo: "Templates", prazo: "2026-12-10", checklist: ["a", "b"] } },
      { key: "b", registro: { tipo: "lembrete", texto: "Levar lista", data: "2026-12-02", hora: "13:00" } },
    ], { project: () => "P4C" });
    expect(md).toContain("## Demandas");
    expect(md).toContain("- **Templates**");
    expect(md).toContain("Projeto: P4C");
    expect(md).toContain("Polos/dossiês: Niterói, Santos");
    expect(md).toContain("Checklist: [ ] a; [ ] b");
    expect(md).toContain("## Lembretes");
    expect(md.indexOf("## Demandas")).toBeLessThan(md.indexOf("## Lembretes"));
    expect(DESTINOS.map((d) => d.tipo)).toContain("documentacao");
  });
});
