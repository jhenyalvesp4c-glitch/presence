/** Organiza um passo a passo falado/escrito em tutorial. Não grava nada: devolve o rascunho para a usuária revisar. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Organized } from "./doc-organize";

const input = z.object({ text: z.string().trim().min(8, "Escreva ou fale um pouco mais.").max(12000), folder: z.string().max(120).optional() });
export type OrganizeResult = { ok: true; draft: Organized; via: "ia" | "simples"; note?: string } | { ok: false; error: string };

export const organizeTutorial = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<OrganizeResult> => {
    const { localOrganize, organizedSchema, SYSTEM, TOOL_NAME, toolSchema } = await import("./doc-organize");
    if (!process.env["OPENAI_API_KEY"]) return { ok: true, draft: localOrganize(data.text), via: "simples", note: "A IA ainda não está ligada neste servidor; organizei de forma simples. Revise os passos." };
    try {
      const { DEFAULT_MODEL } = await import("./mcp/interpret");
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL, create = makeCreate();
      const first = { role: "user", content: [{ type: "input_text", text: `${data.folder ? `Pasta: ${data.folder}\n` : ""}O que a pessoa explicou:\n"""\n${data.text}\n"""` }] };
      const retries: { role: "user"; content: { type: string; text: string }[] }[] = [];
      try {
        for (let round = 0; round < 3; round++) {
          const res = await create({ model, instructions: SYSTEM, input: [first, ...retries], tools: [{ type: "function", name: TOOL_NAME, description: "Devolve o tutorial organizado.", parameters: toolSchema(), strict: false }], tool_choice: { type: "function", name: TOOL_NAME }, max_output_tokens: 4000, reasoning: { effort: "low" }, store: false });
          const call = res.output.find((o) => o.type === "function_call" && o["name"] === TOOL_NAME);
          let problem = "";
          if (!call) problem = `Você não chamou a função ${TOOL_NAME}.`;
          else { let args: unknown; try { args = JSON.parse(String(call["arguments"])); } catch { problem = "Os argumentos não eram JSON válido."; } if (!problem) { const p = organizedSchema.safeParse(args); if (p.success) return { ok: true, draft: p.data, via: "ia" }; problem = `Formato inválido: ${p.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ")}.`; } }
          retries.push({ role: "user", content: [{ type: "input_text", text: `${problem} Corrija e chame a função ${TOOL_NAME} de novo.` }] });
        }
        return { ok: true, draft: localOrganize(data.text), via: "simples", note: "A IA não conseguiu organizar agora; organizei de forma simples. Revise os passos." };
      } catch (e) {
        if (e instanceof OpenAIError) return { ok: true, draft: localOrganize(data.text), via: "simples", note: `${explain(e, model)} Organizei de forma simples.` };
        throw e;
      }
    } catch (e) {
      return { ok: true, draft: localOrganize(data.text), via: "simples", note: `Não consegui usar a IA agora (${(e as Error).message}). Organizei de forma simples.` };
    }
  });
