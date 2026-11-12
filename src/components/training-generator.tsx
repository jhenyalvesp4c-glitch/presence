import { useEffect, useRef, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Check, FileText, FolderPlus, Loader2, Mic, Paperclip, Play, Sparkles, Wand2, X } from "lucide-react";

import { backdropProps } from "@/lib/backdrop";
import { transcribeAudio } from "@/lib/audio.functions";
import { MAX_PENDING, filesFromClipboard, sizeLabel, toPending, type Pending } from "@/lib/brain-files";
import { uploadFiles } from "@/lib/data/brain";
import { MAX_SECONDS, useRecorder } from "@/lib/use-recorder";
import { buildScript, type Draft } from "@/lib/training-ai";
import { generateTrainingScript } from "@/lib/training-ai.functions";
import type { Example, Script } from "@/lib/training-library";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const field = "mt-1 w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none transition focus:border-violet/60";
const MAX_AI_CHARS = 4_000_000;
const STEPS = ["Lendo o que você contou…", "Olhando os prints e arquivos…", "Separando em blocos, na ordem certa…", "Escrevendo o que falar e o que mostrar…", "Ajustando os detalhes…"];

type Created = { script: Script; examples: Example[]; duvidas: string[] };

/** Cria um roteiro de treinamento com IA: a usuária conta tudo e anexa prints; o Presence monta os blocos. */
export function TrainingGenerator({ folders, defaultFolder, onCreate, onOpen, onPresent, onClose }: {
  folders: string[]; defaultFolder?: string | undefined; onCreate: (script: Script, examples: Example[]) => void; onOpen: (id: string) => void; onPresent: (id: string) => void; onClose: () => void;
}) {
  const [brief, setBrief] = useState("");
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [folder, setFolder] = useState(defaultFolder ?? "");
  const [newFolder, setNewFolder] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [stage, setStage] = useState(-1);
  const [error, setError] = useState("");
  const [over, setOver] = useState(false);
  const [done, setDone] = useState<Created | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const rec = useRecorder();
  const busy = stage >= 0;
  const recording = rec.state === "recording";

  useEffect(() => { if (stage < 0 || stage >= STEPS.length - 1) return; const t = setTimeout(() => setStage((s) => (s >= 0 && s < STEPS.length - 1 ? s + 1 : s)), 4500); return () => clearTimeout(t); }, [stage]);
  useEffect(() => { if (recording && rec.seconds >= MAX_SECONDS) void stopVoice(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [rec.seconds, recording]);

  const add = async (list: File[]) => {
    if (!list.length) return;
    setError("");
    const { added, rejected } = await toPending(list, pending).catch((e) => ({ added: [] as Pending[], rejected: [(e as Error).message] }));
    const readable = added.filter((p) => p.ai), skipped = added.filter((p) => !p.ai).map((p) => `${p.name}: o Presence não consegue ler este tipo de arquivo (use imagem, PDF ou texto)`);
    if (readable.length) setPending((p) => [...p, ...readable]);
    const msgs = [...rejected, ...skipped];
    if (msgs.length) setError(msgs.join(" · "));
  };

  const startVoice = async () => { setError(""); try { await rec.start(); } catch (e) { setError((e as Error).message); } };
  async function stopVoice() {
    const audio = await rec.stop(); if (!audio) return;
    setTranscribing(true);
    try { const r = await transcribeAudio({ data: audio }); if (r.ok) setBrief((t) => (t.trim() ? `${t.trim()} ${r.text}` : r.text)); else setError(r.error); }
    catch (e) { setError((e as Error).message); }
    setTranscribing(false);
  }

  const submit = async () => {
    if (busy) return;
    if (brief.trim().length < 10) return void setError("Conte um pouco mais sobre o que o treinamento precisa ensinar.");
    const files = pending.map((p) => p.ai!);
    if (files.reduce((n, f) => n + f.data.length, 0) > MAX_AI_CHARS) return void setError("Os arquivos passam de ~3 MB juntos. Remova alguns ou envie imagens menores.");
    setError(""); setStage(0);
    try {
      const r = await generateTrainingScript({ data: { brief, ...(title.trim() ? { title: title.trim() } : {}), ...(audience.trim() ? { audience: audience.trim() } : {}), files: files.map((f) => ({ name: f.name, mime: f.mime, data: f.data })) } });
      if (!r.ok) { setError(r.error); setStage(-1); return; }
      const draft: Draft = r.draft;
      // Guarda só as imagens que a IA usou; "Imagem n" = n-ésima imagem enviada.
      const images = pending.filter((p) => p.ai!.mime.startsWith("image/"));
      const used = [...new Set(draft.blocos.flatMap((b) => (b.imagens ?? []).map((v) => v.imagem)))].filter((n) => n >= 1 && n <= images.length).sort((a, b) => a - b);
      const imagePaths: (string | undefined)[] = [];
      if (used.length) {
        const up = await uploadFiles("treinamentos", used.map((n) => ({ name: images[n - 1]!.name, mime: images[n - 1]!.mime, blob: images[n - 1]!.blob }))).catch((e: Error) => { toast.error(`Não consegui guardar as imagens: ${e.message}`); return []; });
        used.forEach((n, i) => { imagePaths[n - 1] = up[i]?.path; });
      }
      const chosenFolder = folder === "__new__" ? newFolder.trim() : folder;
      const { script, examples } = buildScript(draft, { imagePaths, folder: chosenFolder, title, audience });
      onCreate(script, examples);
      setDone({ script, examples, duvidas: draft.duvidas });
    } catch (e) { setError((e as Error).message); }
    setStage(-1);
  };

  const color = done?.script.color ?? "violet";
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-background/80 p-4 backdrop-blur-md" {...backdropProps(() => { if (!busy && !recording) onClose(); })} data-testid="gerador-roteiro">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Criar roteiro com o Presence" style={tint(color)}
        onPaste={(e) => { if (done) return; const f = filesFromClipboard(e); if (f.length) { e.preventDefault(); void add(f); } }}
        onDragOver={(e) => { if (!done && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }} onDragLeave={(e) => { if (e.currentTarget === e.target) setOver(false); }}
        onDrop={(e) => { if (!done && e.dataTransfer.files.length) { e.preventDefault(); setOver(false); void add([...e.dataTransfer.files]); } }}
        className="glass relative mx-auto my-6 w-full max-w-3xl overflow-hidden rounded-3xl p-5 animate-rise sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[var(--glow)] opacity-20 blur-3xl" />
        {over && <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-3xl border-2 border-dashed border-cyan bg-background/85 text-sm text-cyan backdrop-blur-sm"><span className="flex items-center gap-2"><Paperclip size={16} /> Solte os prints e arquivos aqui</span></div>}

        <div className="relative flex items-start gap-3">
          <span className="icon-tile h-12 w-12 shrink-0 !rounded-2xl shadow-[0_0_30px_-6px_var(--glow)]"><Wand2 size={22} /></span>
          <div className="mr-auto min-w-0">
            <p className="mono-caps !text-[0.62rem] text-[var(--glow)]">Presence · criador de roteiros</p>
            <h2 className="font-display text-xl font-semibold leading-tight">{done ? "Roteiro pronto!" : "Conte o que precisa ensinar"}</h2>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Fechar" className="text-muted-foreground hover:text-foreground disabled:opacity-40"><X size={18} /></button>
        </div>

        {done ? (
          <div className="relative mt-5 space-y-4" data-testid="roteiro-pronto">
            <div className="rounded-2xl border border-[color-mix(in_oklab,var(--glow)_50%,transparent)] bg-[color-mix(in_oklab,var(--glow)_8%,transparent)] p-4">
              <p className="font-display text-lg font-semibold">{done.script.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{done.script.audience || "—"} · {done.script.blocks.length} blocos · {done.script.blocks.reduce((a, b) => a + b.minutes, 0)} min{done.script.folder ? ` · pasta ${done.script.folder}` : ""}</p>
              <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {done.script.blocks.map((b, i) => <li key={b.id} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/25 px-3 py-1.5 text-sm"><span className="font-mono text-xs text-[var(--glow)]">{String(i + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 truncate">{b.title}</span><span className="text-[0.65rem] text-muted-foreground">{b.show.length} passos</span></li>)}
              </ol>
            </div>
            {done.duvidas.length > 0 && (
              <div className="rounded-2xl border border-amber/50 bg-amber/5 p-4" data-testid="duvidas-roteiro">
                <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle size={15} className="text-amber" /> Confira estes pontos</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[0.8rem] leading-snug text-muted-foreground">{done.duvidas.map((d, i) => <li key={i}>{d}</li>)}</ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Você pode editar qualquer bloco, trocar a ordem ou pedir outro roteiro. O que falar fica nas notas do apresentador (tecla N).</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground">Fechar</button>
              <button onClick={() => { onOpen(done.script.id); onClose(); }} className="flex items-center gap-1.5 rounded-xl border border-[var(--glow)] px-4 py-2 text-sm text-[var(--glow)] transition hover:bg-[color-mix(in_oklab,var(--glow)_10%,transparent)]">Abrir roteiro <ArrowRight size={14} /></button>
              <button onClick={() => { onOpen(done.script.id); onClose(); setTimeout(() => onPresent(done.script.id), 50); }} data-testid="apresentar-agora" className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:scale-105"><Play size={14} /> Apresentar agora</button>
            </div>
          </div>
        ) : busy ? (
          <div className="relative grid place-items-center gap-5 py-14 text-center" data-testid="gerando-roteiro">
            <div className="relative grid h-28 w-28 place-items-center">
              <span className="absolute inset-0 animate-[spin_9s_linear_infinite] rounded-full border border-dashed border-[var(--glow)]" />
              <span className="absolute inset-3 animate-[spin_6s_linear_infinite_reverse] rounded-full border border-violet/60" />
              <span className="absolute inset-6 animate-pulse-ring rounded-full bg-[var(--glow)] opacity-20 blur-md" />
              <Sparkles size={34} className="relative animate-float text-cyan" />
            </div>
            <div className="space-y-1.5">
              {STEPS.map((s, i) => <p key={s} className={`flex items-center justify-center gap-2 text-sm transition-all duration-500 ${i === stage ? "scale-105 text-foreground" : i < stage ? "text-muted-foreground" : "text-muted-foreground/30"}`}>{i < stage ? <Check size={13} className="text-emerald" /> : i === stage ? <Loader2 size={13} className="animate-spin text-cyan" /> : <span className="h-[13px] w-[13px]" />}{s}</p>)}
            </div>
            <p className="text-xs text-muted-foreground">Costuma levar de 20 segundos a 1 minuto. Não feche esta janela.</p>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="relative mt-4">
            <label className="block text-xs text-muted-foreground">Explique do seu jeito (pode ser bagunçado) <span className="opacity-60">— o Presence organiza em blocos, na ordem certa</span>
              <div className="relative">
                <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={9} disabled={transcribing} data-testid="roteiro-conteudo" autoFocus
                  placeholder={"Ex.: Preciso de um vídeo ensinando a fazer o disparo em massa. Primeiro tem que importar a base. A planilha precisa ter uma coluna para cada variável do template (se o template tem {curso}, a planilha tem a coluna curso). Não esquecer de avisar que o número tem que estar com +55. Depois de importar, atualizar os contatos e colocar uma tag em todos para segmentar…"}
                  className={`${field} resize-y pr-12 leading-relaxed`} />
                {rec.supported && !recording && <button type="button" onClick={startVoice} disabled={transcribing} aria-label="Falar em vez de digitar" title="Gravar sua explicação em áudio" data-testid="roteiro-gravar" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-border bg-background/70 text-muted-foreground transition enabled:hover:border-violet/60 enabled:hover:text-violet disabled:opacity-40">{transcribing ? <Loader2 size={14} className="animate-spin" /> : <Mic size={15} />}</button>}
                {recording && (
                  <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl border border-destructive/50 bg-background/90 px-3 py-2 backdrop-blur" data-testid="roteiro-gravando">
                    <span className="relative grid h-4 w-4 place-items-center"><span className="absolute inset-0 animate-ping rounded-full bg-destructive/50" /><span className="h-2 w-2 rounded-full bg-destructive" /></span>
                    <span className="mr-auto text-xs">Gravando… {Math.floor(rec.seconds / 60)}:{String(rec.seconds % 60).padStart(2, "0")}</span>
                    <button type="button" onClick={rec.cancel} aria-label="Cancelar gravação" className="text-muted-foreground hover:text-destructive"><X size={14} /></button>
                    <button type="button" onClick={() => void stopVoice()} aria-label="Parar e transcrever" data-testid="roteiro-parar" className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-brand text-primary-foreground"><Check size={14} /></button>
                  </div>
                )}
              </div>
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block text-xs text-muted-foreground">Nome do roteiro <span className="opacity-60">(opcional)</span><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="A IA sugere" className={field} data-testid="roteiro-nome" /></label>
              <label className="block text-xs text-muted-foreground">Para quem <span className="opacity-60">(opcional)</span><input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={120} placeholder="Ex.: Coordenadores" className={field} /></label>
              <label className="block text-xs text-muted-foreground">Pasta
                <select value={folder} onChange={(e) => setFolder(e.target.value)} className={`${field} [&>option]:bg-popover`} data-testid="roteiro-pasta">
                  <option value="">Sem pasta</option>{folders.map((f) => <option key={f} value={f}>{f}</option>)}<option value="__new__">+ Nova pasta…</option>
                </select>
              </label>
            </div>
            {folder === "__new__" && <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><FolderPlus size={14} className="text-cyan" /><input value={newFolder} onChange={(e) => setNewFolder(e.target.value)} maxLength={60} placeholder="Nome da nova pasta" className={`${field} !mt-0`} data-testid="roteiro-nova-pasta" /></label>}

            <div className="mt-4">
              <div className="flex items-center gap-2">
                <p className="mono-caps mr-auto flex items-center gap-2"><Paperclip size={11} /> Prints, PDFs e arquivos <span className="normal-case tracking-normal text-muted-foreground">({pending.length}/{MAX_PENDING})</span></p>
                <button type="button" onClick={() => input.current?.click()} disabled={pending.length >= MAX_PENDING} data-testid="roteiro-anexar" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-cyan/60 hover:text-cyan disabled:opacity-40"><Paperclip size={12} /> Anexar</button>
                <input ref={input} type="file" multiple hidden data-testid="roteiro-arquivo" onChange={(e) => { void add([...(e.target.files ?? [])]); e.target.value = ""; }} />
              </div>
              {pending.length === 0 ? (
                <button type="button" onClick={() => input.current?.click()} className="mt-2 grid w-full place-items-center gap-1 rounded-2xl border border-dashed border-border py-5 text-xs text-muted-foreground transition hover:border-cyan/50 hover:text-cyan">Cole (Ctrl+V), arraste ou clique para enviar os prints das telas. O Presence usa nos slides e marca os pontos.</button>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-2" data-testid="roteiro-anexos">
                  {pending.map((p, i) => (
                    <li key={p.key} className="relative flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-1.5 pr-7">
                      {p.preview ? <img src={p.preview} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="icon-tile h-10 w-10 shrink-0 !rounded-lg"><FileText size={15} /></span>}
                      <span className="min-w-0"><span className="block max-w-36 truncate text-[0.7rem]">{p.ai?.mime.startsWith("image/") ? `Imagem ${pending.slice(0, i + 1).filter((x) => x.ai?.mime.startsWith("image/")).length} · ` : ""}{p.name}</span><span className="text-[0.6rem] text-muted-foreground">{sizeLabel(p.size)}</span></span>
                      <button type="button" onClick={() => setPending((l) => l.filter((x) => x.key !== p.key))} aria-label={`Remover ${p.name}`} className="absolute right-1.5 top-1.5 text-muted-foreground hover:text-destructive"><X size={12} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error && <p role="alert" className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground">Cancelar</button>
              <button type="submit" disabled={brief.trim().length < 10 || transcribing || recording} data-testid="roteiro-criar" className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-8px_var(--glow)] transition enabled:hover:scale-105 disabled:opacity-40">
                <span aria-hidden className="absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-white/30 transition duration-700 group-enabled:group-hover:left-[150%]" />
                <Wand2 size={15} className="relative" /> <span className="relative">Criar roteiro com o Presence</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
