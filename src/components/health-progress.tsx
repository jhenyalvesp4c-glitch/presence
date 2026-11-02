import { Link } from "@tanstack/react-router";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { TrendingUp, TrendingDown, Plus, Scale, Ruler, Activity, CalendarDays, Camera, Target, ScanLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthTabs } from "@/components/health-tabs";
import { HealthSheetTabs } from "@/components/health-sheet-tabs";
import { useHealthPreview } from "@/components/health-preview-provider";
import { HealthLoading } from "@/components/health-loading";
import { measurementLabels, toNumber, formatDate, type MeasurementSheet } from "@/lib/health-preview";
import bodyAsset from "@/assets/hoje-corpo.jpg";
import heroAsset from "@/assets/medidas-hero.jpg";

const keys = Object.keys(measurementLabels);
const palette = ["var(--cyan)", "var(--violet)", "var(--emerald)", "oklch(0.75 0.18 340)", "oklch(0.82 0.15 80)", "oklch(0.72 0.16 250)", "oklch(0.78 0.14 180)"];
const colorOf = (k: string) => palette[keys.indexOf(k) % palette.length]!;
const glow = (c: string) => ({ "--glow": c }) as CSSProperties;
const longDate = (iso: string) => iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

type Series = { key: string; label: string; color: string; values: (number | null)[] };

/** Multi-series chart with gradient strokes, glow, animated draw and hover tooltip. */
function TrendChart({ dates, series, unit, height = 260 }: { dates: string[]; series: Series[]; unit: string; height?: number }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = height, PL = 44, PR = 20, PT = 24, PB = 36;
  const all = series.flatMap(s => s.values.filter((v): v is number => v !== null));
  if (!all.length) return <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>Sem dados ainda.</div>;
  const pad = (Math.max(...all) - Math.min(...all)) * 0.15 || 1;
  const min = Math.min(...all) - pad, max = Math.max(...all) + pad;
  const x = (i: number) => dates.length === 1 ? (PL + W - PR) / 2 : PL + (i * (W - PL - PR)) / (dates.length - 1);
  const y = (v: number) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB);
  const smooth = (pts: [number, number][]) => pts.map((p, i) => { if (!i) return `M${p[0]},${p[1]}`; const q = pts[i - 1]!; const mx = (q[0] + p[0]) / 2; return `C${mx},${q[1]} ${mx},${p[1]} ${p[0]},${p[1]}`; }).join(" ");
  const single = series.length === 1;
  return <div className="relative">
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label="Gráfico de evolução" onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={`${id}-stroke`} x1="0" x2="1"><stop offset="0%" stopColor="var(--cyan)" /><stop offset="100%" stopColor="var(--violet)" /></linearGradient>
        <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--violet)" stopOpacity=".35" /><stop offset="60%" stopColor="var(--cyan)" stopOpacity=".08" /><stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" /></linearGradient>
        <filter id={`${id}-glow`}><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      {[0, .25, .5, .75, 1].map(t => { const v = max - t * (max - min); return <g key={t}><line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="2 6" /><text x={PL - 10} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="var(--muted-foreground)">{v.toFixed(0)}</text></g>; })}
      {dates.map((d, i) => <text key={d} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill={hover === i ? "var(--cyan)" : "var(--muted-foreground)"}>{formatDate(d)}</text>)}
      {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PT} y2={H - PB} stroke="var(--cyan)" strokeOpacity=".5" strokeDasharray="3 4" />}
      {series.map(s => {
        const pts = s.values.map((v, i) => v === null ? null : [x(i), y(v)] as [number, number]).filter((p): p is [number, number] => !!p);
        const path = smooth(pts), stroke = single ? `url(#${id}-stroke)` : s.color;
        return <g key={s.key}>
          {single && pts.length > 1 && <path d={`${path} L${pts[pts.length - 1]![0]},${H - PB} L${pts[0]![0]},${H - PB} Z`} fill={`url(#${id}-area)`} className="motion-safe:animate-[health-fade_1.2s_ease-out]" />}
          {pts.length > 1 && <path d={path} fill="none" stroke={stroke} strokeWidth={single ? 3.5 : 2.5} strokeLinecap="round" filter={`url(#${id}-glow)`} pathLength={1} strokeDasharray="1" className="motion-safe:animate-[health-draw-1_1.6s_ease-out_both]" />}
          {pts.map(([px, py], i) => <g key={i}><circle cx={px} cy={py} r={hover === i ? 12 : 8} fill={s.color} opacity=".18" className="transition-all" /><circle cx={px} cy={py} r="4.5" fill="var(--background)" stroke={s.color} strokeWidth="2.5" /></g>)}
        </g>;
      })}
      {dates.map((d, i) => <rect key={d} x={x(i) - (W / Math.max(dates.length, 1)) / 2} y={0} width={W / Math.max(dates.length, 1)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />)}
    </svg>
    {hover !== null && <div className="glass pointer-events-none absolute top-0 z-10 min-w-36 -translate-x-1/2 rounded-xl px-3 py-2 text-xs shadow-glow" style={{ left: `${(x(hover) / W) * 100}%` }}>
      <p className="mb-1 font-mono text-[10px] text-cyan">{longDate(dates[hover]!)}</p>
      {series.map(s => s.values[hover] !== null && <p key={s.key} className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span><b>{s.values[hover]}{unit}</b></p>)}
    </div>}
  </div>;
}

function Sparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const v = values.filter((n): n is number => n !== null);
  if (v.length < 2) return <div className="h-10" />;
  const min = Math.min(...v), span = Math.max(...v) - min || 1;
  const pts = v.map((n, i) => `${(i / (v.length - 1)) * 100},${36 - ((n - min) / span) * 30}`).join(" ");
  return <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-10 w-full"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 4px ${color})` }} /></svg>;
}

function Radar({ first, last }: { first: MeasurementSheet; last: MeasurementSheet }) {
  const id = useId().replace(/:/g, "");
  const S = 340, c = S / 2, R = 120;
  const max = Math.max(1, ...keys.flatMap(k => [toNumber(first.valores[k]) ?? 0, toNumber(last.valores[k]) ?? 0])) * 1.05;
  const pt = (i: number, v: number) => { const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2; return [c + Math.cos(a) * R * (v / max), c + Math.sin(a) * R * (v / max)] as const; };
  const poly = (m: MeasurementSheet) => keys.map((k, i) => pt(i, toNumber(m.valores[k]) ?? 0).join(",")).join(" ");
  return <div className="relative mx-auto aspect-square w-full max-w-[340px]">
    <div className="absolute inset-[18%] rounded-full border border-dashed border-cyan/30 motion-safe:animate-[spin_30s_linear_infinite]" />
    <div className="absolute inset-[8%] rounded-full border border-violet/20 motion-safe:animate-[spin_45s_linear_infinite_reverse]" />
    <div className="absolute inset-[30%] rounded-full bg-violet/20 blur-3xl" />
    <svg viewBox={`0 0 ${S} ${S}`} className="relative w-full overflow-visible" role="img" aria-label="Comparação das medidas">
      <defs><radialGradient id={`${id}-f`}><stop offset="0%" stopColor="var(--cyan)" stopOpacity=".55" /><stop offset="100%" stopColor="var(--violet)" stopOpacity=".25" /></radialGradient></defs>
      {[.25, .5, .75, 1].map(t => <polygon key={t} points={keys.map((_, i) => pt(i, max * t).join(",")).join(" ")} fill="none" stroke="var(--border)" />)}
      {keys.map((k, i) => { const [ex, ey] = pt(i, max); const [lx, ly] = pt(i, max * 1.18); return <g key={k}><line x1={c} y1={c} x2={ex} y2={ey} stroke="var(--border)" /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill={colorOf(k)}>{measurementLabels[k]}</text></g>; })}
      <polygon points={poly(first)} fill="var(--violet)" fillOpacity=".1" stroke="var(--violet)" strokeOpacity=".7" strokeDasharray="4 4" />
      <polygon points={poly(last)} fill={`url(#${id}-f)`} stroke="var(--cyan)" strokeWidth="2" style={{ filter: "drop-shadow(0 0 10px var(--cyan))" }} className="origin-center motion-safe:animate-[health-pop_1s_ease-out]" />
      {keys.map((k, i) => { const [px, py] = pt(i, toNumber(last.valores[k]) ?? 0); return <circle key={k} cx={px} cy={py} r="4" fill={colorOf(k)} style={{ filter: `drop-shadow(0 0 6px ${colorOf(k)})` }} />; })}
    </svg>
  </div>;
}

function Panel({ title, icon: Icon, color = "var(--cyan)", children, className = "", right }: { title: string; icon: typeof Scale; color?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return <section style={glow(color)} className={`accent-card min-w-0 p-5 sm:p-6 ${className}`}>
    <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-30 blur-3xl" style={{ background: color }} />
    <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-3 font-display-h text-lg"><span className="icon-tile h-10 w-10"><Icon className="h-4 w-4" /></span>{title}</h2>{right}</div>
    <div className="relative">{children}</div>
  </section>;
}

export function HealthProgress() {
  const { measurementHistory: history, ready } = useHealthPreview();
  const [active, setActive] = useState<string[]>(["cintura", "quadril", "braco"]);
  const first = history[0], last = history[history.length - 1];

  if (!ready) return <HealthLoading />;
  if (!first || !last) return <Shell><div style={glow("var(--violet)")} className="accent-card mx-auto max-w-2xl p-8 text-center"><img src={heroAsset} alt="Análise corporal futurista" className="holo-float mx-auto mb-6 aspect-[4/3] w-full max-w-sm rounded-2xl object-cover" /><h2 className="font-display-h text-2xl">Comece sua <span className="text-gradient">evolução</span></h2><p className="mt-2 text-sm text-muted-foreground">Crie sua ficha de peso e medidas para ver gráficos do seu progresso.</p><Button asChild className="mt-6 rounded-full bg-gradient-brand text-primary-foreground"><Link to="/medidas/nova"><Plus />Criar ficha de medidas</Link></Button></div></Shell>;

  const dates = history.map(h => h.data);
  const pesos = history.map(h => toNumber(h.peso));
  const p0 = toNumber(first.peso), p1 = toNumber(last.peso);
  const dPeso = p0 !== null && p1 !== null ? p1 - p0 : null;
  const alt = toNumber(last.altura);
  const imc = p1 && alt ? p1 / (alt > 3 ? (alt / 100) ** 2 : alt ** 2) : null;
  const days = Math.max(0, Math.round((new Date(last.data).getTime() - new Date(first.data).getTime()) / 86400000));
  const deltas = keys.map(k => { const a = toNumber(first.valores[k]), b = toNumber(last.valores[k]); return { k, a, b, d: a !== null && b !== null ? b - a : null }; });
  const maxAbs = Math.max(1, ...deltas.map(d => Math.abs(d.d ?? 0)));
  const totalCm = deltas.reduce((s, d) => s + (d.d ?? 0), 0);
  const cinturaSeries = history.map(h => toNumber(h.valores["cintura"]));
  const totals = history.map(h => keys.reduce((s, k) => s + (toNumber(h.valores[k]) ?? 0), 0) || null);
  const photoFirst = history.find(h => Object.keys(h.fotos).length), photoLast = [...history].reverse().find(h => Object.keys(h.fotos).length);
  const series: Series[] = keys.filter(k => active.includes(k)).map(k => ({ key: k, label: measurementLabels[k]!, color: colorOf(k), values: history.map(h => toNumber(h.valores[k])) }));

  return <Shell>
    <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { icon: Scale, color: "var(--cyan)", label: "Peso atual", value: last.peso || "—", unit: "kg", sub: `início ${first.peso || "—"} kg`, spark: pesos },
        { icon: dPeso !== null && dPeso <= 0 ? TrendingDown : TrendingUp, color: "var(--violet)", label: "Variação de peso", value: dPeso !== null ? `${dPeso > 0 ? "+" : ""}${dPeso.toFixed(1)}` : "—", unit: "kg", sub: `em ${days} dias`, spark: pesos },
        { icon: Ruler, color: "var(--emerald)", label: "Medidas somadas", value: `${totalCm > 0 ? "+" : ""}${totalCm.toFixed(1)}`, unit: "cm", sub: "desde o início", spark: totals },
        { icon: Target, color: "oklch(0.75 0.18 340)", label: "IMC", value: imc ? imc.toFixed(1) : "—", unit: "", sub: `${history.length} registro${history.length === 1 ? "" : "s"}`, spark: cinturaSeries },
      ].map(s => <div key={s.label} style={glow(s.color)} className="accent-card p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-30 blur-2xl" style={{ background: s.color }} />
        <div className="relative flex items-start justify-between"><div><p className="mb-3 text-xs text-muted-foreground">{s.label}</p><p className="font-display-h text-3xl">{s.value}<span className="ml-1 text-xs text-muted-foreground">{s.unit}</span></p></div><span className="icon-tile h-10 w-10"><s.icon className="h-4 w-4" /></span></div>
        <div className="relative mt-2"><Sparkline values={s.spark} color={s.color} /></div>
        <p className="relative font-mono text-[10px] text-muted-foreground">{s.sub}</p>
      </div>)}
    </section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel title="Evolução do peso" icon={Activity} right={<div className="flex items-center gap-2"><span className="tag" style={glow("var(--cyan)")}>{longDate(first.data)} → {longDate(last.data)}</span><Button asChild size="sm" className="rounded-full bg-gradient-brand text-primary-foreground"><Link to="/medidas/nova"><Plus />Nova medição</Link></Button></div>}>
        <TrendChart dates={dates} unit=" kg" series={[{ key: "peso", label: "Peso", color: "var(--cyan)", values: pesos }]} />
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">{[{ l: "Mínimo", v: Math.min(...pesos.filter((n): n is number => n !== null)) }, { l: "Máximo", v: Math.max(...pesos.filter((n): n is number => n !== null)) }, { l: "Média", v: pesos.filter((n): n is number => n !== null).reduce((a, b, _, arr) => a + b / arr.length, 0) }].map(m => <div key={m.l} className="rounded-xl border border-border bg-card/30 py-2"><p className="font-mono text-[10px] text-muted-foreground">{m.l}</p><p className="font-display-h text-lg">{Number.isFinite(m.v) ? m.v.toFixed(1) : "—"}<span className="ml-1 text-xs text-muted-foreground">kg</span></p></div>)}</div>
      </Panel>
      <Panel title="Antes × agora" icon={ScanLine} color="var(--violet)" right={<div className="flex gap-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet" />{formatDate(first.data)}</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan shadow-glow" />{formatDate(last.data)}</span></div>}>
        <Radar first={first} last={last} />
      </Panel>
    </div>

    <Panel title="Medidas ao longo do tempo" icon={TrendingUp} color="var(--emerald)" className="mt-6">
      <div className="mb-4 flex flex-wrap gap-2">{keys.map(k => { const on = active.includes(k); return <Button key={k} size="sm" variant="outline" aria-pressed={on} onClick={() => setActive(a => on ? a.filter(x => x !== k) : [...a, k])} style={on ? { borderColor: colorOf(k), color: colorOf(k), boxShadow: `0 0 18px -6px ${colorOf(k)}` } : undefined} className="rounded-full bg-card/40 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: colorOf(k) }} />{measurementLabels[k]}</Button>; })}</div>
      <TrendChart dates={dates} unit=" cm" series={series} height={280} />
    </Panel>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Panel title="Variação por medida" icon={Ruler} color="var(--violet)">
        <ul className="space-y-4">{deltas.map(({ k, b, d }) => <li key={k}><div className="mb-1.5 flex justify-between text-sm"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: colorOf(k) }} />{measurementLabels[k]}</span><span className="font-mono text-xs"><span className="text-muted-foreground">{b ?? "—"} cm</span>{d !== null && <span className="ml-2" style={{ color: colorOf(k) }}>{d > 0 ? "+" : ""}{d.toFixed(1)}</span>}</span></div>
          <div className="relative h-2 rounded-full bg-border/60"><span className="absolute left-1/2 top-[-3px] h-[14px] w-px bg-muted-foreground/50" />{d !== null && d !== 0 && <span className={`bar-grow absolute top-0 h-2 rounded-full ${d < 0 ? "right-1/2 origin-right" : "left-1/2"}`} style={{ width: `${(Math.abs(d) / maxAbs) * 50}%`, background: colorOf(k), boxShadow: `0 0 12px ${colorOf(k)}` }} />}</div></li>)}</ul>
      </Panel>
      <Panel title="Linha do tempo" icon={CalendarDays}>
        <ol className="relative ml-3 space-y-4 border-l border-cyan/20">{[...history].reverse().map((h, i, arr) => { const prev = arr[i + 1]; const dp = prev ? (toNumber(h.peso) ?? 0) - (toNumber(prev.peso) ?? 0) : null; return <li key={h.data} className="relative pl-6">
          <span className={`absolute -left-[7px] top-3 h-3 w-3 rounded-full ${i === 0 ? "bg-gradient-brand shadow-glow motion-safe:animate-pulse" : "border border-cyan/40 bg-background"}`} />
          <div className={`rounded-2xl border p-4 ${i === 0 ? "border-cyan/40 bg-cyan/5" : "border-border bg-card/20"}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="font-mono text-xs text-cyan">{longDate(h.data)}</p><p className="font-display-h text-lg">{h.peso || "—"} kg {dp !== null && <span className="ml-1 font-mono text-[10px]" style={{ color: dp <= 0 ? "var(--emerald)" : "var(--violet)" }}>{dp > 0 ? "+" : ""}{dp.toFixed(1)}</span>}</p></div>
            <div className="flex flex-wrap gap-1.5">{keys.map(k => h.valores[k] ? <span key={k} className="tag text-[10px]" style={glow(colorOf(k))}>{measurementLabels[k]} {h.valores[k]}</span> : null)}</div>
            {h.obs && <p className="mt-2 text-xs text-muted-foreground">{h.obs}</p>}
          </div>
        </li>; })}</ol>
      </Panel>
    </div>

    <Panel title="Fotos de evolução" icon={Camera} color="oklch(0.75 0.18 340)" className="mt-6">
      {photoFirst && photoLast ? <div className="grid grid-cols-2 gap-3 sm:max-w-2xl">{[{ s: photoFirst, l: "Antes" }, { s: photoLast, l: "Agora" }].map(({ s, l }) => <figure key={l} className="relative overflow-hidden rounded-2xl border border-cyan/20"><img src={Object.values(s.fotos)[0]!} alt={`${l} · ${formatDate(s.data)}`} className="aspect-[3/4] w-full object-cover" /><figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background to-transparent p-3 text-xs"><span className="font-mono text-cyan">{l}</span> · {longDate(s.data)}</figcaption></figure>)}</div>
        : <div className="flex items-center gap-5"><img src={bodyAsset} alt="Corpo holográfico" className="holo-float h-40 object-contain opacity-70" /><p className="text-sm text-muted-foreground">Adicione fotos nas medições para comparar antes e agora.</p></div>}
    </Panel>
  </Shell>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="health-area relative min-h-screen overflow-hidden bg-background font-body text-foreground">
    <div className="aurora pointer-events-none absolute inset-0" /><div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
    <div className="pointer-events-none absolute -left-40 top-40 h-[28rem] w-[28rem] rounded-full bg-violet/20 blur-3xl" /><div className="pointer-events-none absolute -right-40 top-[40rem] h-[28rem] w-[28rem] rounded-full bg-cyan/15 blur-3xl" />
    <main className="relative z-10 mx-auto max-w-[1440px] px-5 py-6 sm:px-8 lg:px-12">
      <HealthTabs active="saude" />
      <header className="mb-8 flex items-center gap-4"><div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-brand shadow-glow"><Sparkles className="h-7 w-7 text-primary-foreground" /><span className="absolute inset-0 animate-ping rounded-2xl bg-cyan/20 [animation-duration:3s]" /></div><div><p className="mono-caps mb-1 text-[10px] text-cyan">Saúde · Evolução corporal</p><h1 className="font-display-h text-4xl font-semibold sm:text-5xl">Seu <span className="text-gradient">progresso</span>.</h1></div></header>
      <HealthSheetTabs active="progresso" />
      {children}
    </main>
  </div>;
}
