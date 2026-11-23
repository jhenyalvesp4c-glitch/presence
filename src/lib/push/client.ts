/** Avisos no celular (Web Push), lado do navegador: ligar/desligar neste aparelho e mandar um teste. */
import { authHeaders } from "../auth-token";
import { ownerId, supabase } from "../supabase";

export type PushState = { supported: boolean; permission: NotificationPermission | "unsupported"; subscribed: boolean; standalone: boolean; ios: boolean; prod: boolean };

const isIos = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

const toKey = (b64: string): Uint8Array => { const p = "=".repeat((4 - (b64.length % 4)) % 4), s = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
const b64 = (buf: ArrayBuffer | null): string => { if (!buf) return ""; let s = ""; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };

export async function pushState(): Promise<PushState> {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const prod = !!import.meta.env.PROD;
  const base = { ios: isIos(), standalone: isStandalone(), prod };
  if (!supported) return { supported: false, permission: "unsupported", subscribed: false, ...base };
  let subscribed = false;
  try { const reg = await navigator.serviceWorker.getRegistration(); subscribed = !!(await reg?.pushManager.getSubscription()); } catch { /* sem registro */ }
  return { supported: true, permission: Notification.permission, subscribed, ...base };
}

/** Pede permissão, cria a inscrição deste aparelho e guarda no banco. Devolve uma mensagem de erro, ou null se deu certo. */
export async function enablePush(): Promise<string | null> {
  try {
    if (Notification.permission === "denied") return "As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador e tente de novo.";
    const k = await fetch("/api/push/chave").then((r) => (r.ok ? r.json() : null)) as { key?: string } | null;
    if (!k?.key) return "Os avisos ainda não estão configurados no servidor.";
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (perm !== "granted") return "Sem a sua permissão não dá para avisar. Toque em “Permitir” quando o aparelho perguntar.";
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(k.key) as unknown as BufferSource }));
    const { error } = await supabase.from("push_subscriptions").upsert({ user_id: ownerId(), endpoint: sub.endpoint, p256dh: b64(sub.getKey("p256dh")), auth: b64(sub.getKey("auth")), user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: "user_id,endpoint" });
    if (error) return "Não consegui guardar este aparelho. Tente de novo.";
    return null;
  } catch (e) { return e instanceof Error ? e.message : "Não consegui ligar os avisos."; }
}

export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
  } catch { /* já estava desligado */ }
}

export async function sendTestPush(): Promise<{ enviados: number; aparelhos: number } | null> {
  try {
    const r = await fetch("/api/push/teste", { method: "POST", headers: await authHeaders() });
    return r.ok ? ((await r.json()) as { enviados: number; aparelhos: number }) : null;
  } catch { return null; }
}
