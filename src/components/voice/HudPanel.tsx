import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";

import { addItems, setItemDone } from "@/lib/data/checklists";
import type { Panel } from "@/lib/voice/agent";
import { bare, countOf, splitTime, toneOf } from "./VoicePanel";

const PER_CARD = 6, AUTO_MS = 8000;

/** O que o Orion mostra por voz, no estilo HUD (Jarvis): cartões de vidro flutuantes que entram, se mexem, trocam por outros e saem sozinhos. Não bloqueia a tela. */
export function HudPanel({ panel, leaving, onClose, onOpen }: { panel: Panel; leaving: boolean; onClose: () => void; onOpen: (href: string) => void }) {
  const sections = useMemo(() => panel.secoes.filter((s) => s.itens.length), [panel]);
  const total = sections.reduce((n, s) => n + s.itens.length, 0);
  const [perPage, setPerPage] = useState(3);
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState(false);
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const pages = Math.max(1, Math.ceil(sections.length / perPage));
  const hoverRef = useRef(false); hoverRef.current = hover;

  useEffect(() => { const f = () => setPerPage(window.innerWidth < 640 ? 1 : window.innerWidth < 1024 ? 2 : 3); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  useEffect(() => { setPage(0); setLocal({}); }, [panel]);
  useEffect(() => { if (page >= pages) setPage(0); }, [page, pages]);
  // troca sozinha de cartões, como um painel de comando (pausa quando o mouse está em cima)
  useEffect(() => {
    if (pages < 2 || leaving) return;
    const t = setInterval(() => { if (!hoverRef.current) setPage((p) => (p + 1) % pages); }, AUTO_MS);
    return () => clearInterval(t);
  }, [pages, leaving]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);

  const act = async (key: string, it: Panel["secoes"][number]["itens"][number]) => {
    try {
      if (it.marcar) { const next = !(key in local ? local[key] : it.feita); setLocal((m) => ({ ...m, [key]: next })); await setItemDone(it.marcar, next); }
      else if (it.incluir && !local[key]) { setLocal((m) => ({ ...m, [key]: true })); await addItems(it.incluir.lista, [{ texto: it.rotulo }]); }
    } catch { setLocal((m) => { const n = { ...m }; delete n[key]; return n; }); }
  };

  if (typeof document === "undefined") return null;
  const visible = sections.slice(page * perPage, page * perPage + perPage);
  const FROM = ["hud-from-left", "hud-from-up", "hud-from-right"];
  const OFFSET = [0, 34, 10];

  return createPortal(
    <div className={`pointer-events-none fixed inset-0 z-[70] ${leaving ? "hud-leave" : ""}`} data-testid="voz-painel" role="dialog" aria-label={panel.titulo}>
      <div aria-hidden className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 38%, oklch(0.1 0.03 265 / .12) 25%, oklch(0.08 0.03 265 / .5) 100%)", backdropFilter: "blur(2.5px) brightness(.9) saturate(1.05)", WebkitBackdropFilter: "blur(2.5px) brightness(.9) saturate(1.05)", animation: leaving ? "hud-fade-out .45s ease both" : "hud-fade .6s ease both" }} />

      <div className="absolute inset-x-0 top-[5dvh] mx-auto flex max-h-[90dvh] w-full max-w-6xl flex-col items-center gap-4 px-3 sm:px-6">
        {/* cabeçalho flutuante */}
        <header className="hud-card pointer-events-auto relative flex w-full max-w-2xl items-center gap-4 rounded-2xl border border-white/15 bg-[oklch(0.13_0.035_265/0.7)] px-4 py-3 shadow-[0_20px_60px_-24px_var(--cyan)] backdrop-blur-xl"
          style={{ animation: leaving ? "hud-out .4s ease both" : "hud-from-up .7s cubic-bezier(.2,.8,.2,1) both, hud-float 7s ease-in-out .8s infinite" }}>
          <Corners />
          <span className="relative grid h-12 w-12 shrink-0 place-items-center" aria-hidden>
            <span className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg, var(--cyan), var(--violet), var(--emerald), var(--cyan))", animation: "vp-spin 5s linear infinite", mask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))", WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))" }} />
            <span className="absolute inset-1.5 rounded-full border border-dashed border-white/25" style={{ animation: "vp-spin 14s linear infinite reverse" }} />
            <span className="relative grid h-7 w-7 place-items-center rounded-full bg-background/70"><Check size={14} className="text-cyan" /></span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="mono-caps !text-[0.58rem] !tracking-[0.3em]">Orion · para você</p>
            <h2 className="truncate font-serif text-2xl leading-tight tracking-tight first-letter:uppercase sm:text-3xl"><span className="text-gradient">{panel.titulo}</span></h2>
          </div>
          <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-foreground/90 sm:block">{total} {total === 1 ? "item" : "itens"}</span>
          <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition hover:rotate-90 hover:border-cyan/50 hover:text-foreground active:scale-95"><X size={16} /></button>
        </header>

        {/* cartões flutuantes */}
        <div key={page} className="flex w-full flex-wrap items-start justify-center gap-4 px-1 pb-6 pt-1" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          {visible.map((s, i) => {
            const t = toneOf(s.titulo), more = s.itens.length - PER_CARD, secIdx = page * perPage + i;
            return (
              <section key={secIdx} className="hud-card pointer-events-auto relative w-full max-w-[22rem] rounded-2xl border bg-[oklch(0.13_0.035_265/0.72)] p-4 backdrop-blur-xl sm:w-[22rem]"
                style={{ "--tone": t.c, borderColor: "color-mix(in oklab, var(--tone) 38%, transparent)", boxShadow: "0 24px 70px -28px var(--tone), inset 0 1px 0 rgb(255 255 255 / .08)", marginTop: perPage > 1 ? OFFSET[i % 3] : 0,
                  animation: leaving ? `hud-out .4s ease ${i * 0.05}s both` : `${FROM[i % 3]} .75s cubic-bezier(.2,.8,.2,1) ${0.12 + i * 0.12}s both, hud-float ${6 + i * 1.3}s ease-in-out ${1 + i * 0.4}s infinite` } as CSSProperties}>
                <Corners />
                <span aria-hidden className="pointer-events-none absolute inset-x-3 top-0 h-px overflow-hidden"><span className="block h-px w-1/3 bg-gradient-to-r from-transparent via-white/80 to-transparent" style={{ animation: `vp-sweep ${3.5 + i}s ease-in-out infinite` }} /></span>
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "color-mix(in oklab, var(--tone) 18%, transparent)", color: "var(--tone)", boxShadow: "0 0 18px -4px var(--tone)" }}><t.Icon size={15} /></span>
                  <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-wide" style={{ color: "var(--tone)" }}>{bare(s.titulo)}</h3>
                  <span className="rounded-full px-2 py-0.5 font-mono text-[0.7rem] font-semibold" style={{ background: "color-mix(in oklab, var(--tone) 16%, transparent)", color: "var(--tone)" }}>{countOf(s.titulo) ?? s.itens.length}</span>
                </div>
                <ul className="max-h-[42dvh] space-y-1.5 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
                  {s.itens.slice(0, PER_CARD).map((it, k) => {
                    const { time, rest } = splitTime(it.detalhe);
                    const key = `${secIdx}-${k}`, feita = key in local ? !!local[key] : !!it.feita, acts = !!(it.marcar || it.incluir);
                    return (
                      <li key={k} style={{ animation: leaving ? "none" : `vp-item .45s ease ${0.45 + i * 0.12 + k * 0.07}s both` }}>
                        <button onClick={() => { if (acts) void act(key, it); else if (it.link) { onClose(); onOpen(it.link); } }} disabled={!it.link && !acts}
                          className="group relative flex w-full items-start gap-2.5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-left transition duration-300 enabled:hover:-translate-y-0.5 enabled:hover:border-[color:var(--tone)] enabled:hover:bg-white/[0.09] enabled:active:scale-[.98]">
                          <span aria-hidden className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full" style={{ background: "var(--tone)", opacity: feita ? 0.35 : 0.95, boxShadow: "0 0 10px var(--tone)" }} />
                          {time ? <span className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[0.68rem]" style={{ background: "color-mix(in oklab, var(--tone) 14%, transparent)", color: "var(--tone)" }}>{time}</span>
                            : <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ background: "color-mix(in oklab, var(--tone) 14%, transparent)", color: "var(--tone)" }}>{feita ? <Check size={11} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}</span>}
                          <span className="min-w-0 flex-1">
                            <span className={`block break-words text-[0.82rem] leading-snug ${feita && !it.incluir ? "text-muted-foreground line-through" : "text-foreground"}`}>{it.rotulo}</span>
                            {rest && <span className="mt-0.5 block break-words text-[0.7rem] text-muted-foreground">{rest}</span>}
                          </span>
                          {it.link && !acts && <ArrowUpRight size={12} className="mt-1 shrink-0 opacity-0 transition group-hover:opacity-100" style={{ color: "var(--tone)" }} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {more > 0 && <p className="mt-2 text-center font-mono text-[0.68rem] text-muted-foreground">+ {more} {more === 1 ? "item" : "itens"}{panel.abrir ? " · veja tudo abaixo" : ""}</p>}
              </section>
            );
          })}
          {!sections.length && <p className="rounded-2xl border border-white/10 bg-[oklch(0.13_0.035_265/0.7)] px-6 py-8 text-sm text-muted-foreground backdrop-blur-xl">Nada por aqui.</p>}
        </div>

        {/* barra de comando */}
        <footer className="hud-card pointer-events-auto flex items-center gap-3 rounded-full border border-white/12 bg-[oklch(0.13_0.035_265/0.7)] px-3 py-1.5 backdrop-blur-xl" style={{ animation: leaving ? "hud-out .35s ease both" : "hud-from-bottom .7s cubic-bezier(.2,.8,.2,1) .5s both" }}>
          {pages > 1 && <>
            <button onClick={() => setPage((p) => (p - 1 + pages) % pages)} aria-label="Cartões anteriores" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-cyan active:scale-90"><ChevronLeft size={15} /></button>
            <span className="flex items-center gap-1.5">{Array.from({ length: pages }).map((_, k) => <button key={k} onClick={() => setPage(k)} aria-label={`Página ${k + 1}`} className="h-1.5 rounded-full transition-all duration-500" style={{ width: k === page ? 22 : 6, background: k === page ? "var(--cyan)" : "rgb(255 255 255 / .25)", boxShadow: k === page ? "0 0 10px var(--cyan)" : "none" }} />)}</span>
            <button onClick={() => setPage((p) => (p + 1) % pages)} aria-label="Próximos cartões" className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-cyan active:scale-90"><ChevronRight size={15} /></button>
          </>}
          <span className="hidden px-1 text-[0.68rem] text-muted-foreground sm:block">Diga “obrigada” e eu fecho</span>
          {panel.abrir && <button onClick={() => { onClose(); onOpen(panel.abrir!.para); }} className="rounded-full border border-cyan/40 bg-cyan/10 px-3.5 py-1 text-xs font-medium text-cyan transition hover:-translate-y-0.5 hover:bg-cyan/20 active:scale-95">{panel.abrir.rotulo}</button>}
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** Cantos de mira nos cartões (efeito HUD). */
function Corners() {
  const c = "absolute h-2.5 w-2.5 border-[color:var(--tone,var(--cyan))] opacity-80";
  return (
    <span aria-hidden className="pointer-events-none">
      <span className={`${c} -left-px -top-px rounded-tl-md border-l-2 border-t-2`} /><span className={`${c} -right-px -top-px rounded-tr-md border-r-2 border-t-2`} />
      <span className={`${c} -bottom-px -left-px rounded-bl-md border-b-2 border-l-2`} /><span className={`${c} -bottom-px -right-px rounded-br-md border-b-2 border-r-2`} />
    </span>
  );
}
