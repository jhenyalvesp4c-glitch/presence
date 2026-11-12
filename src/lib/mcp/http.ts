/** Camada HTTP do endpoint MCP (usada pelas rotas /api/mcp e /api/mcp/<token>). */
import { authorize } from "./auth";
import { handleBody } from "./protocol";
import { toolSet } from "./tools";

const MAX_BODY_BYTES = 8 * 1024 * 1024;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 240;
const hits = new Map<string, number[]>();

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type, accept, mcp-protocol-version, mcp-session-id, x-mcp-token",
  "access-control-max-age": "86400",
};
const baseHeaders = { ...CORS, "cache-control": "no-store", "x-content-type-options": "nosniff" };

const reply = (status: number, body: unknown, extra: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...baseHeaders, ...(body === null ? {} : { "content-type": "application/json" }), ...extra } });

/** Limite simples por origem (por instância do servidor): contém abuso e laços de um cliente com defeito. */
export function rateLimited(key: string, now = Date.now()): boolean {
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 500) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return list.length > MAX_PER_WINDOW;
}

export async function handleMcpRequest(request: Request, pathToken?: string): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: baseHeaders });

  const auth = authorize(request.headers, pathToken, process.env);
  if (!auth.ok) return reply(auth.status, { jsonrpc: "2.0", id: null, error: { code: -32001, message: auth.message } }, auth.status === 401 ? { "www-authenticate": 'Bearer realm="presence-mcp"' } : {});

  if (request.method !== "POST") return reply(405, { jsonrpc: "2.0", id: null, error: { code: -32000, message: "Use POST (servidor MCP sem sessão e sem stream)." } }, { allow: "POST, OPTIONS" });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(ip)) return reply(429, { jsonrpc: "2.0", id: null, error: { code: -32002, message: "Muitas requisições. Tente de novo em instantes." } }, { "retry-after": "30" });

  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_BODY_BYTES) return reply(413, { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Mensagem grande demais (máx. 8 MB)." } });

  let body: unknown;
  try { body = await request.json(); } catch { return reply(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido." } }); }

  const client = (request.headers.get("user-agent") ?? "cliente MCP").slice(0, 120);
  try {
    const out = await handleBody(body, toolSet, { client });
    return reply(out.status, out.body);
  } catch (e) {
    console.error("[mcp] erro:", e instanceof Error ? e.message : e);
    return reply(500, { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Erro interno." } });
  }
}
