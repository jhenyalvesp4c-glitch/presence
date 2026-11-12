/**
 * Cliente mínimo da API Responses da OpenAI (HTTP direto, sem dependência nova).
 * Variáveis: OPENAI_API_KEY (obrigatória), OPENAI_MODEL (opcional) e OPENAI_BASE_URL (opcional, para testes).
 */
import type { Create, Message } from "./interpret";

export class OpenAIError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

const TIMEOUT_MS = 55_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const baseUrl = (env: Record<string, string | undefined> = process.env) => (env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/+$/, "");

async function post(env: Record<string, string | undefined>, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${baseUrl(env)}/responses`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env["OPENAI_API_KEY"] ?? ""}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

async function fail(res: Response): Promise<never> {
  let code = "", message = `HTTP ${res.status}`;
  try { const j = (await res.json()) as { error?: { code?: string; type?: string; message?: string } }; code = j.error?.code ?? j.error?.type ?? ""; message = j.error?.message ?? message; } catch { /* corpo não era JSON */ }
  throw new OpenAIError(res.status, code, message);
}

/** Uma chamada. Tenta de novo (1x) em 429/5xx e, se o modelo não aceitar `reasoning`, sem esse parâmetro. */
export function makeCreate(env: Record<string, string | undefined> = process.env): Create {
  return async (params) => {
    let body = params;
    let res = await post(env, body);
    if (res.status === 429 || res.status >= 500) { await sleep(1500); res = await post(env, body); }
    if (res.status === 400 && "reasoning" in body) {
      const peek = await res.clone().text();
      if (/reasoning/i.test(peek)) { const { reasoning: _r, ...rest } = body; body = rest; res = await post(env, body); }
    }
    if (!res.ok) return fail(res);
    return (await res.json()) as Message;
  };
}

/** Mensagem em português para cada tipo de falha. */
export function explain(e: OpenAIError, model: string): string {
  if (e.status === 401) return "A chave da OpenAI (OPENAI_API_KEY) é inválida.";
  if (e.status === 429) return e.code === "insufficient_quota" ? "A conta da OpenAI está sem créditos." : "Muitas solicitações seguidas. Tente de novo em instantes.";
  if (e.status === 404 || e.code === "model_not_found") return `O modelo "${model}" não está disponível nesta conta. Defina OPENAI_MODEL com um modelo que ela possa usar.`;
  if (e.status === 400) return `A OpenAI recusou o pedido: ${e.message.slice(0, 200)}`;
  return "A IA está indisponível agora. Tente novamente.";
}

/** Extensão que a API de transcrição reconhece a partir do tipo do áudio gravado no navegador. */
export const audioExt = (mime: string) => (/mp4|m4a|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : /wav/.test(mime) ? "wav" : /mpeg|mp3/.test(mime) ? "mp3" : "webm");
export const DEFAULT_TRANSCRIBE_MODEL = "whisper-1";

/** Áudio → texto (pt-BR) pela API de transcrição da OpenAI. */
export async function transcribe(bytes: Uint8Array, mime: string, env: Record<string, string | undefined> = process.env): Promise<string> {
  const model = env["OPENAI_TRANSCRIBE_MODEL"]?.trim() || DEFAULT_TRANSCRIBE_MODEL;
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mime.split(";")[0] || "audio/webm" }), `audio.${audioExt(mime)}`);
  form.append("model", model);
  form.append("language", "pt");
  form.append("response_format", "json");
  form.append("prompt", "Anotações em português do Brasil sobre disparos em massa, polos, dossiês, demandas, CRM, templates e treinamentos.");
  const res = await fetch(`${baseUrl(env)}/audio/transcriptions`, {
    method: "POST", headers: { authorization: `Bearer ${env["OPENAI_API_KEY"] ?? ""}` }, body: form, signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return fail(res);
  const j = (await res.json()) as { text?: string };
  return (j.text ?? "").trim();
}
