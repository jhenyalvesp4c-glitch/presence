/** Assistente de reuniões — IA: lê a conversa/reunião (texto, transcrição ou WhatsApp) e devolve ata, decisões, quem faz o quê, pendências e, em grupos, o resumo de cada um. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { cleanAnalysis, type Analysis } from "./meetings";

export type AnalyzeResult = { ok: true; analise: Analysis } | { ok: false; error: string };
const TOOL = "registrar_reuniao";

/** Vale para todos os tipos: a pessoa não quer perder nada importante. */
const DETAIL = `- DETALHE (a pessoa não quer perder NADA importante): registre TODO número, valor em dinheiro, percentual, data, horário, prazo, nome de pessoa, cargo, empresa, ferramenta, sistema, link/endereço, regra, política e combinado dito, exatamente como foi dito (não arredonde nem converta).
- "fatos": um item por fato, com "rotulo" curto (ex.: "Salário", "Vale-refeição", "Horário de entrada", "Gestor", "Prazo do relatório") e "valor" exato. Se o valor ficou ambíguo, incompleto ou foi corrigido durante a conversa, use confirmar=true e explique no valor (ex.: "R$ 4.000 — disse 4 mil e depois 4,5 mil; confirmar").
- "lembrar": avisos, combinados e coisas fáceis de esquecer. "perguntas": perguntas sem resposta e dúvidas que vale esclarecer depois (só as que aparecem ou decorrem claramente do texto).
- "decisoes" e "pendencias": sem limite artificial; "topicos": pontos completos, não só palavras soltas.`;

const KIND_RULES = {
  reuniao: "- TIPO REUNIÃO: use topicos, decisoes, acoes e pendencias; \"fatos\" para números e datas combinados.",
  entrevista: `- TIPO ENTREVISTA DE EMPREGO (a pessoa que usa o Orion é a candidata, salvo se o texto mostrar o contrário). Preencha "secoes" (só as que tiverem conteúdo), com estes títulos: "A empresa" (o que fazem, tamanho, cultura, valores), "A vaga" (cargo, área, gestor, presencial/híbrido/remoto, horário), "Remuneração e benefícios" (salário, bônus, vale-refeição, plano de saúde etc., cada valor exato), "O que você vai fazer" (responsabilidades e demandas que vai administrar), "Processo seletivo" (etapas, quem entrevista, prazos de retorno), "Pontos de atenção" (alertas e dúvidas sobre condições). "expectativas" = o que esperam da pessoa (resultados, metas, requisitos). "acoes" = o que a candidata ficou de enviar ou fazer (documentos, portfólio, retorno), com prazo. "proxima" = próxima etapa. Valores de salário e benefícios também vão em "fatos". Título no formato "Entrevista — empresa (cargo)" quando souber.`,
  treinamento: `- TIPO TREINAMENTO / ENCONTRO COM CLIENTE OU POLO. Preencha "secoes" (só as que tiverem conteúdo): "Conteúdo passado" (o passo a passo ensinado, em ordem), "Materiais e acessos prometidos" (o que ficou de ser enviado: quem envia e até quando), "Combinados" (o que foi acertado com o polo/cliente), "Dificuldades e dúvidas" (o que ficou travado). Em "acoes", separe com cuidado o que a PESSOA QUE USA O ORION ficou de enviar ou fazer (minha=true) do que os outros ficaram de fazer. "proxima" = próximo encontro ou retorno marcado. Se pediram para marcar algo, vira ação com prazo.`,
  livre: `- TIPO LIVRE (ex.: primeiro dia de trabalho, aula, palestra, call longa). Organize em "secoes" com títulos que você escolher conforme o conteúdo (ex.: "Tarefas do primeiro dia", "Regras e horários", "Pessoas e contatos", "Ferramentas e sistemas", "Cultura e combinados"). Quando alguém explica o que a pessoa deve fazer, ponha em "expectativas" e em "acoes" com prazo. Não perca nenhuma instrução.`,
} as const;

export const analyzeMeeting = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    texto: z.string().min(1).max(60000), modo: z.enum(["reuniao", "grupo"]).default("reuniao"), hoje: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), diaSemana: z.string().max(20).default(""),
    euSou: z.string().max(60).default(""), titulo: z.string().max(160).default(""), tipo: z.enum(["reuniao", "entrevista", "treinamento", "livre"]).default("reuniao"),
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
- "resumo": a ata COMPLETA e detalhada, em parágrafos (8 a 15 frases, mais se a conversa for longa; nunca só 3 a 6). "topicos": os assuntos tratados, com pontos curtos. "decisoes": o que foi decidido (só decisões claras). "pendencias": dúvidas e itens em aberto que ninguém resolveu.
- "acoes": TODO compromisso de fazer algo, uma linha cada: "quem" (nome como aparece no texto), "oQue" (verbo no infinitivo, claro e completo), "prazo" (AAAA-MM-DD; converta "amanhã", "sexta", "dia 25" usando a data de hoje; vazio se não houver), "prioridade" (alta se for urgente/bloqueante; baixa se for opcional), "tipo" ("demanda" = trabalho de projeto/cliente; "lembrete" = lembrar de algo ou cobrar alguém; "tarefa" = coisa pessoal ou simples), "contexto" (trecho curto que prova) e "minha": true se for da pessoa que está usando o Orion${data.euSou ? ` (${data.euSou})` : ""}.
- "participantes": quem falou. "proxima": só se marcaram a próxima reunião/retorno (data AAAA-MM-DD, hora HH:MM, assunto).
${grupo ? "- MODO GRUPO: preencha \"grupos\" com um item por grupo: nome, resumo (o que rolou, 2 a 4 frases), destaques (avisos, decisões, problemas), pedidos (quem pediu o quê a quem). Pedidos que exijam ação também entram em \"acoes\". Ignore conversa social, figurinhas e mídia sem texto." : "- Se for uma conversa de WhatsApp, ignore cumprimentos e conversa social."}
${DETAIL}
${grupo ? "" : KIND_RULES[data.tipo]}
- "titulo": curto e específico${data.titulo ? ` (a pessoa chamou de "${data.titulo}")` : ""}. Nunca devolva dados de acesso, senhas ou chaves que apareçam no texto.`;
      const acao = { type: "object", properties: { quem: s, oQue: s, prazo: s, prioridade: { type: "string", enum: ["alta", "media", "baixa"] }, tipo: { type: "string", enum: ["demanda", "lembrete", "tarefa"] }, contexto: s, minha: { type: "boolean" } }, required: ["quem", "oQue", "tipo"] };
      const parameters = { type: "object", properties: {
        titulo: s, resumo: s, topicos: { type: "array", items: { type: "object", properties: { assunto: s, pontos: sa }, required: ["assunto"] } }, decisoes: sa, acoes: { type: "array", items: acao }, pendencias: sa, participantes: sa,
        proxima: { type: "object", properties: { data: s, hora: s, assunto: s } },
        fatos: { type: "array", items: { type: "object", properties: { rotulo: s, valor: s, confirmar: { type: "boolean" } }, required: ["rotulo", "valor"] } },
        secoes: { type: "array", items: { type: "object", properties: { titulo: s, itens: sa }, required: ["titulo", "itens"] } },
        expectativas: sa, lembrar: sa, perguntas: sa,
        grupos: { type: "array", items: { type: "object", properties: { nome: s, resumo: s, destaques: sa, pedidos: sa }, required: ["nome", "resumo"] } },
      }, required: ["titulo", "resumo"] };
      const res = await makeCreate()({
        model, instructions: system, input: [{ role: "user", content: data.texto }],
        tools: [{ type: "function", name: TOOL, description: "Devolve a ata detalhada, os fatos exatos e as ações.", parameters, strict: false }],
        tool_choice: { type: "function", name: TOOL }, max_output_tokens: 12000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === TOOL);
      const analise = call ? cleanAnalysis(JSON.parse(String(call["arguments"]))) : null;
      if (!analise) return { ok: false, error: "Não consegui tirar a ata desse texto. Confira se ele tem a conversa completa." };
      analise.tipo = grupo ? "reuniao" : data.tipo;
      if (data.titulo.trim()) analise.titulo = data.titulo.trim();
      return { ok: true, analise };
    } catch (error) {
      const { OpenAIError, explain } = await import("./mcp/openai");
      if (error instanceof OpenAIError) return { ok: false, error: explain(error, process.env["OPENAI_MODEL"] ?? "o modelo") };
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais. Tente com um trecho menor (ex.: só as últimas horas)." };
      return { ok: false, error: "Não consegui analisar agora. Tente de novo." };
    }
  });
