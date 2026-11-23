/** Servidor dos avisos (Web Push): chaves VAPID (guardadas no banco, geradas na 1ª vez) e envio. Só roda no servidor. */
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

import { SUPABASE_KEY, SUPABASE_SCHEMA, SUPABASE_URL } from "../supabase";

export type PushPayload = { title: string; body: string; url: string; tag?: string };
export type Sub = { endpoint: string; p256dh: string; auth: string };
export type Vapid = { public: string; private: string };

export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

/** Cliente sem login (papel anon): só chama as funções `push_*`, que exigem o segredo da rotina. */
export const anonClient = () => createClient(SUPABASE_URL, SUPABASE_KEY, { db: { schema: SUPABASE_SCHEMA }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

/** Quem manda o aviso (vai para Google/Apple): um endereço genérico do app, sem dados pessoais. */
const subject = (): string => { const host = process.env["VERCEL_PROJECT_PRODUCTION_URL"] || process.env["VERCEL_URL"]; return host ? `https://${host}` : "https://orion.invalid"; };

/** Chave pública para o navegador assinar. Se ainda não existe par de chaves, cria e guarda no banco (a 1ª chamada ganha). */
export async function publicKey(db = anonClient()): Promise<string | null> {
  const got = await db.rpc("push_public_key");
  if (typeof got.data === "string" && got.data) return got.data;
  const k = webpush.generateVAPIDKeys();
  const set = await db.rpc("push_bootstrap", { p_public: k.publicKey, p_private: k.privateKey });
  return typeof set.data === "string" && set.data ? set.data : null;
}

/** `send` só muda nos testes. */
export async function sendOne(sub: Sub, payload: PushPayload, vapid: Vapid, send: typeof webpush.sendNotification = webpush.sendNotification): Promise<"ok" | "gone" | "erro"> {
  try {
    await send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      vapidDetails: { subject: subject(), publicKey: vapid.public, privateKey: vapid.private }, TTL: 3600, urgency: "high",
    });
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "erro";
  }
}
