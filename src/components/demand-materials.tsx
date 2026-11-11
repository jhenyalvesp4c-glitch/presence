import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { backdropProps } from "@/lib/backdrop";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ClipboardPaste, Copy, Check, Download, File as FileIcon, FileText, ImageIcon, Paperclip, Pencil, Trash2, Upload, X } from "lucide-react";
import {
  EMPTY_MATERIALS, MAX_FILE_MB, fileSize, getMaterials, isImage, isPdf, onMaterialsChange, putMaterials, toMaterialFiles,
  type MaterialFile, type Materials,
} from "@/lib/demand-materials";

/**
 * Corpo do texto + arquivos de uma demanda, lidos e gravados no banco. O texto é gravado 0,7 s depois da
 * última tecla (e ao fechar o painel); arquivos novos ou removidos são gravados na hora.
 */
export function useMaterials(key: string | null) {
  const [m, setM] = useState<Materials>(EMPTY_MATERIALS);
  const [ready, setReady] = useState(false);
  const cur = useRef(m);
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<Materials | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== undefined) { window.clearTimeout(timer.current); timer.current = undefined; }
    const p = pending.current;
    pending.current = null;
    if (p && key) putMaterials(key, p, { silent: true }).catch((e: Error) => toast.error(`Não consegui guardar: ${e.message}`));
  }, [key]);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const load = () => getMaterials(key).then((v) => { if (alive) { cur.current = v; setM(v); setReady(true); } }).catch(() => alive && setReady(true));
    load();
    const off = onMaterialsChange((k) => { if (k === key) load(); });
    return () => { alive = false; off(); flush(); };
  }, [key, flush]);

  const update = useCallback((fn: (m: Materials) => Materials) => {
    if (!key) return;
    const prev = cur.current;
    const next = fn(prev);
    cur.current = next; setM(next);
    pending.current = next;
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    // Mudou a lista de arquivos: grava já. Só texto ou legenda: espera parar de digitar.
    if (next.files.length !== prev.files.length) flush();
    else timer.current = window.setTimeout(flush, 700);
  }, [key, flush]);
  return { m, ready, update };
}

// Um endereço por arquivo, reaproveitado entre miniatura e tela cheia (some junto com o arquivo).
const urlCache = new WeakMap<Blob, string>();
const urlOf = (b: Blob) => { let u = urlCache.get(b); if (!u) { u = URL.createObjectURL(b); urlCache.set(b, u); } return u; };
function useObjectUrls(files: MaterialFile[]) {
  return useMemo(() => Object.fromEntries(files.map((f) => [f.id, f.blob ? urlOf(f.blob) : (f.url ?? "")])), [files]);
}

function addFiles(list: File[], onAdd: (f: MaterialFile[]) => void) {
  const { ok, tooBig } = toMaterialFiles(list);
  if (tooBig.length) toast.error(`Maior que ${MAX_FILE_MB} MB, não entrou: ${tooBig.join(", ")}`);
  if (ok.length) onAdd(ok);
}

/** Área para soltar, escolher ou colar (Ctrl+V) prints e arquivos. */
export function FileDropZone({ onAdd, pasteAnywhere }: { onAdd: (f: MaterialFile[]) => void; pasteAnywhere?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!pasteAnywhere) return;
    const h = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      addFiles(files, onAdd);
      toast.success(files.length === 1 ? "Print colado" : `${files.length} arquivos colados`);
    };
    window.addEventListener("paste", h);
    return () => window.removeEventListener("paste", h);
  }, [pasteAnywhere, onAdd]);
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); addFiles(Array.from(e.dataTransfer.files), onAdd); };
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
      className={`rounded-xl border border-dashed p-3 text-center transition ${over ? "border-cyan bg-cyan/10" : "border-border hover:border-cyan/50"}`}>
      <input ref={input} type="file" multiple hidden aria-label="Escolher arquivos"
        onChange={(e) => { addFiles(Array.from(e.target.files ?? []), onAdd); e.target.value = ""; }} />
      <button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/50 bg-cyan/10 px-3 py-1.5 text-xs text-cyan transition hover:bg-cyan/20">
        <Upload size={13} /> Adicionar prints ou arquivos
      </button>
      <p className="mt-1.5 flex items-center justify-center gap-1 text-[0.62rem] text-muted-foreground">
        Arraste aqui{pasteAnywhere ? <> ou <ClipboardPaste size={10} /> cole um print com Ctrl+V</> : ""} · imagens, PDF, planilhas… até {MAX_FILE_MB} MB
      </p>
    </div>
  );
}

/** Miniaturas: imagens grandes à mostra, PDFs e outros arquivos como cartões. */
export function FileTiles({ files, onOpen, onRemove }: { files: MaterialFile[]; onOpen?: (i: number) => void; onRemove: (id: string) => void }) {
  const urls = useObjectUrls(files);
  if (!files.length) return null;
  const imgs = files.map((f, i) => ({ f, i })).filter((x) => isImage(x.f));
  const docs = files.map((f, i) => ({ f, i })).filter((x) => !isImage(x.f));
  const del = (f: MaterialFile) => { if (window.confirm(`Remover "${f.name}"?`)) onRemove(f.id); };
  return (
    <div className="space-y-2">
      {imgs.length > 0 && (
        <div className={`grid gap-2 ${imgs.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {imgs.map(({ f, i }) => (
            <figure key={f.id} className="group relative overflow-hidden rounded-xl border border-border bg-background/40">
              <button type="button" onClick={() => onOpen?.(i)} className="block w-full" aria-label={`Ver ${f.name}`}>
                <img src={urls[f.id]} alt={f.caption || f.name} className={`w-full object-cover transition group-hover:scale-[1.02] ${imgs.length === 1 ? "max-h-72 object-top" : "aspect-[4/3]"}`} />
              </button>
              {f.caption && <figcaption className="truncate px-2 py-1 text-[0.65rem] text-muted-foreground">{f.caption}</figcaption>}
              <button type="button" onClick={() => del(f)} aria-label={`Remover ${f.name}`} title="Remover"
                className="absolute right-1.5 top-1.5 rounded-md bg-background/80 p-1 text-muted-foreground opacity-100 backdrop-blur transition hover:text-destructive md:opacity-0 md:group-hover:opacity-100"><Trash2 size={12} /></button>
            </figure>
          ))}
        </div>
      )}
      {docs.map(({ f, i }) => (
        <div key={f.id} className="group flex items-center gap-2.5 rounded-xl border border-border bg-background/30 p-2">
          <button type="button" onClick={() => onOpen?.(i)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" aria-label={`Ver ${f.name}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${isPdf(f) ? "border-pink/50 text-pink" : "border-border text-muted-foreground"}`}>
              {isPdf(f) ? <FileText size={16} /> : <FileIcon size={16} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{f.name}</span>
              <span className="block truncate text-[0.62rem] text-muted-foreground">{isPdf(f) ? "PDF" : f.name.split(".").pop()?.toUpperCase() || "Arquivo"} · {fileSize(f.size)}{f.caption ? ` · ${f.caption}` : ""}</span>
            </span>
          </button>
          <a href={f.downloadUrl ?? urls[f.id]} download={f.name} aria-label={`Baixar ${f.name}`} title="Baixar" className="rounded-md p-1.5 text-muted-foreground transition hover:text-cyan"><Download size={13} /></a>
          <button type="button" onClick={() => del(f)} aria-label={`Remover ${f.name}`} title="Remover" className="rounded-md p-1.5 text-muted-foreground transition hover:text-destructive"><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );
}

/** Tela cheia para ver prints e PDFs, passar de um para outro e escrever uma legenda. */
function FileViewer({ files, index, onIndex, onClose, onCaption }: {
  files: MaterialFile[]; index: number; onIndex: (i: number) => void; onClose: () => void; onCaption: (id: string, caption: string) => void;
}) {
  const f = files[index];
  const urls = useObjectUrls(files);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onIndex((index + 1) % files.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + files.length) % files.length);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [index, files.length, onClose, onIndex]);
  if (!f) return null;
  const url = urls[f.id];
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={f.name} {...backdropProps(onClose)} className="fixed inset-0 z-[70] flex flex-col bg-background/90 p-3 backdrop-blur-md animate-in fade-in sm:p-5">
      <div onClick={(e) => e.stopPropagation()} className="glass mx-auto flex w-full max-w-6xl items-center gap-2 rounded-2xl px-3 py-2">
        <span className="mono-caps shrink-0 !text-[0.55rem]">{index + 1}/{files.length}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
        <a href={f.downloadUrl ?? url} download={f.name} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-cyan"><Download size={13} /> Baixar</a>
        <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><X size={16} /></button>
      </div>
      <div onClick={(e) => e.stopPropagation()} className="relative mx-auto mt-3 flex min-h-0 w-full max-w-6xl flex-1 items-center justify-center">
        {isImage(f) ? <img src={url} alt={f.caption || f.name} className="max-h-full max-w-full rounded-xl border border-border object-contain" />
          : isPdf(f) ? <iframe src={url} title={f.name} className="h-full w-full rounded-xl border border-border bg-background" />
          : (
            <div className="glass rounded-2xl p-8 text-center">
              <FileIcon size={36} className="mx-auto text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">{fileSize(f.size)} · este tipo de arquivo não abre aqui</p>
              <a href={f.downloadUrl ?? url} download={f.name} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-cyan/60 bg-cyan/10 px-4 py-2 text-xs text-cyan"><Download size={13} /> Baixar arquivo</a>
            </div>
          )}
        {files.length > 1 && (
          <>
            <button onClick={() => onIndex((index - 1 + files.length) % files.length)} aria-label="Anterior" className="glass absolute left-1 top-1/2 -translate-y-1/2 rounded-full p-2 hover:text-cyan"><ChevronLeft size={18} /></button>
            <button onClick={() => onIndex((index + 1) % files.length)} aria-label="Próximo" className="glass absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-2 hover:text-cyan"><ChevronRight size={18} /></button>
          </>
        )}
      </div>
      <label onClick={(e) => e.stopPropagation()} className="glass mx-auto mt-3 flex w-full max-w-6xl items-center gap-2 rounded-2xl px-3 py-2">
        <Pencil size={13} className="shrink-0 text-muted-foreground" />
        <input value={f.caption} onChange={(e) => onCaption(f.id, e.target.value)} maxLength={200} placeholder="Legenda (ex.: imagem do template aprovada pela coordenação)" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
      </label>
    </div>,
    document.body,
  );
}

/** Bloco do painel da demanda: conteúdo (ex.: corpo do template) e todos os prints e arquivos. */
export function DemandMaterials({ storageKey }: { storageKey: string | null }) {
  const { m, ready, update } = useMaterials(storageKey);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<number | null>(null);
  const add = useCallback((files: MaterialFile[]) => update((x) => ({ ...x, files: [...x.files, ...files] })), [update]);
  const copy = () => { navigator.clipboard?.writeText(m.body).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  const imgs = m.files.filter(isImage).length;
  return (
    <section className="rounded-2xl border border-border bg-secondary/25 p-4" data-testid="materiais">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-medium"><Paperclip size={15} className="text-cyan" /> Conteúdo e anexos</h3>
        {m.files.length > 0 && <span className="text-[0.65rem] text-muted-foreground">{imgs} print{imgs === 1 ? "" : "s"} · {m.files.length - imgs} arquivo{m.files.length - imgs === 1 ? "" : "s"}</span>}
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <p className="mono-caps mr-auto !text-[0.55rem]">Corpo do texto</p>
            {m.body && !editing && (
              <>
                <button type="button" onClick={copy} className="flex items-center gap-1 text-[0.65rem] text-muted-foreground hover:text-cyan">{copied ? <><Check size={11} className="text-emerald" /> Copiado</> : <><Copy size={11} /> Copiar</>}</button>
                <button type="button" onClick={() => setEditing(true)} className="flex items-center gap-1 text-[0.65rem] text-muted-foreground hover:text-cyan"><Pencil size={11} /> Editar</button>
              </>
            )}
          </div>
          {editing || (!m.body && ready) ? (
            <div>
              <textarea value={m.body} onChange={(e) => update((x) => ({ ...x, body: e.target.value }))} rows={editing ? 8 : 3} autoFocus={editing}
                placeholder="Cole aqui o texto que te mandaram (ex.: o corpo do template)…"
                className="w-full resize-y rounded-xl border border-border bg-secondary/40 p-2.5 text-xs leading-relaxed outline-none focus:border-cyan/60" />
              {editing && <button type="button" onClick={() => setEditing(false)} className="mt-1 flex items-center gap-1 text-[0.7rem] text-cyan"><Check size={12} /> Pronto</button>}
            </div>
          ) : m.body ? (
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border-l-2 border-cyan bg-cyan/5 p-3 text-xs leading-relaxed">{m.body}</div>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="mono-caps !text-[0.55rem]">Prints e arquivos</p>
          <FileTiles files={m.files} onOpen={setView} onRemove={(id) => update((x) => ({ ...x, files: x.files.filter((f) => f.id !== id) }))} />
          <FileDropZone onAdd={add} pasteAnywhere />
        </div>
        <p className="flex items-center gap-1 text-[0.6rem] text-muted-foreground"><ImageIcon size={10} /> Fica salvo no banco: aparece em qualquer aparelho.</p>
      </div>

      {view !== null && m.files[view] && (
        <FileViewer files={m.files} index={view} onIndex={setView} onClose={() => setView(null)}
          onCaption={(id, caption) => update((x) => ({ ...x, files: x.files.map((f) => (f.id === id ? { ...f, caption } : f)) }))} />
      )}
    </section>
  );
}

/** Mesmo conteúdo, na criação da demanda (ainda sem código: guarda em memória até criar). */
export function NewDemandMaterials({ value, onChange }: { value: Materials; onChange: (m: Materials) => void }) {
  const add = useCallback((files: MaterialFile[]) => onChange({ ...value, files: [...value.files, ...files] }), [value, onChange]);
  return (
    <div className="space-y-2">
      <span className="mono-caps flex items-center gap-1.5"><Paperclip size={11} /> Conteúdo e anexos <span className="normal-case tracking-normal text-muted-foreground">(opcional)</span></span>
      <textarea value={value.body} onChange={(e) => onChange({ ...value, body: e.target.value })} rows={3} placeholder="Corpo do texto (ex.: o texto do template que te mandaram)"
        className="w-full resize-y rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-cyan/60" />
      <FileTiles files={value.files} onRemove={(id) => onChange({ ...value, files: value.files.filter((f) => f.id !== id) })} />
      <FileDropZone onAdd={add} pasteAnywhere />
    </div>
  );
}
