import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpRight, BookOpen, CalendarDays, Download, ExternalLink, File as FileIcon, FileText, Image as ImageIcon, KeyRound, Paperclip, Pencil, Save, Sparkles, Trash2, X } from "lucide-react";

import { backdropProps } from "@/lib/backdrop";
import { sizeLabel } from "@/lib/brain-files";
import { updateEntry, type Attachment, type BrainEntry } from "@/lib/data/brain";
import { codesIn } from "./BrainGraph";

export type Urls = Record<string, { view: string; download: string }>;
export const tint = (v: string) => ({ "--glow": `var(--${v})` }) as React.CSSProperties;
export const brDate = (iso: string) => iso.split("-").reverse().join("/");
export const isImage = (a: Attachment) => a.mime.startsWith("image/");
export const isMirror = (e: BrainEntry) => e.source === "documentacao";
export const entryTitle = (e: BrainEntry) => e.title || e.text.replace(/\s+/g, " ").slice(0, 70) || e.attachments[0]?.name || "Anotação";
export const srcColor = (e: BrainEntry) => (isMirror(e) ? "amber" : e.attachments.length ? "emerald" : "violet");
const srcLabel = (e: BrainEntry) => (isMirror(e) ? (e.refId?.startsWith("login:") ? "Login" : "Documentação") : e.attachments.length ? "Com arquivos" : "Anotação");

export function AttachIcon({ a, className = "" }: { a: Attachment; className?: string }) {
  const I = isImage(a) ? ImageIcon : /pdf|text|word|sheet|presentation/.test(a.mime) ? FileText : FileIcon;
  return <I className={className} size={16} />;
}

/** Cartão da linha do tempo: sobe e brilha ao passar o mouse; editar/excluir só aparecem no hover. */
export function EntryCard({ e, urls, delay, onOpen, onDelete }: { e: BrainEntry; urls: Urls; delay: number; onOpen: () => void; onDelete: () => void }) {
  const mirror = isMirror(e);
  const imgs = e.attachments.filter(isImage).slice(0, 3);
  const others = e.attachments.length - imgs.length;
  return (
    <article style={{ ...tint(srcColor(e)), animationDelay: `${Math.min(delay, 12) * 0.04}s` }} data-testid="cartao-cerebro"
      className="accent-card group relative cursor-pointer !rounded-2xl p-4 animate-rise transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_40px_-16px_var(--glow)]"
      onClick={onOpen} tabIndex={0} role="button" aria-label={`Abrir ${entryTitle(e)}`} onKeyDown={(k) => { if (k.key === "Enter") onOpen(); }}>
      <span className="scanline pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-60" />
      <div className="relative flex items-start gap-3">
        <span className="icon-tile h-10 w-10 shrink-0 transition duration-300 group-hover:scale-110 group-hover:rotate-3">
          {mirror ? (e.refId?.startsWith("login:") ? <KeyRound size={17} /> : <BookOpen size={17} />) : e.attachments.length ? <Paperclip size={17} /> : <Sparkles size={17} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.65rem] text-muted-foreground">
            <span className="tag !px-1.5 !py-0 !text-[0.55rem]" style={tint(srcColor(e))}>{srcLabel(e)}</span>
            <span className="flex items-center gap-1"><CalendarDays size={10} />{brDate(e.date)}</span>
          </p>
          <h3 className="mt-1 line-clamp-2 break-words text-sm font-semibold leading-snug">{entryTitle(e)}</h3>
          {e.text && e.text !== entryTitle(e) && <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">{e.text}</p>}
        </div>
      </div>
      {(imgs.length > 0 || others > 0) && (
        <div className="relative mt-3 flex items-center gap-2">
          {imgs.map((a) => (
            <span key={a.path} className="h-14 w-14 overflow-hidden rounded-xl border border-border bg-secondary/40 transition duration-300 group-hover:border-[var(--glow)]">
              {urls[a.path] ? <img src={urls[a.path]!.view} alt={a.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" /> : null}
            </span>
          ))}
          {others > 0 && <span className="flex h-14 items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 text-[0.7rem] text-muted-foreground"><Paperclip size={12} /> +{others} arquivo{others > 1 ? "s" : ""}</span>}
        </div>
      )}
      {e.dossiers.length > 0 && (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {e.dossiers.map((d) => <span key={d} className="rounded-full border border-cyan/40 bg-cyan/10 px-2 py-0.5 text-[0.62rem] text-cyan">{d}</span>)}
        </div>
      )}
      <span className="absolute right-3 top-3 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
        <span role="button" tabIndex={0} aria-label="Abrir" className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-background/80 text-muted-foreground backdrop-blur transition hover:border-cyan/60 hover:text-cyan"><ArrowUpRight size={13} /></span>
        {!mirror && <span role="button" tabIndex={0} aria-label="Excluir" data-testid="excluir-cerebro" onClick={(ev) => { ev.stopPropagation(); onDelete(); }}
          onKeyDown={(k) => { if (k.key === "Enter") { k.stopPropagation(); onDelete(); } }} className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-background/80 text-muted-foreground backdrop-blur transition hover:border-destructive/60 hover:text-destructive"><Trash2 size={13} /></span>}
      </span>
    </article>
  );
}

/** Arquivo na grade "Arquivos": miniatura que dá zoom ao passar o mouse. */
export function FileTile({ a, e, urls, onOpen }: { a: Attachment; e: BrainEntry; urls: Urls; onOpen: () => void }) {
  return (
    <button onClick={onOpen} style={tint(isImage(a) ? "emerald" : "cyan")} data-testid="arquivo-cerebro"
      className="accent-card group relative flex flex-col overflow-hidden !rounded-2xl text-left transition duration-300 hover:-translate-y-1 hover:shadow-[0_14px_40px_-16px_var(--glow)]">
      <span className="relative block aspect-[4/3] overflow-hidden bg-secondary/40">
        {isImage(a) && urls[a.path] ? <img src={urls[a.path]!.view} alt={a.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
          : <span className="grid h-full place-items-center text-[var(--glow)]"><AttachIcon a={a} className="h-9 w-9 transition duration-300 group-hover:scale-125 group-hover:rotate-6" /></span>}
        <span className="scanline pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-50" />
      </span>
      <span className="block p-3">
        <span className="block truncate text-xs font-medium">{a.name}</span>
        <span className="mt-0.5 block truncate text-[0.65rem] text-muted-foreground">{sizeLabel(a.size)} · {brDate(e.date)}{e.dossiers[0] ? ` · ${e.dossiers[0]}` : ""}</span>
      </span>
    </button>
  );
}

/** Painel lateral com tudo de uma anotação: texto, arquivos, conteúdo lido, ligações; edita e exclui. */
export function EntryDrawer({ e, all, urls, onClose, onChanged, onDelete, onOpen }: { e: BrainEntry; all: BrainEntry[]; urls: Urls; onClose: () => void; onChanged: (n: BrainEntry) => void; onDelete: () => void; onOpen: (id: string) => void }) {
  const mirror = isMirror(e);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(e.title);
  const [text, setText] = useState(e.text);
  const [date, setDate] = useState(e.date);
  const [saving, setSaving] = useState(false);
  const [big, setBig] = useState<Attachment | null>(null);
  useEffect(() => { setEdit(false); setTitle(e.title); setText(e.text); setDate(e.date); }, [e.id, e.title, e.text, e.date]);
  useEffect(() => {
    const h = (k: KeyboardEvent) => { if (k.key === "Escape") { if (big) setBig(null); else onClose(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [big, onClose]);

  const related = all.filter((o) => o.id !== e.id && (o.dossiers.some((d) => e.dossiers.includes(d)) || codesIn(`${o.title} ${o.text}`).some((c) => codesIn(`${e.title} ${e.text}`).includes(c)))).slice(0, 6);
  const codes = codesIn(`${e.title} ${e.text}`);
  const save = async () => {
    setSaving(true);
    try { onChanged(await updateEntry(e.id, { text, title, date })); setEdit(false); toast.success("Anotação atualizada"); }
    catch (err) { toast.error((err as Error).message); }
    setSaving(false);
  };
  const field = "w-full rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm outline-none transition focus:border-violet/60";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/60 backdrop-blur-sm" {...backdropProps(onClose)} data-testid="gaveta-cerebro">
      <div className="pointer-events-none flex min-h-full justify-end">
        <aside onClick={(ev) => ev.stopPropagation()} style={tint(srcColor(e))} className="glass pointer-events-auto relative min-h-full w-full max-w-lg overflow-hidden !rounded-none p-6 sm:!rounded-l-3xl animate-rise">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--glow)] opacity-20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="icon-tile h-12 w-12 shrink-0 !rounded-2xl">{mirror ? <BookOpen size={20} /> : <Sparkles size={20} />}</span>
            <div className="min-w-0 flex-1">
              <p className="mono-caps">{srcLabel(e)} · {brDate(e.date)}</p>
              {edit ? <input value={title} onChange={(k) => setTitle(k.target.value)} placeholder="Título (opcional)" className={`${field} mt-1`} />
                : <h2 className="mt-1 break-words font-display text-xl font-semibold leading-snug">{entryTitle(e)}</h2>}
            </div>
            <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>

          <div className="relative mt-4 flex flex-wrap gap-2">
            {mirror ? <Link to="/demandas" className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs transition hover:border-amber/60 hover:text-amber"><ExternalLink size={12} /> Editar na Documentação</Link> : (
              <>
                {edit ? <button onClick={save} disabled={saving || (!text.trim() && !e.attachments.length)} className="flex items-center gap-1.5 rounded-xl bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground transition enabled:hover:scale-105 disabled:opacity-40"><Save size={12} /> Salvar</button>
                  : <button onClick={() => setEdit(true)} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs transition hover:border-cyan/60 hover:text-cyan"><Pencil size={12} /> Editar</button>}
                <button onClick={onDelete} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs transition hover:border-destructive/60 hover:text-destructive"><Trash2 size={12} /> Excluir</button>
              </>
            )}
          </div>

          <div className="relative mt-5">
            {edit ? (
              <div className="space-y-3">
                <label className="block text-xs text-muted-foreground">Data do acontecimento<input type="date" value={date} onChange={(k) => setDate(k.target.value)} className={`${field} mt-1`} /></label>
                <textarea value={text} onChange={(k) => setText(k.target.value)} rows={8} className={`${field} resize-y`} />
              </div>
            ) : e.text ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{e.text}</p> : <p className="text-sm text-muted-foreground">Sem texto: só arquivos.</p>}
          </div>

          {e.dossiers.length > 0 && <div className="relative mt-4 flex flex-wrap gap-1.5">{e.dossiers.map((d) => <span key={d} className="rounded-full border border-cyan/40 bg-cyan/10 px-2.5 py-0.5 text-xs text-cyan">{d}</span>)}</div>}

          {e.attachments.length > 0 && (
            <section className="relative mt-6">
              <h3 className="mono-caps mb-2 flex items-center gap-2"><Paperclip size={11} /> Arquivos ({e.attachments.length})</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {e.attachments.map((a) => (
                  <div key={a.path} className="group/a relative overflow-hidden rounded-xl border border-border bg-secondary/30 transition hover:border-[var(--glow)]">
                    {isImage(a) && urls[a.path] ? (
                      <button onClick={() => setBig(a)} className="block w-full" aria-label={`Ver ${a.name}`}><img src={urls[a.path]!.view} alt={a.name} className="h-32 w-full object-cover transition duration-500 group-hover/a:scale-105" /></button>
                    ) : <span className="grid h-20 place-items-center text-[var(--glow)]"><AttachIcon a={a} className="h-7 w-7" /></span>}
                    <div className="flex items-center gap-2 p-2">
                      <span className="min-w-0 flex-1"><span className="block truncate text-[0.7rem]">{a.name}</span><span className="text-[0.6rem] text-muted-foreground">{sizeLabel(a.size)}</span></span>
                      {urls[a.path] && <a href={urls[a.path]!.download} download={a.name} aria-label={`Baixar ${a.name}`} className="text-muted-foreground transition hover:text-[var(--glow)]"><Download size={14} /></a>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {e.summary && (
            <details className="relative mt-5 rounded-xl border border-border bg-secondary/30 p-3 text-xs">
              <summary className="cursor-pointer select-none text-muted-foreground transition hover:text-foreground">Conteúdo lido dos arquivos (usado na busca)</summary>
              <p className="mt-2 max-h-60 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">{e.summary}</p>
            </details>
          )}

          {(codes.length > 0 || related.length > 0) && (
            <section className="relative mt-6">
              <h3 className="mono-caps mb-2">Ligações</h3>
              {codes.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{codes.map((c) => <Link key={c} to="/demandas" className="rounded-full border border-pink/40 bg-pink/10 px-2 py-0.5 font-mono text-[0.65rem] text-pink transition hover:scale-105">{c}</Link>)}</div>}
              <ul className="space-y-1.5">
                {related.map((o) => (
                  <li key={o.id}><button onClick={() => onOpen(o.id)} className="group/r flex w-full items-center gap-2 rounded-xl border border-border bg-secondary/20 px-3 py-2 text-left text-xs transition hover:translate-x-1 hover:border-violet/50">
                    <span className="min-w-0 flex-1 truncate">{entryTitle(o)}</span><span className="text-[0.65rem] text-muted-foreground">{brDate(o.date)}</span><ArrowUpRight size={11} className="opacity-0 transition group-hover/r:opacity-100" />
                  </button></li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
      {big && urls[big.path] && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-background/90 p-4 backdrop-blur-md" {...backdropProps(() => setBig(null))}>
          <img src={urls[big.path]!.view} alt={big.name} className="max-h-full max-w-full rounded-2xl border border-border object-contain shadow-[0_0_60px_-10px_var(--violet)]" />
        </div>
      )}
    </div>
  );
}
