/** Transcrição de áudio gravado no navegador (OpenAI). Usada pelo Orion para perguntar e documentar por voz. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** ~3 MB de áudio (≈ 4 MB em base64): cabe no limite de corpo da Vercel (4,5 MB). */
export const MAX_AUDIO_B64 = 4_200_000;
const input = z.object({ data: z.string().min(100, "Áudio vazio.").max(MAX_AUDIO_B64, "Áudio longo demais. Grave um trecho menor."), mime: z.string().min(3).max(80) });

export type TranscribeResult = { ok: true; text: string } | { ok: false; error: string };

export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<TranscribeResult> => {
    if (!process.env["OPENAI_API_KEY"]) return { ok: false, error: "A transcrição por voz ainda não está ligada (falta OPENAI_API_KEY no servidor). Digite o texto." };
    try {
      const { transcribe, OpenAIError } = await import("./mcp/openai");
      const bytes = new Uint8Array(Buffer.from(data.data, "base64"));
      const text = await transcribe(bytes, data.mime).catch((e) => {
        if (e instanceof OpenAIError) {
          if (e.status === 401) throw new Error("A chave da OpenAI (OPENAI_API_KEY) é inválida.");
          if (e.status === 429) throw new Error(e.code === "insufficient_quota" ? "A conta da OpenAI está sem créditos." : "Muitas solicitações seguidas. Tente de novo em instantes.");
          if (e.status === 404 || e.code === "model_not_found") throw new Error("O modelo de transcrição não está disponível nesta conta. Defina OPENAI_TRANSCRIBE_MODEL.");
          throw new Error(`A OpenAI não conseguiu ler o áudio: ${e.message.slice(0, 160)}`);
        }
        throw e;
      });
      if (!text) return { ok: false, error: "Não consegui ouvir nada nesse áudio. Tente falar mais perto do microfone." };
      return { ok: true, text };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  });
