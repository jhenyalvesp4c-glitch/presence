import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, BookPlus, CalendarDays, Loader2, MessageSquare, Search, Send, Sparkles, Trash2 } from "lucide-react";

import { addEntry, deleteEntry, listEntries, todayIso, type BrainEntry } from "@/lib/data/brain";
import { orionAsk, type AskResult } from "@/lib/orion.functions";
import { KIND_LABEL, type OrionKind } from "@/lib/orion";

type Mode = "ask" | "doc";
type Answer = Extract<AskResult, { ok: true }> & { question: string };

const KIND_COLOR: Record<OrionKind, string> = { registro: "violet", demanda: "cyan", tarefa: "amber", nota: "emerald", conversa: "pink", treinamento: "emerald" };
const SUGGEST = ["O que eu documentei hoje?", "Teve alguma falha nos disparos este mês?", "O que aconteceu na semana passada?", "Quais demandas estão em andamento?"];

const br = (iso: string) => iso.split("-").reverse().join("/");
const tint = (v: string) => ({ "--glow": `var(--${v})` }) as React.CSSProperties;

/** Orion: pergunta e documenta. Usado na caixa flutuante (todas as páginas) e na Documentação. */
export function OrionPanel({ autoFocus = false, className = "" }: { autoFocus?: boolean; className?: string }) {
  const [mode, setMode] = useState<Mode>("ask");
  const [text, setText] = useState("");
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<BrainEntry[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(() => { listEntries(6).then(setRecent).catch(() => undefined); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (autoFocus) area.current?.focus(); }, [autoFocus, mode]);
  useEffect(() => {
    const el = area.current; if (!el) return;
    el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const ask = async (q = text) => {
    const question = q.trim();
    if (question.length < 2 || busy) return;
    setMode("ask"); setText(q); setBusy(true); setError(""); setAnswer(null);
    try {
      const r = await orionAsk({ data: { question } });
      if (r.ok) setAnswer({ ...r, question }); else setError(r.error);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const document_ = async () => {
    if (!text.trim() || busy) return;
    setBusy(true); setError("");
    try {
      const e = await addEntry(text, date || todayIso());
      setText(""); setDate(todayIso());
      toast.success(e.dossiers.length ? `Documentado · ${e.dossiers.join(", ")}` : "Documentado no Orion");
      refresh();
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  const submit = () => (mode === "ask" ? ask() : document_());
  const remove = async (id: string) => {
    if (!window.confirm("Apagar esta anotação do Orion?")) return;
    try { await deleteEntry(id); refresh(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className={`space-y-3 ${className}`} data-testid="orion">
      <div className="inline-flex rounded-2xl border border-border bg-secondary/40 p-1" role="tablist">
        {([["ask", "Perguntar", Search], ["doc", "Documentar", BookPlus]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={mode === k} data-testid={`orion-${k}`} onClick={() => { setMode(k); setError(""); }}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${mode === k ? "bg-gradient-brand text-primary-foreground shadow-[0_0_18px_-6px_var(--violet)]" : "text-muted-foreground hover:text-foreground"}`}>
            <I size={13} /> {l}
          </button>
        ))}
      </div>

      <div className="relative rounded-2xl border border-violet/40 bg-[linear-gradient(100deg,color-mix(in_oklab,var(--violet)_14%,transparent),color-mix(in_oklab,var(--cyan)_8%,transparent))] p-2 shadow-[0_0_40px_-16px_var(--violet)] transition focus-within:shadow-[0_0_46px_-10px_var(--violet)]">
        <div className="flex items-end gap-2">
          <span className="mb-1.5 ml-1 grid h-8 w-8 shrink-0 place-items-center"><Sparkles size={18} className="text-cyan" /></span>
          <textarea ref={area} rows={1} value={text} onChange={(e) => setText(e.target.value)} data-testid="orion-texto"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
            placeholder={mode === "ask" ? "Pergunte ao Orion… ex: teve falha no disparo de Maceió?" : "Documente algo… ex: disparo em Niterói deu erro de pagamento no cartão"}
            className="min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
          <button onClick={submit} disabled={busy || text.trim().length < 2} data-testid="orion-enviar" aria-label={mode === "ask" ? "Perguntar" : "Documentar"}
            className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-brand text-primary-foreground transition enabled:hover:scale-105 disabled:opacity-40">
            {busy ? <Loader2 size={15} className="animate-spin" /> : mode === "ask" ? <Send size={15} /> : <BookPlus size={15} />}
          </button>
        </div>
        {mode === "doc" && (
          <div className="mt-1 flex items-center gap-2 px-1.5 pb-0.5 text-[0.68rem] text-muted-foreground">
            <CalendarDays size={12} /> Data do acontecimento:
            <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} data-testid="orion-data"
              className="rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[0.7rem] text-foreground outline-none focus:border-violet/60" />
            {date !== todayIso() && <button onClick={() => setDate(todayIso())} className="text-cyan hover:underline">hoje</button>}
          </div>
        )}
      </div>

      {mode === "ask" && !answer && !busy && !error && (
        <div className="flex flex-wrap gap-2">
          {SUGGEST.map((s) => <button key={s} onClick={() => ask(s)} className="tag transition hover:shadow-[0_0_14px_-4px_var(--glow)]" style={tint("violet")}>{s}</button>)}
        </div>
      )}

      {busy && mode === "ask" && (
        <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground" data-testid="orion-pensando">
          {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-cyan" style={{ animationDelay: `${i * 0.2}s` }} />)}
          Vasculhando anotações, demandas, tarefas e conversas…
        </div>
      )}
      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      {answer && mode === "ask" && (
        <div className="glass relative overflow-hidden rounded-2xl p-4 animate-rise" style={tint("violet")} data-testid="orion-resposta">
          <p className="mono-caps">Orion · “{answer.question}”{answer.period ? ` · ${answer.period}` : ""}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed" data-testid="orion-texto-resposta">{answer.answer}</p>
          {answer.sources.length > 0 && (
            <>
              <p className="mono-caps mt-4">{answer.sources.length} fonte{answer.sources.length > 1 ? "s" : ""}</p>
              <ul className="mt-2 space-y-2">
                {answer.sources.map((s) => (
                  <li key={s.id}>
                    <a href={s.link} className="group block rounded-xl border border-border bg-secondary/30 p-2.5 transition hover:border-[color-mix(in_oklab,var(--glow)_55%,transparent)]" style={tint(KIND_COLOR[s.kind])}>
                      <span className="flex items-center gap-2 text-[0.65rem] text-muted-foreground">
                        <span className="font-mono text-[var(--glow)]">[{s.n}]</span>
                        <span className="tag !px-1.5 !py-0 !text-[0.55rem]">{KIND_LABEL[s.kind]}</span>
                        {s.date && <span>{br(s.date)}</span>}
                        {s.where && <span className="min-w-0 truncate">· {s.where}</span>}
                        <ArrowUpRight size={11} className="ml-auto shrink-0 opacity-0 transition group-hover:opacity-100" />
                      </span>
                      <span className="mt-1 block text-xs font-medium leading-snug">{s.title}</span>
                      {s.snippet && s.snippet !== s.title && <span className="mt-0.5 block break-words text-[0.7rem] leading-snug text-muted-foreground">{s.snippet}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {mode === "doc" && recent.length > 0 && (
        <div data-testid="orion-recentes">
          <p className="mono-caps mb-2">Documentado recentemente</p>
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id} className="group relative rounded-xl border border-border bg-secondary/30 p-2.5 pr-9">
                <span className="flex items-center gap-2 text-[0.65rem] text-muted-foreground"><MessageSquare size={10} /> {br(r.date)}{r.dossiers.length > 0 && <span className="min-w-0 truncate text-violet">· {r.dossiers.join(", ")}</span>}</span>
                <span className="mt-1 block whitespace-pre-wrap break-words text-xs leading-snug">{r.text}</span>
                <button onClick={() => remove(r.id)} aria-label="Apagar anotação" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-lg border border-border bg-background/80 text-muted-foreground opacity-0 transition hover:border-destructive/60 hover:text-destructive focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"><Trash2 size={12} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
