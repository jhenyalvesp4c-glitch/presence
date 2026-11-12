/** Cria um roteiro de treinamento com IA (OpenAI) a partir do texto e dos arquivos enviados. Não grava nada: devolve o rascunho. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Draft } from "./training-ai";

const file = z.object({ name: z.string().min(1).max(200), mime: z.string().min(1).max(100), data: z.string().max(4_200_000) });
const input = z.object({
  brief: z.string().trim().min(10, "Conte um pouco mais sobre o que o treinamento precisa ensinar.").max(12000),
  title: z.string().max(120).optional(), audience: z.string().max(120).optional(),
  files: z.array(file).max(8).refine((l) => l.reduce((n, f) => n + f.data.length, 0) <= 4_200_000, "Arquivos grandes demais (máx. ~3 MB no total)."),
});

export type GenerateResult = { ok: true; draft: Draft } | { ok: false; error: string };

export const generateTrainingScript = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<GenerateResult> => {
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A criação por IA ainda não está ligada (falta OPENAI_API_KEY no servidor)." };
    try {
      const { SYSTEM, TOOL_NAME, briefContent, draftSchema, toolSchema } = await import("./training-ai");
      const { DEFAULT_MODEL } = await import("./mcp/interpret");
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      const create = makeCreate();
      const first = { role: "user", content: briefContent(data.brief, data.files, { ...(data.title ? { title: data.title } : {}), ...(data.audience ? { audience: data.audience } : {}) }) };
      const retries: { role: "user"; content: { type: string; text: string }[] }[] = [];
      try {
        for (let round = 0; round < 3; round++) {
          const res = await create({
            model, instructions: SYSTEM, input: [first, ...retries],
            tools: [{ type: "function", name: TOOL_NAME, description: "Devolve o roteiro de treinamento organizado em blocos.", parameters: toolSchema(), strict: false }],
            tool_choice: { type: "function", name: TOOL_NAME }, max_output_tokens: 14000, reasoning: { effort: "low" }, store: false,
          });
          if (res.status === "incomplete") return { ok: false, error: "O conteúdo é grande demais para montar de uma vez. Envie menos arquivos ou divida em dois roteiros." };
          const call = res.output.find((o) => o.type === "function_call" && o["name"] === TOOL_NAME);
          let problem = "";
          if (!call) problem = `Você não chamou a função ${TOOL_NAME}.`;
          else {
            let args: unknown;
            try { args = JSON.parse(String(call["arguments"])); } catch { problem = "Os argumentos não eram JSON válido."; }
            if (!problem) {
              const parsed = draftSchema.safeParse(args);
              if (parsed.success) return { ok: true, draft: parsed.data };
              problem = `Formato inválido: ${parsed.error.issues.slice(0, 6).map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ")}.`;
            }
          }
          retries.push({ role: "user", content: [{ type: "input_text", text: `${problem} Corrija e chame a função ${TOOL_NAME} de novo.` }] });
        }
        return { ok: false, error: "A IA não conseguiu montar o roteiro. Tente de novo contando com mais detalhes." };
      } catch (e) {
        if (e instanceof OpenAIError) return { ok: false, error: explain(e, model) };
        throw e;
      }
    } catch (e) {
      return { ok: false, error: `Não consegui montar o roteiro agora: ${(e as Error).message}` };
    }
  });
