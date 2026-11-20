/** Programa de treino — IA: lê a ficha que a pessoa envia (prints, PDF ou texto) e monta o programa completo para revisão. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { cleanProgram, type Program } from "./program";

const file = z.object({ name: z.string().min(1).max(200), mime: z.string().min(1).max(100), size: z.number().int().min(0), data: z.string().max(4_000_000) });
export type ImportResult = { ok: true; programa: Program } | { ok: false; error: string };

const TOOL = "montar_programa";
const SYSTEM = `Você lê a FICHA DE TREINO que a pessoa enviou (prints, PDF ou texto) e monta o programa estruturado, chamando a função ${TOOL}. Copie fielmente o que está na ficha; NÃO invente exercícios, cargas, séries ou regras que não estejam lá.
- "dias": um item por dia da semana citado (dia: 0=domingo, 1=segunda … 6=sábado). Dia de descanso: tipo "descanso" e exercicios vazio. Dia só de cardio/abdômen: tipo "cardio" (mas liste os exercícios).
- Cada exercício: nome, grupo muscular, series, repsMin e repsMax (para "10–12" use 10 e 12; para um número só, os dois iguais), repsNota ("por perna", "por lado"), descansoS (segundos), equip ("maquina" | "halter" | "polia" | "livre" | "corpo"), tipo ("forca" para musculação; "cardio" para esteira/bicicleta; "tempo" para prancha e similares, com "prescricao" como está escrita, ex.: "2 × 15–25 s"), rir (ex.: "3–4"), incrementoKg (o menor aumento de carga que a ficha indicar; senão 2,5 para máquina e 1 para halter/polia), instrucoes (a orientação de execução da ficha) e cargaInicial só se a ficha der um número de carga ATUAL (se disser "a aferir", deixe vazio).
- "aquecimento" por dia, "cardio" do dia, "nota" e "meta" quando a ficha trouxer.
- "fases": a tabela de semanas (semana, objetivo, orientacao). "regras": a tabela de progressão de carga (situacao → acao). "incrementos", "rirEscala" (rir → significado) e "rirNota". "cargaInicial": o protocolo para achar as cargas. "acompanhamento": como será o acompanhamento. "medidas": o que medir. "metas": metas do ciclo. "orientacoes" e "observacoes": avisos e recomendações da ficha.
- "perfil": pesoKg, alturaM (em metros), frequencia e duracao se constarem. "semanas": duração do programa. "objetivos": lista.
Leia o texto dentro das imagens com atenção. Português do Brasil. Nunca devolva dados de acesso.`;

export const importProgram = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ texto: z.string().max(60000).default(""), files: z.array(file).max(12).default([]) }).parse(d))
  .handler(async ({ data }): Promise<ImportResult> => {
    if (!data.texto.trim() && !data.files.length) return { ok: false, error: "Cole o texto da ficha ou anexe os prints/PDF." };
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A leitura por IA ainda não está ligada (falta OPENAI_API_KEY no servidor). Enquanto isso, use a ficha de Recomposição pronta." };
    try {
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const { DEFAULT_MODEL, userContent } = await import("./mcp/interpret");
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      const s = { type: "string" }, n = { type: "number" };
      const exercicio = { type: "object", properties: { nome: s, grupo: s, tipo: { type: "string", enum: ["forca", "cardio", "tempo"] }, series: n, repsMin: n, repsMax: n, repsNota: s, descansoS: n, prescricao: s, rir: s, equip: { type: "string", enum: ["maquina", "halter", "polia", "livre", "corpo"] }, incrementoKg: n, instrucoes: s, cargaInicial: { type: ["number", "null"] } }, required: ["nome", "tipo", "series"] };
      const dia = { type: "object", properties: { dia: n, titulo: s, foco: s, tipo: { type: "string", enum: ["forca", "cardio", "descanso"] }, aquecimento: { type: "array", items: s }, cardio: s, nota: s, meta: s, exercicios: { type: "array", items: exercicio } }, required: ["dia", "titulo", "tipo", "exercicios"] };
      const par = (a: string, b: string) => ({ type: "array", items: { type: "object", properties: { [a]: s, [b]: s }, required: [a, b] } });
      const parameters = { type: "object", properties: {
        nome: s, objetivos: { type: "array", items: s }, semanas: n, perfil: { type: "object", properties: { pesoKg: { type: ["number", "null"] }, alturaM: { type: ["number", "null"] }, frequencia: s, duracao: s } }, estrategia: s,
        dias: { type: "array", items: dia }, fases: { type: "array", items: { type: "object", properties: { semana: n, objetivo: s, orientacao: s }, required: ["semana", "objetivo"] } }, regras: par("situacao", "acao"),
        incrementos: { type: "array", items: s }, rirEscala: { type: "array", items: { type: "object", properties: { rir: n, significado: s }, required: ["rir", "significado"] } }, rirNota: s, cargaInicial: { type: "array", items: s },
        acompanhamento: { type: "array", items: s }, medidas: { type: "array", items: s }, metas: { type: "array", items: s }, orientacoes: { type: "array", items: s }, observacoes: { type: "array", items: s },
      }, required: ["nome", "dias"] };
      const res = await makeCreate()({
        model, instructions: SYSTEM, input: [{ role: "user", content: userContent(data.texto.trim() || "(a ficha está nos arquivos anexos)", data.files) }],
        tools: [{ type: "function", name: TOOL, description: "Devolve o programa de treino estruturado.", parameters, strict: false }],
        tool_choice: { type: "function", name: TOOL }, max_output_tokens: 12000, reasoning: { effort: "low" }, store: false,
      });
      const call = res.output.find((o) => o.type === "function_call" && o["name"] === TOOL);
      if (!call) return { ok: false, error: "A IA não devolveu o programa. Tente de novo ou envie prints mais nítidos." };
      const programa = cleanProgram(JSON.parse(String(call["arguments"])));
      if (!programa) return { ok: false, error: "Não consegui achar os dias de treino nessa ficha. Envie as páginas com os exercícios." };
      return { ok: true, programa };
    } catch (error) {
      const { OpenAIError, explain } = await import("./mcp/openai");
      if (error instanceof OpenAIError) return { ok: false, error: explain(error, process.env["OPENAI_MODEL"] ?? "o modelo") };
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais. Envie menos páginas por vez." };
      return { ok: false, error: "Não consegui ler a ficha agora. Tente de novo." };
    }
  });
