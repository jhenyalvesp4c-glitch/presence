/** Assistente de reuniões — IA: lê a conversa/reunião (texto, transcrição ou WhatsApp) e devolve ata, decisões, quem faz o quê, pendências e, em grupos, o resumo de cada um. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { cleanAnalysis, type Analysis } from "./meetings";

export type AnalyzeResult = { ok: true; analise: Analysis } | { ok: false; error: string };
const TOOL = "registrar_reuniao";

export const analyzeMeeting = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    texto: z.string().min(1).max(60000), modo: z.enum(["reuniao", "grupo"]).default("reuniao"), hoje: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), diaSemana: z.string().max(20).default(""),
    euSou: z.string().max(60).default(""), titulo: z.string().max(160).default(""),
  }).parse(d))
  .handler(async ({ data }): Promise<AnalyzeResult> => {
    if (!data.texto.trim()) return { ok: false, error: "Cole ou grave o conteúdo da reunião." };
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A IA ainda não está ligada neste ambiente (falta OPENAI_API_KEY no servidor)." };
    try {
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const { DEFAULT_MODEL } = await import("./mcp/interpret");
      void OpenAIError; void explain;
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      const s = { type: "string" }, sa = { type: "array", items: s }, grupo = data.modo === "grupo";
      const system = `Você é o assistente de reuniões do Orion. Lê ${grupo ? "conversas de grupos de WhatsApp (cada bloco começa com \"=== Grupo: nome ===\")" : "a transcrição ou anotação de uma reunião, ou uma conversa de WhatsApp"} e chama a função ${TOOL}. Português do Brasil. Hoje é ${data.hoje}${data.diaSemana ? ` (${data.diaSemana})` : ""}.
Regras:
- NÃO invente nada: só o que está no texto. Se faltar responsável ou prazo, diga "A definir" / deixe o prazo vazio.
- "resumo": a ata em 3 a 6 frases. "topicos": os assuntos tratados, com pontos curtos. "decisoes": o que foi decidido (só decisões claras). "pendencias": dúvidas e itens em aberto que ninguém resolveu.
- "acoes": TODO compromisso de fazer algo, uma linha cada: "quem" (nome como aparece no texto), "oQue" (verbo no infinitivo, claro e completo), "prazo" (AAAA-MM-DD; converta "amanhã", "sexta", "dia 25" usando a data de hoje; vazio se não houver), "prioridade" (alta se for urgente/bloqueante; baixa se for opcional), "tipo" ("demanda" = trabalho de projeto/cliente; "lembrete" = lembrar de algo ou cobrar alguém; "tarefa" = coisa pessoal ou simples), "contexto" (trecho curto que prova) e "minha": true se for da pessoa que está usando o Orion${data.euSou ? ` (${data.euSou})` : ""}.
- "participantes": quem falou. "proxima": só se marcaram a próxima reunião/retorno (data AAAA-MM-DD, hora HH:MM, assunto).
${grupo ? "- MODO GRUPO: preencha \"grupos\" com um item por grupo: nome, resumo (o que rolou, 2 a 4 frases), destaques (avisos, decisões, problemas), pedidos (quem pediu o quê a quem). Pedidos que exijam ação também entram em \"acoes\". Ignore conversa social, figurinhas e mídia sem texto." : "- Se for uma conversa de WhatsApp, ignore cumprimentos e conversa social."}
- "titulo": curto e específico${data.titulo ? ` (a pessoa chamou de "${data.titulo}")` : ""}. Nunca devolva dados de acesso, senhas ou chaves que apareçam no texto.`;
      const acao = { type: "object", properties: { quem: s, oQue: s, prazo: s, prioridade: { type: "string", enum: ["alta", "media", "baixa"] }, tipo: { type: "string", enum: ["demanda", "lembrete", "tarefa"] }, contexto: s, minha: { type: "boolean" } }, required: ["quem", "oQue", "tipo"] };
      const parameters = { type: "object", properties: {
        titulo: s, resumo: s, topicos: { type: "array", items: { type: "object", properties: { assunto: s, pontos: sa }, required: ["assunto"] } }, decisoes: sa, acoes: { type: "array", items: acao }, pendencias: sa, participantes: sa,
        proxima: { type: "object", properties: { data: s, hora: s, assunto: s } },
        grupos: { type: "array", items: { type: "object", properties: { nome: s, resumo: s, destaques: sa, pedidos: sa }, required: ["nome", "resumo"] } },
      }, required: ["titulo", "resumo"] };
      const res = await makeCreate()({
        model, instructions: system, input: [{ role: "user", content: data.texto }],
        tools: [{ type: "function", name: TOOL, description: "Devolve a ata e as ações da reunião.", parameters, strict: false }],
        tool_choice: { type: "function", name: TOOL }, max_output_tokens: 8000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === TOOL);
      const analise = call ? cleanAnalysis(JSON.parse(String(call["arguments"]))) : null;
      if (!analise) return { ok: false, error: "Não consegui tirar a ata desse texto. Confira se ele tem a conversa completa." };
      if (data.titulo.trim()) analise.titulo = data.titulo.trim();
      return { ok: true, analise };
    } catch (error) {
      const { OpenAIError, explain } = await import("./mcp/openai");
      if (error instanceof OpenAIError) return { ok: false, error: explain(error, process.env["OPENAI_MODEL"] ?? "o modelo") };
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais. Tente com um trecho menor (ex.: só as últimas horas)." };
      return { ok: false, error: "Não consegui analisar agora. Tente de novo." };
    }
  });
