/** Entrada das medidas como um terminal futurista: zonas coloridas, campos grandes com ajuste fino, sinal de preenchimento, scanners de foto e envio animado. */
import { useRef, type ReactNode } from "react";
import { Camera, Check, Loader2, Minus, Plus, Ruler, Scale, Send } from "lucide-react";

import { Ring } from "@/components/finance/charts";
import { LiveDot } from "@/components/finance/fx";
import { MEASURE_FIELDS, PHOTO_SLOTS } from "@/lib/program";

const ZONES: { n: string; title: string; sub: string; color: string; keys: string[] }[] = [
  { n: "01", title: "Peso e tronco", sub: "peso, peito, cintura, abdômen e quadril", color: "var(--cyan)", keys: ["peso", "peito", "cintura", "abdomen", "quadril"] },
  { n: "02", title: "Braços", sub: "direito e esquerdo", color: "var(--violet)", keys: ["braco_d", "braco_e"] },
  { n: "03", title: "Pernas", sub: "coxas e panturrilhas", color: "var(--emerald)", keys: ["coxa_d", "coxa_e", "panturrilha_d", "panturrilha_e"] },
];
const LABEL: Record<string, string> = { peso: "Peso", ...Object.fromEntries(MEASURE_FIELDS.map((f) => [f.key, f.label])) };
const num = (s: string | undefined) => { const n = Number((s ?? "").replace(",", ".")); return s && s.trim() && Number.isFinite(n) ? n : null; };
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

function Corners({ color }: { color: string }) {
  const c = "pointer-events-none absolute h-3 w-3 opacity-70";
  return <><span className={`${c} left-2 top-2 border-l border-t`} style={{ borderColor: color }} /><span className={`${c} right-2 top-2 border-r border-t`} style={{ borderColor: color }} /><span className={`${c} bottom-2 left-2 border-b border-l`} style={{ borderColor: color }} /><span className={`${c} bottom-2 right-2 border-b border-r`} style={{ borderColor: color }} /></>;
}

function DataField({ id, label, unit, value, last, color, icon: Icon, step, onChange, onFocus, delay }: { id: string; label: string; unit: string; value: string; last: number | null; color: string; icon: typeof Ruler; step: number; onChange: (v: string) => void; onFocus: () => void; delay: number }) {
  const n = num(value), filled = n !== null, d = filled && last !== null ? Math.round((n - last) * 10) / 10 : null;
  const bump = (dir: 1 | -1) => onChange(fmt(Math.max(0, (n ?? last ?? 0) + dir * step)));
  return (
    <div className="group relative overflow-hidden rounded-2xl border bg-black/30 p-3 transition duration-300 focus-within:-translate-y-0.5" style={{ borderColor: filled ? `color-mix(in oklab, ${color} 55%, transparent)` : "rgba(255,255,255,.1)", boxShadow: filled ? `0 0 24px -12px ${color}` : undefined, animation: "fin-rise .55s both", animationDelay: `${delay}ms` }}>
      <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-0 blur-2xl transition duration-500 group-focus-within:opacity-40" style={{ background: color }} />
      <div className="relative flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg border" style={{ color, borderColor: `color-mix(in oklab, ${color} 40%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)` }}><Icon size={13} /></span>
        <label htmlFor={id} className="min-w-0 flex-1 truncate text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</label>
        {filled ? <span className="grid h-5 w-5 place-items-center rounded-full text-[#04121a]" style={{ background: color, animation: "field-pop .4s both" }} aria-label="preenchido"><Check size={12} strokeWidth={3} /></span> : last !== null ? <button type="button" onClick={() => onChange(fmt(last))} className="rounded-full border border-white/10 px-2 py-0.5 text-[0.6rem] text-muted-foreground transition hover:border-white/30 hover:text-foreground" title="Usar a última medida">↺ {fmt(last)}</button> : null}
      </div>
      <div className="relative mt-2 flex items-center gap-1.5">
        <button type="button" onClick={() => bump(-1)} aria-label={`Diminuir ${label}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground transition hover:border-white/30 hover:text-foreground active:scale-90"><Minus size={14} /></button>
        <div className="relative min-w-0 flex-1"><input id={id} data-medida data-testid={`medida-${id.replace(/^m-/, "")}`} inputMode="decimal" autoComplete="off" value={value} placeholder={last !== null ? fmt(last) : "0"} onFocus={(e) => { e.currentTarget.select(); onFocus(); }} onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const all = [...(e.currentTarget.form ?? document).querySelectorAll<HTMLInputElement>("input[data-medida]")]; all[all.indexOf(e.currentTarget) + 1]?.focus(); } }}
          className="w-full bg-transparent text-center font-display text-3xl font-semibold tabular-nums outline-none placeholder:text-white/15" style={{ color: filled ? "var(--foreground)" : undefined, textShadow: filled ? `0 0 20px ${color}` : undefined }} />
          <span className="pointer-events-none absolute -bottom-0.5 right-1 text-[0.65rem] text-muted-foreground">{unit}</span></div>
        <button type="button" onClick={() => bump(1)} aria-label={`Aumentar ${label}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 text-muted-foreground transition hover:border-white/30 hover:text-foreground active:scale-90"><Plus size={14} /></button>
      </div>
      <div className="relative mt-2 h-[3px] overflow-hidden rounded-full bg-white/10"><span className="block h-full origin-left rounded-full transition-transform duration-700" style={{ background: `linear-gradient(90deg, ${color}, var(--violet))`, transform: `scaleX(${filled ? 1 : 0})`, boxShadow: `0 0 10px ${color}` }} /></div>
      <p className="relative mt-1.5 h-4 text-center text-[0.65rem] tabular-nums text-muted-foreground">{d !== null && d !== 0 ? <>última {fmt(last!)} {unit} · <b style={{ color: d < 0 ? "var(--emerald)" : "oklch(0.8 0.15 75)" }}>{d > 0 ? "+" : "−"}{fmt(Math.abs(d))}</b></> : last !== null ? `última: ${fmt(last)} ${unit}` : "primeira medida"}</p>
    </div>
  );
}

export type MeasureTerminalProps = {
  week: number; vals: Record<string, string>; setVals: (f: (v: Record<string, string>) => Record<string, string>) => void; peso: string; setPeso: (v: string) => void;
  obs: string; setObs: (v: string) => void; photos: Record<string, string>; setPhotos: (f: (p: Record<string, string>) => Record<string, string>) => void; existingPhotos: Record<string, string>;
  last: Record<string, number | null>; onFocusKey: (k: string) => void; busy: boolean; onSave: () => void; existing: boolean; children?: ReactNode;
};

export function MeasureTerminal(p: MeasureTerminalProps) {
  const get = (k: string) => (k === "peso" ? p.peso : p.vals[k] ?? ""), set = (k: string, v: string) => (k === "peso" ? p.setPeso(v) : p.setVals((x) => ({ ...x, [k]: v })));
  const allKeys = ZONES.flatMap((z) => z.keys), filled = allKeys.filter((k) => num(get(k)) !== null).length, shots = PHOTO_SLOTS.filter((s) => p.photos[s] ?? p.existingPhotos[s]).length;
  const total = allKeys.length + PHOTO_SLOTS.length, done = filled + shots, pct = (done / total) * 100, form = useRef<HTMLFormElement>(null);
  let d = 0;
  return (
    <form ref={form} onSubmit={(e) => { e.preventDefault(); p.onSave(); }} className="space-y-4" data-testid="medidas-form">
      <section className="glass fin-frame relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div aria-hidden className="fin-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,#000,transparent_70%)]" />
        <span aria-hidden className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-cyan opacity-15 blur-3xl" /><span aria-hidden className="pointer-events-none absolute -bottom-24 right-0 h-60 w-60 rounded-full bg-violet opacity-15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0"><p className="mono-caps flex flex-wrap items-center gap-3">Entrada de dados corporais <LiveDot color="var(--emerald)" label="canal aberto" /></p>
            <h2 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl">Registrar <span className="text-gradient inline-block pr-2 italic">medidas</span> · semana {p.week}</h2>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">Sempre nas mesmas condições (horário, sem roupa apertada). Use <kbd className="rounded border border-white/15 px-1">Enter</kbd> para ir ao próximo campo e + / − para ajustar de meio em meio centímetro.</p></div>
          <div className="flex items-center gap-3"><Ring pct={pct} size={78} thickness={7} color="var(--cyan)"><span className="text-center leading-tight"><b className="block text-base tabular-nums">{done}/{total}</b><span className="text-[0.5rem] uppercase tracking-wider text-muted-foreground">sinal</span></span></Ring></div>
        </div>
      </section>

      {ZONES.map((z) => (
        <section key={z.n} className="glass relative overflow-hidden rounded-3xl p-4 sm:p-5" style={{ animation: "fin-rise .6s both", animationDelay: `${(Number(z.n) - 1) * 90}ms`, boxShadow: `0 30px 80px -50px ${z.color}` }}>
          <Corners color={z.color} /><span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-20 blur-3xl" style={{ background: z.color }} /><span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${z.color}, transparent)` }} />
          <div className="relative mb-3 flex items-center gap-3"><span className="font-mono text-xs tracking-widest" style={{ color: z.color }}>{z.n}</span><div><h3 className="font-display text-sm font-semibold uppercase tracking-[0.16em]">{z.title}</h3><p className="text-[0.68rem] text-muted-foreground">{z.sub}</p></div>
            <span className="ml-auto rounded-full border px-2.5 py-0.5 text-[0.65rem] tabular-nums" style={{ color: z.color, borderColor: `color-mix(in oklab, ${z.color} 40%, transparent)` }}>{z.keys.filter((k) => num(get(k)) !== null).length}/{z.keys.length}</span></div>
          <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{z.keys.map((k) => (
            <div key={k} data-testid={`campo-${k}`}><DataField id={`m-${k}`} label={LABEL[k]!} unit={k === "peso" ? "kg" : "cm"} value={get(k)} last={p.last[k] ?? null} color={z.color} icon={k === "peso" ? Scale : Ruler} step={k === "peso" ? 0.1 : 0.5} delay={(d++) * 45} onChange={(v) => set(k, v)} onFocus={() => p.onFocusKey(k)} /></div>))}</div>
        </section>
      ))}

      <section className="glass relative overflow-hidden rounded-3xl p-4 sm:p-5" style={{ animation: "fin-rise .6s both", animationDelay: "300ms", boxShadow: "0 30px 80px -50px var(--pink)" }}>
        <Corners color="var(--pink)" /><span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-pink opacity-20 blur-3xl" />
        <div className="relative mb-3 flex items-center gap-3"><span className="font-mono text-xs tracking-widest text-pink">04</span><div><h3 className="font-display text-sm font-semibold uppercase tracking-[0.16em]">Fotos</h3><p className="text-[0.68rem] text-muted-foreground">frente, lado e costas · mesma luz e distância</p></div><span className="ml-auto rounded-full border border-pink/40 px-2.5 py-0.5 text-[0.65rem] tabular-nums text-pink">{shots}/3</span></div>
        <div className="relative grid gap-3 sm:grid-cols-3">{PHOTO_SLOTS.map((s) => { const src = p.photos[s] ?? p.existingPhotos[s]; return (
          <label key={s} className="group relative grid h-44 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed bg-black/30 transition hover:border-pink/60" style={{ borderColor: src ? "color-mix(in oklab, var(--emerald) 60%, transparent)" : "rgba(255,255,255,.2)" }}>
            {src ? <><img src={src} alt={`Foto ${s}`} className="absolute inset-0 h-full w-full object-cover" /><span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" /><span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-emerald/90 px-2.5 py-1 text-[0.65rem] font-semibold text-[#04121a]"><Check size={11} strokeWidth={3} /> {s} capturada</span></>
              : <><span aria-hidden data-idea-fx className="pointer-events-none absolute inset-x-3 h-px bg-gradient-to-r from-transparent via-pink to-transparent shadow-[0_0_14px_var(--pink)]" style={{ animation: "slot-scan 3.2s ease-in-out infinite" }} /><span className="flex flex-col items-center gap-2 text-xs text-muted-foreground"><span className="grid h-11 w-11 place-items-center rounded-full border border-pink/40 bg-pink/10 text-pink transition group-hover:scale-110"><Camera size={18} /></span><b className="font-display text-sm uppercase tracking-[0.16em] text-foreground">{s}</b>toque para fotografar ou enviar</span></>}
            <Corners color="var(--pink)" />
            <input type="file" accept="image/*" className="sr-only" data-testid={`foto-${s}`} onChange={(e) => { const f = e.target.files?.[0]; if (f) p.setPhotos((x) => ({ ...x, [s]: URL.createObjectURL(f) })); }} />
          </label>); })}</div>
      </section>

      <section className="glass rounded-3xl p-4 sm:p-5"><label className="block text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">Observações do registro<textarea value={p.obs} onChange={(e) => p.setObs(e.target.value)} rows={2} placeholder="Como se sentiu, alimentação, sono, algo que mudou…" className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none transition focus:border-cyan/60" /></label></section>

      <button type="submit" disabled={p.busy || done === 0} className="shine relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-gradient-brand px-6 py-4 text-base font-semibold text-[#04121a] shadow-[0_14px_50px_-14px_var(--cyan)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50" data-testid="medidas-salvar">
        {p.busy ? <><Loader2 size={18} className="animate-spin" /> Transmitindo para o Orion…<span aria-hidden className="absolute inset-y-0 left-0 w-1/3 bg-white/25 blur-md" style={{ animation: "tx-bar 1.2s linear infinite" }} /></> : <><Send size={18} /> {p.existing ? "Atualizar o registro de hoje" : "Enviar medidas ao Orion"}<span className="rounded-full bg-black/20 px-2.5 py-0.5 text-xs tabular-nums">{done}/{total} dados</span></>}
      </button>
      {p.children}
    </form>
  );
}
