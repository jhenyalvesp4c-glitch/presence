/** Lê prints, PDFs e textos anexados ao segundo cérebro (OpenAI) para a pesquisa achar o conteúdo depois. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const file = z.object({ name: z.string().min(1).max(200), mime: z.string().min(1).max(100), data: z.string().max(4_200_000) });
const input = z.object({ files: z.array(file).min(1).max(8) });
export type SummarizeResult = { ok: true; text: string; note?: string } | { ok: false; error: string };

const PROMPT = `Você ajuda a montar um "segundo cérebro". Para cada arquivo enviado, escreva em português do Brasil:
1) o texto relevante que aparece nele (transcreva fielmente números, nomes, datas, mensagens de erro), e
2) uma frase dizendo o que é.
Seja objetivo e completo o bastante para que uma busca por palavras ache este conteúdo depois. Não invente nada que não esteja no arquivo. Separe arquivos diferentes com uma linha "## nome-do-arquivo".`;

export const summarizeFiles = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<SummarizeResult> => {
    if (!process.env["OPENAI_API_KEY"]) return { ok: true, text: "", note: "O conteúdo dos arquivos não foi lido (falta OPENAI_API_KEY no servidor); só os nomes entram na busca." };
    try {
      const { userContent } = await import("./mcp/interpret");
      const { DEFAULT_MODEL } = await import("./mcp/interpret");
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      try {
        const msg = await makeCreate()({
          model, instructions: PROMPT,
          input: [{ role: "user", content: userContent("Leia os arquivos acima.", data.files) }],
          max_output_tokens: 3000, reasoning: { effort: "low" }, store: false,
        });
        const out: string[] = [];
        for (const b of msg.output) if (b.type === "message") for (const c of (b["content"] as { type: string; text?: string }[] | undefined) ?? []) if (c.type === "output_text" && c.text) out.push(c.text);
        return { ok: true, text: out.join("\n").trim().slice(0, 18000) };
      } catch (e) {
        if (e instanceof OpenAIError) return { ok: true, text: "", note: `${explain(e, model)} Os arquivos foram guardados, mas o conteúdo deles não entra na busca.` };
        throw e;
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
