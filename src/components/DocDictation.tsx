/** Caixa dentro da pasta: a usuária fala ou escreve o passo a passo e o Orion organiza em tutorial (revisável) para salvar como documento. */
import { useEffect, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { Check, Loader2, Mic, Plus, Sparkles, Square, Trash2, Wand2, X } from "lucide-react";

import { transcribeAudio } from "@/lib/audio.functions";
import { organizeTutorial } from "@/lib/doc-organize.functions";
import { KINDS_ORGANIZE, type Organized } from "@/lib/doc-organize";
import { MAX_SECONDS, useRecorder } from "@/lib/use-recorder";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
export type DictationDoc = Organized & { kind: string };

export function DocDictation({ folderName, defaultKind, onSave }: { folderName: string; defaultKind: string; onSave: (d: DictationDoc) => Promise<void> }) {
  const [open, setOpen] = useState(false), [text, setText] = useState(""), [busy, setBusy] = useState(false), [transcribing, setTranscribing] = useState(false), [error, setError] = useState("");
  const [draft, setDraft] = useState<DictationDoc | null>(null), [note, setNote] = useState(""), [saving, setSaving] = useState(false);
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
    try { const r = await organizeTutorial({ data: { text, folder: folderName } }); if (r.ok) { setDraft({ ...r.draft, kind: defaultKind }); setNote(r.note ?? (r.via === "ia" ? "" : "Organizado de forma simples.")); } else setError(r.error); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const save = async () => { if (!draft) return; setSaving(true); try { await onSave({ ...draft, passos: draft.passos.map((p) => p.trim()).filter(Boolean), antes: draft.antes.map((p) => p.trim()).filter(Boolean) }); toast.success("Tutorial salvo na pasta"); setDraft(null); setText(""); setOpen(false); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } };
  const upd = (patch: Partial<DictationDoc>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const fld = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-cyan/60";

  if (!open) return (
    <button onClick={() => setOpen(true)} data-testid="ditado-abrir" className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-dashed border-cyan/40 bg-cyan/[0.04] px-4 py-3 text-left transition hover:border-cyan/70 hover:bg-cyan/[0.08]">
      <span className="icon-tile h-9 w-9 shrink-0 !rounded-xl" style={tint("cyan")}><Wand2 size={16} /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Falar ou escrever o passo a passo</span><span className="block truncate text-xs text-muted-foreground">O Orion organiza em um tutorial e salva nesta pasta.</span></span>
      <Mic size={15} className="shrink-0 text-cyan" />
    </button>);

  return (
    <div className="mt-4 rounded-2xl border border-cyan/30 bg-black/20 p-4" data-testid="ditado">
      <div className="mb-3 flex items-center gap-2"><Sparkles size={14} className="text-cyan" /><b className="flex-1 font-display text-sm">{draft ? "Revise e salve" : "Conte o passo a passo"}</b><button onClick={() => { rec.cancel(); setOpen(false); setDraft(null); }} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={14} /></button></div>
      {!draft ? <div className="space-y-3">
        <div className="relative">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Escreva ou fale do seu jeito: “primeiro abro as configurações, depois vou em horário de atendimento…”" aria-label="Passo a passo" data-testid="ditado-texto" className={`${fld} pr-12`} />
          {rec.supported && !recording && <button type="button" onClick={() => void startVoice()} disabled={transcribing || busy} aria-label="Falar em vez de digitar" title="Gravar sua explicação" data-testid="ditado-gravar" className="absolute bottom-2.5 right-2.5 grid h-9 w-9 place-items-center rounded-full border border-cyan/50 text-cyan transition hover:bg-cyan/10 disabled:opacity-40">{transcribing ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}</button>}
        </div>
        {recording && <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"><span className="h-2.5 w-2.5 rounded-full bg-destructive" style={{ animation: "fin-pulse 1.4s ease-out infinite" }} /><span className="mr-auto text-xs">Gravando… {Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, "0")}</span><button onClick={rec.cancel} aria-label="Cancelar gravação" className="text-muted-foreground hover:text-destructive"><X size={14} /></button><button onClick={() => void stopVoice()} data-testid="ditado-parar" className="flex items-center gap-1.5 rounded-full bg-destructive/80 px-3 py-1 text-xs font-semibold text-white"><Square size={11} /> Parar</button></div>}
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-3"><span className="text-[0.7rem] text-muted-foreground">Não grave senhas nem dados pessoais.</span>
          <button onClick={() => void organize()} disabled={busy || recording || transcribing || text.trim().length < 8} data-testid="ditado-organizar" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet px-5 py-2 text-sm font-semibold text-background shadow-[0_0_28px_-8px_var(--cyan)] transition active:scale-[0.97] disabled:opacity-40 disabled:shadow-none">{busy ? <><Loader2 size={14} className="animate-spin" /> Organizando…</> : <><Wand2 size={14} /> Organizar</>}</button></div>
      </div> : <div className="space-y-3" data-testid="ditado-rascunho">
        {note && <p className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">{note}</p>}
        <input value={draft.titulo} onChange={(e) => upd({ titulo: e.target.value })} aria-label="Título" data-testid="ditado-titulo" className={`${fld} font-display text-base font-semibold`} />
        <textarea value={draft.descricao} onChange={(e) => upd({ descricao: e.target.value })} rows={2} placeholder="Descrição (o que a pessoa consegue fazer ao final)" aria-label="Descrição" className={fld} />
        <div className="flex items-center gap-2"><span className="mono-caps">Tipo</span><select value={draft.kind} onChange={(e) => upd({ kind: e.target.value })} aria-label="Tipo do documento" className="rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 text-sm">{KINDS_ORGANIZE.map((k) => <option key={k}>{k}</option>)}</select></div>
        <div><p className="mono-caps mb-1.5">Antes de começar</p>{draft.antes.map((a, i) => <div key={i} className="mb-1 flex gap-2"><input value={a} onChange={(e) => upd({ antes: draft.antes.map((x, k) => (k === i ? e.target.value : x)) })} aria-label={`Antes de começar ${i + 1}`} className={fld} /><button onClick={() => upd({ antes: draft.antes.filter((_, k) => k !== i) })} aria-label="Remover" className="text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button></div>)}<button onClick={() => upd({ antes: [...draft.antes, ""] })} className="flex items-center gap-1 text-xs text-cyan hover:underline"><Plus size={12} /> Adicionar</button></div>
        <div><p className="mono-caps mb-1.5">Passo a passo ({draft.passos.length})</p><ol className="space-y-1.5">{draft.passos.map((p, i) => <li key={i} className="flex items-start gap-2"><span className="mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-cyan/40 text-[0.65rem] font-semibold text-cyan">{i + 1}</span><textarea value={p} onChange={(e) => upd({ passos: draft.passos.map((x, k) => (k === i ? e.target.value.replace(/\n/g, " ") : x)) })} rows={1} aria-label={`Passo ${i + 1}`} data-testid={`ditado-passo-${i}`} className={`${fld} resize-none`} /><button onClick={() => upd({ passos: draft.passos.filter((_, k) => k !== i) })} aria-label={`Remover passo ${i + 1}`} className="mt-2 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button></li>)}</ol><button onClick={() => upd({ passos: [...draft.passos, ""] })} className="mt-1.5 flex items-center gap-1 text-xs text-cyan hover:underline"><Plus size={12} /> Adicionar passo</button></div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3"><button onClick={() => { setDraft(null); setNote(""); }} className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao texto</button>
          <button onClick={() => void save()} disabled={saving || !draft.titulo.trim() || draft.passos.every((p) => !p.trim())} data-testid="ditado-salvar" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan to-violet px-6 py-2 text-sm font-semibold text-background disabled:opacity-40">{saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar na pasta</button></div>
      </div>}
    </div>
  );
}
