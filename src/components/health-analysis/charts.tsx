// Gráficos SVG da tela Análise (Saúde): linhas com brilho, rosca, anel de pontuação, faixas e comparador de fotos.

import { useEffect, useId, useState, type CSSProperties, type ReactNode } from "react";

export const glow = (c: string) => ({ "--glow": c }) as CSSProperties;
const pt = (n: number, d = 1) => n.toFixed(d).replace(".", ",");
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const shortDate = (iso: string) => { const [, m, d] = iso.split("-"); return `${d}/${MONTHS[Number(m) - 1] ?? m}`; };
export const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const smooth = (pts: [number, number][]) => pts.map((p, i) => { if (!i) return `M${p[0]},${p[1]}`; const q = pts[i - 1]!; const mx = (q[0] + p[0]) / 2; return `C${mx},${q[1]} ${mx},${p[1]} ${p[0]},${p[1]}`; }).join(" ");

/** Número que sobe até o valor ao aparecer. */
export function Counter({ value, decimals = 1, prefix = "", suffix = "" }: { value: number | null; decimals?: number; prefix?: string; suffix?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (value === null) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(value); return; }
    let raf = 0; const start = performance.now(), dur = 1100;
    const tick = (now: number) => { const k = Math.min(1, (now - start) / dur); setShown(value * (1 - (1 - k) ** 3)); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (value === null) return <>—</>;
  return <>{prefix}{pt(shown, decimals)}{suffix}</>;
}

export function Sparkline({ values, color, id }: { values: (number | null)[]; color: string; id: string }) {
  const v = values.filter((n): n is number => n !== null);
  if (v.length < 2) return <div className="h-9" />;
  const min = Math.min(...v), span = Math.max(...v) - min || 1;
  const pts = v.map((n, i) => [(i / (v.length - 1)) * 100, 32 - ((n - min) / span) * 26] as [number, number]);
  const line = smooth(pts);
  return <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-9 w-full" aria-hidden>
    <defs><linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <path d={`${line} L100,36 L0,36 Z`} fill={`url(#sp-${id})`} />
    <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray="1" className="motion-safe:animate-[health-draw-1_1.4s_ease-out_both]" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
  </svg>;
}

type Pt = { date: string; value: number | null };

/** Evolução do peso: área em degradê, rótulos de início/fim, projeção tracejada e dica ao passar o mouse. */
export function WeightChart({ points, projection, unit = "kg" }: { points: Pt[]; projection?: { date: string; value: number } | null; unit?: string }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const data = points.filter((p): p is { date: string; value: number } => p.value !== null);
  if (!data.length) return <div className="grid h-56 place-items-center text-sm text-muted-foreground">Sem peso registrado.</div>;
  const W = 640, H = 250, PL = 40, PR = projection ? 64 : 26, PT = 34, PB = 30;
  const all = [...data.map((d) => d.value), ...(projection ? [projection.value] : [])];
  const pad = (Math.max(...all) - Math.min(...all)) * 0.25 || 1;
  const min = Math.min(...all) - pad, max = Math.max(...all) + pad;
  const t0 = new Date(`${data[0]!.date}T12:00:00`).getTime();
  const tEnd = new Date(`${(projection ?? data.at(-1)!).date}T12:00:00`).getTime();
  const span = tEnd - t0 || 1;
  const x = (iso: string) => data.length === 1 && !projection ? (PL + W - PR) / 2 : PL + ((new Date(`${iso}T12:00:00`).getTime() - t0) / span) * (W - PL - PR);
  const y = (v: number) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB);
  const pts = data.map((d) => [x(d.date), y(d.value)] as [number, number]);
  const line = smooth(pts);
  const last = pts.at(-1)!, firstP = pts[0]!;
  const ticks = data.length <= 6 ? data.map((_, i) => i) : [0, Math.round((data.length - 1) / 3), Math.round(((data.length - 1) * 2) / 3), data.length - 1];
  const bubble = (px: number, py: number, label: string, color: string, below = false) => {
    const w = label.length * 7.4 + 18, by = below ? py + 14 : py - 32;
    return <g className="motion-safe:animate-[health-pop_.8s_ease-out_both]" style={{ transformOrigin: `${px}px ${py}px` }}>
      <rect x={Math.min(Math.max(px - w / 2, 2), W - w - 2)} y={by} width={w} height={22} rx={7} fill={color} fillOpacity=".22" stroke={color} strokeOpacity=".7" />
      <text x={Math.min(Math.max(px, w / 2 + 2), W - w / 2 - 2)} y={by + 15} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--foreground)">{label}</text>
    </g>;
  };
  return <div className="relative">
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label="Gráfico da evolução do peso" onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={`${id}-s`} x1="0" x2="1"><stop offset="0%" stopColor="var(--violet)" /><stop offset="100%" stopColor="var(--cyan)" /></linearGradient>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--violet)" stopOpacity=".45" /><stop offset="70%" stopColor="var(--violet)" stopOpacity=".06" /><stop offset="100%" stopColor="var(--violet)" stopOpacity="0" /></linearGradient>
        <filter id={`${id}-g`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((k) => { const v = max - k * (max - min); return <g key={k}><line x1={PL} x2={W - 10} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="2 6" /><text x={PL - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--muted-foreground)">{pt(v)}</text></g>; })}
      {ticks.map((i) => <text key={i} x={pts[i]![0]} y={H - 8} textAnchor="middle" fontSize="11" fill={hover === i ? "var(--cyan)" : "var(--muted-foreground)"}>{shortDate(data[i]!.date)}</text>)}
      {pts.length > 1 && <path d={`${line} L${last[0]},${H - PB} L${firstP[0]},${H - PB} Z`} fill={`url(#${id}-a)`} className="motion-safe:animate-[health-fade_1.4s_ease-out]" />}
      {projection && <g>
        <line x1={last[0]} y1={last[1]} x2={x(projection.date)} y2={y(projection.value)} stroke="var(--cyan)" strokeWidth="2" strokeDasharray="4 6" strokeOpacity=".7" />
        <circle cx={x(projection.date)} cy={y(projection.value)} r="5" fill="var(--background)" stroke="var(--cyan)" strokeDasharray="2 2" strokeWidth="2" />
        <text x={x(projection.date)} y={y(projection.value) + 20} textAnchor="middle" fontSize="10" fill="var(--cyan)">projeção</text>
      </g>}
      {pts.length > 1 && <path d={line} fill="none" stroke={`url(#${id}-s)`} strokeWidth="3.5" strokeLinecap="round" filter={`url(#${id}-g)`} pathLength={1} strokeDasharray="1" className="motion-safe:animate-[health-draw-1_1.8s_ease-out_both]" />}
      {hover !== null && <line x1={pts[hover]![0]} x2={pts[hover]![0]} y1={PT - 10} y2={H - PB} stroke="var(--cyan)" strokeOpacity=".5" strokeDasharray="3 4" />}
      {pts.map(([px, py], i) => <g key={i}><circle cx={px} cy={py} r={hover === i ? 11 : 7} fill="var(--violet)" opacity=".2" className="transition-all" /><circle cx={px} cy={py} r="4.5" fill="var(--background)" stroke={i === pts.length - 1 ? "var(--cyan)" : "var(--violet)"} strokeWidth="2.5" /></g>)}
      {pts.length > 1 && bubble(firstP[0], firstP[1], `${pt(data[0]!.value)} ${unit}`, "var(--violet)")}
      {bubble(last[0], last[1], `${pt(data.at(-1)!.value)} ${unit}`, "var(--cyan)", pts.length > 1 && last[1] < firstP[1] - 20 ? false : pts.length > 1)}
      {pts.map(([px], i) => <rect key={i} x={px - 18} y={0} width={36} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />)}
    </svg>
    {hover !== null && <div className="glass pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl px-3 py-2 text-xs shadow-glow" style={{ left: `${(pts[hover]![0] / W) * 100}%` }}>
      <p className="font-mono text-[10px] text-cyan">{longDate(data[hover]!.date)}</p><p className="font-display-h text-base">{pt(data[hover]!.value)} {unit}</p>
    </div>}
  </div>;
}

export type Series = { key: string; label: string; color: string; values: (number | null)[] };

/** Várias medidas ao longo do tempo, cada uma na sua cor, com faixa e pontos com brilho. */
export function MultiLine({ dates, series }: { dates: string[]; series: Series[] }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 260, PL = 36, PR = 16, PT = 16, PB = 28;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (!all.length || !dates.length) return <div className="grid h-56 place-items-center text-sm text-muted-foreground">Escolha uma medida para ver.</div>;
  const pad = (Math.max(...all) - Math.min(...all)) * 0.1 || 2;
  const min = Math.floor((Math.min(...all) - pad) / 5) * 5, max = Math.ceil((Math.max(...all) + pad) / 5) * 5;
  const x = (i: number) => dates.length === 1 ? (PL + W - PR) / 2 : PL + (i * (W - PL - PR)) / (dates.length - 1);
  const y = (v: number) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB);
  const steps = 5;
  const ticks = dates.length <= 6 ? dates.map((_, i) => i) : [0, Math.round((dates.length - 1) / 3), Math.round(((dates.length - 1) * 2) / 3), dates.length - 1];
  return <div className="relative">
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label="Evolução das medidas" onMouseLeave={() => setHover(null)}>
      <defs><filter id={`${id}-g`}><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      {Array.from({ length: steps + 1 }, (_, k) => min + ((max - min) * k) / steps).map((v) => <g key={v}><line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="2 6" /><text x={PL - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--muted-foreground)">{Math.round(v)}</text></g>)}
      {ticks.map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill={hover === i ? "var(--cyan)" : "var(--muted-foreground)"}>{shortDate(dates[i]!)}</text>)}
      {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="var(--cyan)" strokeOpacity=".45" strokeDasharray="3 4" />}
      {series.map((s, si) => {
        const p = s.values.map((v, i) => (v === null ? null : ([x(i), y(v)] as [number, number]))).filter((q): q is [number, number] => !!q);
        return <g key={s.key}>
          {p.length > 1 && <path d={smooth(p)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" filter={`url(#${id}-g)`} pathLength={1} strokeDasharray="1" className="motion-safe:animate-[health-draw-1_1.6s_ease-out_both]" style={{ animationDelay: `${si * 120}ms` }} />}
          {p.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={i === p.length - 1 ? 5 : 3.5} fill="var(--background)" stroke={s.color} strokeWidth="2.2" style={i === p.length - 1 ? { filter: `drop-shadow(0 0 6px ${s.color})` } : undefined} />)}
        </g>;
      })}
      {dates.map((d, i) => <rect key={d} x={x(i) - 16} y={0} width={32} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />)}
    </svg>
    {hover !== null && <div className="glass pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-xl px-3 py-2 text-xs shadow-glow" style={{ left: `${(x(hover) / W) * 100}%` }}>
      <p className="mb-1 font-mono text-[10px] text-cyan">{longDate(dates[hover]!)}</p>
      {series.map((s) => s.values[hover] != null && <p key={s.key} className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span><b>{pt(s.values[hover]!)} cm</b></p>)}
    </div>}
  </div>;
}

/** Rosca animada com anel tracejado girando por fora. */
export function Donut({ segments, size = 180, children }: { segments: { value: number; color: string }[]; size?: number; children?: ReactNode }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 70, C = 2 * Math.PI * R, gap = segments.filter((s) => s.value > 0).length > 1 ? 6 : 0;
  let acc = 0;
  return <div className="relative shrink-0" style={{ width: size, height: size }}>
    <div className="absolute inset-0 rounded-full border border-dashed border-cyan/25 motion-safe:animate-[spin_24s_linear_infinite]" />
    <div className="absolute inset-[22%] rounded-full bg-cyan/10 blur-2xl" />
    <svg viewBox="0 0 180 180" className="relative h-full w-full -rotate-90" aria-hidden>
      <circle cx="90" cy="90" r={R} fill="none" stroke="var(--border)" strokeWidth="14" />
      {segments.map((s, i) => {
        const len = Math.max(0, (s.value / total) * C - gap), off = -acc; acc += (s.value / total) * C;
        return <circle key={i} cx="90" cy="90" r={R} fill="none" stroke={s.color} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${len} ${C}`} strokeDashoffset={off} className="motion-safe:animate-[health-fade_1.2s_ease-out_both]" style={{ filter: `drop-shadow(0 0 8px ${s.color})`, animationDelay: `${i * 150}ms` }} />;
      })}
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
  </div>;
}

/** Anel de pontuação (270°) com marcas em volta. */
export function ScoreRing({ value, size = 168, label }: { value: number | null; size?: number; label: string }) {
  const id = useId().replace(/:/g, "");
  const R = 64, C = 2 * Math.PI * R, arc = C * 0.75, v = Math.max(0, Math.min(100, value ?? 0));
  const [drawn, setDrawn] = useState(0);
  useEffect(() => { const h = requestAnimationFrame(() => setDrawn(v)); return () => cancelAnimationFrame(h); }, [v]);
  return <div className="relative" style={{ width: size, height: size }}>
    <div className="absolute inset-[18%] rounded-full bg-cyan/15 blur-2xl motion-safe:animate-pulse" />
    <svg viewBox="0 0 160 160" className="relative h-full w-full rotate-[135deg]" aria-hidden>
      <defs><linearGradient id={`${id}-r`} x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="var(--cyan)" /><stop offset="100%" stopColor="var(--emerald)" /></linearGradient></defs>
      {Array.from({ length: 31 }, (_, i) => { const a = (i / 30) * 270 * (Math.PI / 180); const on = i / 30 <= v / 100; return <line key={i} x1={80 + Math.cos(a) * 76} y1={80 + Math.sin(a) * 76} x2={80 + Math.cos(a) * 71} y2={80 + Math.sin(a) * 71} stroke={on ? "var(--cyan)" : "var(--border)"} strokeWidth="1.6" strokeLinecap="round" />; })}
      <circle cx="80" cy="80" r={R} fill="none" stroke="var(--border)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${arc} ${C}`} />
      <circle cx="80" cy="80" r={R} fill="none" stroke={`url(#${id}-r)`} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(arc * drawn) / 100} ${C}`} style={{ transition: "stroke-dasharray 1.4s cubic-bezier(.2,.7,.2,1)", filter: "drop-shadow(0 0 8px var(--cyan))" }} />
    </svg>
    <div className="absolute inset-0 grid place-items-center text-center"><div><p className="font-display-h text-4xl font-semibold">{value === null ? "—" : <Counter value={value} decimals={0} />}</p><p className="text-[11px] text-muted-foreground">{label}</p></div></div>
  </div>;
}

/** Faixa com zona ideal destacada e marcador do valor atual. */
export function ZoneBar({ value, scale, ideal, color }: { value: number; scale: [number, number]; ideal: [number, number]; color: string }) {
  const pos = (n: number) => Math.max(0, Math.min(100, ((n - scale[0]) / (scale[1] - scale[0])) * 100));
  return <div className="relative mt-3 h-2.5 rounded-full bg-gradient-to-r from-emerald/25 via-amber/25 to-destructive/30">
    <span className="absolute inset-y-0 rounded-full bg-emerald/45 shadow-[0_0_12px_var(--emerald)]" style={{ left: `${pos(ideal[0])}%`, width: `${pos(ideal[1]) - pos(ideal[0])}%` }} />
    <span className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background transition-[left] duration-1000" style={{ left: `${pos(value)}%`, background: color, boxShadow: `0 0 14px ${color}` }}>
      <span className="absolute inset-0 animate-ping rounded-full opacity-40" style={{ background: color }} />
    </span>
  </div>;
}

/** Barra de progresso com brilho que percorre. */
export function GlowBar({ pct, from = "var(--cyan)", to = "var(--emerald)" }: { pct: number; from?: string; to?: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-border/60">
    <div className="shine bar-grow h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: `linear-gradient(90deg, ${from}, ${to})`, boxShadow: `0 0 14px ${to}` }} />
  </div>;
}

/** Comparador antes/depois: arraste a linha para revelar uma foto sobre a outra. */
export function PhotoCompare({ before, after, beforeLabel, afterLabel }: { before: string; after: string; beforeLabel: string; afterLabel: string }) {
  const [pos, setPos] = useState(50);
  return <div className="relative aspect-[4/5] w-full select-none overflow-hidden rounded-2xl border border-cyan/25">
    <img src={after} alt={afterLabel} className="absolute inset-0 h-full w-full object-cover" />
    <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}><img src={before} alt={beforeLabel} className="absolute inset-0 h-full w-full object-cover" /></div>
    <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-cyan shadow-[0_0_16px_var(--cyan)]" style={{ left: `${pos}%` }}>
      <span className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-cyan/60 bg-background/70 text-cyan backdrop-blur">⇆</span>
    </div>
    <span className="tag absolute left-3 top-3 bg-background/60 backdrop-blur" style={glow("var(--violet)")}>{beforeLabel}</span>
    <span className="tag absolute right-3 top-3 bg-background/60 backdrop-blur" style={glow("var(--cyan)")}>{afterLabel}</span>
    <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Arraste para comparar antes e agora" className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0" />
  </div>;
}
