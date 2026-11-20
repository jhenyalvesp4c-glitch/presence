/** Plano alimentar — IA: lê a ficha de dieta enviada (prints, PDF ou texto) e monta o plano completo para revisão. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { cleanDietPlan, type DietPlan } from "./diet-plan";

const file = z.object({ name: z.string().min(1).max(200), mime: z.string().min(1).max(100), size: z.number().int().min(0), data: z.string().max(4_000_000) });
export type DietImportResult = { ok: true; plano: DietPlan } | { ok: false; error: string };

const TOOL = "montar_dieta";
const SYSTEM = `Você lê a FICHA DE DIETA / plano alimentar que a pessoa enviou (prints, PDF ou texto) e monta o plano estruturado, chamando a função ${TOOL}. Copie fielmente o que está na ficha; NÃO invente alimentos, quantidades, metas ou regras que não estejam lá.
- "opcoes": cada esquema de refeições (ex.: "Opção A — 2 refeições", "Opção B — 3 refeições"); "recomendada" só se a ficha indicar. Cada refeição: nome, hora, itens (alimento, qtd como escrita, g se for em gramas, protG só se a ficha der proteína), objetivo e orientacoes.
- "proteina": min e max em g/dia. "perfil", "atencao", "estrategia" (prioridades), "tmb", "semMeta".
- "trocasProteina"/"trocasCarbo" (alimento, porcao) e notas, "frutas", "whey", "treinoNota", "hidratacao", "intestino", "aceitos", "rejeitados", "comparar" (o que registrar), "semanal", "revisar", "seguranca", "objetivoFinal".
- "grupos": cada grupo de substituição (nome, referencia calórica, itens alimento/porcao, nota). "trocas": tabela prática (se → escolha). "versaoPratica": refeição, principal, alternativas.
Leia o texto dentro das imagens com atenção. Português do Brasil. Nunca devolva dados de acesso.`;

export const importDiet = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ texto: z.string().max(60000).default(""), files: z.array(file).max(12).default([]) }).parse(d))
  .handler(async ({ data }): Promise<DietImportResult> => {
    if (!data.texto.trim() && !data.files.length) return { ok: false, error: "Cole o texto da ficha ou anexe os prints/PDF." };
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A leitura por IA ainda não está ligada (falta OPENAI_API_KEY no servidor). Enquanto isso, use a ficha de Recomposição pronta." };
    try {
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const { DEFAULT_MODEL, userContent } = await import("./mcp/interpret");
      void OpenAIError; void explain;
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      const s = { type: "string" }, n = { type: "number" }, sa = { type: "array", items: s };
      const par = (a: string, b: string) => ({ type: "array", items: { type: "object", properties: { [a]: s, [b]: s }, required: [a] } });
      const item = { type: "object", properties: { alimento: s, qtd: s, g: { type: ["number", "null"] }, protG: { type: ["number", "null"] } }, required: ["alimento"] };
      const refeicao = { type: "object", properties: { nome: s, hora: s, objetivo: s, orientacoes: sa, itens: { type: "array", items: item } }, required: ["nome", "itens"] };
      const opcao = { type: "object", properties: { id: s, nome: s, tag: s, recomendada: { type: "boolean" }, resumo: s, refeicoes: { type: "array", items: refeicao } }, required: ["nome", "refeicoes"] };
      const parameters = { type: "object", properties: {
        nome: s, objetivo: s, perfil: { type: "object", properties: { idade: { type: ["number", "null"] }, sexo: s, pesoKg: { type: ["number", "null"] }, alturaM: { type: ["number", "null"] }, imc: { type: ["number", "null"] }, treino: s, duracaoTreino: s, medicacao: s, preferencia: s, horarios: s, hidratacao: s } },
        atencao: s, estrategia: sa, proteina: { type: "object", properties: { min: { type: ["number", "null"] }, max: { type: ["number", "null"] }, nota: s } }, tmb: { type: ["number", "null"] }, semMeta: s,
        opcoes: { type: "array", items: opcao }, trocasProteina: par("alimento", "porcao"), trocasProteinaNota: s, trocasCarbo: par("alimento", "porcao"), trocasCarboNota: s, frutas: sa, frutasNota: s,
        whey: { type: "object", properties: { dose: s, notas: sa } }, treinoNota: sa, hidratacao: { type: "object", properties: { atualMl: { type: ["number", "null"] }, orientacoes: sa, estrategia: sa, aviso: s } },
        intestino: { type: "object", properties: { texto: s, estrategias: sa, aviso: s } }, aceitos: sa, rejeitados: sa, preferenciasNota: s, comparar: { type: "object", properties: { registrar: sa, nota: s } },
        semanal: sa, revisar: sa, seguranca: sa, objetivoFinal: s, grupos: { type: "array", items: { type: "object", properties: { id: s, nome: s, referencia: s, nota: s, destaque: s, itens: par("alimento", "porcao") }, required: ["nome"] } },
        trocas: par("se", "escolha"), trocasNota: s, versaoPratica: { type: "array", items: { type: "object", properties: { refeicao: s, principal: s, alternativas: s }, required: ["refeicao"] } },
      }, required: ["nome", "opcoes"] };
      void n;
      const res = await makeCreate()({
        model, instructions: SYSTEM, input: [{ role: "user", content: userContent(data.texto.trim() || "(a ficha está nos arquivos anexos)", data.files) }],
        tools: [{ type: "function", name: TOOL, description: "Devolve o plano alimentar estruturado.", parameters, strict: false }],
        tool_choice: { type: "function", name: TOOL }, max_output_tokens: 14000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === TOOL);
      if (!call) return { ok: false, error: "A IA não devolveu o plano. Tente de novo ou envie prints mais nítidos." };
      const plano = cleanDietPlan(JSON.parse(String(call["arguments"])));
      if (!plano) return { ok: false, error: "Não consegui achar as refeições nessa ficha. Envie as páginas com o cardápio." };
      return { ok: true, plano };
    } catch (error) {
      const { OpenAIError, explain } = await import("./mcp/openai");
      if (error instanceof OpenAIError) return { ok: false, error: explain(error, process.env["OPENAI_MODEL"] ?? "o modelo") };
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais. Envie menos páginas por vez." };
      return { ok: false, error: "Não consegui ler a ficha agora. Tente de novo." };
    }
  });

/* ───────────── "Conte o que você comeu": a IA monta as refeições e calcula os macros ───────────── */
import type { AiResult } from "./diet-ai";
export type MealsResult = { ok: true; resultado: AiResult } | { ok: false; error: string };
const MEALS_TOOL = "registrar_refeicoes";
const mySchema = z.object({ nome: z.string().max(80), kcal: z.number().min(0).max(2000), p: z.number().min(0).max(200), c: z.number().min(0).max(200), f: z.number().min(0).max(200), medidas: z.array(z.object({ nome: z.string().max(40), g: z.number().min(0).max(5000) })).max(8) });

export const interpretMeals = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ texto: z.string().min(1).max(4000), refeicoes: z.array(z.string().max(40)).max(12).default([]), padrao: z.string().max(40).default("Refeição"), meusAlimentos: z.array(mySchema).max(60).default([]) }).parse(d))
  .handler(async ({ data }): Promise<MealsResult> => {
    if (!data.texto.trim()) return { ok: false, error: "Conte o que você comeu." };
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A IA ainda não está ligada neste ambiente (falta OPENAI_API_KEY no servidor). Enquanto isso, use “Adicionar alimento”." };
    try {
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const { DEFAULT_MODEL } = await import("./mcp/interpret");
      const { cleanInterpretation, foodsPrompt } = await import("./diet-ai");
      void OpenAIError; void explain;
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      const s = { type: "string" }, n = { type: "number" };
      const system = `Você registra o que a pessoa COMEU e calcula calorias e macros, chamando a função ${MEALS_TOOL}. Português do Brasil.
Regras:
- Separe em refeições. Se ela disser a refeição ("no almoço", "de café"), use esse nome; se for uma das disponíveis (${data.refeicoes.join(", ") || "nenhuma"}), use exatamente o nome disponível. Se não disser, use "${data.padrao}". Não invente refeições.
- Um item por alimento. "qtd" é a quantidade como a pessoa disse ("3 col. sopa", "20 g"). "gramas" é a conversão para gramas.
- Converta medidas caseiras em gramas pela base abaixo (colher de sopa de arroz = 25 g etc.). Quando a medida não estiver na base, estime e marque "estimado": true. Interprete "1 frango de 20g" como frango, 20 g.
- Calcule kcal, proteína (p), carboidrato (c) e gordura (f) em gramas pela quantidade, usando a base por 100 g. Alimento fora da base: use valores nutricionais típicos e marque "estimado": true. Alimentos marcados [MEU] são cadastrados pela pessoa: prefira-os.
- Não faça perguntas. Se algo for ambíguo, assuma o mais comum, marque "estimado": true e explique em "aviso" em uma frase. Nunca devolva dados de acesso.
BASE (por 100 g, preparado):\n${foodsPrompt(data.meusAlimentos)}`;
      const item = { type: "object", properties: { nome: s, qtd: s, gramas: n, kcal: n, p: n, c: n, f: n, estimado: { type: "boolean" } }, required: ["nome", "qtd", "kcal", "p", "c", "f"] };
      const parameters = { type: "object", properties: { refeicoes: { type: "array", items: { type: "object", properties: { refeicao: s, itens: { type: "array", items: item } }, required: ["refeicao", "itens"] } }, aviso: s }, required: ["refeicoes"] };
      const res = await makeCreate()({
        model, instructions: system, input: [{ role: "user", content: data.texto.trim() }],
        tools: [{ type: "function", name: MEALS_TOOL, description: "Devolve as refeições e os alimentos com macros calculados.", parameters, strict: false }],
        tool_choice: { type: "function", name: MEALS_TOOL }, max_output_tokens: 4000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === MEALS_TOOL);
      const resultado = call ? cleanInterpretation(JSON.parse(String(call["arguments"]))) : null;
      if (!resultado) return { ok: false, error: "Não consegui entender o que você comeu. Escreva com quantidades (ex.: 3 colheres de arroz, 150 g de frango)." };
      return { ok: true, resultado };
    } catch (error) {
      const { OpenAIError, explain } = await import("./mcp/openai");
      if (error instanceof OpenAIError) return { ok: false, error: explain(error, process.env["OPENAI_MODEL"] ?? "o modelo") };
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais. Tente de novo com menos itens." };
      return { ok: false, error: "Não consegui calcular agora. Tente de novo." };
    }
  });
