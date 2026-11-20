/** Anotar rápido: escrever, falar ou mandar um print/foto. A IA organiza (título, tipo, área, etiquetas) e a ideia já cai na caixa. */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Mic, Send, Square, X } from "lucide-react";

import { readFiles, type LocalFile } from "@/components/inbox/files";
import { transcribeAudio } from "@/lib/audio.functions";
import { VoiceWave } from "@/components/ideas/fx";
import { useIdeaActions } from "@/lib/data/ideas";
import { captureIdea, manualCapture } from "@/lib/ideas.functions";
import { useRecorder } from "@/lib/use-recorder";
import type { Idea, IdeaSource } from "@/lib/ideas";

const toBlob = (f: LocalFile) => new Blob([Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))], { type: f.mime });

export function Capture({ onCreated }: { onCreated: (i: Idea) => void }) {
  const { create } = useIdeaActions();
  const [text, setText] = useState(""), [files, setFiles] = useState<LocalFile[]>([]), [busy, setBusy] = useState(false), [note, setNote] = useState(""), [heard, setHeard] = useState(false), [transcribing, setTranscribing] = useState(false);
  const rec = useRecorder(), recording = rec.state === "recording", pick = useRef<HTMLInputElement>(null), area = useRef<HTMLTextAreaElement>(null);

  const addFiles = async (l: FileList | null) => {
    if (!l?.length) return;
    const r = await readFiles([...l].filter((f) => f.type.startsWith("image/") || f.type === "application/pdf"), files);
    if (r.added.length) setFiles((f) => [...f, ...r.added].slice(0, 4));
    setNote(r.rejected.join(" · "));
  };
  const toggleMic = async () => {
    setNote("");
    if (!recording) { try { await rec.start(); } catch (e) { setNote((e as Error).message); } return; }
    const audio = await rec.stop();
    if (!audio) return;
    setTranscribing(true);
    try { const r = await transcribeAudio({ data: audio }); if (r.ok) { setText((t) => (t.trim() ? `${t.trim()} ${r.text}` : r.text)); setHeard(true); setTimeout(() => area.current?.focus(), 50); } else setNote(r.error); }
    catch (e) { setNote((e as Error).message); }
    setTranscribing(false);
  };

  const save = async () => {
    if ((!text.trim() && !files.length) || busy) return;
    setBusy(true); setNote("");
    try {
      let cap = manualCapture(text, files), organized = false;
      try {
        const r = await captureIdea({ data: { texto: text, files: files.map(({ name, mime, size, data }) => ({ name, mime, size, data })) } });
        if (r.ok) { cap = r.ideia; organized = r.fonte === "ia"; if (r.aviso) setNote(r.aviso); } else { setNote(r.error); setBusy(false); return; }
      } catch { /* sem rede para a IA: guarda do jeito que está */ }
      const source: IdeaSource = files.length ? "print" : heard ? "voz" : "texto";
      const idea = await create.mutateAsync({ title: cap.titulo, body: cap.descricao, kind: cap.tipo, area: cap.area, tags: cap.etiquetas, links: cap.links, source, files: files.map((f) => ({ name: f.name, mime: f.mime, blob: toBlob(f) })) });
      setText(""); setFiles([]); setHeard(false);
      toast.success(cap.tipo === "referencia" ? "Guardado no mural" : "Ideia guardada", { description: organized ? "Organizada pelo Orion." : undefined });
      onCreated(idea);
    } catch (e) { setNote(`Não consegui guardar: ${(e as Error).message}`); }
    setBusy(false);
  };

  return (
    <div className="space-y-3" data-testid="ideia-captura">
      <div className="fin-frame glass relative flex items-end gap-2 capture-glow rounded-2xl bg-background/60 p-2.5 transition">
        <button type="button" onClick={() => pick.current?.click()} aria-label="Anexar print ou foto" data-testid="ideia-anexar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground transition hover:text-violet"><Camera size={17} /></button>
        <input ref={pick} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        <textarea ref={area} value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Jogue uma ideia aqui… ou cole um link, um print, uma frase solta" data-testid="ideia-texto"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void save(); } }}
          onPaste={(e) => { const imgs = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/")); if (imgs.length) { e.preventDefault(); const dt = new DataTransfer(); imgs.forEach((f) => dt.items.add(f)); void addFiles(dt.files); } }}
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/60" />
        {rec.supported && <button type="button" onClick={() => void toggleMic()} disabled={transcribing} aria-label={recording ? "Parar de gravar" : "Falar a ideia"} data-testid="ideia-mic"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border transition ${recording ? "animate-pulse border-destructive/60 bg-destructive/15 text-destructive" : "border-white/10 text-muted-foreground hover:text-violet"}`}>{transcribing ? <Loader2 size={16} className="animate-spin" /> : recording ? <Square size={15} /> : <Mic size={17} />}</button>}
        <button type="button" onClick={() => void save()} disabled={busy || (!text.trim() && !files.length)} aria-label="Guardar ideia" data-testid="ideia-guardar"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-brand text-primary-foreground shadow-[0_0_20px_-6px_var(--cyan)] transition enabled:hover:scale-105 disabled:opacity-40">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
      </div>
      {recording && <p className="flex items-center gap-3 text-xs text-destructive" role="status"><VoiceWave />Gravando… {rec.seconds}s. Toque no quadrado para parar.</p>}
      {files.length > 0 && <div className="flex flex-wrap gap-2">{files.map((f) => <span key={f.name + f.size} className="inline-flex items-center gap-1.5 rounded-full border border-violet/40 bg-violet/10 px-2.5 py-1 text-xs text-violet">{f.preview && <img src={f.preview} alt="" className="h-5 w-5 rounded object-cover" />}{f.name}<button type="button" aria-label={`Tirar ${f.name}`} onClick={() => setFiles((l) => l.filter((x) => x !== f))}><X size={12} /></button></span>)}</div>}
      {note && <p className="text-xs text-amber" data-testid="ideia-aviso">{note}</p>}
    </div>
  );
}
