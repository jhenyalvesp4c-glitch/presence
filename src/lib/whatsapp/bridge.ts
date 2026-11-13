/** Servidor: fala com a ponte local do WhatsApp (whatsapp-bridge). Só existe no app instalado no computador da pessoa. */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const OFFLINE = "O WhatsApp só funciona no app do seu computador, com a ponte ligada (dê dois cliques em whatsapp.cmd).";
export type Result<T> = { ok: true; data: T } | { ok: false; erro: string; offline?: boolean };

async function info(): Promise<{ url: string; token: string } | { erro: string }> {
  const url = process.env["WHATSAPP_BRIDGE_URL"], token = process.env["WHATSAPP_BRIDGE_TOKEN"];
  if (url && token) return { url, token };
  const dir = process.env["PRESENCE_WHATSAPP_DIR"] ?? join(homedir(), ".presence", "whatsapp");
  try {
    const j = JSON.parse(await readFile(join(dir, "bridge.json"), "utf8")) as { port: number; token: string };
    return { url: `http://127.0.0.1:${j.port}`, token: j.token };
  } catch (e) { return { erro: `Não achei o arquivo da ponte em ${join(dir, "bridge.json")} (${e instanceof Error ? e.message : "erro"}). ${OFFLINE}` }; }
}

export async function bridge<T = Record<string, unknown>>(path: string, method: "GET" | "POST" = "GET"): Promise<Result<T>> {
  const i = await info();
  if ("erro" in i) return { ok: false, erro: i.erro, offline: true };
  try {
    const r = await fetch(`${i.url}${path}`, { method, headers: { "x-presence-token": i.token }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return { ok: false, erro: r.status === 401 ? "A ponte foi reiniciada. Recarregue a página." : `A ponte respondeu com erro ${r.status}.` };
    return { ok: true, data: (await r.json()) as T };
  } catch (e) {
    const cause = e instanceof Error ? `${e.message}${(e as { cause?: { code?: string } }).cause?.code ? ` / ${(e as { cause?: { code?: string } }).cause!.code}` : ""}` : "erro";
    return { ok: false, erro: `O app não conseguiu falar com a ponte em ${i.url} (${cause}). ${OFFLINE}`, offline: true };
  }
}

export type WaMsg = { id: string; chat: string; chat_name: string; is_group: boolean; sender: string; sender_name: string; from_me: boolean; ts: number; text: string; kind: string; mentions_me: boolean; reply_to_me: boolean };
export type WaChat = { jid: string; name: string; is_group: boolean; last_ts: number; novas: number };
