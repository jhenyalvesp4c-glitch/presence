import { authHeaders } from "@/lib/auth-token";

export type WaStatus = {
  phase: "desligado" | "aguardando_qr" | "conectando" | "conectado" | "pausado"; qr: string | null; phone: string; name: string; since: number; paused: boolean;
  chats: number; messages: number; now: number; erro?: string;
};
export type WaMessage = Omit<WaMention, "mentions_me" | "reply_to_me"> & { from_me: boolean; mentions_me: boolean; reply_to_me: boolean };
export type WaMention = { id: string; chat: string; chat_name: string; is_group: boolean; sender_name: string; sender: string; ts: number; text: string; kind: string; mentions_me: boolean; reply_to_me: boolean };

const get = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };

/* ───── Acesso direto do navegador à ponte (127.0.0.1) ───── */
const isLocalPage = () => typeof location !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1");
/** Só tenta a ponte direto se a página é local ou se a pessoa pediu (assim o navegador não pergunta nada sem necessidade). */
export const directEnabled = () => isLocalPage() || get("presence.wa.ativo", "0") === "1";
export const enableDirect = () => set("presence.wa.ativo", "1");
const base = () => `http://127.0.0.1:${Number(get("presence.wa.porta", "3939")) || 3939}`;
let token: string | null = null;

type Out<T> = { ok: true; data: T } | { ok: false; erro: string; offline: boolean };
export async function bridgeDirect<T = unknown>(path: string, method: "GET" | "POST" = "GET"): Promise<Out<T>> {
  if (!directEnabled()) return { ok: false, erro: "acesso direto desligado", offline: true };
  try {
    if (!token) {
      const r = await fetch(`${base()}/parear`, { mode: "cors", signal: AbortSignal.timeout(3000) });
      if (!r.ok) return { ok: false, erro: `a ponte recusou este site (${r.status})`, offline: true };
      token = ((await r.json()) as { token?: string }).token ?? null;
      if (!token) return { ok: false, erro: "a ponte não entregou a senha", offline: true };
    }
    const res = await fetch(`${base()}${path}`, { method, headers: { "x-presence-token": token }, mode: "cors", signal: AbortSignal.timeout(7000) });
    if (res.status === 401) { token = null; return { ok: false, erro: "a ponte foi reiniciada, tente de novo", offline: true }; }
    if (!res.ok) return { ok: false, erro: `a ponte respondeu ${res.status}`, offline: false };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) { return { ok: false, erro: `não alcancei a ponte em ${base()} (${e instanceof Error ? e.message : "erro"})`, offline: true }; }
}

/** Consulta a ponte: primeiro direto do navegador; se não der, pelo servidor do app (app local). */
export async function waGet<T>(r: string, params: Record<string, string> = {}): Promise<Out<T>> {
  const q = new URLSearchParams(params).toString();
  const d = await bridgeDirect<T>(`/${r}${q ? `?${q}` : ""}`);
  if (d.ok) return d;
  try {
    const sp = new URLSearchParams({ r, ...params });
    const res = await fetch(`/api/whatsapp?${sp}`, { headers: await authHeaders() });
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok || !body) return { ok: false, offline: true, erro: `${d.erro}. Pelo servidor: ${!body ? `o app respondeu ${res.status} sem dados` : `${res.status}: ${String(body["error"] ?? "erro")}`}` };
    return { ok: true, data: body as T };
  } catch (e) { return { ok: false, offline: true, erro: `${d.erro}. ${e instanceof Error ? e.message : ""}` }; }
}
export async function waPost(r: string, params: Record<string, string> = {}): Promise<boolean> {
  const q = new URLSearchParams(params).toString();
  const d = await bridgeDirect(`/${r}${q ? `?${q}` : ""}`, "POST");
  if (d.ok) return true;
  try { const sp = new URLSearchParams({ r, ...params }); const res = await fetch(`/api/whatsapp?${sp}`, { method: "POST", headers: await authHeaders() }); return res.ok; } catch { return false; }
}
/** Para as ferramentas de voz executadas no navegador. */
export const clientFetcher = async (path: string, method: "GET" | "POST" = "GET") => {
  const r = await bridgeDirect(path, method);
  return r.ok ? ({ ok: true, data: r.data } as const) : ({ ok: false, erro: `${r.erro}. Ligue a ponte (whatsapp.cmd) e libere o acesso em Configurações → WhatsApp.`, offline: true } as const);
};

export const waPrefs = {
  alerts: () => get("presence.wa.avisos", "1") === "1", setAlerts: (v: boolean) => set("presence.wa.avisos", v ? "1" : "0"),
  voice: () => get("presence.wa.voz", "1") === "1", setVoice: (v: boolean) => set("presence.wa.voz", v ? "1" : "0"),
  names: () => get("presence.wa.avisar.nome", "1") === "1", setNames: (v: boolean) => set("presence.wa.avisar.nome", v ? "1" : "0"),
  crm: () => get("presence.wa.avisar.crm", "1") === "1", setCrm: (v: boolean) => set("presence.wa.avisar.crm", v ? "1" : "0"),
  /** Listas de palavras (uma por linha ou separadas por vírgula). Vazio = usa o padrão. */
  list: (k: "nomes" | "crm" | "ignorar") => get(`presence.wa.lista.${k}`, ""), setList: (k: "nomes" | "crm" | "ignorar", v: string) => set(`presence.wa.lista.${k}`, v),
  cursor: () => Number(get("presence.wa.cursor", "0")) || 0, setCursor: (n: number) => set("presence.wa.cursor", String(n)),
};
