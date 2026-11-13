import { createClient } from "@supabase/supabase-js";

// Este app compartilha o projeto Supabase "presence" com o assistente virtual,
// mas todas as tabelas dele ficam no schema `presence_app` — nunca em `public`.
export const SUPABASE_SCHEMA = "presence_app";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (veja .env.example).");
}

export const SUPABASE_URL = url as string, SUPABASE_KEY = key as string;
const isBrowser = typeof window !== "undefined";

/** Contexto do pedido no servidor (preenchido por src/lib/server-auth.ts): cliente com o login de quem pediu e o dono dos dados. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Scope = { client: any; owner: string; uid: string };
const scope = (): Scope | undefined => (globalThis as { __presenceScope?: () => Scope | undefined }).__presenceScope?.();

const base = createClient(url, key, {
  db: { schema: SUPABASE_SCHEMA },
  auth: {
    // Chave própria no localStorage para não colidir com a sessão do assistente virtual.
    storageKey: "presence-app-auth",
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
  },
});

/** Cliente do app. No navegador usa a sessão da pessoa; no servidor, durante um pedido, usa o login que veio nele. */
export const supabase = new Proxy(base, {
  get(target, prop) {
    const t = (scope()?.client as typeof base | undefined) ?? target;
    const v = Reflect.get(t, prop) as unknown;
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(t) : v;
  },
}) as typeof base;

/** Cliente "cru" (sem escopo de pedido): usado só pela camada de autenticação. */
export const authClient = base;

/**
 * MODO TEMPORÁRIO SEM LOGIN: todos os dados pertencem a este dono fixo
 * (ver supabase/migrations/*_presence_app_single_user_mode.sql).
 * Ao reativar o login, troque pelo id do usuário autenticado.
 */
export const SINGLE_USER_ID = "00000000-0000-0000-0000-000000000001";

let clientOwner: string | undefined;
/** Define o dono dos dados da pessoa logada (chamado pelo login no navegador). */
export const setClientOwner = (id: string | undefined) => { clientOwner = id; };
/** Dono dos dados de quem está usando agora: no servidor vem do pedido, no navegador do login. Sem login = dono legado. */
export const ownerId = (): string => scope()?.owner ?? clientOwner ?? SINGLE_USER_ID;

/** Cliente para uso no servidor (sem sessão). O acesso é limitado pelo RLS do papel `anon`. */
export function createServerClient() {
  const sc = scope();
  if (sc) return sc.client as unknown as typeof base;
  return createClient(url, key, {
    db: { schema: SUPABASE_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type Demand = {
  id: string;
  title: string;
  description: string | null;
  source: "voz" | "texto" | "assistente";
  status: "nova" | "em_andamento" | "concluida";
  created_at: string;
};

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
