import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Copy, Eye, GraduationCap, Grid3x3, Lightbulb, Maximize, MessageCircleQuestion,
  Minimize, MousePointerClick, Sparkles, StickyNote, Target, ThumbsUp, Users, X,
} from "lucide-react";

import type { Block, Example, Faq, Script, Visual } from "@/lib/training-library";
import { visualSrc } from "./training-images";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;

type Slide =
  | { k: "title" }
  | { k: "block"; bi: number; block: Block }
  | { k: "show"; bi: number; block: Block }
  | { k: "visual"; bi: number; block: Block; visual: Visual; vi: number }
  | { k: "why"; bi: number; block: Block }
  | { k: "scenario"; bi: number; block: Block }
  | { k: "example"; bi: number; block: Block; ex: Example }
  | { k: "faq"; bi: number; block: Block; faq: Faq; fi: number }
  | { k: "end" };

const KIND_LABEL: Record<Slide["k"], string> = { title: "Abertura", block: "Bloco", show: "O que mostrar", visual: "Imagem", why: "Por que ajuda", scenario: "Situação", example: "Exemplo", faq: "Pergunta", end: "Encerramento" };

/** Transforma o roteiro em uma sequência de slides (só entram os que têm conteúdo). */
export function buildSlides(script: Script, examples: Example[]): Slide[] {
  const out: Slide[] = [{ k: "title" }];
  script.blocks.forEach((block, bi) => {
    out.push({ k: "block", bi, block });
    if (block.show.length) out.push({ k: "show", bi, block });
    (block.visuals ?? []).forEach((visual, vi) => out.push({ k: "visual", bi, block, visual, vi }));
    if (block.why?.length) out.push({ k: "why", bi, block });
    if (block.scenario) out.push({ k: "scenario", bi, block });
    for (const id of block.examples) { const ex = examples.find((e) => e.id === id); if (ex) out.push({ k: "example", bi, block, ex }); }
    (block.faq ?? []).forEach((faq, fi) => out.push({ k: "faq", bi, block, faq, fi }));
  });
  out.push({ k: "end" });
  return out;
}

export const slideTitle = (s: Slide, script: Script): string => {
  switch (s.k) {
    case "title": return script.title;
    case "block": return s.block.title;
    case "show": return `${s.block.title} · o que mostrar`;
    case "visual": return s.visual.title;
    case "why": return `${s.block.title} · por que ajuda`;
    case "scenario": return `${s.block.title} · situação`;
    case "example": return s.ex.title;
    case "faq": return s.faq.q;
    case "end": return "Encerramento";
  }
};

const delay = (i: number) => ({ animationDelay: `${120 + i * 90}ms` }) as CSSProperties;
const rise = "animate-rise [animation-fill-mode:both]";

function Pins({ v, active, setActive }: { v: Visual; active: number | null; setActive: (n: number | null) => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--glow)_50%,transparent)] shadow-[0_0_60px_-18px_var(--glow)]">
      <img src={visualSrc(v)} alt={v.caption} className="block w-full" />
      <span aria-hidden className="scanline pointer-events-none absolute inset-0 opacity-30" />
      {v.pins.map((p, i) => (
        <button key={i} type="button" onMouseEnter={() => setActive(i + 1)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === i + 1 ? null : i + 1)} aria-label={`${i + 1}. ${p.label}`}
          style={{ left: `${p.x}%`, top: `${p.y}%`, animation: `pres-pop .5s ${300 + i * 140}ms both` }}
          className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-brand text-sm font-bold text-primary-foreground ring-2 ring-background transition ${active === i + 1 ? "scale-125 shadow-[0_0_28px_4px_var(--cyan)]" : "shadow-[0_0_16px_-2px_var(--cyan)]"}`}>
          {active === i + 1 && <span className="absolute inset-0 animate-ping rounded-full bg-cyan/40" />}
          <span className="relative">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

function Legend({ v, active, setActive }: { v: Visual; active: number | null; setActive: (n: number | null) => void }) {
  return (
    <ol className="space-y-2.5">
      {v.pins.map((p, i) => (
        <li key={i} onMouseEnter={() => setActive(i + 1)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === i + 1 ? null : i + 1)} style={delay(i)}
          className={`${rise} flex cursor-pointer gap-3 rounded-2xl border p-3.5 transition duration-300 ${active === i + 1 ? "border-cyan/70 bg-cyan/10 shadow-[0_0_30px_-10px_var(--cyan)]" : "border-border bg-secondary/20 hover:border-cyan/40"}`}>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-brand text-sm font-bold text-primary-foreground">{i + 1}</span>
          <span className="text-[clamp(.9rem,1.3vw,1.15rem)] leading-snug"><b>{p.label}.</b> <span className="text-muted-foreground">{p.text}</span></span>
        </li>
      ))}
    </ol>
  );
}

function SlideBody({ s, script, shown, onToggle, pct, onRestart, onClose }: {
  s: Slide; script: Script; shown: Record<string, boolean>; onToggle: (k: string) => void; pct: number; onRestart: () => void; onClose: () => void;
}) {
  const [pin, setPin] = useState<number | null>(null);
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key) && (s.k === "visual" || (s.k === "example" && s.ex.visual))) setPin((p) => (p === Number(e.key) ? null : Number(e.key)));
      if ((e.key === "ArrowDown" || e.key === "Enter") && s.k === "faq") { e.preventDefault(); setReveal(true); }
      if (e.key === "ArrowUp" && s.k === "faq") setReveal(false);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [s]);

  const label = (t: string) => <p className="mono-caps mb-3 flex items-center gap-2 !text-[clamp(.65rem,.9vw,.85rem)] text-[var(--glow)]"><span className="h-px w-8 bg-[var(--glow)]" />{t}</p>;
  const h1 = "font-display text-[clamp(1.9rem,4.4vw,4.2rem)] font-semibold leading-[1.05] tracking-tight";

  if (s.k === "title") {
    const mins = script.blocks.reduce((a, b) => a + b.minutes, 0);
    return (
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
        <div>
          {label("Treinamento")}
          <h1 className={`${h1} !text-[clamp(2.4rem,6.5vw,6rem)] text-gradient ${rise}`}>{script.title}</h1>
          <p className={`${rise} mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[clamp(.95rem,1.5vw,1.35rem)] text-muted-foreground`} style={delay(2)}>
            <span className="flex items-center gap-2"><Users size={18} className="text-[var(--glow)]" /> {script.audience}</span>
            <span className="flex items-center gap-2"><Clock size={18} className="text-[var(--glow)]" /> {mins} min</span>
            <span className="flex items-center gap-2"><GraduationCap size={18} className="text-[var(--glow)]" /> {script.blocks.length} blocos</span>
          </p>
          {script.goal && (
            <div className={`${rise} mt-8 max-w-3xl rounded-2xl border border-[color-mix(in_oklab,var(--glow)_45%,transparent)] bg-[color-mix(in_oklab,var(--glow)_8%,transparent)] p-5`} style={delay(4)}>
              <p className="mono-caps mb-1 flex items-center gap-2 text-[var(--glow)]"><Target size={13} /> Objetivo</p>
              <p className="text-[clamp(1rem,1.7vw,1.5rem)] leading-snug">{script.goal}</p>
            </div>
          )}
          <p className={`${rise} mt-10 flex items-center gap-2 text-sm text-muted-foreground`} style={delay(6)}><span className="rounded-md border border-border px-2 py-0.5 font-mono">→</span> para começar · <span className="rounded-md border border-border px-2 py-0.5 font-mono">G</span> ver todos os slides</p>
        </div>
        <div className="relative hidden h-72 w-72 place-items-center lg:grid" aria-hidden>
          <span className="absolute inset-0 animate-[spin_26s_linear_infinite] rounded-full border border-dashed border-[var(--glow)] opacity-60" />
          <span className="absolute inset-6 animate-[spin_18s_linear_infinite_reverse] rounded-full border border-violet/50" />
          <span className="absolute inset-12 animate-pulse-ring rounded-full bg-[var(--glow)] opacity-10 blur-xl" />
          <span className="relative grid h-28 w-28 animate-float place-items-center rounded-3xl bg-gradient-brand text-primary-foreground shadow-[0_0_80px_-6px_var(--glow)]"><GraduationCap size={52} /></span>
        </div>
      </div>
    );
  }

  if (s.k === "block") {
    return (
      <div className="relative">
        <span aria-hidden className={`${rise} pointer-events-none absolute -left-2 -top-10 select-none font-display text-[clamp(8rem,22vw,20rem)] font-bold leading-none text-transparent [-webkit-text-stroke:2px_color-mix(in_oklab,var(--glow)_35%,transparent)]`}>{String(s.bi + 1).padStart(2, "0")}</span>
        <div className="relative pt-[clamp(4rem,12vw,10rem)]">
          {label(`Bloco ${s.bi + 1} de ${script.blocks.length}`)}
          <h1 className={`${h1} ${rise}`} style={delay(1)}>{s.block.title}</h1>
          <div className={`${rise} mt-6 flex flex-wrap gap-3`} style={delay(3)}>
            {[[Clock, `${s.block.minutes} min`], [Eye, `${s.block.show.length} para mostrar`], ...(s.block.examples.length ? [[Sparkles, `${s.block.examples.length} exemplo${s.block.examples.length > 1 ? "s" : ""}`]] : [])].map(([I, t], i) => {
              const Icon = I as typeof Clock;
              return <span key={i} className="flex items-center gap-2 rounded-full border border-border bg-secondary/30 px-4 py-2 text-[clamp(.85rem,1.2vw,1.1rem)]"><Icon size={16} className="text-[var(--glow)]" /> {t as string}</span>;
            })}
          </div>
        </div>
      </div>
    );
  }

  if (s.k === "show") {
    return (
      <div>
        {label(`Bloco ${s.bi + 1} · ${s.block.title}`)}
        <h2 className={`${h1} ${rise}`}>O que vamos mostrar</h2>
        <ul className="mt-8 grid gap-3 md:grid-cols-2">
          {s.block.show.map((t, i) => {
            const k = `${s.block.id}:${i}`, ok = !!shown[k];
            return (
              <li key={k} style={delay(i)} className={rise}>
                <button onClick={() => onToggle(k)} data-testid="item-mostrar"
                  className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition duration-300 hover:-translate-y-0.5 ${ok ? "border-emerald/60 bg-emerald/10 shadow-[0_0_30px_-12px_var(--emerald)]" : "border-border bg-secondary/25 hover:border-[var(--glow)] hover:shadow-[0_0_30px_-14px_var(--glow)]"}`}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-lg font-bold transition ${ok ? "border-emerald bg-emerald/20 text-emerald" : "border-[var(--glow)] text-[var(--glow)]"}`}>
                    {ok ? <Check size={20} style={{ animation: "pres-pop .35s both" }} /> : i + 1}
                  </span>
                  <span className={`text-[clamp(1.05rem,1.9vw,1.7rem)] leading-snug transition ${ok ? "text-muted-foreground line-through decoration-emerald/60" : ""}`}>{t}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><MousePointerClick size={13} /> Clique num item para marcar como já mostrado.</p>
      </div>
    );
  }

  if (s.k === "visual") {
    return (
      <div>
        {label(`Bloco ${s.bi + 1} · ${s.block.title}`)}
        <div className="grid items-start gap-6 xl:grid-cols-[1.55fr_1fr]">
          <div className={rise}><Pins v={s.visual} active={pin} setActive={setPin} /><p className="mt-2 text-center text-sm italic text-muted-foreground">{s.visual.caption}</p></div>
          <div>
            <h2 className={`${h1} !text-[clamp(1.5rem,2.8vw,2.6rem)] ${rise}`}>{s.visual.title}</h2>
            <div className="mt-5"><Legend v={s.visual} active={pin} setActive={setPin} /></div>
            <p className="mt-4 text-xs text-muted-foreground">Passe o mouse, clique nos pontos ou use as teclas 1 a {Math.min(9, s.visual.pins.length)}.</p>
          </div>
        </div>
      </div>
    );
  }

  if (s.k === "why") {
    return (
      <div>
        {label(`Bloco ${s.bi + 1} · ${s.block.title}`)}
        <h2 className={`${h1} ${rise}`}><ThumbsUp className="mr-3 inline text-emerald" size={44} />Por que isso ajuda no dia a dia</h2>
        <ul className="mt-8 space-y-3.5">
          {(s.block.why ?? []).map((w, i) => (
            <li key={i} style={delay(i)} className={`${rise} flex items-start gap-4 rounded-2xl border border-emerald/40 bg-emerald/5 p-4 transition hover:-translate-y-0.5 hover:shadow-[0_0_30px_-12px_var(--emerald)]`}>
              <CheckCircle2 size={28} className="mt-0.5 shrink-0 text-emerald" />
              <span className="text-[clamp(1.05rem,1.9vw,1.7rem)] leading-snug">{w}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (s.k === "scenario") {
    const sc = s.block.scenario!;
    return (
      <div>
        {label(`Bloco ${s.bi + 1} · ${s.block.title}`)}
        <p className="mono-caps mb-2">Situação para contar</p>
        <h2 className={`${h1} !text-[clamp(1.5rem,3.2vw,3rem)] ${rise}`}>{sc.situation}</h2>
        <div className="mt-8 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <div style={delay(2)} className={`${rise} rounded-3xl border border-pink/50 bg-pink/5 p-6`}>
            <p className="mono-caps mb-2 !text-pink">{sc.beforeLabel || "Antes"}</p>
            <p className="text-[clamp(1.05rem,1.9vw,1.7rem)] leading-snug">{sc.before}</p>
          </div>
          <span className="grid place-items-center text-[var(--glow)]"><ArrowRight size={44} className="hidden animate-pulse lg:block" /></span>
          <div style={delay(5)} className={`${rise} rounded-3xl border border-emerald/60 bg-emerald/10 p-6 shadow-[0_0_50px_-20px_var(--emerald)]`}>
            <p className="mono-caps mb-2 !text-emerald">{sc.afterLabel || "Depois"}</p>
            <p className="text-[clamp(1.05rem,1.9vw,1.7rem)] leading-snug">{sc.after}</p>
          </div>
        </div>
      </div>
    );
  }

  if (s.k === "example") {
    const e = s.ex;
    return (
      <div>
        {label(`Exemplo · ${e.cat}`)}
        <h2 className={`${h1} ${rise}`}>{e.title}</h2>
        <div className={`mt-6 grid items-start gap-6 ${e.visual ? "xl:grid-cols-[1fr_1fr]" : ""}`}>
          <div>
            <p className={`${rise} rounded-2xl border border-border bg-secondary/25 p-4 text-[clamp(.95rem,1.5vw,1.3rem)] leading-snug`} style={delay(1)}><b className="mono-caps mr-2 !text-[0.7em]">Situação</b>{e.situation}</p>
            <blockquote className={`${rise} relative mt-4 rounded-2xl border border-[color-mix(in_oklab,var(--glow)_50%,transparent)] bg-[color-mix(in_oklab,var(--glow)_8%,transparent)] p-6 text-[clamp(1.05rem,1.9vw,1.7rem)] leading-snug shadow-[0_0_50px_-22px_var(--glow)]`} style={delay(3)}>
              <span aria-hidden className="absolute -top-4 left-4 font-display text-6xl leading-none text-[var(--glow)]">“</span>
              {e.text}
              <button onClick={() => { navigator.clipboard?.writeText(e.text).catch(() => undefined); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
                className="mt-4 flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:border-[var(--glow)] hover:text-[var(--glow)]">{copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar exemplo</>}</button>
            </blockquote>
          </div>
          {e.visual && <div className={rise} style={delay(2)}><Pins v={e.visual} active={pin} setActive={setPin} /><div className="mt-4"><Legend v={e.visual} active={pin} setActive={setPin} /></div></div>}
        </div>
      </div>
    );
  }

  if (s.k === "faq") {
    return (
      <div>
        {label(`Bloco ${s.bi + 1} · pergunta frequente`)}
        <MessageCircleQuestion size={44} className="mb-3 text-cyan" />
        <h2 className={`${h1} ${rise}`}>{s.faq.q}</h2>
        {reveal ? (
          <p className={`${rise} mt-8 max-w-4xl rounded-3xl border border-cyan/50 bg-cyan/5 p-6 text-[clamp(1.1rem,2vw,1.8rem)] leading-snug shadow-[0_0_50px_-22px_var(--cyan)]`}>{s.faq.a}</p>
        ) : (
          <button onClick={() => setReveal(true)} className="mt-8 flex items-center gap-2 rounded-2xl border border-dashed border-cyan/60 px-6 py-4 text-cyan transition hover:bg-cyan/10 hover:shadow-[0_0_30px_-10px_var(--cyan)]"><Eye size={18} /> Mostrar a resposta <span className="rounded-md border border-cyan/40 px-1.5 font-mono text-xs">↓</span></button>
        )}
      </div>
    );
  }

  return (
    <div className="grid place-items-center text-center">
      <div className="relative grid h-56 w-56 place-items-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="6" /><circle cx="60" cy="60" r="52" fill="none" stroke="var(--glow)" strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 52} strokeDashoffset={2 * Math.PI * 52 * (1 - pct / 100)} style={{ filter: "drop-shadow(0 0 8px var(--glow))", transition: "stroke-dashoffset 1.2s ease" }} /></svg>
        <span className="font-display text-5xl font-semibold tabular-nums">{pct}%</span>
      </div>
      <h1 className={`${h1} mt-8 text-gradient ${rise}`}>{pct === 100 ? "Tudo mostrado!" : "Fim do roteiro"}</h1>
      <p className="mt-3 text-muted-foreground">{pct === 100 ? "Nada ficou de fora ✦" : `${pct}% dos itens foram marcados como mostrados.`}</p>
      <p className="mt-6 text-2xl">Dúvidas?</p>
      <div className="mt-8 flex gap-3">
        <button onClick={onRestart} className="rounded-xl border border-border px-5 py-2.5 text-sm transition hover:border-[var(--glow)] hover:text-[var(--glow)]">Voltar ao início</button>
        <button onClick={onClose} className="rounded-xl bg-gradient-brand px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:scale-105">Encerrar apresentação</button>
      </div>
    </div>
  );
}

/** Apresentação em tela cheia do roteiro: um slide por vez, passa com setas, espaço ou deslizando. */
export function TrainingPresenter({ script, examples, shown, onToggle, onClose }: {
  script: Script; examples: Example[]; shown: Record<string, boolean>; onToggle: (k: string) => void; onClose: () => void;
}) {
  const slides = useMemo(() => buildSlides(script, examples), [script, examples]);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [overview, setOverview] = useState(false);
  const [notes, setNotes] = useState(false);
  const [full, setFull] = useState(false);
  const touch = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  const go = useCallback((n: number) => setI((cur) => { const t = Math.max(0, Math.min(slides.length - 1, n)); if (t !== cur) setDir(t > cur ? 1 : -1); return t; }), [slides.length]);
  const next = useCallback(() => setI((c) => { const t = Math.min(slides.length - 1, c + 1); if (t !== c) setDir(1); return t; }), [slides.length]);
  const prev = useCallback(() => setI((c) => { const t = Math.max(0, c - 1); if (t !== c) setDir(-1); return t; }), []);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.().catch(() => undefined);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); prev(); }
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(slides.length - 1);
      else if (e.key === "Escape") { if (overview) setOverview(false); else onClose(); }
      else if (e.key.toLowerCase() === "g") setOverview((o) => !o);
      else if (e.key.toLowerCase() === "n") setNotes((n) => !n);
      else if (e.key.toLowerCase() === "f") toggleFull();
    };
    window.addEventListener("keydown", h);
    const fs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fs);
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.removeEventListener("fullscreenchange", fs); document.body.style.overflow = prevOverflow; if (document.fullscreenElement) void document.exitFullscreen(); };
  }, [next, prev, go, slides.length, overview, onClose, toggleFull]);

  const s = slides[i]!;
  const items = script.blocks.flatMap((b) => b.show.map((_, k) => `${b.id}:${k}`));
  const pct = items.length ? Math.round((items.filter((k) => shown[k]).length / items.length) * 100) : 0;
  const bi = "bi" in s ? s.bi : s.k === "end" ? script.blocks.length - 1 : -1;
  const tip = "block" in s ? s.block.tip : undefined;
  const slideKey = `${i}`;

  return (
    <div ref={root} role="dialog" aria-modal="true" aria-label={`Apresentação: ${script.title}`} data-testid="apresentacao" style={tint(script.color)}
      onTouchStart={(e) => { touch.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => { const x = e.changedTouches[0]?.clientX; if (touch.current != null && x != null) { const d = x - touch.current; if (Math.abs(d) > 60) (d < 0 ? next : prev)(); } touch.current = null; }}
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[oklch(0.1_0.025_265)] text-foreground">
      {/* fundo vivo */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -left-1/4 -top-1/4 h-[70vmax] w-[70vmax] rounded-full bg-[var(--glow)] opacity-[0.14] blur-[110px] [animation:pres-aurora_18s_ease-in-out_infinite]" />
        <span className="absolute -bottom-1/3 -right-1/4 h-[60vmax] w-[60vmax] rounded-full bg-violet opacity-[0.16] blur-[120px] [animation:pres-aurora_24s_ease-in-out_infinite_reverse]" />
        <span className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(var(--foreground)_1px,transparent_1px),linear-gradient(90deg,var(--foreground)_1px,transparent_1px)] [background-size:64px_64px] [animation:pres-grid_6s_linear_infinite] [mask-image:radial-gradient(70%_70%_at_50%_45%,black,transparent)]" />
        {Array.from({ length: 26 }).map((_, k) => <span key={k} className="absolute h-0.5 w-0.5 animate-pulse-ring rounded-full bg-[var(--glow)] shadow-[0_0_8px_var(--glow)]" style={{ left: `${(k * 37) % 100}%`, top: `${(k * 53) % 100}%`, animationDelay: `${(k % 9) * 0.35}s` }} />)}
      </div>

      {/* barra superior */}
      <header className="relative z-10 flex items-center gap-3 px-4 py-3 sm:px-6">
        <span className="icon-tile h-9 w-9 shrink-0 !rounded-xl"><GraduationCap size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{script.title}</p>
          <p className="truncate text-[0.68rem] text-muted-foreground">{bi >= 0 && s.k !== "end" ? `Bloco ${bi + 1}/${script.blocks.length} · ${script.blocks[bi]!.title}` : KIND_LABEL[s.k]}</p>
        </div>
        <span className="rounded-full border border-border bg-background/60 px-3 py-1 font-mono text-xs tabular-nums backdrop-blur" data-testid="contador-slide">{String(i + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
        {([[() => setNotes((n) => !n), StickyNote, "Notas do apresentador (N)", notes], [() => setOverview(true), Grid3x3, "Todos os slides (G)", false], [toggleFull, full ? Minimize : Maximize, "Tela cheia (F)", full], [onClose, X, "Encerrar (Esc)", false]] as const).map(([fn, Icon, label, on], k) => (
          <button key={k} onClick={fn} aria-label={label} title={label} data-testid={k === 3 ? "fechar-apresentacao" : undefined}
            className={`grid h-9 w-9 place-items-center rounded-xl border transition hover:scale-105 ${on ? "border-amber/60 bg-amber/15 text-amber" : "border-border bg-background/60 text-muted-foreground backdrop-blur hover:border-[var(--glow)] hover:text-[var(--glow)]"}`}><Icon size={15} /></button>
        ))}
      </header>

      {/* palco */}
      <main className="scroll-neon relative z-10 flex flex-1 items-center overflow-y-auto px-4 pb-4 sm:px-10 lg:px-16">
        <div key={slideKey} data-testid="slide" data-kind={s.k} className="mx-auto w-full max-w-7xl py-4" style={{ animation: `${dir === 1 ? "pres-in-r" : "pres-in-l"} .55s cubic-bezier(.2,.7,.2,1) both` }}>
          <SlideBody s={s} script={script} shown={shown} onToggle={onToggle} pct={pct} onRestart={() => go(0)} onClose={onClose} />
        </div>
      </main>

      {/* notas do apresentador (só você vê, se ligar) */}
      {notes && (
        <div className="relative z-10 mx-4 mb-2 flex items-start gap-3 rounded-2xl border border-amber/50 bg-amber/10 p-3 text-sm backdrop-blur sm:mx-6" data-testid="notas">
          <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber" />
          <p className="min-w-0 flex-1"><b className="mono-caps mr-2 !text-amber">Nota do apresentador</b>{tip || "Este bloco não tem dica. Você pode escrevê-la ao editar o bloco."}{"block" in s ? <span className="ml-2 text-muted-foreground">· {s.block.minutes} min previstos</span> : null}</p>
        </div>
      )}

      {/* setas + progresso */}
      <button onClick={prev} disabled={i === 0} aria-label="Slide anterior" data-testid="slide-anterior" className="absolute left-2 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/50 text-muted-foreground backdrop-blur transition hover:scale-110 hover:border-[var(--glow)] hover:text-[var(--glow)] hover:shadow-[0_0_24px_-6px_var(--glow)] disabled:opacity-0 sm:left-4"><ChevronLeft size={22} /></button>
      <button onClick={next} disabled={i === slides.length - 1} aria-label="Próximo slide" data-testid="slide-proximo" className="absolute right-2 top-1/2 z-20 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-[var(--glow)] bg-[color-mix(in_oklab,var(--glow)_12%,transparent)] text-[var(--glow)] backdrop-blur transition hover:scale-110 hover:shadow-[0_0_28px_-4px_var(--glow)] disabled:opacity-0 sm:right-4"><ChevronRight size={22} /></button>

      <footer className="relative z-10 flex items-center gap-1.5 px-4 pb-4 sm:px-6" aria-label="Progresso">
        {slides.map((sl, k) => {
          const first = k === 0 || ("bi" in sl ? ("bi" in slides[k - 1]! ? (slides[k - 1] as { bi: number }).bi : -1) !== sl.bi : false);
          return <button key={k} onClick={() => go(k)} aria-label={`Ir para o slide ${k + 1}: ${slideTitle(sl, script)}`} title={slideTitle(sl, script)}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 hover:h-2.5 ${k === i ? "bg-[var(--glow)] shadow-[0_0_12px_var(--glow)]" : k < i ? "bg-[color-mix(in_oklab,var(--glow)_55%,transparent)]" : "bg-secondary"} ${first && k > 0 ? "ml-2" : ""}`} />;
        })}
      </footer>

      {/* todos os slides */}
      {overview && (
        <div className="absolute inset-0 z-30 overflow-y-auto bg-background/92 p-4 backdrop-blur-xl sm:p-8" data-testid="visao-geral" onClick={() => setOverview(false)}>
          <div className="mx-auto max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center gap-3"><h2 className="mr-auto font-display text-2xl font-semibold">Todos os slides</h2><button onClick={() => setOverview(false)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-xl border border-border text-muted-foreground hover:text-foreground"><X size={16} /></button></div>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {slides.map((sl, k) => (
                <li key={k}><button onClick={() => { go(k); setOverview(false); }} style={{ animationDelay: `${Math.min(k, 14) * 25}ms` }}
                  className={`${rise} group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition duration-300 hover:-translate-y-1 hover:border-[var(--glow)] hover:shadow-[0_10px_30px_-14px_var(--glow)] ${k === i ? "border-[var(--glow)] bg-[color-mix(in_oklab,var(--glow)_10%,transparent)]" : "border-border bg-secondary/20"}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/60 font-mono text-sm tabular-nums transition group-hover:bg-[var(--glow)] group-hover:text-background">{k + 1}</span>
                  <span className="min-w-0"><span className="mono-caps block !text-[0.55rem]">{KIND_LABEL[sl.k]}{"bi" in sl ? ` · bloco ${sl.bi + 1}` : ""}</span><span className="block truncate text-sm font-medium">{slideTitle(sl, script)}</span></span>
                </button></li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
