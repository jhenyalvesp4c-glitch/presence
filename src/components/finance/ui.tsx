import { useEffect, useId, useState, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import * as Icons from "lucide-react";
import { X } from "lucide-react";
import { catOf } from "@/lib/finance/categories";
import type { Tone } from "@/lib/finance/types";

/* ───────────── paletas ───────────── */
export const TONES: Record<Tone, { bg: string; glow: string; label: string }> = {
  roxo: { bg: "linear-gradient(135deg, oklch(0.5 0.22 305) 0%, oklch(0.32 0.18 285) 55%, oklch(0.22 0.1 270) 100%)", glow: "oklch(0.68 0.22 305)", label: "Roxo" },
  verde: { bg: "linear-gradient(135deg, oklch(0.6 0.18 155) 0%, oklch(0.4 0.13 165) 55%, oklch(0.24 0.07 175) 100%)", glow: "oklch(0.78 0.17 155)", label: "Verde" },
  azul: { bg: "linear-gradient(135deg, oklch(0.6 0.16 235) 0%, oklch(0.4 0.14 255) 55%, oklch(0.25 0.08 265) 100%)", glow: "oklch(0.75 0.14 235)", label: "Azul" },
  laranja: { bg: "linear-gradient(135deg, oklch(0.7 0.18 50) 0%, oklch(0.5 0.16 35) 55%, oklch(0.3 0.09 30) 100%)", glow: "oklch(0.78 0.17 55)", label: "Laranja" },
  grafite: { bg: "linear-gradient(135deg, oklch(0.42 0.02 260) 0%, oklch(0.27 0.02 262) 55%, oklch(0.17 0.02 265) 100%)", glow: "oklch(0.75 0.03 255)", label: "Grafite" },
  rosa: { bg: "linear-gradient(135deg, oklch(0.66 0.21 355) 0%, oklch(0.45 0.18 340) 55%, oklch(0.27 0.1 330) 100%)", glow: "oklch(0.76 0.19 355)", label: "Rosa" },
  dourado: { bg: "linear-gradient(135deg, oklch(0.78 0.13 85) 0%, oklch(0.55 0.12 70) 55%, oklch(0.34 0.07 60) 100%)", glow: "oklch(0.84 0.13 85)", label: "Dourado" },
  ciano: { bg: "linear-gradient(135deg, oklch(0.74 0.13 205) 0%, oklch(0.5 0.12 225) 55%, oklch(0.3 0.08 245) 100%)", glow: "oklch(0.82 0.13 205)", label: "Ciano" },
};
export const TONE_KEYS = Object.keys(TONES) as Tone[];

/** Ícone do lucide pelo nome (o usado nas categorias). */
export function CatIcon({ id, size = 16, className = "" }: { id: string; size?: number; className?: string }) {
  const name = catOf(id).icon as keyof typeof Icons;
  const I = (Icons[name] ?? Icons.CircleEllipsis) as typeof Icons.Home;
  return <I size={size} className={className} />;
}
export function CatBadge({ id, size = 36 }: { id: string; size?: number }) {
  const c = catOf(id);
  return <span className="grid shrink-0 place-items-center rounded-2xl" style={{ width: size, height: size, color: c.color, background: `color-mix(in oklab, ${c.color} 16%, transparent)`, border: `1px solid color-mix(in oklab, ${c.color} 32%, transparent)` }}><CatIcon id={id} size={Math.round(size * 0.45)} /></span>;
}

/* ───────────── blocos de tela ───────────── */
/** Cartão de vidro com um brilho de cor no canto (a marca visual do módulo). */
export function Panel({ children, glow = "var(--cyan)", className = "", style, as: Tag = "section", ...rest }: { children: ReactNode; glow?: string; className?: string; style?: CSSProperties; as?: "section" | "div" | "article" } & Record<string, unknown>) {
  return (
    <Tag className={`glass group/panel relative overflow-hidden rounded-[1.6rem] p-5 transition duration-500 hover:border-white/15 sm:p-6 ${className}`} style={{ boxShadow: `inset 0 1px 0 oklch(1 0 0 / 6%), 0 30px 80px -55px ${glow}`, ...style }} {...rest}>
      <span aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-[0.16] blur-3xl transition-opacity duration-700 group-hover/panel:opacity-[0.3]" style={{ background: glow }} />
      <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${glow}, transparent)` }} />
      <span aria-hidden className="fin-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top_right,#000,transparent_60%)]" />
      <div className="relative">{children}</div>
    </Tag>
  );
}
export function Head({ icon: I, title, sub, right }: { icon?: typeof Icons.Home; title: string; sub?: string | undefined; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {I && <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-cyan/25 bg-gradient-to-br from-cyan/15 to-violet/15 text-cyan shadow-[0_0_22px_-8px_var(--cyan)]"><I size={17} /></span>}
        <div><h3 className="font-display text-base font-semibold leading-tight">{title}</h3>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>
      </div>
      {right}
    </div>
  );
}
export function Empty({ icon: I = Icons.Sparkles, title, hint, action }: { icon?: typeof Icons.Home; title: string; hint?: string | undefined; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/12 px-6 py-10 text-center">
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.05] text-violet"><I size={22} /></span>
      <p className="font-medium">{title}</p>{hint && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
export function Pill({ children, color = "var(--cyan)" }: { children: ReactNode; color?: string }) {
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium" style={{ color, background: `color-mix(in oklab, ${color} 14%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 28%, transparent)` }}>{children}</span>;
}

/* ───────────── botões ───────────── */
const base = "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium transition active:scale-[.97] disabled:pointer-events-none disabled:opacity-45";
export const btn = {
  primary: `${base} px-5 py-2.5 text-[#04121a] bg-gradient-brand shadow-[0_8px_30px_-10px_var(--cyan)] hover:brightness-110`,
  ghost: `${base} px-4 py-2 border border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08]`,
  danger: `${base} px-4 py-2 border border-white/10 bg-white/[0.04] hover:border-destructive/60 hover:text-destructive`,
  icon: "grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition hover:border-white/25 hover:text-foreground",
};

/* ───────────── campos ───────────── */
const field = "w-full rounded-2xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-cyan/55 focus:bg-black/35 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--cyan)_14%,transparent)]";
export function Field({ label, hint, children, className = "", group = false }: { label: string; hint?: string | undefined; children: ReactNode; className?: string; group?: boolean }) {
  const head = <span className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>, foot = hint ? <span className="mt-1 block text-[0.7rem] text-muted-foreground/80">{hint}</span> : null;
  // campos de escolha (vários botões) não podem ficar dentro de <label>: clicar no título acionaria o primeiro botão
  return group ? <div role="group" aria-label={label} className={className}>{head}{children}{foot}</div> : <label className={`block ${className}`}>{head}{children}{foot}</label>;
}
export function TextInput(p: InputHTMLAttributes<HTMLInputElement>) { return <input {...p} className={`${field} ${p.className ?? ""}`} />; }
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) { return <select {...p} className={`${field} appearance-none bg-[length:14px] pr-9 ${p.className ?? ""}`} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center", ...p.style }} />; }
/** Campo de dinheiro: aceita "1.250,50" ou "1250.5" e devolve número. */
const parseMoney = (t: string): number | undefined => { const x = t.trim(); if (!x) return undefined; const n = Number(x.includes(",") ? x.replace(/\./g, "").replace(",", ".") : x); return Number.isFinite(n) ? n : undefined; };
export function MoneyInput({ value, onChange, placeholder = "0,00", ...rest }: { value: number | undefined; onChange: (n: number | undefined) => void; placeholder?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [txt, setTxt] = useState(() => (value === undefined ? "" : String(value).replace(".", ",")));
  useEffect(() => { if (parseMoney(txt) !== value) setTxt(value === undefined ? "" : String(value).replace(".", ",")); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <input {...rest} inputMode="decimal" placeholder={placeholder} className={`${field} pl-10 tabular-nums`} value={txt}
        onChange={(e) => { setTxt(e.target.value); onChange(parseMoney(e.target.value)); }} />
    </div>
  );
}
export function Segmented<T extends string>({ value, onChange, options, className = "" }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: typeof Icons.Home }[]; className?: string }) {
  return (
    <div role="radiogroup" className={`flex gap-1 rounded-2xl border border-white/10 bg-black/25 p-1 ${className}`}>
      {options.map((o) => { const on = o.value === value, I = o.icon; return (
        <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2 text-[0.8rem] transition ${on ? "bg-cyan/15 text-cyan shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--cyan)_45%,transparent)]" : "text-muted-foreground hover:text-foreground"}`}>
          {I && <I size={14} />}{o.label}
        </button>); })}
    </div>
  );
}

/* ───────────── modal ───────────── */
export function Modal({ open, onClose, title, subtitle, children, width = "max-w-xl", footer }: { open: boolean; onClose: () => void; title: string; subtitle?: string | undefined; children: ReactNode; width?: string; footer?: ReactNode }) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k); const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-end overflow-y-auto bg-background/70 p-0 backdrop-blur-md sm:place-items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="fin-modal">
      <div role="dialog" aria-modal="true" aria-labelledby={id} className={`relative flex max-h-[92dvh] w-full ${width} flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[oklch(0.15_0.03_265/0.96)] shadow-[0_40px_120px_-30px_var(--violet)] sm:rounded-[2rem]`} style={{ animation: "fin-modal .45s cubic-bezier(.2,.8,.2,1) both" }}>
        <span aria-hidden className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[var(--violet)] opacity-25 blur-3xl" style={{ animation: "fin-aurora 12s ease-in-out infinite" }} />
        <span aria-hidden className="pointer-events-none absolute -bottom-28 -right-16 h-64 w-64 rounded-full bg-[var(--cyan)] opacity-15 blur-3xl" style={{ animation: "fin-aurora 15s ease-in-out infinite reverse" }} />
        <header className="relative flex items-start justify-between gap-4 px-6 pb-3 pt-6">
          <div><h2 id={id} className="font-serif text-2xl leading-tight"><span className="text-gradient">{title}</span></h2>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>
          <button onClick={onClose} aria-label="Fechar" className={btn.icon}><X size={16} /></button>
        </header>
        <div className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-5">{children}</div>
        {footer && <footer className="relative flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>, document.body);
}

/** Confirmação simples antes de apagar. */
export function ConfirmDelete({ open, what, onCancel, onConfirm }: { open: boolean; what: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal open={open} onClose={onCancel} title="Excluir?" width="max-w-md"
      footer={<><button className={btn.ghost} onClick={onCancel}>Cancelar</button><button className={`${base} px-5 py-2.5 bg-destructive/90 text-white hover:bg-destructive`} onClick={onConfirm} data-testid="fin-confirmar-exclusao">Excluir</button></>}>
      <p className="text-sm text-muted-foreground">Vai apagar <b className="text-foreground">{what}</b>. Isso não pode ser desfeito.</p>
    </Modal>
  );
}
