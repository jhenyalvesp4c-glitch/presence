import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, BookPlus, CalendarDays, Check, FileText, Loader2, MessageSquare, Mic, Paperclip, Search, Send, Sparkles, Trash2, X } from "lucide-react";

import { addEntry, deleteEntry, listEntries, todayIso, type BrainEntry } from "@/lib/data/brain";
import { orionAsk, type AskResult } from "@/lib/orion.functions";
import { transcribeAudio } from "@/lib/audio.functions";
import { summarizeFiles } from "@/lib/brain.functions";
import { MAX_PENDING, filesFromClipboard, sizeLabel, toPending, type Pending } from "@/lib/brain-files";
import { MAX_SECONDS, useRecorder } from "@/lib/use-recorder";
import { KIND_LABEL, type OrionKind } from "@/lib/orion";

type Mode = "ask" | "doc";
type Answer = Extract<AskResult, { ok: true }> & { question: string };

const KIND_COLOR: Record<OrionKind, string> = { registro: "violet", documentacao: "amber", demanda: "cyan", tarefa: "amber", nota: "emerald", conversa: "pink", treinamento: "emerald" };
const SUGGEST = ["O que eu documentei hoje?", "Teve alguma falha nos disparos este mês?", "O que aconteceu na semana passada?", "Quais demandas estão em andamento?"];

const br = (iso: string) => iso.split("-").reverse().join("/");
const tint = (v: string) => ({ "--glow": `var(--${v})` }) as React.CSSProperties;

/** Orion: pergunta e documenta. Usado na caixa flutuante (todas as páginas) e na Documentação. */
export function OrionPanel({ autoFocus = false, className = "", onDocumented }: { autoFocus?: boolean; className?: string; onDocumented?: () => void }) {
  const [mode, setMode] = useState<Mode>("ask");
  const [text, setText] = useState("");
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<BrainEntry[]>([]);
  const area = useRef<HTMLTextAreaElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [stage, setStage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const recorder = useRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const recording = recorder.state === "recording";

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

  const addFiles = async (list: File[]) => {
    if (!list.length) return;
    setMode("doc"); setError("");
    try {
      const { added, rejected } = await toPending(list, pending);
      if (added.length) setPending((p) => [...p, ...added]);
      if (rejected.length) setError(rejected.join(" · "));
    } catch (e) { setError((e as Error).message); }
  };
  const dropPending = (key: string) => setPending((p) => p.filter((x) => x.key !== key));

  const document_ = async () => {
    if ((!text.trim() && !pending.length) || busy) return;
    setBusy(true); setError("");
    try {
      // Lê o conteúdo dos anexos (print, PDF, texto) para a busca achar depois.
      let summary = "";
      const textual = pending.filter((p) => p.ai?.mime === "text/plain").map((p) => `## ${p.name}\n${new TextDecoder().decode(Uint8Array.from(atob(p.ai!.data), (c) => c.charCodeAt(0)))}`);
      const visual = pending.filter((p) => p.ai && p.ai.mime !== "text/plain").map((p) => ({ name: p.name, mime: p.ai!.mime, data: p.ai!.data }));
      if (visual.length) {
        setStage("Lendo os arquivos…");
        const r = await summarizeFiles({ data: { files: visual } });
        if (r.ok) { summary = r.text; if (r.note) toast.message(r.note); } else toast.error(r.error);
      }
      summary = [...textual, summary].filter(Boolean).join("\n\n");
      setStage(pending.length ? "Guardando os arquivos…" : "");
      const e = await addEntry({ text, date: date || todayIso(), summary, files: pending.map((p) => ({ name: p.name, mime: p.mime, blob: p.blob })) });
      setText(""); setDate(todayIso()); setPending([]);
      toast.success(e.dossiers.length ? `Documentado · ${e.dossiers.join(", ")}` : "Documentado no Orion");
      refresh(); onDocumented?.();
    } catch (e) { setError((e as Error).message); }
    setStage(""); setBusy(false);
  };

  const startVoice = async () => {
    setError("");
    try { await recorder.start(); } catch (e) { setError((e as Error).message); }
  };
  const finishVoice = async () => {
    const audio = await recorder.stop();
    if (!audio) return;
    setTranscribing(true);
    try {
      const r = await transcribeAudio({ data: audio });
      if (r.ok) { setText((t) => (t.trim() ? `${t.trim()} ${r.text}` : r.text)); setTimeout(() => area.current?.focus(), 50); }
      else setError(r.error);
    } catch (e) { setError((e as Error).message); }
    setTranscribing(false);
  };
  useEffect(() => { if (recording && recorder.seconds >= MAX_SECONDS) void finishVoice(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [recorder.seconds, recording]);

  const submit = () => (mode === "ask" ? ask() : document_());
  const remove = async (id: string) => {
    if (!window.confirm("Apagar esta anotação do Orion?")) return;
    try { await deleteEntry(id); refresh(); } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className={`relative space-y-3 ${className}`} data-testid="orion"
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDragOver(false); void addFiles([...e.dataTransfer.files]); } }}>
      <input ref={fileInput} type="file" multiple hidden data-testid="orion-arquivo" onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ""; }} />
      {dragOver && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-cyan bg-background/80 text-sm text-cyan backdrop-blur-sm"><span className="flex items-center gap-2"><Paperclip size={16} /> Solte para anexar ao Orion</span></div>}
      <div className="inline-flex rounded-2xl border border-border bg-secondary/40 p-1" role="tablist">
        {([["ask", "Perguntar", Search], ["doc", "Documentar", BookPlus]] as const).map(([k, l, I]) => (
          <button key={k} role="tab" aria-selected={mode === k} data-testid={`orion-${k}`} onClick={() => { setMode(k); setError(""); }}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${mode === k ? "bg-gradient-brand text-primary-foreground shadow-[0_0_18px_-6px_var(--violet)]" : "text-muted-foreground hover:text-foreground"}`}>
            <I size={13} /> {l}
          </button>
        ))}
      </div>

      <div className="relative rounded-2xl border border-violet/40 bg-[linear-gradient(100deg,color-mix(in_oklab,var(--violet)_14%,transparent),color-mix(in_oklab,var(--cyan)_8%,transparent))] p-2 shadow-[0_0_40px_-16px_var(--violet)] transition focus-within:shadow-[0_0_46px_-10px_var(--violet)]">
        {recording ? (
          <div className="flex items-center gap-3 px-2 py-1" data-testid="orion-gravando">
            <span className="relative grid h-9 w-9 shrink-0 place-items-center"><span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" /><span className="relative h-3 w-3 rounded-full bg-destructive" /></span>
            <span className="flex h-6 flex-1 items-center gap-[3px]" aria-hidden>
              {Array.from({ length: 28 }).map((_, i) => <span key={i} className="w-[3px] rounded-full bg-gradient-to-t from-cyan to-violet" style={{ height: `${30 + ((i * 37) % 70)}%`, animation: `orion-wave 1s ease-in-out ${(i % 7) * 0.12}s infinite alternate` }} />)}
            </span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground" data-testid="orion-tempo">{Math.floor(recorder.seconds / 60)}:{String(recorder.seconds % 60).padStart(2, "0")}</span>
            <button onClick={recorder.cancel} aria-label="Cancelar gravação" data-testid="orion-cancelar-audio" className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-destructive/60 hover:text-destructive"><X size={15} /></button>
            <button onClick={finishVoice} aria-label="Parar e transcrever" data-testid="orion-parar-audio" className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-brand text-primary-foreground transition hover:scale-105"><Check size={16} /></button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <span className="mb-1.5 ml-1 grid h-8 w-8 shrink-0 place-items-center"><Sparkles size={18} className="text-cyan" /></span>
            <textarea ref={area} rows={1} value={text} onChange={(e) => setText(e.target.value)} data-testid="orion-texto" disabled={transcribing}
              onPaste={(e) => { const f = filesFromClipboard(e); if (f.length) { e.preventDefault(); void addFiles(f); } }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
              placeholder={transcribing ? "Transcrevendo o áudio…" : mode === "ask" ? "Pergunte ao Orion… ex: teve falha no disparo de Maceió?" : "Documente algo… cole um print (Ctrl+V), anexe arquivos ou escreva. Ex: disparo em Niterói deu erro de pagamento"}
              className="min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
            {mode === "doc" && (
              <button onClick={() => fileInput.current?.click()} disabled={busy} data-testid="orion-anexar" aria-label="Anexar arquivo ou imagem" title="Anexar arquivo, print ou imagem (ou cole com Ctrl+V)"
                className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition enabled:hover:border-cyan/60 enabled:hover:text-cyan disabled:opacity-40"><Paperclip size={16} /></button>
            )}
            {recorder.supported && (
              <button onClick={startVoice} disabled={busy || transcribing} data-testid="orion-gravar" aria-label="Gravar áudio" title="Gravar áudio"
                className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-muted-foreground transition enabled:hover:border-violet/60 enabled:hover:text-violet disabled:opacity-40">
                {transcribing ? <Loader2 size={15} className="animate-spin" /> : <Mic size={16} />}
              </button>
            )}
            <button onClick={submit} disabled={busy || transcribing || (mode === "ask" ? text.trim().length < 2 : !text.trim() && !pending.length)} data-testid="orion-enviar" aria-label={mode === "ask" ? "Perguntar" : "Documentar"}
              className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-brand text-primary-foreground transition enabled:hover:scale-105 disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : mode === "ask" ? <Send size={15} /> : <BookPlus size={15} />}
            </button>
          </div>
        )}
        {mode === "doc" && (
          <div className="mt-1 flex items-center gap-2 px-1.5 pb-0.5 text-[0.68rem] text-muted-foreground">
            <CalendarDays size={12} /> Data do acontecimento:
            <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} data-testid="orion-data"
              className="rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[0.7rem] text-foreground outline-none focus:border-violet/60" />
            {date !== todayIso() && <button onClick={() => setDate(todayIso())} className="text-cyan hover:underline">hoje</button>}
          </div>
        )}
      </div>

      {mode === "doc" && pending.length > 0 && (
        <ul className="flex flex-wrap gap-2" data-testid="orion-anexos">
          {pending.map((p) => (
            <li key={p.key} className="group/f relative flex max-w-full items-center gap-2 rounded-xl border border-border bg-secondary/40 p-1.5 pr-7 transition hover:border-cyan/50">
              {p.preview ? <img src={p.preview} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="icon-tile h-9 w-9 shrink-0 !rounded-lg"><FileText size={15} /></span>}
              <span className="min-w-0"><span className="block max-w-40 truncate text-[0.7rem]">{p.name}</span><span className="text-[0.6rem] text-muted-foreground">{sizeLabel(p.size)}{p.ai ? "" : " · sem leitura por IA"}</span></span>
              <button onClick={() => dropPending(p.key)} aria-label={`Remover ${p.name}`} className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-destructive"><X size={12} /></button>
            </li>
          ))}
          {pending.length < MAX_PENDING && <li><button onClick={() => fileInput.current?.click()} className="grid h-12 place-items-center rounded-xl border border-dashed border-border px-3 text-[0.65rem] text-muted-foreground transition hover:border-cyan/50 hover:text-cyan">+ anexar</button></li>}
        </ul>
      )}

      {mode === "ask" && !answer && !busy && !error && (
        <div className="flex flex-wrap gap-2">
          {SUGGEST.map((s) => <button key={s} onClick={() => ask(s)} className="tag transition hover:shadow-[0_0_14px_-4px_var(--glow)]" style={tint("violet")}>{s}</button>)}
        </div>
      )}

      {busy && mode === "doc" && stage && <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground" data-testid="orion-etapa"><Loader2 size={12} className="animate-spin text-cyan" /> {stage}</p>}
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
                <span className="mt-1 block whitespace-pre-wrap break-words text-xs leading-snug">{r.text || r.title || "(só arquivos)"}</span>
                {r.attachments.length > 0 && <span className="mt-1 flex items-center gap-1 text-[0.65rem] text-cyan"><Paperclip size={10} /> {r.attachments.length} arquivo{r.attachments.length > 1 ? "s" : ""}</span>}
                <button onClick={() => remove(r.id)} aria-label="Apagar anotação" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-lg border border-border bg-background/80 text-muted-foreground opacity-0 transition hover:border-destructive/60 hover:text-destructive focus:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"><Trash2 size={12} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
