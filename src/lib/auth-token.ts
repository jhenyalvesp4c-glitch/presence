import { authClient } from "./supabase";

/** Token de acesso da pessoa logada (para o servidor saber quem pediu). */
export async function accessToken(): Promise<string | null> {
  try { const { data } = await authClient.auth.getSession(); return data.session?.access_token ?? null; } catch { return null; }
}

/** Cabeçalho de autorização para fetch das rotas /api. */
export async function authHeaders(): Promise<Record<string, string>> {
  const t = await accessToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}
