import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlarmClock, BellRing, Check, Clock, X } from "lucide-react";

import { supabase } from "@/lib/data/db";
import { dueReminders, hhmm, localDay, spokenReminder, type Due, type ReminderRow } from "@/lib/reminders";
import { useVoice } from "@/lib/voice/use-voice";

const SEEN = "presence.lembretes.avisados", SNOOZE = "presence.lembretes.adiados", ASKED = "presence.lembretes.perguntou";
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

/** Avisa os lembretes na hora marcada (com o app aberto): popup, notificação do sistema e voz. */
export function ReminderWatcher() {
  const voice = useVoice();
  const announceRef = useRef(voice.announce); announceRef.current = voice.announce;
  const [cards, setCards] = useState<Due[]>([]);
  const [askPerm, setAskPerm] = useState(false);
  const busy = useRef(false);

  const check = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const now = new Date();
      const y = new Date(now.getTime() - 86_400_000);
      const { data, error } = await supabase.from("tasks").select("id, title, due_date, due_time, done")
        .eq("kind", "lembrete").eq("done", false).not("due_time", "is", null).gte("due_date", localDay(y)).lte("due_date", localDay(now)).limit(100);
      if (error || !data) return;
      const seen = read<Record<string, string>>(SEEN, {}), snoozed = read<Record<string, number>>(SNOOZE, {});
      const due = dueReminders(data as ReminderRow[], now, seen, snoozed);
      if (!due.length) return;
      for (const d of due) { seen[d.id] = d.key; delete snoozed[d.id]; }
      write(SEEN, seen); write(SNOOZE, snoozed);
      setCards((c) => [...c.filter((x) => !due.some((d) => d.id === x.id)), ...due]);
      if ("Notification" in window && Notification.permission === "granted") {
        for (const d of due) { try { new Notification("Lembrete", { body: `${d.title}\n${hhmm(d.at)}`, tag: `lembrete-${d.id}`, requireInteraction: true }); } catch { /* sem notificação */ } }
      }
      announceRef.current(spokenReminder(due));
    } finally { busy.current = false; }
  }, []);

  useEffect(() => {
    void check();
    const t = setInterval(() => void check(), 20_000);
    const vis = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", vis); window.addEventListener("focus", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); window.removeEventListener("focus", vis); };
  }, [check]);

  useEffect(() => {
    try { if ("Notification" in window && Notification.permission === "default" && !localStorage.getItem(ASKED)) setAskPerm(true); } catch { /* sem notificação */ }
  }, []);

  const close = (id: string) => setCards((c) => c.filter((x) => x.id !== id));
  const done = async (d: Due) => { close(d.id); await supabase.from("tasks").update({ done: true, done_at: new Date().toISOString() }).eq("id", d.id); };
  const snooze = (d: Due, min: number) => { close(d.id); const s = read<Record<string, number>>(SNOOZE, {}); s[d.id] = Date.now() + min * 60_000; write(SNOOZE, s); };
  const enable = async () => { setAskPerm(false); write(ASKED, 1); try { await Notification.requestPermission(); } catch { /* sem notificação */ } };

  if (typeof document === "undefined" || (!cards.length && !askPerm)) return null;
  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[75] flex w-[min(92vw,22rem)] flex-col gap-3" data-testid="lembretes-avisos">
      {askPerm && (
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-[oklch(0.16_0.03_265/0.96)] p-4 shadow-[0_20px_60px_-24px_var(--violet)] backdrop-blur-xl" style={{ animation: "vp-in .45s ease both" }}>
          <p className="text-sm font-medium">Quer receber os lembretes como notificação?</p>
          <p className="mt-1 text-xs text-muted-foreground">Eles também aparecem aqui e a Presence fala na hora marcada.</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => void enable()} className="rounded-full bg-gradient-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground" data-testid="lembretes-ativar">Ativar</button>
            <button onClick={() => { setAskPerm(false); write(ASKED, 1); }} className="rounded-full border border-white/10 px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground">Agora não</button>
          </div>
        </div>
      )}
      {cards.map((d) => (
        <div key={d.id} role="alert" data-testid="lembrete-aviso" className="pointer-events-auto relative overflow-hidden rounded-2xl border border-white/10 bg-[oklch(0.16_0.03_265/0.96)] p-4 shadow-[0_20px_60px_-24px_oklch(0.82_0.15_75)] backdrop-blur-xl" style={{ animation: "vp-in .5s cubic-bezier(.2,.8,.2,1) both" }}>
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[oklch(0.82_0.15_75)]" />
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[oklch(0.82_0.15_75)] opacity-20 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[oklch(0.82_0.15_75/0.16)] text-[oklch(0.82_0.15_75)]">
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[oklch(0.82_0.15_75/0.25)]" style={{ animationDuration: "2s" }} />
              <BellRing size={18} className="relative" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mono-caps !text-[0.6rem] !text-[oklch(0.82_0.15_75)]">Lembrete · {hhmm(d.at)}</p>
              <p className="mt-0.5 break-words text-sm font-medium leading-snug">{d.title}</p>
            </div>
            <button onClick={() => close(d.id)} aria-label="Fechar aviso" className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
          </div>
          <div className="relative mt-3 flex flex-wrap gap-2">
            <button onClick={() => void done(d)} className="flex items-center gap-1.5 rounded-full bg-emerald/20 px-3.5 py-1.5 text-xs font-semibold text-emerald transition hover:bg-emerald/30" data-testid="lembrete-concluir"><Check size={13} /> Concluir</button>
            <button onClick={() => snooze(d, 10)} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-foreground/90 transition hover:border-cyan/50 hover:text-cyan" data-testid="lembrete-adiar"><Clock size={13} /> Adiar 10 min</button>
            <button onClick={() => snooze(d, 60)} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"><AlarmClock size={13} /> 1 hora</button>
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
