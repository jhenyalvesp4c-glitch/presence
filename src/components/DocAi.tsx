/**
 * Caixa da IA dentro do documento: a usuária fala ou escreve o passo a passo e o Orion organiza e coloca NESTE documento
 * (substituindo ou acrescentando). Também serve para criar o primeiro documento de uma pasta vazia.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Check, Loader2, Mic, Plus, Sparkles, Square, Trash2, Wand2, X } from "lucide-react";

import { transcribeAudio } from "@/lib/audio.functions";
import { organizeTutorial } from "@/lib/doc-organize.functions";
import { KINDS_ORGANIZE, type Organized } from "@/lib/doc-organize";
import { MAX_SECONDS, useRecorder } from "@/lib/use-recorder";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
export type DictationDoc = Organized & { kind: string };
export type ApplyMode = "replace" | "append";

type Props = { folderName: string; docTitle?: string; hasSteps?: boolean; defaultKind: string; create?: boolean; onApply: (d: DictationDoc, mode: ApplyMode) => Promise<void> };

export function DocAi({ folderName, docTitle, hasSteps, defaultKind, create, onApply }: Props) {
  const [open, setOpen] = useState(false), [text, setText] = useState(""), [busy, setBusy] = useState(false), [transcribing, setTranscribing] = useState(false), [error, setError] = useState("");
  const [draft, setDraft] = useState<DictationDoc | null>(null), [note, setNote] = useState(""), [saving, setSaving] = useState(false), [mode, setMode] = useState<ApplyMode>(hasSteps ? "append" : "replace");
  const rec = useRecorder(), recording = rec.state === "recording";
  useEffect(() => { if (recording && rec.seconds >= MAX_SECONDS) void stopVoice(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rec.seconds, recording]);
  const startVoice = async () => { setError(""); try { await rec.start(); } catch (e) { setError((e as Error).message); } };
  const stopVoice = async () => {
    const audio = await rec.stop(); if (!audio) return;
    setTranscribing(true);
    try { const r = await transcribeAudio({ data: audio }); if (r.ok) setText((t) => (t.trim() ? `${t.trim()}\n${r.text}` : r.text)); else setError(r.error); } catch (e) { setError((e as Error).message); } finally { setTranscribing(false); }
  };
  const organize = async () => {
    setBusy(true); setError(""); setNote("");
    try { const r = await organizeTutorial({ data: { text, folder: [folderName, docTitle].filter(Boolean).join(" · ") } }); if (r.ok) { setDraft({ ...r.draft, kind: defaultKind }); setNote(r.note ?? ""); } else setError(r.error); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const apply = async () => {
    if (!draft) return; setSaving(true);
    try { await onApply({ ...draft, passos: draft.passos.map((p) => p.trim()).filter(Boolean), antes: draft.antes.map((p) => p.trim()).filter(Boolean) }, create ? "replace" : mode); toast.success(create ? "Tutorial criado" : mode === "append" ? "Passos acrescentados ao documento" : "Passo a passo atualizado"); setDraft(null); setText(""); setOpen(false); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };
  const upd = (patch: Partial<DictationDoc>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const close = () => { rec.cancel(); setOpen(false); setDraft(null); setError(""); };

  if (!open) return (
    <button onClick={() => setOpen(true)} data-testid="ia-abrir" className="ai-border group relative mt-4 flex w-full items-center gap-3 overflow-hidden bg-[oklch(0.15_0.04_265/0.55)] px-4 py-3 text-left backdrop-blur transition hover:bg-[oklch(0.18_0.05_265/0.7)]">
      <span aria-hidden className="pointer-events-none absolute -left-8 -top-10 h-24 w-24 rounded-full bg-[var(--cyan)] opacity-20 blur-2xl transition group-hover:opacity-35" />
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full border border-cyan/50 text-cyan shadow-[0_0_20px_-4px_var(--cyan)]"><Wand2 size={15} /></span>
      <span className="relative min-w-0 flex-1"><span className="block text-sm font-medium">{create ? "Criar com a IA" : "Contar o passo a passo"}</span><span className="block truncate text-[0.7rem] text-muted-foreground">{create ? "Fale ou escreva e o Orion monta o tutorial." : `Fale ou escreva e o Orion organiza aqui${docTitle ? ` em “${docTitle}”` : ""}.`}</span></span>
      <Mic size={14} className="relative shrink-0 text-muted-foreground transition group-hover:text-cyan" />
    </button>);

  return (
    <div className="ai-border relative mt-4 min-w-0 max-w-full overflow-hidden bg-[oklch(0.14_0.04_265/0.72)] p-4 backdrop-blur-xl" data-testid="ia-caixa" style={{ animation: "fin-rise .35s both" }}>
      <span aria-hidden className="pointer-events-none absolute -left-10 -top-12 h-32 w-32 rounded-full bg-[var(--cyan)] opacity-20 blur-3xl" style={{ animation: "fin-aurora 14s ease-in-out infinite" }} />
      <span aria-hidden className="pointer-events-none absolute -bottom-12 -right-10 h-32 w-32 rounded-full bg-[var(--violet)] opacity-25 blur-3xl" style={{ animation: "fin-aurora 18s ease-in-out infinite reverse" }} />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2"><Sparkles size={13} className="text-cyan" /><span className="mono-caps flex-1">{draft ? "Revise e aplique" : "Orion · passo a passo"}</span><button onClick={close} aria-label="Fechar" className="text-muted-foreground transition hover:text-foreground"><X size={14} /></button></div>

        {!draft ? (
          <div className="space-y-3">
            <div className="relative">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Fale ou escreva do seu jeito…" aria-label="Passo a passo" data-testid="ia-texto" className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-16 text-sm leading-relaxed outline-none transition placeholder:text-muted-foreground/60 focus:border-cyan/50 focus:shadow-[0_0_30px_-14px_var(--cyan)]" />
              {rec.supported && !recording && (
                <button type="button" onClick={() => void startVoice()} disabled={transcribing || busy} aria-label="Falar em vez de digitar" title="Gravar a explicação" data-testid="ia-gravar" className="absolute bottom-3 right-3 grid h-10 w-10 place-items-center rounded-full border border-cyan/50 text-cyan transition hover:bg-cyan/10 disabled:opacity-40">
                  {transcribing ? <Loader2 size={15} className="animate-spin" /> : <><span aria-hidden className="absolute inset-0 rounded-full border border-cyan/40" style={{ animation: "ai-ring 2.4s ease-out infinite" }} /><Mic size={15} /></>}
                </button>)}
            </div>
            {recording && (
              <div className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2">
                <span className="flex h-6 items-center gap-[3px]" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} className="block h-full w-[3px] origin-center rounded-full bg-destructive" style={{ animation: `ai-wave ${0.7 + (i % 5) * 0.12}s ease-in-out ${i * 0.05}s infinite` }} />)}</span>
                <span className="mr-auto text-xs tabular-nums">{Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, "0")}</span>
                <button onClick={rec.cancel} aria-label="Cancelar gravação" className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                <button onClick={() => void stopVoice()} data-testid="ia-parar" className="flex items-center gap-1.5 rounded-full bg-destructive/80 px-3 py-1 text-xs font-semibold text-white"><Square size={10} /> Parar</button>
              </div>)}
            {busy && <div className="ai-shimmer h-1 rounded-full" aria-hidden />}
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex items-center justify-between gap-3"><span className="text-[0.68rem] text-muted-foreground">Sem senhas nem dados pessoais.</span>
              <button onClick={() => void organize()} disabled={busy || recording || transcribing || text.trim().length < 8} data-testid="ia-organizar" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2 text-sm font-semibold text-background shadow-[0_0_30px_-8px_var(--cyan)] transition active:scale-[0.97] disabled:opacity-40 disabled:shadow-none">{busy ? <><Loader2 size={14} className="animate-spin" /> Organizando…</> : <><Wand2 size={14} /> Organizar</>}</button></div>
          </div>
        ) : (
          <div className="space-y-3.5" data-testid="ia-rascunho">
            {note && <p className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-[0.7rem] text-amber">{note}</p>}
            {create && <input value={draft.titulo} onChange={(e) => upd({ titulo: e.target.value })} aria-label="Título" data-testid="ia-titulo" className="w-full border-0 border-b border-white/15 bg-transparent pb-1.5 font-display text-lg font-semibold outline-none transition focus:border-cyan/60" />}
            {create && <div className="flex items-center gap-2"><span className="mono-caps">Tipo</span><select value={draft.kind} onChange={(e) => upd({ kind: e.target.value })} aria-label="Tipo do documento" className="rounded-xl border border-white/10 bg-black/25 px-3 py-1 text-xs">{KINDS_ORGANIZE.map((k) => <option key={k}>{k}</option>)}</select></div>}
            {draft.antes.length > 0 && <div><p className="mono-caps mb-1.5">Antes de começar</p>{draft.antes.map((a, i) => <div key={i} className="mb-1 flex items-center gap-2"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" /><input value={a} onChange={(e) => upd({ antes: draft.antes.map((x, k) => (k === i ? e.target.value : x)) })} aria-label={`Antes de começar ${i + 1}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><button onClick={() => upd({ antes: draft.antes.filter((_, k) => k !== i) })} aria-label="Remover" className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button></div>)}</div>}
            <div>
              <p className="mono-caps mb-2">Passo a passo · {draft.passos.length}</p>
              <ol>{draft.passos.map((p, i) => (
                <li key={i} className="group relative flex items-start gap-3 py-1" style={{ animation: `fin-rise .35s ${Math.min(i, 10) * 0.04}s both` }}>
                  {i < draft.passos.length - 1 && <span aria-hidden className="absolute left-[11px] top-[calc(0.25rem+1.5rem)] h-[calc(100%-1rem)] w-px bg-gradient-to-b from-cyan/50 to-violet/30" />}
                  <span className="relative z-10 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cyan/50 bg-[oklch(0.17_0.04_265)] text-[0.65rem] font-semibold text-cyan shadow-[0_0_14px_-4px_var(--cyan)]">{i + 1}</span>
                  <textarea value={p} ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }} onChange={(e) => upd({ passos: draft.passos.map((x, k) => (k === i ? e.target.value.replace(/\n/g, " ") : x)) })} rows={1} aria-label={`Passo ${i + 1}`} data-testid={`ia-passo-${i}`} className="min-w-0 flex-1 resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm leading-snug outline-none transition hover:border-white/10 focus:border-cyan/50" />
                  <button onClick={() => upd({ passos: draft.passos.filter((_, k) => k !== i) })} aria-label={`Remover passo ${i + 1}`} className="mt-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"><Trash2 size={12} /></button>
                </li>))}</ol>
              <button onClick={() => upd({ passos: [...draft.passos, ""] })} className="mt-1 flex items-center gap-1 pl-9 text-xs text-cyan hover:underline"><Plus size={12} /> Adicionar passo</button>
            </div>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 border-t border-white/10 pt-3">
              <button onClick={() => { setDraft(null); setNote(""); }} className="text-xs text-muted-foreground hover:text-foreground">← Voltar</button>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                {!create && hasSteps && <span className="flex rounded-full border border-white/10 p-0.5 text-[0.68rem]" role="radiogroup" aria-label="Como aplicar">{([["replace", "Substituir"], ["append", "Acrescentar"]] as const).map(([k, l]) => <button key={k} role="radio" aria-checked={mode === k} onClick={() => setMode(k)} className={`rounded-full px-2.5 py-1 transition ${mode === k ? "bg-white/10 text-foreground" : "text-muted-foreground"}`}>{l}</button>)}</span>}
                <button onClick={() => void apply()} disabled={saving || draft.passos.every((p) => !p.trim()) || (create && !draft.titulo.trim())} data-testid="ia-aplicar" className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2 text-sm font-semibold text-background shadow-[0_0_28px_-8px_var(--cyan)] transition active:scale-[0.97] disabled:opacity-40 disabled:shadow-none">{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {create ? "Criar na pasta" : "Aplicar no documento"}</button>
              </div>
            </div>
          </div>)}
      </div>
    </div>
  );
}
