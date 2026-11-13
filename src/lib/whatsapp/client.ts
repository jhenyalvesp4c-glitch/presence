import { authHeaders } from "@/lib/auth-token";

export type WaStatus = {
  phase: "desligado" | "aguardando_qr" | "conectando" | "conectado" | "pausado"; qr: string | null; phone: string; name: string; since: number; paused: boolean;
  chats: number; messages: number; now: number;
};
export type WaMention = { id: string; chat: string; chat_name: string; is_group: boolean; sender_name: string; sender: string; ts: number; text: string; kind: string; mentions_me: boolean; reply_to_me: boolean };

export async function waGet<T>(r: string, params: Record<string, string> = {}): Promise<{ ok: true; data: T } | { ok: false; offline: boolean; erro: string }> {
  try {
    const q = new URLSearchParams({ r, ...params });
    const res = await fetch(`/api/whatsapp?${q}`, { headers: await authHeaders() });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) return { ok: false, offline: res.status === 503 || body["offline"] === true, erro: String(body["error"] ?? "erro") };
    return { ok: true, data: body as T };
  } catch (e) { return { ok: false, offline: true, erro: e instanceof Error ? e.message : "sem conexão" }; }
}
export async function waPost(r: string, params: Record<string, string> = {}): Promise<boolean> {
  try { const q = new URLSearchParams({ r, ...params }); const res = await fetch(`/api/whatsapp?${q}`, { method: "POST", headers: await authHeaders() }); return res.ok; } catch { return false; }
}

const get = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };
export const waPrefs = {
  alerts: () => get("presence.wa.avisos", "1") === "1", setAlerts: (v: boolean) => set("presence.wa.avisos", v ? "1" : "0"),
  voice: () => get("presence.wa.voz", "1") === "1", setVoice: (v: boolean) => set("presence.wa.voz", v ? "1" : "0"),
  cursor: () => Number(get("presence.wa.cursor", "0")) || 0, setCursor: (n: number) => set("presence.wa.cursor", String(n)),
};
