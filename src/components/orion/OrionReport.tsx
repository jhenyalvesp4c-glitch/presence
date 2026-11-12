import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BookOpen, Brain, CalendarDays, CheckCircle2, ChevronDown, ClipboardList, Download, ExternalLink, FileIcon, FileText, Folder, GraduationCap, ImageIcon, MessageSquare, Paperclip, ShieldCheck, Sparkles, StickyNote, X } from "lucide-react";

import { backdropProps } from "@/lib/backdrop";
import { signedUrlsFor } from "@/lib/data/brain";
import { KIND_LABEL, normalize, type FileRef, type OrionKind, type OrionSource } from "@/lib/orion";
import type { AskResult } from "@/lib/orion.functions";
import { Rich } from "./Rich";

export type Report = Extract<AskResult, { ok: true }> & { question: string };
type Urls = Record<string, { view: string; download: string }>;

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as React.CSSProperties;
const br = (iso: string) => iso.split("-").reverse().join("/");
const COLOR: Record<OrionKind, string> = { registro: "violet", documentacao: "amber", demanda: "cyan", tarefa: "amber", nota: "emerald", conversa: "pink", treinamento: "emerald" };
const ICON: Record<OrionKind, typeof FileText> = { registro: Sparkles, documentacao: BookOpen, demanda: ClipboardList, tarefa: CheckCircle2, nota: StickyNote, conversa: MessageSquare, treinamento: GraduationCap };
const isImg = (f: FileRef) => f.mime.startsWith("image/");
const sizeLabel = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1).replace(".", ",")} MB`);
const fkey = (f: FileRef) => `${f.bucket}/${f.path}`;

/** Número de protocolo estável para a pergunta (só visual). */
const protocol = (q: string) => { let h = 7; for (const c of q) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `ORN-${(h % 10000).toString().padStart(4, "0")}`; };

/** Destaca no trecho as palavras da pergunta. */
function Highlight({ text: raw, kws }: { text: string; kws: string[] }) {
  const text = raw.replace(/\*\*|__|`/g, "");
  if (!kws.length) return <>{text}</>;
  return (
    <>
      {text.split(/(\s+)/).map((w, i) => {
        const n = normalize(w);
        const hit = n.length >= 3 && kws.some((k) => n.includes(k.length > 5 ? k.slice(0, 5) : k));
        return hit ? <mark key={i} className="rounded bg-violet/25 px-0.5 text-foreground">{w}</mark> : <span key={i}>{w}</span>;
      })}
    </>
  );
}

function FileChip({ f, urls, onZoom }: { f: FileRef; urls: Urls; onZoom: (f: FileRef) => void }) {
  const u = urls[fkey(f)];
  const I = isImg(f) ? ImageIcon : /pdf|text|word|sheet|presentation/.test(f.mime) ? FileText : FileIcon;
  return (
    <span className="group/f relative inline-flex max-w-full items-center gap-2 overflow-hidden rounded-xl border border-border bg-secondary/40 p-1 pr-2 transition hover:-translate-y-0.5 hover:border-cyan/60 hover:shadow-[0_6px_18px_-8px_var(--cyan)]">
      {isImg(f) && u ? <button onClick={() => onZoom(f)} aria-label={`Ver ${f.name}`} className="h-9 w-9 shrink-0 overflow-hidden rounded-lg"><img src={u.view} alt={f.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover/f:scale-125" /></button>
        : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-cyan/10 text-cyan"><I size={15} /></span>}
      <span className="min-w-0 max-w-[9rem]"><span className="block truncate text-[0.68rem]">{f.name}</span><span className="text-[0.58rem] text-muted-foreground">{sizeLabel(f.size)}</span></span>
      {u && <a href={u.download} download={f.name} aria-label={`Baixar ${f.name}`} className="text-muted-foreground transition hover:text-cyan"><Download size={12} /></a>}
    </span>
  );
}

function Corner({ pos }: { pos: string }) {
  return <span aria-hidden className={`pointer-events-none absolute h-3.5 w-3.5 border-cyan/70 ${pos}`} />;
}

function SourceCard({ s, i, cited, kws, urls, onZoom }: { s: OrionSource; i: number; cited: boolean; kws: string[]; urls: Urls; onZoom: (f: FileRef) => void }) {
  const c = COLOR[s.kind], I = ICON[s.kind];
  return (
    <li id={`orion-fonte-${s.n}`} data-testid="fonte" style={{ ...tint(c), animationDelay: `${Math.min(i, 8) * 70}ms` }}
      className="group relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(135deg,color-mix(in_oklab,var(--glow)_7%,transparent),transparent_60%)] p-3 pl-4 animate-rise transition duration-300 hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--glow)_60%,transparent)] hover:shadow-[0_12px_32px_-16px_var(--glow)] target:ring-1">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--glow)] opacity-70 shadow-[0_0_14px_var(--glow)] transition group-hover:opacity-100" />
      <span aria-hidden className="scanline pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-40" />
      <div className="relative flex items-start gap-3">
        <span className="icon-tile h-10 w-10 shrink-0 !rounded-xl transition duration-300 group-hover:scale-110 group-hover:rotate-3"><I size={17} /></span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.62rem] text-muted-foreground">
            <span className="font-mono text-[0.7rem] font-semibold text-[var(--glow)]">Nº {String(s.n).padStart(2, "0")}</span>
            <span className="tag !px-1.5 !py-0 !text-[0.55rem]">{KIND_LABEL[s.kind]}</span>
            {s.date && <span className="flex items-center gap-1"><CalendarDays size={10} />{br(s.date)}</span>}
            {cited && <span className="flex items-center gap-1 rounded-full border border-emerald/50 bg-emerald/10 px-1.5 text-[0.55rem] uppercase tracking-wider text-emerald"><ShieldCheck size={9} /> citada</span>}
          </p>
          <h5 className="mt-1 break-words text-[0.82rem] font-semibold leading-snug">{s.title}</h5>
          {s.where && <p className="mt-1 flex items-center gap-1 text-[0.65rem] text-cyan"><Folder size={10} /> {s.where}</p>}
          {s.snippet && s.snippet !== s.title && <p className="mt-1.5 break-words text-[0.72rem] leading-relaxed text-muted-foreground"><Highlight text={s.snippet} kws={kws} /></p>}
          {s.files.length > 0 && <div className="mt-2.5 flex flex-wrap gap-2">{s.files.map((f) => <FileChip key={fkey(f)} f={f} urls={urls} onZoom={onZoom} />)}</div>}
        </div>
        <a href={s.link} aria-label={`Abrir ${s.title}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border bg-background/60 text-muted-foreground opacity-60 transition hover:border-cyan/60 hover:text-cyan group-hover:opacity-100"><ArrowUpRight size={13} /></a>
      </div>
    </li>
  );
}

/** Resposta do Orion no formato de relatório: texto organizado, arquivos encontrados e documentos consultados. */
export function OrionReport({ r }: { r: Report }) {
  const [urls, setUrls] = useState<Urls>({});
  const [zoom, setZoom] = useState<FileRef | null>(null);
  const [more, setMore] = useState(false);

  const cites = useMemo(() => new Set([...r.answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]))), [r.answer]);
  const featured = useMemo(() => {
    const c = r.sources.filter((s) => cites.has(s.n));
    return c.length ? c : r.sources.slice(0, 3);
  }, [r.sources, cites]);
  const rest = r.sources.filter((s) => !featured.includes(s));
  const files = useMemo(() => {
    const seen = new Set<string>(); const out: FileRef[] = [];
    for (const s of featured) for (const f of s.files) if (!seen.has(fkey(f))) { seen.add(fkey(f)); out.push(f); }
    return out.slice(0, 12);
  }, [featured]);
  const images = files.filter(isImg), docs = files.filter((f) => !isImg(f));

  useEffect(() => {
    const need = r.sources.flatMap((s) => s.files);
    if (need.length) signedUrlsFor(need).then(setUrls).catch(() => undefined);
  }, [r.sources]);
  useEffect(() => {
    if (!zoom) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setZoom(null); } };
    window.addEventListener("keydown", h, true); return () => window.removeEventListener("keydown", h, true);
  }, [zoom]);

  const cite = (n: number) => {
    if (!featured.some((s) => s.n === n)) setMore(true);
    setTimeout(() => {
      const el = document.getElementById(`orion-fonte-${n}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.animate([{ boxShadow: "0 0 0 0 transparent" }, { boxShadow: "0 0 0 3px var(--cyan)" }, { boxShadow: "0 0 0 0 transparent" }], { duration: 1200 });
    }, 60);
  };
  const stamp = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <section data-testid="orion-resposta" style={tint("violet")}
      className="relative overflow-hidden rounded-2xl border border-violet/40 bg-[linear-gradient(160deg,color-mix(in_oklab,var(--violet)_12%,transparent),color-mix(in_oklab,var(--cyan)_5%,transparent)_55%,transparent)] p-4 shadow-[0_0_50px_-22px_var(--violet)] backdrop-blur-xl animate-rise sm:p-5">
      <Corner pos="left-1.5 top-1.5 border-l border-t" /><Corner pos="right-1.5 top-1.5 border-r border-t" /><Corner pos="bottom-1.5 left-1.5 border-b border-l" /><Corner pos="bottom-1.5 right-1.5 border-b border-r" />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan to-transparent" />

      <header className="relative flex items-center gap-3">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center">
          <span className="absolute inset-0 animate-[spin_14s_linear_infinite] rounded-full border border-dashed border-cyan/60" />
          <span className="absolute inset-1 rounded-full bg-gradient-to-br from-violet/40 to-cyan/30 shadow-[0_0_20px_-4px_var(--violet)]" />
          <Brain size={17} className="relative text-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mono-caps !text-[0.62rem] text-cyan">Relatório do Orion</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.62rem] text-muted-foreground"><span className="font-mono">{protocol(r.question)}</span><span>·</span><span>{stamp}</span>{r.period && <span className="rounded-full border border-violet/40 px-1.5 text-violet">{r.period}</span>}</p>
        </div>
        <span className={`hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.58rem] uppercase tracking-wider sm:flex ${r.mode === "ia" ? "border-emerald/50 bg-emerald/10 text-emerald" : "border-amber/50 bg-amber/10 text-amber"}`}><span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-current" />{r.mode === "ia" ? "Análise por IA" : "Busca direta"}</span>
      </header>

      <blockquote className="relative mt-4 border-l-2 border-violet/60 bg-secondary/20 py-1.5 pl-3 pr-2 text-[0.75rem] italic text-muted-foreground">“{r.question}”</blockquote>

      <div className="relative mt-4" data-testid="orion-texto-resposta"><Rich text={r.answer} onCite={cite} /></div>

      {files.length > 0 && (
        <div className="relative mt-5" data-testid="orion-arquivos">
          <h4 className="mono-caps mb-2 flex items-center gap-2 !text-[0.62rem]"><Paperclip size={11} className="text-emerald" /> Arquivos encontrados <span className="text-muted-foreground">({files.length})</span></h4>
          {images.length > 0 && (
            <div className={`grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {images.map((f, i) => {
                const u = urls[fkey(f)];
                return (
                  <button key={fkey(f)} onClick={() => setZoom(f)} style={{ animationDelay: `${i * 80}ms` }} aria-label={`Ampliar ${f.name}`} data-testid="imagem-encontrada"
                    className="group/img relative overflow-hidden rounded-xl border border-border bg-secondary/40 animate-rise transition duration-300 hover:-translate-y-0.5 hover:border-emerald/60 hover:shadow-[0_12px_30px_-14px_var(--emerald)]">
                    <span className={`block w-full overflow-hidden ${images.length === 1 ? "aspect-[16/8]" : "aspect-video"}`}>
                      {u ? <img src={u.view} alt={f.name} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover/img:scale-110" /> : <span className="grid h-full place-items-center text-xs text-muted-foreground">carregando…</span>}
                    </span>
                    <span className="scanline pointer-events-none absolute inset-0 opacity-0 transition group-hover/img:opacity-40" />
                    <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-background/90 to-transparent px-2 pb-1.5 pt-6 text-left text-[0.65rem]"><ImageIcon size={11} className="text-emerald" /><span className="truncate">{f.name}</span></span>
                  </button>
                );
              })}
            </div>
          )}
          {docs.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{docs.map((f) => <FileChip key={fkey(f)} f={f} urls={urls} onZoom={setZoom} />)}</div>}
        </div>
      )}

      {r.sources.length > 0 && (
        <div className="relative mt-5">
          <h4 className="mono-caps mb-2 flex items-center gap-2 !text-[0.62rem]"><FileText size={11} className="text-violet" /> Documentos consultados <span className="text-muted-foreground">({r.sources.length})</span></h4>
          <ul className="space-y-2.5">
            {featured.map((s, i) => <SourceCard key={s.id} s={s} i={i} cited={cites.has(s.n)} kws={r.keywords} urls={urls} onZoom={setZoom} />)}
          </ul>
          {rest.length > 0 && (
            <>
              <button onClick={() => setMore((m) => !m)} aria-expanded={more} data-testid="mais-fontes"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2 text-[0.7rem] text-muted-foreground transition hover:border-violet/50 hover:text-violet">
                <ChevronDown size={13} className={`transition ${more ? "rotate-180" : ""}`} /> {more ? "Ocultar" : "Ver"} outras {rest.length} fonte{rest.length > 1 ? "s" : ""} relacionada{rest.length > 1 ? "s" : ""}
              </button>
              {more && <ul className="mt-2.5 space-y-2.5">{rest.map((s, i) => <SourceCard key={s.id} s={s} i={i} cited={false} kws={r.keywords} urls={urls} onZoom={setZoom} />)}</ul>}
            </>
          )}
        </div>
      )}

      {zoom && urls[fkey(zoom)] && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-background/90 p-4 backdrop-blur-md" {...backdropProps(() => setZoom(null))} data-testid="lightbox">
          <button onClick={() => setZoom(null)} aria-label="Fechar" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-border bg-background/80 text-muted-foreground hover:text-foreground"><X size={16} /></button>
          {isImg(zoom) ? <img src={urls[fkey(zoom)]!.view} alt={zoom.name} className="max-h-full max-w-full rounded-2xl border border-border object-contain shadow-[0_0_60px_-10px_var(--violet)]" />
            : <a href={urls[fkey(zoom)]!.view} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-border bg-background/80 px-4 py-3 text-sm"><ExternalLink size={14} /> Abrir {zoom.name}</a>}
        </div>
      )}
    </section>
  );
}
