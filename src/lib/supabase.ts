import { createClient } from "@supabase/supabase-js";

// Este app compartilha o projeto Supabase "presence" com o assistente virtual,
// mas todas as tabelas dele ficam no schema `presence_app` — nunca em `public`.
export const SUPABASE_SCHEMA = "presence_app";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (veja .env.example).");
}

export const supabase = createClient(url, key, {
  db: { schema: SUPABASE_SCHEMA },
  auth: {
    // Chave própria no localStorage para não colidir com a sessão do assistente virtual.
    storageKey: "presence-app-auth",
  },
});
