import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileIcon, FileText, ImageIcon, X } from "lucide-react";

import { backdropProps } from "@/lib/backdrop";
import type { MediaFile } from "@/lib/training-library";
import { mediaUrl, primePaths } from "./training-images";

const sizeLabel = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1).replace(".", ",")} MB`);
const kindOf = (f: MediaFile) => (f.mime.startsWith("image/") ? "img" : f.mime === "application/pdf" || /\.pdf$/i.test(f.name) ? "pdf" : "other");

/** Mostra os arquivos de um passo em tela cheia: imagem grande, PDF embutido ou botão de baixar. ← → trocam, Esc fecha. */
export function MediaViewer({ title, files, start = 0, onClose }: { title: string; files: MediaFile[]; start?: number; onClose: () => void }) {
  const [i, setI] = useState(Math.min(start, files.length - 1));
  const [, setTick] = useState(0);
  const f = files[i];

  useEffect(() => { primePaths(files.map((x) => x.path)).then((any) => { if (any) setTick((t) => t + 1); }).catch(() => undefined); }, [files]);
  useEffect(() => {
    // Captura as teclas antes da apresentação (que usa as mesmas setas) e não deixa passar.
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); e.stopPropagation(); setI((c) => Math.max(0, Math.min(files.length - 1, c + (e.key === "ArrowRight" ? 1 : -1)))); }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [files.length, onClose]);
  if (!f || typeof document === "undefined") return null;
  const u = mediaUrl(f.path), kind = kindOf(f);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-background/92 p-3 backdrop-blur-xl animate-rise sm:p-5" {...backdropProps(onClose)} data-testid="visualizador" role="dialog" aria-label={`Arquivos: ${title}`}>
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <span className="icon-tile h-10 w-10 shrink-0 !rounded-xl">{kind === "img" ? <ImageIcon size={17} /> : <FileText size={17} />}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="truncate text-[0.7rem] text-muted-foreground">{f.name} · {sizeLabel(f.size)}{files.length > 1 ? ` · ${i + 1} de ${files.length}` : ""}</p>
        </div>
        {u && <a href={u.download} download={f.name} aria-label="Baixar" title="Baixar" className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-cyan/60 hover:text-cyan"><Download size={15} /></a>}
        {u && kind !== "img" && <a href={u.view} target="_blank" rel="noreferrer" aria-label="Abrir em outra aba" title="Abrir em outra aba" className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:border-cyan/60 hover:text-cyan"><ExternalLink size={15} /></a>}
        <button onClick={onClose} aria-label="Fechar" data-testid="fechar-visualizador" className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground transition hover:text-foreground"><X size={16} /></button>
      </div>

      <div className="relative mt-3 grid min-h-0 flex-1 place-items-center" onClick={(e) => e.stopPropagation()}>
        {files.length > 1 && <button onClick={() => setI((c) => Math.max(0, c - 1))} disabled={i === 0} aria-label="Anterior" className="absolute left-0 z-10 grid h-11 w-11 place-items-center rounded-full border border-border bg-background/70 text-muted-foreground backdrop-blur transition hover:border-cyan hover:text-cyan disabled:opacity-0"><ChevronLeft size={20} /></button>}
        {files.length > 1 && <button onClick={() => setI((c) => Math.min(files.length - 1, c + 1))} disabled={i === files.length - 1} aria-label="Próximo" className="absolute right-0 z-10 grid h-11 w-11 place-items-center rounded-full border border-border bg-background/70 text-muted-foreground backdrop-blur transition hover:border-cyan hover:text-cyan disabled:opacity-0"><ChevronRight size={20} /></button>}
        <div key={f.path} className="relative flex h-full max-h-full w-full max-w-[min(94vw,1400px)] items-center justify-center" style={{ animation: "pres-pop .35s both" }}>
          {!u ? <p className="text-sm text-muted-foreground">Carregando arquivo…</p>
            : kind === "img" ? <img src={u.view} alt={f.name} data-testid="imagem-passo" className="max-h-full max-w-full rounded-2xl border border-[color-mix(in_oklab,var(--cyan)_45%,transparent)] object-contain shadow-[0_0_70px_-14px_var(--cyan)]" />
            : kind === "pdf" ? <iframe src={u.view} title={f.name} className="h-full w-full rounded-2xl border border-border bg-white" />
            : <div className="grid place-items-center gap-4 rounded-3xl border border-border bg-secondary/30 p-10 text-center"><FileIcon size={52} className="text-cyan" /><p className="text-lg font-medium">{f.name}</p><a href={u.download} download={f.name} className="flex items-center gap-2 rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:scale-105"><Download size={15} /> Baixar arquivo</a></div>}
        </div>
      </div>

      {files.length > 1 && (
        <div className="mt-3 flex justify-center gap-2 overflow-x-auto pb-1" onClick={(e) => e.stopPropagation()}>
          {files.map((x, k) => (
            <button key={x.path} onClick={() => setI(k)} aria-label={`Arquivo ${k + 1}: ${x.name}`} className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border transition hover:-translate-y-0.5 ${k === i ? "border-cyan shadow-[0_0_20px_-4px_var(--cyan)]" : "border-border opacity-70 hover:opacity-100"}`}>
              {kindOf(x) === "img" && mediaUrl(x.path) ? <img src={mediaUrl(x.path)!.view} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-cyan"><FileText size={18} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}