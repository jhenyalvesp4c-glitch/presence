/** Proteções simples das rotas de voz (mesma origem + limite por IP), já que o app não tem login. */
import { rateLimited } from "../mcp/http";

export function guard(request: Request, bucket: string): Response | null {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (origin) { try { if (new URL(origin).host !== host) return new Response(JSON.stringify({ error: "Origem não permitida." }), { status: 403, headers: { "content-type": "application/json" } }); } catch { return new Response("{}", { status: 403 }); } }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(`${bucket}:${ip}`)) return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um instante." }), { status: 429, headers: { "content-type": "application/json", "retry-after": "20" } });
  return null;
}
