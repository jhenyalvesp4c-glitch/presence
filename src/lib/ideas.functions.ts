/**
 * Projetos e ideias — IA: (1) organiza uma captura rápida (texto, fala transcrita, print) numa ideia ou referência;
 * (2) "Desenvolver com o Orion": perguntas que faltam, riscos, primeiros passos e o que seria preciso (tempo, dinheiro, pessoas).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { cleanBudget, cleanLinks, cleanPlan, cleanTags, linksIn, type BudgetItem, type IdeaArea, type IdeaKind, type IdeaPlan } from "./ideas";

const file = z.object({ name: z.string().min(1).max(200), mime: z.string().min(1).max(100), size: z.number().int().min(0), data: z.string().max(4_000_000) });

export type Captured = { titulo: string; descricao: string; area: IdeaArea; tipo: IdeaKind; etiquetas: string[]; links: string[] };
export type CaptureResult = { ok: true; ideia: Captured; fonte: "ia" | "manual"; aviso?: string } | { ok: false; error: string };
export type DevelopResult = { ok: true; plano: IdeaPlan } | { ok: false; error: string };

/** Sem IA (ou se ela falhar): título = primeira linha, descrição = o resto. */
export function manualCapture(texto: string, files: { name: string }[] = []): Captured {
  const clean = texto.trim(), [first = "", ...rest] = clean.split(/\n+/), title = (first.replace(/https?:\/\/\S+/g, "").trim() || first || files[0]?.name || "Nova ideia").slice(0, 120);
  return { titulo: title, descricao: (rest.join("\n") || (clean.length > title.length ? clean : "")).slice(0, 8000), area: "pessoal", tipo: "ideia", etiquetas: [], links: linksIn(clean) };
}

const CAPTURE_TOOL = "guardar_ideia";
const CAPTURE_SYSTEM = `Você organiza o que a pessoa joga rápido na caixa de ideias dela (texto digitado, fala transcrita, print ou foto de algo que ela viu), chamando a função ${CAPTURE_TOOL}.
- "titulo": curto e claro (até 80 caracteres), no jeito dela falar. "descricao": o que importa, bem organizado, sem inventar nada além do que foi dito ou está na imagem (nomes, preços, datas e links como aparecem).
- "tipo": "ideia" quando é algo que ela quer fazer/explorar; "referencia" quando é só inspiração/material para guardar (print, link, exemplo) sem uma ação clara.
- "area": "negocios" se for sobre trabalho, empresa, clientes, polos, campanhas, vendas ou projeto profissional; senão "pessoal".
- "etiquetas": até 5, curtas, minúsculas. "links": só endereços http(s) que aparecem. Se houver imagem, leia o texto dela. Português do Brasil. Nunca devolva senhas, tokens ou números de documentos.`;

export const captureIdea = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ texto: z.string().max(8000).default(""), files: z.array(file).max(4).default([]) }).parse(d))
  .handler(async ({ data }): Promise<CaptureResult> => {
    if (!data.texto.trim() && !data.files.length) return { ok: false, error: "Escreva, fale ou mande um print." };
    const fallback = manualCapture(data.texto, data.files);
    if (!process.env["OPENAI_API_KEY"]) return { ok: true, ideia: fallback, fonte: "manual", aviso: "A organização por IA ainda não está ligada; guardei do jeito que você escreveu." };
    try {
      const { makeCreate } = await import("./mcp/openai");
      const { DEFAULT_MODEL, userContent } = await import("./mcp/interpret");
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      const parameters = { type: "object", properties: { titulo: { type: "string" }, descricao: { type: "string" }, tipo: { type: "string", enum: ["ideia", "referencia"] }, area: { type: "string", enum: ["pessoal", "negocios"] }, etiquetas: { type: "array", items: { type: "string" } }, links: { type: "array", items: { type: "string" } } }, required: ["titulo", "tipo", "area"] };
      const res = await makeCreate()({
        model, instructions: CAPTURE_SYSTEM,
        input: [{ role: "user", content: userContent(data.texto.trim() || "(só a imagem)", data.files) }],
        tools: [{ type: "function", name: CAPTURE_TOOL, description: "Guarda a ideia ou referência organizada.", parameters, strict: false }],
        tool_choice: { type: "function", name: CAPTURE_TOOL }, max_output_tokens: 2000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === CAPTURE_TOOL);
      if (!call) return { ok: true, ideia: fallback, fonte: "manual", aviso: "A IA não organizou desta vez; guardei do jeito que você escreveu." };
      const a = JSON.parse(String(call["arguments"])) as Record<string, unknown>, titulo = String(a["titulo"] ?? "").trim().slice(0, 200);
      if (!titulo) return { ok: true, ideia: fallback, fonte: "manual" };
      return { ok: true, fonte: "ia", ideia: { titulo, descricao: String(a["descricao"] ?? "").trim().slice(0, 8000), tipo: a["tipo"] === "referencia" ? "referencia" : "ideia", area: a["area"] === "negocios" ? "negocios" : "pessoal", etiquetas: cleanTags(a["etiquetas"]), links: cleanLinks([...(Array.isArray(a["links"]) ? (a["links"] as unknown[]) : []), ...linksIn(data.texto)]) } };
    } catch {
      return { ok: true, ideia: fallback, fonte: "manual", aviso: "Não consegui organizar com a IA agora; guardei do jeito que você escreveu." };
    }
  });

const PLAN_TOOL = "montar_plano";
const PLAN_SYSTEM = `Você é o Orion ajudando a pessoa a DESENVOLVER uma ideia (pessoal ou de negócios): como um bom mentor, prático e direto. Chame a função ${PLAN_TOOL}.
- "resumo": 2 ou 3 linhas dizendo o que a ideia é e o que ela precisa para sair do papel.
- "perguntas": 3 a 6 perguntas que FALTAM e mudam a decisão (para quem é, quanto custa, quanto tempo, o que já existe, como saber se deu certo). Nunca repita uma pergunta que ela já respondeu.
- "riscos": 3 a 6 riscos reais (o que pode dar errado) e, quando fizer sentido, como reduzir.
- "passos": 4 a 8 primeiros passos concretos, em ordem, cada um começando com um verbo (ex.: "Conversar com 5 possíveis clientes").
- "precisa": {"tempo": estimativa realista, "dinheiro": faixa de custo ou "quase nada", "pessoas": quem seria preciso envolver}. Se não der para estimar, diga o que falta saber.
- "proximoPasso": a menor ação possível para fazer nas próximas 24 a 48 horas.
Use SÓ o que ela contou; quando estimar, deixe claro que é estimativa. Se houver respostas dela às perguntas anteriores, incorpore-as e refine tudo (não recomece do zero). Português do Brasil, frases curtas.`;

export const developIdea = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ texto: z.string().min(2).max(12000), plano: z.unknown().optional() }).parse(d))
  .handler(async ({ data }): Promise<DevelopResult> => {
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A IA ainda não está ligada (falta OPENAI_API_KEY no servidor), então não consigo desenvolver a ideia agora." };
    try {
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const { DEFAULT_MODEL } = await import("./mcp/interpret");
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      const before = cleanPlan(data.plano);
      const answered = before?.perguntas.filter((p) => p.a) ?? [];
      const ctx = before ? `\n\nPLANO ANTERIOR (refine, não recomece):\nResumo: ${before.resumo}\nRiscos: ${before.riscos.join("; ")}\nPassos: ${before.passos.join("; ")}\nPerguntas respondidas: ${answered.map((p) => `${p.q} → ${p.a}`).join(" | ") || "nenhuma"}\nPerguntas ainda sem resposta: ${before.perguntas.filter((p) => !p.a).map((p) => p.q).join(" | ") || "nenhuma"}` : "";
      const item = { type: "object", properties: { q: { type: "string" } }, required: ["q"] };
      const parameters = { type: "object", properties: { resumo: { type: "string" }, perguntas: { type: "array", items: item }, riscos: { type: "array", items: { type: "string" } }, passos: { type: "array", items: { type: "string" } }, precisa: { type: "object", properties: { tempo: { type: "string" }, dinheiro: { type: "string" }, pessoas: { type: "string" } }, required: ["tempo", "dinheiro", "pessoas"] }, proximoPasso: { type: "string" } }, required: ["resumo", "perguntas", "riscos", "passos", "precisa", "proximoPasso"] };
      const res = await makeCreate()({
        model, instructions: PLAN_SYSTEM,
        input: [{ role: "user", content: [{ type: "input_text", text: `IDEIA:\n${data.texto}${ctx}` }] }],
        tools: [{ type: "function", name: PLAN_TOOL, description: "Devolve o plano para desenvolver a ideia.", parameters, strict: false }],
        tool_choice: { type: "function", name: PLAN_TOOL }, max_output_tokens: 4000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === PLAN_TOOL);
      if (!call) return { ok: false, error: "A IA não devolveu o plano. Tente de novo." };
      const plan = cleanPlan(JSON.parse(String(call["arguments"])));
      if (!plan) return { ok: false, error: "A IA devolveu um plano vazio. Tente de novo com mais detalhes na ideia." };
      // mantém as respostas já dadas às perguntas que a IA repetiu
      plan.perguntas = plan.perguntas.map((p) => ({ q: p.q, a: answered.find((x) => x.q.trim().toLowerCase() === p.q.trim().toLowerCase())?.a ?? "" }));
      return { ok: true, plano: plan };
    } catch (error) {
      const { OpenAIError, explain } = await import("./mcp/openai");
      if (error instanceof OpenAIError) return { ok: false, error: explain(error, process.env["OPENAI_MODEL"] ?? "o modelo") };
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais. Tente de novo." };
      return { ok: false, error: "Não consegui desenvolver a ideia agora. Tente de novo." };
    }
  });

const BUDGET_SYSTEM = `Você ajuda a montar o ORÇAMENTO de uma ideia da pessoa: tudo o que ela vai precisar COMPRAR ou PAGAR para tirar a ideia do papel, em português do Brasil.
Chame a ferramenta com a lista "itens". Regras:
- Inclua só o que envolve dinheiro (compras, serviços, taxas, materiais). Não inclua tarefas sem custo.
- Use EXATAMENTE os nomes, quantidades, valores e links que a pessoa deu. Se ela disse que já tem algo ("já tenho as tintas"), coloque status "tenho" (não conta no total) e valor vazio.
- Quando ela não deu valor, deixe "valor" vazio (null) para ela preencher, OU dê uma estimativa realista de UMA unidade em reais com "estimado": true. Prefira deixar vazio se não tiver noção razoável. Nunca invente links.
- Se ela citou decorações/peças, uma linha para cada uma. Se faltar algo óbvio que ela vai precisar (ex.: parafusos e buchas para a prateleira), inclua com "nota" explicando e valor vazio ou estimado.
- Se já houver itens do orçamento, NÃO repita os que já existem; devolva só os que faltam adicionar.
- "qtd" é a quantidade (mínimo 1). "nota" curta e opcional.`;

export type BudgetResult = { ok: true; itens: BudgetItem[] } | { ok: false; error: string };

export const suggestBudget = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ texto: z.string().min(2).max(14000) }).parse(d))
  .handler(async ({ data }): Promise<BudgetResult> => {
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A IA ainda não está ligada (falta OPENAI_API_KEY no servidor), então não consigo montar o orçamento agora." };
    try {
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const { DEFAULT_MODEL } = await import("./mcp/interpret");
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      const item = { type: "object", properties: { nome: { type: "string" }, qtd: { type: "number" }, valor: { type: ["number", "null"] }, estimado: { type: "boolean" }, status: { type: "string", enum: ["comprar", "tenho"] }, link: { type: "string" }, nota: { type: "string" } }, required: ["nome", "qtd", "valor", "estimado", "status", "link", "nota"] };
      const res = await makeCreate()({
        model, instructions: BUDGET_SYSTEM,
        input: [{ role: "user", content: [{ type: "input_text", text: `IDEIA E CONVERSA:\n${data.texto}` }] }],
        tools: [{ type: "function", name: "montar_orcamento", description: "Devolve os itens do orçamento.", parameters: { type: "object", properties: { itens: { type: "array", items: item } }, required: ["itens"] }, strict: false }],
        tool_choice: { type: "function", name: "montar_orcamento" }, max_output_tokens: 3000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === "montar_orcamento");
      if (!call) return { ok: false, error: "A IA não devolveu a lista. Tente de novo." };
      const itens = cleanBudget((JSON.parse(String(call["arguments"])) as { itens?: unknown }).itens);
      if (!itens.length) return { ok: false, error: "Não encontrei nada que envolva gasto nessa ideia. Conte mais (o que você vai comprar) e tente de novo." };
      return { ok: true, itens };
    } catch (error) {
      const { OpenAIError, explain } = await import("./mcp/openai");
      if (error instanceof OpenAIError) return { ok: false, error: explain(error, process.env["OPENAI_MODEL"] ?? "o modelo") };
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais. Tente de novo." };
      return { ok: false, error: "Não consegui montar o orçamento agora. Tente de novo." };
    }
  });
