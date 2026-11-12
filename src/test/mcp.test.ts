import { describe, expect, it } from "vitest";

import { authorize, MIN_TOKEN_LENGTH } from "@/lib/mcp/auth";
import { handleBody, handleMessage, negotiate, type ToolSet } from "@/lib/mcp/protocol";
import { RANK, deadlineLabel, minusMinutes, normalize, refProblems, registroSchema, similar, structuralProblems, type Registro } from "@/lib/mcp/records";
import { lineOf, summarize, type Resolved } from "@/lib/mcp/plan";
import { rateLimited } from "@/lib/mcp/http";

const TOKEN = "t".repeat(MIN_TOKEN_LENGTH + 8);
const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe("autenticação do MCP", () => {
  it("sem MCP_TOKEN (ou curto demais) o endpoint fica desligado", () => {
    expect(authorize(h({}), undefined, {})).toMatchObject({ ok: false, status: 503 });
    expect(authorize(h({ authorization: "Bearer curto" }), undefined, { MCP_TOKEN: "curto" })).toMatchObject({ ok: false, status: 503 });
  });
  it("aceita Bearer, x-mcp-token e token no endereço; recusa o resto", () => {
    const env = { MCP_TOKEN: TOKEN };
    expect(authorize(h({ authorization: `Bearer ${TOKEN}` }), undefined, env)).toEqual({ ok: true });
    expect(authorize(h({ "x-mcp-token": TOKEN }), undefined, env)).toEqual({ ok: true });
    expect(authorize(h({}), TOKEN, env)).toEqual({ ok: true });
    expect(authorize(h({ authorization: "Bearer errado" }), undefined, env)).toMatchObject({ ok: false, status: 401 });
    expect(authorize(h({}), undefined, env)).toMatchObject({ ok: false, status: 401 });
    expect(authorize(h({}), `${TOKEN}x`, env)).toMatchObject({ ok: false, status: 401 });
  });
});

const set: ToolSet = {
  instructions: "regras",
  tools: [
    { name: "ok", title: "Ok", description: "d", inputSchema: { type: "object" }, annotations: { readOnlyHint: true }, run: async () => ({ content: [{ type: "text", text: "feito" }] }) },
    { name: "quebra", title: "Q", description: "d", inputSchema: { type: "object" }, annotations: {}, run: async () => { throw new Error("falhou"); } },
  ],
};
const ctx = { client: "teste" };

describe("protocolo MCP (JSON-RPC)", () => {
  it("initialize negocia a versão e devolve instruções", async () => {
    const r = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, set, ctx);
    expect(r?.result).toMatchObject({ protocolVersion: "2025-03-26", instructions: "regras", capabilities: { tools: {} } });
    expect(negotiate("1999-01-01")).toBe("2025-06-18");
  });
  it("notificações não têm resposta e o lote devolve só o que tem id", async () => {
    expect(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, set, ctx)).toBeNull();
    const out = await handleBody([{ jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 7, method: "ping" }], set, ctx);
    expect(out.status).toBe(200);
    expect(out.body).toEqual([{ jsonrpc: "2.0", id: 7, result: {} }]);
    expect((await handleBody({ jsonrpc: "2.0", method: "notifications/initialized" }, set, ctx)).status).toBe(202);
  });
  it("tools/list e tools/call", async () => {
    const list = await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, set, ctx);
    expect((list?.result as { tools: { name: string }[] }).tools.map((t) => t.name)).toEqual(["ok", "quebra"]);
    const call = await handleMessage({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "ok", arguments: {} } }, set, ctx);
    expect(call?.result).toMatchObject({ content: [{ text: "feito" }] });
  });
  it("erro dentro da ferramenta volta como resultado (isError), não derruba o servidor", async () => {
    const r = await handleMessage({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "quebra" } }, set, ctx);
    expect(r?.result).toMatchObject({ isError: true });
    expect(r?.error).toBeUndefined();
  });
  it("método ou ferramenta desconhecidos e mensagens inválidas dão erro JSON-RPC", async () => {
    expect((await handleMessage({ jsonrpc: "2.0", id: 5, method: "nao/existe" }, set, ctx))?.error?.code).toBe(-32601);
    expect((await handleMessage({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "x" } }, set, ctx))?.error?.code).toBe(-32602);
    expect((await handleMessage("lixo", set, ctx))?.error?.code).toBe(-32600);
    expect((await handleBody([], set, ctx)).status).toBe(400);
  });
});

describe("registros: validação", () => {
  const parse = (r: unknown) => registroSchema.safeParse(r);
  it("o tipo decide os campos; campo desconhecido não passa despercebido", () => {
    expect(parse({ tipo: "demanda", projeto_id: "p4c", escopo: "geral", titulo: "x" }).success).toBe(true);
    expect(parse({ tipo: "tarefa", titulo: "x", data: "31/12" }).success).toBe(false);
    expect(parse({ tipo: "lembrete", texto: "x", hora: "25:00", data: "2026-12-01" }).success).toBe(false);
    expect(parse({ tipo: "inventado", titulo: "x" }).success).toBe(false);
  });
  const reg = (r: unknown) => registroSchema.parse(r) as Registro;
  it("demanda: escopo e polo precisam combinar", () => {
    expect(structuralProblems(reg({ tipo: "demanda", projeto_id: "p", escopo: "geral", dossie: "Niterói", titulo: "x" }))).not.toEqual([]);
    expect(structuralProblems(reg({ tipo: "demanda", projeto_id: "p", escopo: "polo", titulo: "x" }))).not.toEqual([]);
    expect(structuralProblems(reg({ tipo: "demanda", projeto_id: "p", escopo: "multipolo", dossies: ["A", "B"], titulo: "x" }))).toEqual([]);
    expect(structuralProblems(reg({ tipo: "demanda", projeto_id: "p", escopo: "multipolo", dossie: "A", titulo: "x" }))).not.toEqual([]);
  });
  it("compromisso: profissional exige projeto; pessoal não se vincula; horários coerentes", () => {
    expect(structuralProblems(reg({ tipo: "compromisso", escopo: "profissional", titulo: "x", data: "2026-12-01" }))).not.toEqual([]);
    expect(structuralProblems(reg({ tipo: "compromisso", escopo: "pessoal", projeto_id: "p", titulo: "x", data: "2026-12-01" }))).not.toEqual([]);
    expect(structuralProblems(reg({ tipo: "compromisso", escopo: "pessoal", titulo: "x", data: "2026-12-01", inicio: "10:00", fim: "09:00" }))).not.toEqual([]);
    expect(structuralProblems(reg({ tipo: "compromisso", escopo: "pessoal", titulo: "x", data: "2026-02-30" }))).not.toEqual([]);
    expect(structuralProblems(reg({ tipo: "compromisso", escopo: "pessoal", titulo: "x", data: "2026-12-01", inicio: "10:00", fim: "11:00", lembrete_minutos_antes: 15 }))).toEqual([]);
    expect(structuralProblems(reg({ tipo: "compromisso", escopo: "pessoal", titulo: "x", data: "2026-12-01", lembrete_minutos_antes: 15 }))).not.toEqual([]);
  });
  it("lembrete e tarefa: hora exige data", () => {
    expect(structuralProblems(reg({ tipo: "lembrete", texto: "x", hora: "10:00" }))).not.toEqual([]);
    expect(structuralProblems(reg({ tipo: "lembrete", texto: "x" }))).toEqual([]);
    expect(structuralProblems(reg({ tipo: "tarefa", titulo: "x", hora: "10:00" }))).not.toEqual([]);
  });
  it("evidência: precisa de arquivo (com nome) ou texto, e respeita o limite de 4 MB", () => {
    expect(structuralProblems(reg({ tipo: "evidencia", projeto_id: "p", demanda: "#G040" }))).not.toEqual([]);
    expect(structuralProblems(reg({ tipo: "evidencia", projeto_id: "p", demanda: "#G040", conteudo_base64: "AAAA" }))).not.toEqual([]);
    expect(structuralProblems(reg({ tipo: "evidencia", projeto_id: "p", demanda: "#G040", conteudo_base64: "AAAA", nome: "a.png" }))).toEqual([]);
    expect(structuralProblems(reg({ tipo: "evidencia", projeto_id: "p", demanda: "#G040", texto: "transcrição" }))).toEqual([]);
    expect(structuralProblems(reg({ tipo: "evidencia", projeto_id: "p", demanda: "#G040", nome: "a.bin", conteudo_base64: "A".repeat(5_900_000) }))).not.toEqual([]);
  });
  it("referências entre registros da mesma proposta", () => {
    const d = reg({ tipo: "demanda", ref: "d1", projeto_id: "p", escopo: "geral", titulo: "x" });
    const c = reg({ tipo: "compromisso", ref: "c1", escopo: "profissional", projeto_id: "p", titulo: "x", data: "2026-12-01", demanda: "ref:d1" });
    const l = reg({ tipo: "lembrete", texto: "x", compromisso: "ref:c1" });
    expect(refProblems([d, c, l])).toEqual([]);
    expect(refProblems([c, l])).not.toEqual([]); // d1 não existe
    expect(refProblems([d, reg({ tipo: "lembrete", texto: "x", compromisso: "ref:d1" })])).not.toEqual([]); // tipo errado
    expect(refProblems([d, d])).not.toEqual([]); // ref repetida
  });
  it("a ordem de criação respeita as dependências", () => {
    expect(RANK.demanda).toBeLessThan(RANK.compromisso);
    expect(RANK.compromisso).toBeLessThan(RANK.lembrete);
    expect(RANK.demanda).toBeLessThan(RANK.evidencia);
  });
});

describe("texto, datas e duplicidade", () => {
  it("normaliza acentos, caixa e pontuação", () => {
    expect(normalize("  Reunião — Polo Niterói! ")).toBe("reuniao polo niteroi");
  });
  it("equivalentes: iguais ou muito parecidos; assuntos diferentes não", () => {
    expect(similar("Reunião com o Polo Niterói", "reuniao com o polo niteroi")).toBe(true);
    expect(similar("Atualizar templates dos polos", "Atualizar templates dos polos.")).toBe(true);
    expect(similar("Atualizar templates", "Criar formulário de matrícula")).toBe(false);
    expect(similar("", "x")).toBe(false);
  });
  it("prazo vira dia/mês e lembrete antes do evento atravessa a meia-noite", () => {
    expect(deadlineLabel("2026-12-10")).toBe("10/12");
    expect(deadlineLabel(undefined)).toBe("—");
    expect(minusMinutes("2026-12-02", "00:20", 30)).toEqual({ date: "2026-12-01", time: "23:50" });
  });
});

describe("resumo para aprovação", () => {
  const demanda = { tipo: "demanda", ref: "d1", projeto_id: "p4c", escopo: "multipolo", titulo: "Templates", prioridade: "alta", prazo: "2026-12-10", _projeto: { id: "p4c", nome: "P4C" }, _dossies: [{ id: "a", name: "Niterói" }, { id: "b", name: "Santos" }] } as Resolved;
  const reuniao = { tipo: "compromisso", escopo: "profissional", projeto_id: "p4c", titulo: "Reunião", data: "2026-12-02", inicio: "14:00", demanda: "ref:d1", _projeto: { id: "p4c", nome: "P4C" } } as Resolved;
  it("mostra módulo, projeto, polos e troca ref: por número do item", () => {
    const s = summarize([demanda, reuniao]);
    expect(s).toContain("[Demanda · projeto P4C]");
    expect(s).toContain("multipolo (2): Niterói, Santos");
    expect(s).toContain("prazo 10/12");
    expect(s).toContain("[Calendário · profissional · projeto P4C]");
    expect(s).toContain("demanda item 1 desta proposta");
  });
  it("marca duplicado que será ignorado", () => {
    expect(lineOf({ ...demanda, _ignorar: true, _duplicado: "demanda #G041" }, 1)).toContain("DUPLICADO");
  });
});

describe("limite de requisições", () => {
  it("passa de 240 por minuto e libera depois", () => {
    const t0 = 1_000_000;
    let blocked = false;
    for (let i = 0; i < 241; i++) blocked = rateLimited("ip-teste", t0 + i);
    expect(blocked).toBe(true);
    expect(rateLimited("ip-teste", t0 + 61_000)).toBe(false);
  });
});
