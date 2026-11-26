import { useEffect, useRef, useState } from "react";
import { ImagePlus, Paperclip, X } from "lucide-react";
import { toast } from "sonner";

import { MediaViewer } from "@/components/media-viewer";
import { mediaUrl, primePaths } from "@/components/training-images";
import { filesFromClipboard, toPending, type Pending } from "@/lib/brain-files";
import { uploadFiles, type Attachment } from "@/lib/data/brain";

const LIMITS = { maxFiles: 8, maxBytes: 25 * 1024 * 1024 };

/** Imagens e arquivos que ainda não foram enviados: escolher, colar (Ctrl+V), arrastar, tirar da lista e enviar ao salvar a tarefa. */
export function useTaskFiles(existing: Attachment[] = []) {
  const [pending, setPending] = useState<Pending[]>([]), [kept, setKept] = useState<Attachment[]>(existing), [busy, setBusy] = useState(false);
  const add = async (list: File[]) => {
    if (!list.length) return;
    const { added, rejected } = await toPending(list, pending, { ...LIMITS, aiCap: 0 }).catch((e: Error) => ({ added: [] as Pending[], rejected: [e.message] }));
    if (added.length) setPending((p) => [...p, ...added]);
    if (rejected.length) toast.error(rejected.join(" · "));
  };
  const onPaste = (e: React.ClipboardEvent) => { const f = filesFromClipboard(e); if (f.length) { e.preventDefault(); void add(f); } };
  /** Envia o que falta e devolve a lista final (as que já estavam + as novas). */
  const upload = async (): Promise<Attachment[]> => {
    if (!pending.length) return kept;
    setBusy(true);
    try { const up = await uploadFiles("tarefas", pending.map((p) => ({ name: p.name, mime: p.mime, blob: p.blob }))); return [...kept, ...up]; }
    finally { setBusy(false); }
  };
  const clear = () => setPending([]);
  const onDrop = (e: React.DragEvent) => { if (e.dataTransfer.files.length) { e.preventDefault(); void add([...e.dataTransfer.files]); } };
  const onDragOver = (e: React.DragEvent) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); };
  return { onDrop, onDragOver, pending, kept, setKept, busy, add, onPaste, upload, clear, count: pending.length + kept.length, removePending: (key: string) => setPending((p) => p.filter((x) => x.key !== key)) };
}
export type TaskFiles = ReturnType<typeof useTaskFiles>;

/** Botão "Anexar imagem" + miniaturas do que vai junto com a tarefa (as novas e as já salvas). */
export function TaskFilePicker({ files }: { files: TaskFiles }) {
  const input = useRef<HTMLInputElement>(null);
  const [, setTick] = useState(0);
  useEffect(() => { primePaths(files.kept.map((k) => k.path)).then((any) => { if (any) setTick((t) => t + 1); }).catch(() => undefined); }, [files.kept]);
  return (
    <div data-testid="tarefa-imagens">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => input.current?.click()} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-cyan/50 hover:text-cyan" data-testid="tarefa-anexar"><ImagePlus size={13} /> Anexar imagem ou arquivo</button>
        <span className="text-[0.68rem] text-muted-foreground">ou cole um print (Ctrl+V) ou arraste para cá</span>
        <input ref={input} type="file" multiple hidden onChange={(e) => { void files.add([...(e.target.files ?? [])]); e.target.value = ""; }} />
      </div>
      {files.count > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {files.kept.map((k) => { const u = mediaUrl(k.path)?.view; return (
            <li key={k.path} className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-black/30">
              {k.mime.startsWith("image/") && u ? <img src={u} alt={k.name} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-[0.55rem] text-muted-foreground">{k.name.slice(0, 8)}</span>}
              <button type="button" onClick={() => files.setKept((l) => l.filter((x) => x.path !== k.path))} aria-label={`Tirar ${k.name}`} className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white"><X size={10} /></button>
            </li>); })}
          {files.pending.map((p) => (
            <li key={p.key} className="relative h-14 w-14 overflow-hidden rounded-xl border border-cyan/40 bg-black/30" data-testid="tarefa-imagem-nova">
              {p.preview ? <img src={p.preview} alt={p.name} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center text-[0.55rem] text-muted-foreground">{p.name.slice(0, 8)}</span>}
              <button type="button" onClick={() => files.removePending(p.key)} aria-label={`Tirar ${p.name}`} className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white"><X size={10} /></button>
            </li>))}
        </ul>
      )}
    </div>
  );
}

/** Miniaturas das imagens de uma tarefa já salva; tocar abre em tela cheia. */
export function TaskThumbs({ files, title }: { files: Attachment[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null), [, setTick] = useState(0);
  useEffect(() => { primePaths(files.map((k) => k.path)).then((any) => { if (any) setTick((t) => t + 1); }).catch(() => undefined); }, [files]);
  if (!files.length) return null;
  return (
    <>
      <span className="mt-1 flex flex-wrap items-center gap-1.5" data-testid="tarefa-miniaturas">
        {files.slice(0, 4).map((k, i) => { const u = mediaUrl(k.path)?.view; return (
          <button key={k.path} type="button" onClick={(e) => { e.stopPropagation(); setOpen(i); }} aria-label={`Abrir ${k.name}`} className="h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-black/30 transition hover:scale-105 hover:border-cyan/60">
            {k.mime.startsWith("image/") && u ? <img src={u} alt={k.name} className="h-full w-full object-cover" /> : <Paperclip size={13} className="m-auto text-muted-foreground" />}
          </button>); })}
        {files.length > 4 && <span className="text-[0.68rem] text-muted-foreground">+{files.length - 4}</span>}
      </span>
      {open !== null && <MediaViewer title={title} files={files} start={open} onClose={() => setOpen(null)} />}
    </>
  );
}
