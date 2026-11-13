/** Servidor: descobre quem está pedindo (login do Supabase) e roda o pedido com o acesso dessa pessoa (RLS). */
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient } from "@supabase/supabase-js";

import { SUPABASE_KEY, SUPABASE_SCHEMA, SUPABASE_URL, SINGLE_USER_ID, type Scope } from "./supabase";

const als = new AsyncLocalStorage<Scope>();
(globalThis as { __presenceScope?: () => Scope | undefined }).__presenceScope = () => als.getStore();

/** Só para testes locais sem login (VITE_AUTH_DISABLED=1): tudo roda como a conta principal. Nunca defina isso em produção. */
export const authDisabled = (): boolean => (import.meta.env as Record<string, string | undefined>)["VITE_AUTH_DISABLED"] === "1";

const cache = new Map<string, { scope: Scope; at: number }>();
const TTL = 60_000;

export const bearer = (request: Request): string | null => {
  const h = request.headers.get("authorization");
  const m = h ? /^Bearer\s+(.+)$/i.exec(h) : null;
  return m ? m[1]!.trim() : null;
};

/** Valida o token no Supabase e descobre o dono dos dados. Devolve null se o login não vale ou a conta não foi liberada. */
export async function resolveScope(token: string | null): Promise<Scope | null> {
  if (!token) {
    if (!authDisabled()) return null;
    return { client: createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: SUPABASE_SCHEMA }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }), owner: SINGLE_USER_ID, uid: SINGLE_USER_ID };
  }
  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < TTL) return hit.scope;
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    db: { schema: SUPABASE_SCHEMA }, global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: u, error } = await client.auth.getUser(token);
  if (error || !u.user) return null;
  const { data: owner, error: e2 } = await client.rpc("owner_id");
  if (e2 || typeof owner !== "string") return null;
  const scope: Scope = { client, owner, uid: u.user.id };
  if (cache.size > 200) cache.clear();
  cache.set(token, { scope, at: Date.now() });
  return scope;
}

export const runWithScope = <T>(scope: Scope, fn: () => Promise<T>): Promise<T> => als.run(scope, fn);

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Para rotas de API: roda `fn` com o acesso de quem pediu, ou responde 401. */
export async function withUser(request: Request, fn: (scope: Scope) => Promise<Response>): Promise<Response> {
  const scope = await resolveScope(bearer(request));
  if (!scope) return json(401, { error: "Entre na sua conta para continuar." });
  return runWithScope(scope, () => fn(scope));
}
