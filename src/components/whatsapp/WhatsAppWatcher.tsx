import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { useVoice } from "@/lib/voice/use-voice";
import { waGet, waPrefs, type WaMention, type WaStatus } from "@/lib/whatsapp/client";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);
const who = (m: WaMention) => m.sender_name || m.sender.split("@")[0] || "Alguém";
const where = (m: WaMention) => (m.is_group ? `no grupo ${m.chat_name || "sem nome"}` : "em conversa direta");

/** Avisa quando alguém marcar a pessoa (ou responder a ela) em um grupo do WhatsApp: aviso na tela, notificação e voz. */
export function WhatsAppWatcher() {
  const voice = useVoice();
  const announceRef = useRef(voice.announce); announceRef.current = voice.announce;
  const busy = useRef(false);
  const delay = useRef(20_000);
  const pending = useRef<WaMention[]>([]);
  const speaking = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    if (speaking.current) { timer.current = setTimeout(() => void flush(), 1000); return; }
    const list = pending.current.splice(0);
    if (!list.length || !waPrefs.voice()) return;
    const parts = list.slice(0, 4).map((m) => `${who(m)} ${m.reply_to_me && !m.mentions_me ? "respondeu a você" : "te marcou"} ${where(m)}${m.text ? `: ${clip(m.text, 160)}` : ""}`);
    speaking.current = true;
    try { await announceRef.current(`${parts.join(". ")}${list.length > 4 ? `. E mais ${list.length - 4}.` : "."}`); } catch { /* sem voz */ } finally { speaking.current = false; }
  }, []);

  const check = useCallback(async () => {
    if (busy.current || !waPrefs.alerts()) return;
    busy.current = true;
    try {
      const st = await waGet<WaStatus>("status");
      if (!st.ok) { delay.current = 60_000; return; }
      delay.current = 20_000;
      if (st.data.phase !== "conectado") return;
      const cursor = waPrefs.cursor();
      if (!cursor) { waPrefs.setCursor(st.data.now); return; } // primeira vez: não avisa o que já estava lá
      const r = await waGet<{ mentions: WaMention[]; now: number }>("mentions", { after: String(cursor) });
      if (!r.ok) return;
      const fresh = r.data.mentions;
      if (fresh.length) waPrefs.setCursor(Math.max(...fresh.map((m) => m.ts)));
      for (const m of fresh) {
        const title = `${who(m)} ${m.reply_to_me && !m.mentions_me ? "respondeu a você" : "te marcou"} ${where(m)}`;
        toast(title, { description: clip(m.text || `(${m.kind})`, 200), duration: 15_000 });
        if ("Notification" in window && Notification.permission === "granted") { try { new Notification(title, { body: clip(m.text || `(${m.kind})`, 200), tag: `wa-${m.chat}-${m.id}` }); } catch { /* sem notificação */ } }
      }
      if (fresh.length) {
        pending.current.push(...fresh);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), 2500); // junta o que chegou junto numa fala só
      }
    } finally { busy.current = false; }
  }, [flush]);

  useEffect(() => {
    let stop = false;
    const loop = async () => { while (!stop) { await check(); await new Promise((r) => setTimeout(r, delay.current)); } };
    void loop();
    return () => { stop = true; if (timer.current) clearTimeout(timer.current); };
  }, [check]);
  return null;
}
