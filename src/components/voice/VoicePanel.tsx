import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AlarmClock, ArrowUpRight, Bell, CalendarDays, Check, ClipboardList, Flame, ListChecks, Rocket, Sparkles, StickyNote, X } from "lucide-react";

import { addItems, setItemDone } from "@/lib/data/checklists";
import { normalize } from "@/lib/orion";
import type { Panel } from "@/lib/voice/agent";

type Tone = { c: string; Icon: typeof Bell };
const ROSE = "oklch(0.72 0.18 10)", AMBER = "oklch(0.82 0.15 75)";

/** Cor e ícone de cada seção, pelo nome. */
function toneOf(title: string): Tone {
  const n = normalize(title);
  if (n.includes("compromiss")) return { c: "var(--violet)", Icon: CalendarDays };
  if (n.includes("lembret")) return { c: AMBER, Icon: Bell };
  if (n.includes("atrasad")) return { c: ROSE, Icon: AlarmClock };
  if (n.includes("alta")) return { c: ROSE, Icon: Flame };
  if (n.includes("andamento")) return { c: "var(--emerald)", Icon: Rocket };
  if (n.includes("anota")) return { c: "var(--violet)", Icon: StickyNote };
  if (n.includes("demanda")) return { c: "var(--cyan)", Icon: ClipboardList };
  if (n.includes("tarefa")) return { c: "var(--cyan)", Icon: ListChecks };
  return { c: "var(--cyan)", Icon: Sparkles };
}

const countOf = (title: string) => /\((\d+)\)\s*$/.exec(title)?.[1];
const bare = (title: string) => title.replace(/\s*\(\d+\)\s*$/, "");
/** "09:00–10:00 · local" → hora separada do resto. */
const splitTime = (d?: string) => { const m = d ? /^(\d{2}:\d{2}(?:–\d{2}:\d{2})?)(?:\s*·\s*)?(.*)$/.exec(d) : null; return m ? { time: m[1]!, rest: m[2] || undefined } : { time: undefined, rest: d }; };

/** Modal do que o Presence mostra por voz (o dia, registros, o que foi criado): bonito, organizado e clicável. */
export function VoicePanel({ panel, onClose, onOpen }: { panel: Panel; onClose: () => void; onOpen: (href: string) => void }) {
  /** Itens de lista tocados aqui: marcar/incluir sem fechar o painel. */
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const act = async (key: string, it: Panel["secoes"][number]["itens"][number]) => {
    try {
      if (it.marcar) { const next = !(key in local ? local[key] : it.feita); setLocal((m) => ({ ...m, [key]: next })); await setItemDone(it.marcar, next); }
      else if (it.incluir && !local[key]) { setLocal((m) => ({ ...m, [key]: true })); await addItems(it.incluir.lista, [{ texto: it.rotulo }]); }
    } catch { setLocal((m) => { const n = { ...m }; delete n[key]; return n; }); }
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose]);

  const total = panel.secoes.reduce((n, s) => n + s.itens.length, 0);
  const sections = panel.secoes.filter((s) => s.itens.length);
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/70 p-3 backdrop-blur-md sm:p-6" onClick={onClose} data-testid="voz-painel">
      <div role="dialog" aria-label={panel.titulo} onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[oklch(0.15_0.03_265/0.94)] shadow-[0_40px_120px_-30px_var(--violet),0_0_0_1px_color-mix(in_oklab,var(--cyan)_18%,transparent)]"
        style={{ animation: "vp-in .55s cubic-bezier(.2,.8,.2,1) both" }}>
        {/* aurora e brilho */}
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-[var(--violet)] opacity-30 blur-3xl" style={{ animation: "vp-aurora 12s ease-in-out infinite" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-[var(--cyan)] opacity-20 blur-3xl" style={{ animation: "vp-aurora 15s ease-in-out infinite reverse" }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden"><span className="block h-px w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent" style={{ animation: "vp-sweep 4s ease-in-out infinite" }} /></div>

        {/* cabeçalho */}
        <header className="relative flex items-start gap-4 px-6 pb-4 pt-6 sm:px-8 sm:pt-7">
          <span className="relative grid h-14 w-14 shrink-0 place-items-center">
            <span aria-hidden className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg, var(--cyan), var(--violet), var(--emerald), var(--cyan))", animation: "vp-spin 6s linear infinite", mask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))", WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))" }} />
            <span aria-hidden className="absolute inset-1.5 rounded-full bg-[var(--cyan)] opacity-20 blur-md" />
            <span className="relative grid h-10 w-10 place-items-center rounded-full bg-background/70"><Check size={18} className="text-cyan" /></span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="mono-caps !text-[0.6rem]">Presence · para você</p>
            <h2 className="mt-1 font-serif text-3xl leading-tight tracking-tight first-letter:uppercase sm:text-4xl"><span className="text-gradient">{panel.titulo}</span></h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-foreground/90">{total} {total === 1 ? "item" : "itens"}</span>
              {sections.map((s, i) => { const t = toneOf(s.titulo); return (
                <span key={i} className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs" style={{ borderColor: `color-mix(in oklab, ${t.c} 40%, transparent)`, background: `color-mix(in oklab, ${t.c} 12%, transparent)`, color: t.c }}>
                  <t.Icon size={12} /> {bare(s.titulo)} <b className="font-semibold">{countOf(s.titulo) ?? s.itens.length}</b>
                </span>); })}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar painel" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition hover:rotate-90 hover:text-foreground"><X size={16} /></button>
        </header>

        {/* corpo */}
        <div className="relative min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6 sm:px-8">
          {sections.map((s, i) => {
            const t = toneOf(s.titulo);
            return (
              <section key={i} style={{ "--tone": t.c, animation: `vp-item .5s ease ${0.12 + i * 0.09}s both` } as CSSProperties}>
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "color-mix(in oklab, var(--tone) 16%, transparent)", color: "var(--tone)" }}><t.Icon size={14} /></span>
                  <h3 className="text-sm font-semibold tracking-wide" style={{ color: "var(--tone)" }}>{bare(s.titulo)}</h3>
                  <span aria-hidden className="h-px flex-1" style={{ background: "linear-gradient(to right, color-mix(in oklab, var(--tone) 45%, transparent), transparent)" }} />
                  <span className="rounded-full px-2 py-0.5 text-[0.68rem] font-semibold" style={{ background: "color-mix(in oklab, var(--tone) 16%, transparent)", color: "var(--tone)" }}>{s.itens.length}</span>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {s.itens.map((it, k) => {
                    const { time, rest } = splitTime(it.detalhe);
                    const key = `${i}-${k}`, feita = key in local ? !!local[key] : !!it.feita, acts = !!(it.marcar || it.incluir);
                    return (
                      <li key={k} style={{ animation: `vp-item .45s ease ${0.2 + i * 0.09 + k * 0.035}s both` }}>
                        <button onClick={() => { if (acts) void act(key, it); else if (it.link) { onClose(); onOpen(it.link); } }} disabled={!it.link && !acts}
                          className="group relative flex h-full w-full items-start gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition duration-300 enabled:hover:-translate-y-0.5 enabled:hover:bg-white/[0.08]"
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "color-mix(in oklab, var(--tone) 55%, transparent)"; e.currentTarget.style.boxShadow = "0 10px 30px -16px var(--tone)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; e.currentTarget.style.boxShadow = ""; }}>
                          <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-full" style={{ background: "var(--tone)", opacity: feita ? 0.35 : 0.9 }} />
                          {time ? <span className="mt-0.5 shrink-0 rounded-lg px-2 py-1 font-mono text-[0.7rem] font-medium" style={{ background: "color-mix(in oklab, var(--tone) 14%, transparent)", color: "var(--tone)" }}>{time}</span>
                            : <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ background: "color-mix(in oklab, var(--tone) 14%, transparent)", color: "var(--tone)" }}>{feita ? <Check size={12} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>}
                          <span className="min-w-0 flex-1">
                            <span className={`block break-words text-sm leading-snug ${feita && !it.incluir ? "text-muted-foreground line-through" : "text-foreground"}`}>{it.rotulo}</span>
                            {rest && <span className="mt-0.5 block text-[0.72rem] text-muted-foreground">{rest}</span>}
                          </span>
                          {it.link && !acts && <ArrowUpRight size={13} className="mt-1 shrink-0 opacity-0 transition group-hover:opacity-100" style={{ color: "var(--tone)" }} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          {!sections.length && <p className="py-10 text-center text-sm text-muted-foreground">Nada por aqui.</p>}
        </div>

        <footer className="relative flex items-center justify-between gap-3 border-t border-white/10 px-6 py-3 text-[0.7rem] text-muted-foreground sm:px-8">
          <span>{sections.some((x) => x.itens.some((y) => y.marcar || y.incluir)) ? "Toque para marcar ou incluir · Esc fecha" : "Toque num item para abrir · Esc fecha"}</span>
          <span className="flex items-center gap-2">
            {panel.abrir && <button onClick={() => { onClose(); onOpen(panel.abrir!.para); }} className="rounded-full border border-cyan/40 bg-cyan/10 px-4 py-1.5 text-xs font-medium text-cyan transition hover:bg-cyan/20">{panel.abrir.rotulo}</button>}
            <button onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-foreground transition hover:border-cyan/50 hover:text-cyan">Fechar</button>
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
