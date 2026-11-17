import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { brl } from "@/lib/finance/calc";

/** Número que sobe até o valor (efeito "contador"). */
export function useCountUp(value: number, ms = 900): number {
  const [v, setV] = useState(0), from = useRef(0);
  useEffect(() => {
    const a = from.current, t0 = performance.now(); let raf = 0;
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); setV(a + (value - a) * e); if (k < 1) raf = requestAnimationFrame(tick); else from.current = value; };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}
export function Money({ value, className = "", cents = true }: { value: number; className?: string; cents?: boolean }) {
  const v = useCountUp(value);
  return <span className={`tabular-nums ${className}`}>{cents ? brl(v) : brl(Math.round(v)).replace(/,00$/, "")}</span>;
}

/** Curva suave (monótona) que passa pelos pontos, sem "ondas" a mais. */
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0]!.x},${pts[0]!.y}` : "";
  const n = pts.length, dx: number[] = [], m: number[] = [], t: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(pts[i + 1]!.x - pts[i]!.x); m.push((pts[i + 1]!.y - pts[i]!.y) / dx[i]!); }
  t.push(m[0]!); for (let i = 1; i < n - 1; i++) t.push(m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2); t.push(m[n - 2]!);
  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < n - 1; i++) { const h = dx[i]! / 3; d += ` C${pts[i]!.x + h},${pts[i]!.y + t[i]! * h} ${pts[i + 1]!.x - h},${pts[i + 1]!.y - t[i + 1]! * h} ${pts[i + 1]!.x},${pts[i + 1]!.y}`; }
  return d;
}

/* ───────────── rosca por categoria ───────────── */
export type Slice = { id: string; name: string; color: string; value: number };
export function Donut({ data, size = 220, thickness = 26, center, active, onActive }: { data: Slice[]; size?: number; thickness?: number; center?: ReactNode; active?: string | null; onActive?: (id: string | null) => void }) {
  const uid = useId().replace(/:/g, ""), total = data.reduce((a, d) => a + d.value, 0), r = (size - thickness) / 2, c = 2 * Math.PI * r, gap = data.length > 1 ? 3 : 0;
  let acc = 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ width: size, height: size, overflow: "visible" }} role="img" aria-label="Gastos por categoria">
        <defs>{data.map((d) => (
          <linearGradient key={d.id} id={`${uid}-${d.id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={d.color} /><stop offset="100%" stopColor={`color-mix(in oklab, ${d.color} 55%, black)`} /></linearGradient>
        ))}</defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in oklab, white 6%, transparent)" strokeWidth={thickness} />
        {total > 0 && data.map((d, i) => {
          const len = Math.max(0, (d.value / total) * c - gap), off = -acc; acc += (d.value / total) * c;
          const on = active === d.id, dim = active && !on;
          return (
            <circle key={d.id} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${uid}-${d.id})`} strokeWidth={on ? thickness + 6 : thickness} strokeLinecap="butt"
              strokeDasharray={`${len} ${c}`} strokeDashoffset={off} opacity={dim ? 0.3 : 1}
              style={{ transition: "stroke-width .25s, opacity .25s", filter: on ? `drop-shadow(0 0 10px ${d.color})` : undefined, animation: `fin-ring .9s cubic-bezier(.2,.8,.2,1) ${i * 0.07}s both`, cursor: "pointer", ["--len" as string]: `${len}`, ["--c" as string]: `${c}` }}
              onMouseEnter={() => onActive?.(d.id)} onMouseLeave={() => onActive?.(null)} onClick={() => onActive?.(active === d.id ? null : d.id)} />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>
    </div>
  );
}

/* ───────────── anel de progresso ───────────── */
export function Ring({ pct, color = "var(--cyan)", size = 72, thickness = 7, children }: { pct: number; color?: string; size?: number; thickness?: number; children?: ReactNode }) {
  const uid = useId().replace(/:/g, ""), r = (size - thickness) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ width: size, height: size, overflow: "visible" }}>
        <defs><linearGradient id={uid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="var(--violet)" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in oklab, white 8%, transparent)" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${uid})`} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)}
          style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)", filter: `drop-shadow(0 0 6px color-mix(in oklab, ${color} 70%, transparent))` }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children ?? <span className="text-[0.78rem] font-semibold tabular-nums">{Math.round(p)}%</span>}</div>
    </div>
  );
}

/* ───────────── minigráfico ───────────── */
export function Sparkline({ values, color = "var(--cyan)", height = 36, width = 120 }: { values: number[]; color?: string; height?: number; width?: number }) {
  const uid = useId().replace(/:/g, "");
  const { d, area, last } = useMemo(() => {
    if (values.length < 2) return { d: "", area: "", last: null as null | { x: number; y: number } };
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1, pad = 4;
    const pts = values.map((v, i) => ({ x: (i / (values.length - 1)) * width, y: pad + (1 - (v - min) / span) * (height - pad * 2) }));
    const d = smooth(pts);
    return { d, area: `${d} L${width},${height} L0,${height} Z`, last: pts[pts.length - 1]! };
  }, [values, height, width]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height, overflow: "visible" }} aria-hidden>
      <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".35" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill={`url(#${uid})`} /><path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" pathLength={1} style={{ strokeDasharray: 1, animation: "fin-draw 1.2s ease both", filter: `drop-shadow(0 0 4px ${color})` }} />
      {last && <circle cx={last.x} cy={last.y} r={3} fill={color} style={{ filter: `drop-shadow(0 0 5px ${color})` }} />}
    </svg>
  );
}

/* ───────────── área (evolução) ───────────── */
export type Pt = { label: string; value: number };
export function AreaChart({ points, color = "var(--cyan)", height = 220, format = brl }: { points: Pt[]; color?: string; height?: number; format?: (n: number) => string }) {
  const uid = useId().replace(/:/g, ""), [hover, setHover] = useState<number | null>(null), W = 640, H = height, padX = 28, padT = 18, padB = 28;
  const min = Math.min(0, ...points.map((p) => p.value)), max = Math.max(1, ...points.map((p) => p.value)), span = max - min || 1;
  const xy = points.map((p, i) => ({ x: padX + (i / Math.max(1, points.length - 1)) * (W - padX * 2), y: padT + (1 - (p.value - min) / span) * (H - padT - padB) }));
  const d = smooth(xy), area = `${d} L${xy.at(-1)?.x ?? 0},${H - padB} L${xy[0]?.x ?? 0},${H - padB} Z`, zeroY = padT + (1 - (0 - min) / span) * (H - padT - padB);
  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" style={{ overflow: "visible" }} role="img" aria-label="Evolução mensal"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const b = (e.currentTarget as SVGSVGElement).getBoundingClientRect(), x = ((e.clientX - b.left) / b.width) * W; let bi = 0, bd = 1e9; xy.forEach((p, i) => { const dd = Math.abs(p.x - x); if (dd < bd) { bd = dd; bi = i; } }); setHover(bi); }}>
        <defs>
          <linearGradient id={`${uid}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".42" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient>
          <linearGradient id={`${uid}l`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor="var(--violet)" /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={padX} x2={W - padX} y1={padT + g * (H - padT - padB)} y2={padT + g * (H - padT - padB)} stroke="white" strokeOpacity=".05" strokeDasharray="3 6" />)}
        {min < 0 && <line x1={padX} x2={W - padX} y1={zeroY} y2={zeroY} stroke="white" strokeOpacity=".18" strokeDasharray="2 4" />}
        <path d={area} fill={`url(#${uid}a)`} style={{ animation: "fin-fade 1.2s ease both" }} />
        <path d={d} fill="none" stroke={`url(#${uid}l)`} strokeWidth={3} strokeLinecap="round" pathLength={1} vectorEffect="non-scaling-stroke" style={{ strokeDasharray: 1, animation: "fin-draw 1.4s ease both", filter: `drop-shadow(0 0 8px color-mix(in oklab, ${color} 60%, transparent))` }} />
        {hover !== null && <line x1={xy[hover]!.x} x2={xy[hover]!.x} y1={padT} y2={H - padB} stroke={color} strokeOpacity=".35" strokeDasharray="3 4" />}
        {xy.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 6 : 3.5} fill="var(--background)" stroke={color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" style={{ transition: "r .2s", filter: hover === i ? `drop-shadow(0 0 8px ${color})` : undefined }} />)}
        {points.map((p, i) => <text key={i} x={xy[i]!.x} y={H - 6} textAnchor="middle" fontSize="11" fill="currentColor" opacity={hover === i ? 1 : 0.5} className="select-none">{p.label}</text>)}
      </svg>
      {xy.length > 0 && <span aria-hidden className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(xy.at(-1)!.x / W) * 100}%`, top: `${(xy.at(-1)!.y / H) * 100}%`, background: color, animation: "fin-pulse 2.2s ease-out infinite" }} />}
      {hover !== null && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl border border-white/10 bg-[oklch(0.18_0.03_262/0.95)] px-3 py-1.5 text-xs shadow-xl backdrop-blur"
          style={{ left: `${(xy[hover]!.x / W) * 100}%`, top: `${(xy[hover]!.y / H) * 100}%`, marginTop: -10 }}>
          <div className="text-muted-foreground">{points[hover]!.label}</div><div className="font-semibold tabular-nums" style={{ color }}>{format(points[hover]!.value)}</div>
        </div>
      )}
    </div>
  );
}

/* ───────────── barras: receitas × despesas ───────────── */
export type BarPt = { label: string; a: number; b: number };
export function BarsChart({ points, aColor = "var(--emerald)", bColor = "oklch(0.72 0.18 10)", aName = "Receitas", bName = "Despesas", height = 220 }: { points: BarPt[]; aColor?: string; bColor?: string; aName?: string; bName?: string; height?: number }) {
  const uid = useId().replace(/:/g, ""), [hover, setHover] = useState<number | null>(null), W = 640, H = height, padX = 24, padT = 14, padB = 28;
  const max = Math.max(1, ...points.flatMap((p) => [p.a, p.b])), slot = (W - padX * 2) / Math.max(1, points.length), bw = Math.min(26, slot * 0.28);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" style={{ overflow: "visible" }} role="img" aria-label={`${aName} e ${bName} por mês`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`${uid}a`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={aColor} /><stop offset="100%" stopColor={aColor} stopOpacity=".25" /></linearGradient>
          <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={bColor} /><stop offset="100%" stopColor={bColor} stopOpacity=".25" /></linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={padX} x2={W - padX} y1={padT + (1 - g) * (H - padT - padB)} y2={padT + (1 - g) * (H - padT - padB)} stroke="white" strokeOpacity=".05" strokeDasharray="3 6" />)}
        {points.map((p, i) => {
          const cx = padX + slot * i + slot / 2, on = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} style={{ cursor: "default" }}>
              <rect x={cx - slot / 2} y={padT} width={slot} height={H - padT - padB} fill="white" opacity={on ? 0.04 : 0} rx="10" />
              <rect x={cx - bw - 2} y={y(p.a)} width={bw} height={Math.max(2, H - padB - y(p.a))} rx="6" fill={`url(#${uid}a)`} style={{ transformOrigin: `${cx}px ${H - padB}px`, animation: `fin-bar .8s cubic-bezier(.2,.8,.2,1) ${i * 0.07}s both`, filter: on ? `drop-shadow(0 0 8px ${aColor})` : undefined }} />
              <rect x={cx + 2} y={y(p.b)} width={bw} height={Math.max(2, H - padB - y(p.b))} rx="6" fill={`url(#${uid}b)`} style={{ transformOrigin: `${cx}px ${H - padB}px`, animation: `fin-bar .8s cubic-bezier(.2,.8,.2,1) ${i * 0.07 + 0.05}s both`, filter: on ? `drop-shadow(0 0 8px ${bColor})` : undefined }} />
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="currentColor" opacity={on ? 1 : 0.5}>{p.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-white/10 bg-[oklch(0.18_0.03_262/0.95)] px-3 py-2 text-xs shadow-xl backdrop-blur" style={{ left: `${((padX + slot * hover + slot / 2) / W) * 100}%` }}>
          <div className="mb-1 text-muted-foreground">{points[hover]!.label}</div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: aColor }} />{aName} <b className="ml-auto pl-3 tabular-nums">{brl(points[hover]!.a)}</b></div>
          <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: bColor }} />{bName} <b className="ml-auto pl-3 tabular-nums">{brl(points[hover]!.b)}</b></div>
        </div>
      )}
    </div>
  );
}

/* ───────────── barras empilhadas (comprometimento futuro) ───────────── */
export type StackPt = { label: string; segs: { name: string; color: string; value: number }[]; extra?: number };
export function StackedBars({ points, height = 200, highlight }: { points: StackPt[]; height?: number; highlight?: number }) {
  const [hover, setHover] = useState<number | null>(null), W = 640, H = height, padX = 18, padT = 12, padB = 26;
  const totals = points.map((p) => p.segs.reduce((a, s) => a + s.value, 0)), max = Math.max(1, ...totals), slot = (W - padX * 2) / Math.max(1, points.length), bw = Math.min(30, slot * 0.6);
  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full" style={{ overflow: "visible" }} role="img" aria-label="Parcelas dos próximos meses" onMouseLeave={() => setHover(null)}>
        {[0.5, 1].map((g) => <line key={g} x1={padX} x2={W - padX} y1={padT + (1 - g) * (H - padT - padB)} y2={padT + (1 - g) * (H - padT - padB)} stroke="white" strokeOpacity=".05" strokeDasharray="3 6" />)}
        {points.map((p, i) => {
          const cx = padX + slot * i + slot / 2; let acc = 0; const on = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={cx - slot / 2} y={padT} width={slot} height={H - padT - padB} fill="white" opacity={on ? 0.04 : 0} rx="10" />
              {p.segs.map((sg, k) => {
                const h = (sg.value / max) * (H - padT - padB), y = H - padB - acc - h; acc += h;
                return <rect key={k} x={cx - bw / 2} y={y} width={bw} height={Math.max(0, h - 1)} rx={k === p.segs.length - 1 ? 6 : 2} fill={sg.color} opacity={0.92} style={{ transformOrigin: `${cx}px ${H - padB}px`, animation: `fin-bar .8s cubic-bezier(.2,.8,.2,1) ${i * 0.05}s both`, filter: on ? `drop-shadow(0 0 7px ${sg.color})` : undefined }} />;
              })}
              <text x={cx} y={H - 7} textAnchor="middle" fontSize="11" fill="currentColor" opacity={on || highlight === i ? 1 : 0.5} fontWeight={highlight === i ? 700 : 400}>{p.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-white/10 bg-[oklch(0.18_0.03_262/0.95)] px-3 py-2 text-xs shadow-xl backdrop-blur" style={{ left: `${((padX + slot * hover + slot / 2) / W) * 100}%` }}>
          <div className="mb-1 font-medium">{points[hover]!.label} · {brl(totals[hover]!)}</div>
          {points[hover]!.segs.length ? points[hover]!.segs.map((sg, k) => <div key={k} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: sg.color }} />{sg.name}<b className="ml-auto pl-3 tabular-nums">{brl(sg.value)}</b></div>) : <div className="text-muted-foreground">Sem parcelas</div>}
        </div>
      )}
    </div>
  );
}

/* ───────────── medidor (limite do cartão) ───────────── */
export function Meter({ pct, color = "var(--cyan)", height = 8, warn = true }: { pct: number; color?: string; height?: number; warn?: boolean }) {
  const p = Math.max(0, Math.min(100, pct)), hot = warn && p >= 80, c = hot ? "oklch(0.72 0.18 10)" : color;
  return (
    <div className="overflow-hidden rounded-full bg-white/8" style={{ height }} role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full" style={{ width: `${p}%`, background: `linear-gradient(90deg, ${c}, color-mix(in oklab, ${c} 55%, var(--violet)))`, boxShadow: `0 0 14px -2px ${c}`, transition: "width .9s cubic-bezier(.2,.8,.2,1)" }} />
    </div>
  );
}


/* ───────────── velocímetro (meia-lua) ───────────── */
export function Gauge({ pct, size = 240, label, value, sub, from = "oklch(0.72 0.18 10)", mid = "var(--amber)", to = "var(--emerald)" }: { pct: number; size?: number; label?: ReactNode; value?: ReactNode; sub?: ReactNode; from?: string; mid?: string; to?: string }) {
  const uid = useId().replace(/:/g, ""), p = Math.max(0, Math.min(100, pct)), W = size, H = size * 0.62, cx = W / 2, cy = H - 10, r = W / 2 - 18;
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = setTimeout(() => setShown(p), 60); return () => clearTimeout(t); }, [p]);
  const ang = Math.PI * (1 - shown / 100), kx = cx + Math.cos(ang) * r, ky = cy - Math.sin(ang) * r;
  const arc = `M${cx - r},${cy} A${r},${r} 0 0 1 ${cx + r},${cy}`, len = Math.PI * r;
  return (
    <div className="relative" style={{ width: W, height: H + 8 }}>
      <svg viewBox={`0 0 ${W} ${H + 8}`} className="h-full w-full overflow-visible" role="img" aria-label={`${Math.round(p)}%`}>
        <defs><linearGradient id={uid} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={from} /><stop offset="50%" stopColor={mid} /><stop offset="100%" stopColor={to} /></linearGradient></defs>
        {Array.from({ length: 41 }, (_, i) => { const a = Math.PI * (1 - i / 40), big = i % 5 === 0, r1 = r + 9, r2 = r + (big ? 16 : 12); return <line key={i} x1={cx + Math.cos(a) * r1} y1={cy - Math.sin(a) * r1} x2={cx + Math.cos(a) * r2} y2={cy - Math.sin(a) * r2} stroke="currentColor" strokeOpacity={i / 40 <= shown / 100 ? 0.7 : 0.15} strokeWidth={big ? 1.6 : 1} style={{ transition: "stroke-opacity .6s" }} />; })}
        <path d={arc} fill="none" stroke="color-mix(in oklab, var(--foreground) 8%, transparent)" strokeWidth="14" strokeLinecap="round" />
        <path d={arc} fill="none" stroke={`url(#${uid})`} strokeWidth="14" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - shown / 100)} style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 10px color-mix(in oklab, var(--cyan) 45%, transparent))" }} />
        <circle cx={kx} cy={ky} r="9" fill="var(--background)" stroke="var(--foreground)" strokeWidth="3" style={{ transition: "cx 1.4s cubic-bezier(.2,.8,.2,1), cy 1.4s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 10px var(--cyan))" }} />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 text-center" style={{ top: H * 0.42 }}>
        {label && <p className="text-[0.66rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>}
        {value && <p className="font-display text-3xl font-semibold tabular-nums leading-tight">{value}</p>}
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/* ───────────── anéis concêntricos ───────────── */
export type RingItem = { id: string; label: string; pct: number; color: string; detail?: string };
export function RadialRings({ items, size = 220, thickness = 11, center }: { items: RingItem[]; size?: number; thickness?: number; center?: ReactNode }) {
  const [shown, setShown] = useState(false), c = size / 2, gap = thickness + 6;
  useEffect(() => { const t = setTimeout(() => setShown(true), 80); return () => clearTimeout(t); }, []);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90 h-full w-full overflow-visible" role="img" aria-label="Progresso">
        {items.slice(0, 5).map((it, i) => {
          const r = c - thickness / 2 - i * gap, len = 2 * Math.PI * r, p = Math.max(0, Math.min(100, it.pct));
          return (
            <g key={it.id}>
              <circle cx={c} cy={c} r={r} fill="none" stroke="color-mix(in oklab, var(--foreground) 7%, transparent)" strokeWidth={thickness} />
              <circle cx={c} cy={c} r={r} fill="none" stroke={it.color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={len} strokeDashoffset={shown ? len * (1 - p / 100) : len}
                style={{ transition: `stroke-dashoffset 1.3s cubic-bezier(.2,.8,.2,1) ${i * 0.12}s`, filter: `drop-shadow(0 0 7px color-mix(in oklab, ${it.color} 70%, transparent))` }} />
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>
    </div>
  );
}

/* ───────────── calendário de calor (gasto por dia) ───────────── */
export function Heatmap({ ym, values, today, color = "var(--violet)" }: { ym: string; values: Record<number, number>; today?: number | undefined; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [y, m] = ym.split("-").map(Number), days = new Date(y!, m!, 0).getDate(), first = new Date(y!, m! - 1, 1).getDay();
  const max = Math.max(1, ...Object.values(values)), cells = [...Array.from({ length: first }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div className="relative">
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[0.62rem] uppercase tracking-wider text-muted-foreground">{["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (d === null) return <span key={`x${i}`} />;
          const v = values[d] ?? 0, k = v / max, future = today !== undefined && d > today, isToday = d === today;
          return (
            <button type="button" key={d} onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(d)} onBlur={() => setHover(null)}
              className="relative grid aspect-square place-items-center rounded-lg text-[0.66rem] tabular-nums transition hover:scale-110"
              style={{ background: v ? `color-mix(in oklab, ${color} ${18 + k * 72}%, transparent)` : "color-mix(in oklab, var(--foreground) 4%, transparent)", boxShadow: k > 0.6 ? `0 0 14px -3px ${color}` : isToday ? "inset 0 0 0 1.5px var(--cyan)" : undefined, opacity: future ? 0.35 : 1, color: k > 0.5 ? "var(--foreground)" : "var(--muted-foreground)", animation: `fin-pop .4s ${i * 0.012}s both` }}
              aria-label={`Dia ${d}: ${brl(v)}`}>{d}</button>
          );
        })}
      </div>
      {hover !== null && <div className="pointer-events-none absolute -top-2 right-0 -translate-y-full rounded-xl border border-white/10 bg-[oklch(0.18_0.03_262/0.95)] px-3 py-1.5 text-xs shadow-xl backdrop-blur">Dia {hover} · <b className="tabular-nums">{brl(values[hover] ?? 0)}</b></div>}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[0.62rem] text-muted-foreground">menos{[0.1, 0.35, 0.6, 0.85].map((k) => <span key={k} className="h-2.5 w-2.5 rounded" style={{ background: `color-mix(in oklab, ${color} ${18 + k * 72}%, transparent)` }} />)}mais</div>
    </div>
  );
}

/* ───────────── barras por dia + linha acumulada ───────────── */
export function DailyBars({ days, height = 170, today, color = "var(--cyan)", lineColor = "var(--violet)" }: { days: { day: number; value: number }[]; height?: number; today?: number | undefined; color?: string; lineColor?: string }) {
  const uid = useId().replace(/:/g, ""), [hover, setHover] = useState<number | null>(null), W = 640, H = height, padX = 8, padT = 12, padB = 22;
  const max = Math.max(1, ...days.map((d) => d.value)), slot = (W - padX * 2) / Math.max(1, days.length), bw = Math.max(3, slot * 0.58);
  let acc = 0; const cum = days.map((d) => (acc += d.value)), cmax = Math.max(1, acc);
  const line = smooth(days.map((_, i) => ({ x: padX + slot * i + slot / 2, y: padT + (1 - cum[i]! / cmax) * (H - padT - padB) })));
  return (
    <div className="relative w-full" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label="Gastos por dia" onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} /><stop offset="100%" stopColor={color} stopOpacity=".15" /></linearGradient></defs>
        {[0.33, 0.66].map((g) => <line key={g} x1={padX} x2={W - padX} y1={padT + g * (H - padT - padB)} y2={padT + g * (H - padT - padB)} stroke="currentColor" strokeOpacity=".06" strokeDasharray="3 6" />)}
        {days.map((d, i) => {
          const x = padX + slot * i + slot / 2, h = (d.value / max) * (H - padT - padB), on = hover === i, isT = d.day === today;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)}>
              <rect x={x - slot / 2} y={padT} width={slot} height={H - padT - padB} fill="currentColor" opacity={on ? 0.05 : 0} />
              <rect x={x - bw / 2} y={H - padB - h} width={bw} height={Math.max(d.value ? 2 : 0, h)} rx={Math.min(4, bw / 2)} fill={isT ? "var(--amber)" : `url(#${uid})`} style={{ transformOrigin: `${x}px ${H - padB}px`, animation: `fin-bar .7s cubic-bezier(.2,.8,.2,1) ${i * 0.015}s both`, filter: on || isT ? `drop-shadow(0 0 7px ${isT ? "var(--amber)" : color})` : undefined }} />
              {(d.day === 1 || d.day % 5 === 0) && <text x={x} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" opacity=".45">{d.day}</text>}
            </g>
          );
        })}
        <path d={line} fill="none" stroke={lineColor} strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" style={{ animation: "fin-dash 2s linear infinite", filter: `drop-shadow(0 0 5px ${lineColor})` }} />
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-xl border border-white/10 bg-[oklch(0.18_0.03_262/0.95)] px-3 py-1.5 text-xs shadow-xl backdrop-blur" style={{ left: `${((padX + slot * hover + slot / 2) / W) * 100}%` }}>
          <div className="text-muted-foreground">Dia {days[hover]!.day}</div><div className="font-semibold tabular-nums" style={{ color }}>{brl(days[hover]!.value)}</div><div className="text-[0.66rem] text-muted-foreground">acumulado {brl(cum[hover]!)}</div>
        </div>
      )}
    </div>
  );
}
