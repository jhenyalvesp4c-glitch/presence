/**
 * Autenticação do endpoint MCP. O app está em modo sem login (um dono fixo), então o próprio endpoint
 * precisa de um segredo: sem `MCP_TOKEN` configurado o endpoint fica desligado (503), e com ele só entra
 * quem apresenta o token — no cabeçalho `Authorization: Bearer <token>` (clientes que permitem
 * cabeçalhos) ou no endereço `/api/mcp/<token>` (clientes que só aceitam uma URL, como o ChatGPT).
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const MIN_TOKEN_LENGTH = 24;

export type AuthResult = { ok: true } | { ok: false; status: 401 | 503; message: string };

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Compara sem vazar o tamanho nem o ponto onde os segredos diferem. */
export const sameSecret = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

export function authorize(headers: Pick<Headers, "get">, pathToken: string | undefined, env: Record<string, string | undefined>): AuthResult {
  const expected = env["MCP_TOKEN"]?.trim();
  if (!expected || expected.length < MIN_TOKEN_LENGTH) {
    return { ok: false, status: 503, message: `MCP desligado: defina MCP_TOKEN (mínimo ${MIN_TOKEN_LENGTH} caracteres) no ambiente do servidor.` };
  }
  const auth = headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim();
  const given = bearer ?? headers.get("x-mcp-token")?.trim() ?? pathToken;
  if (!given || !sameSecret(given, expected)) return { ok: false, status: 401, message: "Token inválido ou ausente." };
  return { ok: true };
}
