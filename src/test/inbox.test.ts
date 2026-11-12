import { describe, expect, it } from "vitest";

import { DESTINOS, buildRecords, convertTipo, itemsToMarkdown, messagesByIndex, withRefs, type InboxFile, type InboxItem } from "@/lib/inbox";
import { SYSTEM, TOOL_NAME, interpret, outputSchema, userContent, type Context, type Create } from "@/lib/mcp/interpret";
import { OpenAIError, baseUrl, explain, makeCreate } from "@/lib/mcp/openai";

const ctx: Context = {
  today: "2026-11-12", weekday: "quinta-feira",
  projects: [{ id: "p4c", nome: "P4C", descricao: "", status: "Ativo", rotulo_dossie: { singular: "Polo", plural: "Polos" }, dossiers: [{ id: "d1", nome: "Niterói", descricao: "" }, { id: "d2", nome: "Santos", descricao: "" }] }],
  categories: [{ id: "c1", slug: "pes", nome: "Pessoal" }],
};
const call = (input: unknown, id = "call_1") => ({ status: "completed", output: [{ type: "function_call", call_id: id, name: TOOL_NAME, arguments: JSON.stringify(input) }] });

describe("interpretação (OpenAI simulada)", () => {
  it("devolve os itens e aceita rascunho incompleto (sem projeto) em vez de forçar um chute", async () => {
    const calls: Record<string, unknown>[] = [];
    const create: Create = async (p) => { calls.push(p); return call({ resumo: "Uma demanda", itens: [{ registro: { tipo: "demanda", escopo: "geral", titulo: "Atualizar templates" }, motivo: "pedido de trabalho" }], duvidas: ["Qual projeto?"], pendencias: [] }); };
    const r = await interpret(create, { text: "atualizar templates", files: [] }, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.output.itens[0]!.registro).toMatchObject({ tipo: "demanda", titulo: "Atualizar templates" }); expect(r.output.duvidas).toEqual(["Qual projeto?"]); }
    expect(calls).toHaveLength(1);
  });

  it("monta a chamada da API Responses com os dados reais, imagem, PDF e texto", async () => {
    let params: Record<string, unknown> = {};
    const create: Create = async (p) => { params = p; return call({ resumo: "", itens: [], duvidas: [], pendencias: [] }); };
    const files = [{ name: "print.jpg", mime: "image/jpeg", data: "AAAA" }, { name: "doc.pdf", mime: "application/pdf", data: "BBBB" }, { name: "n.txt", mime: "text/plain", data: Buffer.from("olá").toString("base64") }];
    await interpret(create, { text: "veja", files, model: "gpt-teste" }, ctx);
    expect(params["model"]).toBe("gpt-teste");
    expect(params["store"]).toBe(false);
    expect(params["tool_choice"]).toEqual({ type: "function", name: TOOL_NAME });
    expect(params["tools"]).toMatchObject([{ type: "function", name: TOOL_NAME, strict: false }]);
    const instructions = String(params["instructions"]);
    expect(instructions).toContain("projeto_id: p4c");
    expect(instructions).toContain("Niterói; Santos");
    expect(instructions).toContain("Hoje: quinta-feira, 2026-11-12");
    const content = (params["input"] as { content: { type: string }[] }[])[0]!.content;
    expect(content.map((b) => b.type)).toEqual(["input_image", "input_file", "input_text", "input_text"]);
    expect(content[0]).toMatchObject({ image_url: "data:image/jpeg;base64,AAAA", detail: "high" });
    expect(content[1]).toMatchObject({ filename: "doc.pdf", file_data: "data:application/pdf;base64,BBBB" });
    expect(JSON.stringify(content[2])).toContain("olá");
  });

  it("formato inválido volta para a IA corrigir; resposta sem a função é cobrada", async () => {
    const inputs: unknown[] = [];
    let n = 0;
    const create: Create = async (p) => {
      inputs.push(JSON.parse(JSON.stringify(p["input"])));
      n++;
      if (n === 1) return { status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "claro!" }] }] };
      if (n === 2) return call({ resumo: "x", itens: "errado" });
      return call({ resumo: "ok", itens: [], duvidas: [], pendencias: [] });
    };
    const r = await interpret(create, { text: "oi", files: [] }, ctx);
    expect(r.ok).toBe(true);
    expect(n).toBe(3);
    expect(inputs[1]).toHaveLength(2);
    expect(JSON.stringify(inputs[2])).toContain("Formato inválido");
  });

  it("recusa, corte por tamanho e falha repetida viram erro claro", async () => {
    const mk = (res: unknown): Create => async () => res as never;
    expect(await interpret(mk({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "não" }] }] }), { text: "x", files: [] }, ctx)).toMatchObject({ ok: false });
    expect(await interpret(mk({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] }), { text: "x", files: [] }, ctx)).toMatchObject({ ok: false, error: expect.stringContaining("grande demais") });
    expect(await interpret(mk({ status: "completed", output: [] }), { text: "x", files: [] }, ctx)).toMatchObject({ ok: false });
  });

  it("argumentos que não são JSON também voltam para correção", async () => {
    let n = 0;
    const create: Create = async () => (++n === 1 ? { status: "completed", output: [{ type: "function_call", call_id: "c", name: TOOL_NAME, arguments: "{quebrado" }] } : call({ resumo: "", itens: [], duvidas: [], pendencias: [] }));
    expect((await interpret(create, { text: "x", files: [] }, ctx)).ok).toBe(true);
    expect(n).toBe(2);
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

describe("cliente HTTP da OpenAI", () => {
  const env = { OPENAI_API_KEY: "sk-teste", OPENAI_BASE_URL: "https://exemplo.test/v1/" };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const withFetch = async (fn: (calls: { url: string; body: Record<string, unknown>; auth: string }[]) => Promise<void>, answers: Response[]) => {
    const calls: { url: string; body: Record<string, unknown>; auth: string }[] = [];
    const real = globalThis.fetch;
    globalThis.fetch = (async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>)["authorization"]) }); return answers.shift()!; }) as never;
    try { await fn(calls); } finally { globalThis.fetch = real; }
  };

  it("chama /responses com a chave e devolve o JSON", async () => {
    await withFetch(async (calls) => {
      const out = await makeCreate(env)({ model: "m", input: [] });
      expect(out.output).toEqual([]);
      expect(calls[0]).toMatchObject({ url: "https://exemplo.test/v1/responses", auth: "Bearer sk-teste" });
    }, [reply(200, { status: "completed", output: [] })]);
  });

  it("modelo que não aceita 'reasoning': repete sem esse parâmetro", async () => {
    await withFetch(async (calls) => {
      await makeCreate(env)({ model: "m", reasoning: { effort: "low" }, input: [] });
      expect(calls).toHaveLength(2);
      expect(calls[1]!.body).not.toHaveProperty("reasoning");
    }, [reply(400, { error: { message: "Unsupported parameter: 'reasoning.effort'", code: "unsupported_parameter" } }), reply(200, { output: [] })]);
  });

  it("erros viram mensagens claras (chave, créditos, modelo)", async () => {
    await withFetch(async () => {
      await expect(makeCreate(env)({ model: "m", input: [] })).rejects.toMatchObject({ status: 401 });
    }, [reply(401, { error: { message: "Incorrect API key", code: "invalid_api_key" } })]);
    expect(explain(new OpenAIError(401, "invalid_api_key", "x"), "m")).toContain("OPENAI_API_KEY");
    expect(explain(new OpenAIError(429, "insufficient_quota", "x"), "m")).toContain("sem créditos");
    expect(explain(new OpenAIError(404, "model_not_found", "x"), "gpt-x")).toContain("OPENAI_MODEL");
    expect(explain(new OpenAIError(503, "", "x"), "m")).toContain("indisponível");
    expect(baseUrl({})).toBe("https://api.openai.com/v1");
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
