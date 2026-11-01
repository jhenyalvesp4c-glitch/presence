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
 * Cliente "em nome da usuária", para uso no servidor: toda query passa pelo RLS
 * com o token dela, então o servidor nunca enxerga dados de outra pessoa.
 */
export function createUserClient(accessToken: string) {
  return createClient(url, key, {
    db: { schema: SUPABASE_SCHEMA },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
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
