import { createClient } from "@supabase/supabase-js";

// Este app compartilha o projeto Supabase "presence" com o assistente virtual,
// mas todas as tabelas dele ficam no schema `presence_app` — nunca em `public`.
export const SUPABASE_SCHEMA = "presence_app";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (veja .env.example).");
}

const isBrowser = typeof window !== "undefined";

/** Cliente do navegador: guarda a sessão da usuária. */
export const supabase = createClient(url, key, {
  db: { schema: SUPABASE_SCHEMA },
  auth: {
    // Chave própria no localStorage para não colidir com a sessão do assistente virtual.
    storageKey: "presence-app-auth",
    persistSession: isBrowser,
    autoRefreshToken: isBrowser,
  },
});

/**
 * MODO TEMPORÁRIO SEM LOGIN: todos os dados pertencem a este dono fixo
 * (ver supabase/migrations/*_presence_app_single_user_mode.sql).
 * Ao reativar o login, troque pelo id do usuário autenticado.
 */
export const SINGLE_USER_ID = "00000000-0000-0000-0000-000000000001";

/** Cliente para uso no servidor (sem sessão). O acesso é limitado pelo RLS do papel `anon`. */
export function createServerClient() {
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
