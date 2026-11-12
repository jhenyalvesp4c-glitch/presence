import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { toast } from "sonner";
import {
  ArrowRight, Check, CircleHelp, Copy, ExternalLink, FileText, Inbox, Loader2, Mic, Paperclip, Plus, RotateCcw, Sparkles, Undo2, Upload, X,
} from "lucide-react";
import { DESTINOS, itemsToMarkdown, newKey, type InboxItem } from "@/lib/inbox";
import { distributeInbox, inboxContext, interpretInbox, undoInbox, validateInbox, type CheckResult, type DistributeResult, type InboxContext, type InterpretResult } from "@/lib/inbox.functions";
import type { Tipo } from "@/lib/mcp/records";
import { readFiles, sizeLabel, type LocalFile } from "./files";
import { RecordCard } from "./RecordCard";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const EMPTY_CHECK: CheckResult = { problems: [], warnings: [], perItem: [], general: [] };
const STEPS = ["Lendo o conteúdo enviado", "Identificando projeto, polo e dossiê", "Classificando cada informação", "Conferindo datas e duplicidades"];

type Phase = "idle" | "processing" | "review" | "done";

/**
 * Central de entrada da tela inicial: a usuária cola texto, prints e documentos (ou dita); a Presence interpreta,
 * mostra cada registro em um cartão por destino para revisar/editar/remover e só distribui depois de confirmar.
 */
export function InboxPanel({ incoming, onClose, onListen, listening, interim }: {
  incoming: { id: number; text: string } | null; onClose: () => void; onListen: () => void; listening: boolean; interim: string;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [meta, setMeta] = useState<{ resumo: string; duvidas: string[]; pendencias: string[]; source: "ia" | "manual" }>({ resumo: "", duvidas: [], pendencias: [], source: "ia" });
  const [check, setCheck] = useState<CheckResult>(EMPTY_CHECK);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Extract<DistributeResult, { ok: true }> | null>(null);
  const [undone, setUndone] = useState(false);
  const [ctx, setCtx] = useState<InboxContext | null>(null);
  const [over, setOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const reqId = useRef(0);

  useEffect(() => { inboxContext().then(setCtx).catch(() => undefined); }, []);
  useEffect(() => { textRef.current?.focus(); }, []);

  const addFiles = useCallback(async (list: File[]) => {
    if (!list.length) return;
    const { added, rejected } = await readFiles(list, files);
    if (added.length) setFiles((f) => [...f, ...added.filter((a) => !f.some((x) => x.name === a.name))]);
    rejected.forEach((r) => toast.error(r));
  }, [files]);

  const interpret = useCallback(async (override?: string) => {
    const t = (override ?? text).trim();
    if (!t && !files.length) { toast.error("Escreva, cole ou anexe algo para interpretar."); return; }
    setPhase("processing"); setStep(0); setResult(null); setUndone(false);
    const id = ++reqId.current;
    try {
      const res: InterpretResult = await interpretInbox({ data: { text: t, files: files.map(({ name, mime, size, data }) => ({ name, mime, size, data })) } });
      if (id !== reqId.current) return;
      if (!res.ok) { toast.error(res.error); setPhase("idle"); return; }
      setItems(res.itens); setCheck(res.check);
      setMeta({ resumo: res.resumo, duvidas: res.duvidas, pendencias: res.pendencias, source: res.source });
      setPhase("review");
    } catch (e) {
      if (id !== reqId.current) return;
      toast.error(e instanceof Error ? e.message : "Não consegui interpretar agora.");
      setPhase("idle");
    }
  }, [text, files]);

  // Texto ditado pela tela inicial: entra no campo e já interpreta.
  const lastIncoming = useRef(0);
  useEffect(() => {
    if (!incoming || incoming.id === lastIncoming.current) return;
    lastIncoming.current = incoming.id;
    setText((t) => (t.trim() ? `${t.trim()}\n${incoming.text}` : incoming.text));
    void interpret(`${text.trim() ? `${text.trim()}\n` : ""}${incoming.text}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  useEffect(() => {
    if (phase !== "processing") return;
    const t = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2200);
    return () => window.clearInterval(t);
  }, [phase]);

  // Revalida (destino real, campos, duplicidade) depois que a usuária edita os cartões.
  useEffect(() => {
    if (phase !== "review" || !items.length) return;
    setChecking(true);
    const id = ++reqId.current;
    const t = window.setTimeout(() => {
      validateInbox({ data: { itens: items } }).then((c) => { if (id === reqId.current) { setCheck(c); setChecking(false); } }).catch(() => { if (id === reqId.current) setChecking(false); });
    }, 700);
    return () => window.clearTimeout(t);
  }, [items, phase]);

  const update = (key: string, next: InboxItem | null) => setItems((l) => (next ? l.map((i) => (i.key === key ? next : i)) : l.filter((i) => i.key !== key)));
  const addManual = (tipo: Tipo) => { setItems((l) => [...l, { key: newKey(), registro: { tipo } }]); if (phase !== "review") setPhase("review"); };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await distributeInbox({ data: { itens: items, files: files.map(({ name, mime, size, data }) => ({ name, mime, size, data })) } });
      if (!res.ok) { toast.error(res.error); if (res.check) setCheck(res.check); return; }
      setResult(res); setPhase("done");
      toast.success(`${res.criados.length} registro${res.criados.length === 1 ? "" : "s"} distribuído${res.criados.length === 1 ? "" : "s"}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não consegui distribuir agora."); } finally { setBusy(false); }
  };

  const undo = async () => {
    if (!result) return;
    setBusy(true);
    try { const r = await undoInbox({ data: { operacaoId: result.operacaoId } }); if (r.ok) { setUndone(true); toast.success("Distribuição desfeita"); } else toast.error(r.message); }
    finally { setBusy(false); }
  };

  const reset = () => { setText(""); setFiles([]); setItems([]); setCheck(EMPTY_CHECK); setResult(null); setUndone(false); setPhase("idle"); setMeta({ resumo: "", duvidas: [], pendencias: [], source: "ia" }); };

  const copy = () => {
    const md = itemsToMarkdown(items, { project: (id) => ctx?.projects.find((p) => p.id === id)?.nome ?? id });
    navigator.clipboard?.writeText(`${meta.resumo ? `${meta.resumo}\n\n` : ""}${md}`).then(() => toast.success("Registros copiados")).catch(() => toast.error("Não consegui copiar"));
  };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void addFiles(Array.from(e.dataTransfer.files)); };
  const pending = check.problems.length;
  const dupIgnored = items.filter((_, i) => check.perItem[i]?.duplicado && !items[i]?.duplicadoOk).length;
  const doubts = useMemo(() => [...meta.duvidas, ...meta.pendencias, ...check.general], [meta, check.general]);
  const grouped = DESTINOS.map((d) => ({ d, list: items.map((it, i) => ({ it, i })).filter((x) => x.it.registro.tipo === d.tipo) })).filter((g) => g.list.length);
  const readyCount = items.length - dupIgnored;

  return (
    <section className="glass relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl p-5 animate-rise" style={tint("cyan")} data-testid="central-entrada"
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
      onPaste={(e) => { const fs = Array.from(e.clipboardData?.files ?? []); if (fs.length) { e.preventDefault(); void addFiles(fs); toast.success(fs.length === 1 ? "Print colado" : `${fs.length} arquivos colados`); } }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(60%_100%_at_30%_0%,color-mix(in_oklab,var(--cyan)_16%,transparent),transparent)]" />
      <header className="relative flex items-center gap-3">
        <span className="icon-tile h-10 w-10 !rounded-2xl"><Inbox size={18} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">Central de entrada</h2>
          <p className="text-xs text-muted-foreground">Cole ou envie textos, prints, PDFs e documentos. A Presence interpreta e leva cada informação ao lugar certo, depois da sua revisão.</p>
        </div>
        <button onClick={onClose} aria-label="Fechar central de entrada" className="rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"><X size={18} /></button>
      </header>

      {over && <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-2xl border-2 border-dashed border-cyan bg-background/70 text-sm text-cyan backdrop-blur-sm"><span className="flex items-center gap-2"><Upload size={18} /> Solte os arquivos aqui</span></div>}

      {/* ENTRADA */}
      {(phase === "idle" || phase === "processing") && (
        <div className="relative mt-4 space-y-3">
          <textarea ref={textRef} value={text} onChange={(e) => setText(e.target.value)} rows={5} disabled={phase === "processing"} data-testid="entrada-texto"
            placeholder="Cole aqui uma mensagem, uma conversa, um e-mail… ou escreva o que precisa ser registrado. Ctrl+V também cola prints."
            className="w-full resize-y rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-cyan/60 disabled:opacity-60" />
          {listening && <p className="text-xs text-emerald">Ouvindo… {interim}</p>}

          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2" data-testid="anexos">
              {files.map((f) => (
                <li key={f.name} className="group flex items-center gap-2 rounded-xl border border-border bg-secondary/30 p-1.5 pr-2 text-xs">
                  {f.preview ? <img src={f.preview} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground"><FileText size={15} /></span>}
                  <span className="max-w-[160px] truncate">{f.name}<span className="block text-[0.6rem] text-muted-foreground">{sizeLabel(f.size)}</span></span>
                  <button onClick={() => setFiles((l) => l.filter((x) => x.name !== f.name))} aria-label={`Remover ${f.name}`} disabled={phase === "processing"} className="rounded-md p-1 text-muted-foreground hover:text-destructive"><X size={12} /></button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInput} type="file" multiple hidden aria-label="Escolher arquivos" accept="image/*,.pdf,.txt,.md,.csv,.json,text/*,.xlsx,.xlsm,.docx,.pptx"
              onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={phase === "processing"} className="glass flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition hover:shadow-[0_0_20px_-8px_var(--cyan)]"><Paperclip size={15} className="text-cyan" /> Anexar arquivo</button>
            <button type="button" onClick={onListen} disabled={phase === "processing"} className={`glass flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition ${listening ? "text-emerald" : ""}`}><Mic size={15} className={listening ? "animate-pulse-ring" : "text-violet"} /> {listening ? "Ouvindo…" : "Ditar"}</button>
            <span className="text-[0.68rem] text-muted-foreground">Imagens, PDF, TXT/CSV, Excel, Word e PowerPoint · até ~3 MB no total</span>
            <button type="button" onClick={() => void interpret()} disabled={phase === "processing" || (!text.trim() && !files.length)} data-testid="interpretar"
              className="ml-auto flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-8px_var(--cyan)] transition hover:scale-[1.02] disabled:opacity-50"
              style={{ background: "linear-gradient(90deg, var(--cyan), oklch(0.66 0.19 265) 55%, var(--violet))" }}>
              {phase === "processing" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Interpretar conteúdo
            </button>
          </div>

          {phase === "processing" && (
            <div className="relative overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--cyan)_35%,transparent)] bg-secondary/25 p-5" data-testid="processando" aria-live="polite">
              <span className="scanline absolute inset-0" />
              <div className="relative flex items-center gap-4">
                <span className="relative grid h-14 w-14 shrink-0 place-items-center">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-cyan/20" />
                  <span className="absolute inset-1.5 animate-[spin_3s_linear_infinite] rounded-full border-2 border-dashed border-cyan/60" />
                  <Sparkles size={20} className="relative text-cyan" />
                </span>
                <ol className="space-y-1.5 text-sm">
                  {STEPS.map((s, i) => (
                    <li key={s} className={`flex items-center gap-2 transition ${i < step ? "text-muted-foreground" : i === step ? "text-foreground" : "text-muted-foreground/40"}`}>
                      {i < step ? <Check size={13} className="text-emerald" /> : i === step ? <Loader2 size={13} className="animate-spin text-cyan" /> : <span className="h-[13px] w-[13px] rounded-full border border-border" />} {s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REVISÃO */}
      {phase === "review" && (
        <div className="relative mt-4 space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="mono-caps !text-[0.6rem]">{meta.source === "ia" ? "Entendi assim" : "Registros manuais"}</p>
              <p className="mt-1 text-sm">{meta.resumo || (items.length ? `${items.length} registro${items.length === 1 ? "" : "s"} para revisar.` : "Nenhum registro ainda.")}</p>
            </div>
            <button onClick={() => setPhase("idle")} className="glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs transition hover:text-cyan"><ArrowRight size={13} className="rotate-180" /> Voltar ao texto</button>
          </div>

          {doubts.length > 0 && (
            <div className="rounded-2xl border border-amber/40 bg-amber/10 p-3.5" data-testid="duvidas">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber"><CircleHelp size={14} /> Dúvidas e pendências</p>
              <ul className="space-y-1 text-xs text-foreground/90">{doubts.map((d, i) => <li key={i} className="flex gap-1.5"><span className="text-amber">•</span> {d}</li>)}</ul>
            </div>
          )}

          {grouped.map(({ d, list }) => (
            <div key={d.tipo} className="space-y-2" data-testid={`grupo-${d.tipo}`}>
              <h3 className="flex items-center gap-2 text-sm font-semibold" style={tint(d.cor)}>
                <span className="h-2 w-2 rounded-full bg-[var(--glow)] shadow-[0_0_8px_var(--glow)]" /> {d.label} <span className="tag !px-2 !py-0 !text-[0.6rem]">{list.length}</span>
                <span className="text-[0.65rem] font-normal text-muted-foreground">{d.sub}</span>
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map(({ it, i }) => (
                  <RecordCard key={it.key} item={it} ctx={ctx} files={files} problems={check.perItem[i]?.problems ?? []} warnings={check.perItem[i]?.warnings ?? []} duplicado={check.perItem[i]?.duplicado}
                    onChange={(n) => update(it.key, n)} onRemove={() => update(it.key, null)} />
                ))}
              </div>
            </div>
          ))}

          {!items.length && <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nada identificado com segurança. Responda às dúvidas acima, volte ao texto para detalhar, ou adicione um registro manualmente.</p>}

          <footer className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center gap-2 border-t border-border bg-[color-mix(in_oklab,var(--background)_88%,transparent)] px-5 py-3 backdrop-blur-md">
            <label className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs">
              <Plus size={13} className="text-cyan" />
              <select value="" onChange={(e) => e.target.value && addManual(e.target.value as Tipo)} aria-label="Adicionar registro" data-testid="adicionar-registro" className="cursor-pointer bg-transparent outline-none [&>option]:bg-popover">
                <option value="">Adicionar registro…</option>
                {DESTINOS.filter((d) => d.tipo !== "evidencia").map((d) => <option key={d.tipo} value={d.tipo}>{d.label}</option>)}
              </select>
            </label>
            <button onClick={copy} disabled={!items.length} className="glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition hover:text-cyan disabled:opacity-50" data-testid="copiar"><Copy size={13} /> Copiar registros</button>
            <button onClick={() => void interpret()} className="glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition hover:text-cyan"><RotateCcw size={13} /> Interpretar de novo</button>
            <span className="ml-auto text-[0.68rem] text-muted-foreground" aria-live="polite">
              {checking ? "Conferindo…" : pending ? `${pending} pendência${pending === 1 ? "" : "s"} para corrigir` : dupIgnored ? `${dupIgnored} duplicado${dupIgnored === 1 ? "" : "s"} será ignorado` : items.length ? "Tudo certo para distribuir" : ""}
            </span>
            <button onClick={() => void confirm()} disabled={busy || checking || !items.length || pending > 0 || readyCount < 1} data-testid="confirmar-distribuicao"
              className="flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-8px_var(--cyan)] transition hover:scale-[1.02] disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Confirmar e distribuir ({readyCount})
            </button>
          </footer>
        </div>
      )}

      {/* PRONTO */}
      {phase === "done" && result && (
        <div className="relative mt-4 space-y-4" data-testid="distribuido">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald/15 text-emerald"><Check size={18} /></span>
            <div>
              <p className="font-semibold">{undone ? "Distribuição desfeita" : `${result.criados.length} registro${result.criados.length === 1 ? "" : "s"} distribuído${result.criados.length === 1 ? "" : "s"}`}</p>
              <p className="text-xs text-muted-foreground">{undone ? "Os registros foram removidos dos módulos." : "Cada um já está no módulo correto."}{result.ignorados ? ` ${result.ignorados} duplicado(s) ignorado(s).` : ""}</p>
            </div>
          </div>
          <ul className={`grid gap-2 sm:grid-cols-2 ${undone ? "opacity-50" : ""}`}>
            {result.criados.map((c) => (
              <li key={c.id + c.tipo} className="flex items-center gap-2.5 rounded-2xl border border-border bg-secondary/25 p-3 text-sm">
                <span className="tag !text-[0.6rem]" style={tint(DESTINOS.find((d) => d.tipo === c.tipo)?.cor ?? "cyan")}>{c.modulo}</span>
                <span className="min-w-0 flex-1 truncate" title={c.rotulo}>{c.rotulo}</span>
                {!undone && <a href={c.link} className="flex items-center gap-1 text-xs text-cyan hover:underline" aria-label={`Abrir ${c.modulo}`}>Abrir <ExternalLink size={11} /></a>}
              </li>
            ))}
          </ul>
          {result.falhas.length > 0 && <p className="text-xs text-destructive">Falhas: {result.falhas.join(" | ")}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={reset} className="flex items-center gap-2 rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground"><Plus size={14} /> Nova entrada</button>
            {!undone && <button onClick={() => void undo()} disabled={busy} data-testid="desfazer" className="glass flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition hover:text-destructive"><Undo2 size={14} /> Desfazer tudo</button>}
            <button onClick={() => { setPhase("review"); setResult(null); }} className="glass flex items-center gap-1.5 rounded-full px-4 py-2 text-sm">Revisar de novo</button>
          </div>
        </div>
      )}
    </section>
  );
}
