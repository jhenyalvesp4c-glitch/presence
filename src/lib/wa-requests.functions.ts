/** Verificar demandas no WhatsApp — IA: lê um lote de conversas (grupos e privadas, com imagens/PDFs) e lista os PEDIDOS feitos a você, para você decidir o que vira demanda. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { cleanRequests, rulesPrompt, type Req } from "./wa-requests";

const file = z.object({ n: z.number().int().min(1).max(100000), name: z.string().min(1).max(200), mime: z.string().min(1).max(100), size: z.number().int().min(0), data: z.string().max(2_500_000) });
export type FindResult = { ok: true; pedidos: Req[] } | { ok: false; error: string };
const TOOL = "listar_pedidos";
const example = z.object({ titulo: z.string().max(300), chat: z.string().max(120), trecho: z.string().max(400).default("") });

export const findRequests = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ texto: z.string().min(1).max(60000), hoje: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), diaSemana: z.string().max(20).default(""), euSou: z.string().max(60).default(""), regras: z.string().max(6000).default(""), aceitos: z.array(example).max(15).default([]), descartados: z.array(example).max(15).default([]), demandas: z.array(z.object({ codigo: z.string().max(20), titulo: z.string().max(200), dossie: z.string().max(120).default(""), projeto: z.string().max(120).default("") })).max(60).default([]), files: z.array(file).max(8).default([]) }).parse(d))
  .handler(async ({ data }): Promise<FindResult> => {
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A IA ainda não está ligada neste ambiente (falta OPENAI_API_KEY no servidor)." };
    try {
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const { DEFAULT_MODEL, userContent } = await import("./mcp/interpret");
      void OpenAIError; void explain;
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      const s = { type: "string" }, n = { type: "number" };
      const system = `Você varre conversas de WhatsApp (grupos e conversas privadas) e lista os PEDIDOS que alguém fez${data.euSou ? ` à pessoa que usa o Orion (${data.euSou})` : " à pessoa que usa o Orion"} ou à equipe e que podem virar DEMANDA de trabalho. Chame a função ${TOOL}. Português do Brasil. Hoje é ${data.hoje}${data.diaSemana ? ` (${data.diaSemana})` : ""}.
Cada conversa começa com "=== Grupo: nome ===" ou "=== Conversa privada: nome ===". "Eu" é a pessoa que usa o Orion. As linhas "[imagem #N]" e "[pdf #N]" são arquivos enviados; os arquivos numerados vêm anexados a esta mensagem.
Regras:
- Um item por pedido: "titulo" (verbo no infinitivo, claro), "detalhes" (o que é preciso, com dados do print/PDF se houver), "trecho" (a frase original que prova, curta), "chat" (nome do grupo/pessoa), "grupo" (true se grupo), "quem" (quem pediu), "quando" (DD/MM HH:mm da mensagem), "prazo" (AAAA-MM-DD; converta "amanhã", "sexta"; vazio se não houver), "prioridade" (alta se urgente), "paraMim" ("sim" se é para mim ou me citou; "talvez" se é um pedido geral ao grupo/equipe que eu poderia assumir), "resolvido" (true se, depois, alguém disse que foi feito ou entregue), "imagens" (números dos anexos que mostram/provam o pedido) e "confianca" (alta/media/baixa).
- Use o conhecimento abaixo para decidir o que é demanda desta pessoa: relatos de erro e dúvidas sobre o CRM/atendimento contam mesmo sem a palavra "preciso".
- NÃO liste: conversa social, cumprimentos, avisos sem pedido, dúvidas já respondidas, pedidos que eu mesmo fiz a outros (a menos que eu tenha me comprometido a algo), nem assuntos entre terceiros que não envolvem o meu trabalho.
- DETALHE TUDO no campo "detalhes" (até 3000 caracteres), sem resumir e sem perder nada: o que foi pedido, nome do template, nome e conteúdo da base/planilha enviada (colunas, quantidade de contatos, nome do arquivo), datas e horários, valores, nomes de pessoas e números citados, o que foi combinado e o que ainda falta. Se vier imagem ou PDF, transcreva os dados importantes dele.
- COMPLEMENTOS: se alguém mandou INFORMAÇÃO nova sobre um pedido que já existe (a base de contatos, qual template usar, a data do disparo, um arquivo, uma correção), liste como item com "tipo": "complemento" e um "titulo" de AÇÃO (ex.: "Disparar o template X para a base base_nov.xlsx (1.250 contatos)"). Quando for um pedido novo, "tipo": "pedido".
- Se o item continua uma das DEMANDAS JÁ ABERTAS abaixo, preencha "demanda" com o código dela (ex.: "P059"). Se for assunto novo, deixe vazio.
- Não invente nada. Se não houver pedido nenhum, devolva a lista vazia. Nunca repita senhas, chaves ou dados de acesso que apareçam.

${data.demandas.length ? `\n\nDEMANDAS JÁ ABERTAS (use o código em "demanda" quando o item for continuação de uma delas):\n${data.demandas.map((d) => `- ${d.codigo}${d.dossie ? ` [${d.dossie}]` : ""}${d.projeto ? ` (${d.projeto})` : ""}: ${d.titulo}`).join("\n")}` : ""}\n\n${rulesPrompt(data.regras, data.aceitos, data.descartados)}`;
      const parameters = { type: "object", properties: { pedidos: { type: "array", items: { type: "object", properties: { titulo: s, detalhes: s, trecho: s, chat: s, grupo: { type: "boolean" }, quem: s, quando: s, prazo: s, prioridade: { type: "string", enum: ["alta", "media", "baixa"] }, paraMim: { type: "string", enum: ["sim", "talvez"] }, resolvido: { type: "boolean" }, tipo: { type: "string", enum: ["pedido", "complemento"] }, demanda: s, imagens: { type: "array", items: n }, confianca: { type: "string", enum: ["alta", "media", "baixa"] } }, required: ["titulo", "chat", "quem", "quando"] } } }, required: ["pedidos"] };
      const res = await makeCreate()({
        model, instructions: system, input: [{ role: "user", content: userContent(data.texto, data.files.map(({ name, mime, size, data: d }) => ({ name, mime, size, data: d }))) }],
        tools: [{ type: "function", name: TOOL, description: "Devolve os pedidos encontrados nas conversas.", parameters, strict: false }],
        tool_choice: { type: "function", name: TOOL }, max_output_tokens: 12000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === TOOL);
      if (!call) return { ok: false, error: "A IA não devolveu a lista de pedidos." };
      return { ok: true, pedidos: cleanRequests(JSON.parse(String(call["arguments"])), new Set(data.files.map((f) => f.n))) };
    } catch (error) {
      const { OpenAIError, explain } = await import("./mcp/openai");
      if (error instanceof OpenAIError) return { ok: false, error: explain(error, process.env["OPENAI_MODEL"] ?? "o modelo") };
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais neste lote." };
      return { ok: false, error: "Não consegui analisar este lote agora." };
    }
  });
