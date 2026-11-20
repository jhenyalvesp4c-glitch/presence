// Saúde → Análise: painel futurista da evolução corporal (peso, medidas, composição, indicadores, fotos e frases).
// Lê as medições reais; sem nenhuma medição, mostra um exemplo marcado como tal.

import { Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BrainCircuit, CalendarDays, Camera, CheckCircle2, Droplet, Dumbbell, Gauge, HeartPulse,
  Info, Plus, Ruler, Scale, ScanLine, Sparkles, Target, TrendingUp, TriangleAlert, Utensils, Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HealthTabs } from "@/components/health-tabs";
import { HealthLoading } from "@/components/health-loading";
import { HealthSheetTabs } from "@/components/health-sheet-tabs";
import { BodyPanel } from "@/components/health-body";
import { PROGRESS_TABS, ProgramHeader, ProgramProgressView, SubTabs, useProgramBundle, type ProgressView } from "@/components/program/ProgramHub";
import { DeltaBars, Radar } from "./extras";
import type { Program } from "@/lib/program";
import { useHealthPreview } from "@/components/health-preview-provider";
import { todayIso } from "@/lib/dates";
import { useAnalysisPrefs } from "@/lib/data/analysis";
import { analyze, addDays, demoHistory, goalProgress, periodSlice, PERIODS, slopePerDay, type Analysis, type PeriodKey, type Sexo, type Status } from "@/lib/health-analysis";
import { toNumber as toNum, type DietSheet, type MeasurementSheet, type WorkoutSheet } from "@/lib/health-preview";
import bodyAsset from "@/assets/hoje-corpo.jpg";
import { Counter, Donut, GlowBar, MultiLine, PhotoCompare, ScoreRing, Sparkline, WeightChart, ZoneBar, glow, longDate, shortDate, type Series } from "./charts";

const C = { cyan: "var(--cyan)", violet: "var(--violet)", emerald: "var(--emerald)", pink: "var(--pink)", amber: "var(--amber)" };
const MEASURE_COLOR: Record<string, string> = { peito: C.pink, braco: C.emerald, cintura: C.cyan, abdomen: C.amber, quadril: C.violet, gluteo: "oklch(0.72 0.16 250)", coxa: "oklch(0.78 0.14 180)" };
// Onde cada medida fica na silhueta (percentual da imagem).
const BODY_SPOTS: Record<string, [number, number]> = { peito: [50, 26], braco: [37.5, 31], cintura: [50, 38.5], abdomen: [50, 42.5], quadril: [60, 47], gluteo: [40.5, 47], coxa: [44.5, 58] };
const STATUS_COLOR: Record<Status, string> = { ideal: C.emerald, atencao: C.amber, alerta: "var(--destructive)" };
const n1 = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? "—" : n.toFixed(d).replace(".", ","));
const signed = (n: number | null, d = 1, unit = "") => (n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d).replace(".", ",")}${unit}`);

function Panel({ title, icon: Icon, color = C.cyan, right, className = "", children, delay = 0 }: { title: ReactNode; icon: typeof Scale; color?: string; right?: ReactNode; className?: string; children: ReactNode; delay?: number }) {
  return <section style={{ ...glow(color), animationDelay: `${delay}ms` }} className={`accent-card group min-w-0 animate-rise p-5 sm:p-6 ${className}`}>
    <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full opacity-25 blur-3xl transition-opacity duration-700 group-hover:opacity-50" style={{ background: color }} />
    <div className="pointer-events-none absolute inset-x-6 top-0 h-px opacity-70" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
    <span className="pointer-events-none absolute left-3 top-3 h-3 w-3 border-l border-t opacity-60" style={{ borderColor: color }} />
    <span className="pointer-events-none absolute bottom-3 right-3 h-3 w-3 border-b border-r opacity-60" style={{ borderColor: color }} />
    <header className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-3 font-display-h text-lg font-semibold"><span className="icon-tile h-9 w-9"><Icon className="h-4 w-4" /></span>{title}</h2>{right}
    </header>
    <div className="relative">{children}</div>
  </section>;
}

function DeltaPill({ value, unit, goodWhen, d = 1 }: { value: number | null; unit: string; goodWhen: "down" | "up"; d?: number }) {
  if (value === null) return <span className="tag" style={glow("var(--muted-foreground)")}>sem comparação</span>;
  const good = Math.abs(value) < 0.05 ? null : goodWhen === "down" ? value < 0 : value > 0;
  const color = good === null ? C.cyan : good ? C.emerald : C.amber;
  const Arrow = value <= 0 ? ArrowDownRight : ArrowUpRight;
  return <span className="tag inline-flex items-center gap-1 font-mono font-semibold" style={glow(color)}><Arrow className="h-3 w-3" />{signed(value, d, ` ${unit}`)}</span>;
}

function Kpi({ icon: Icon, label, value, unit, decimals = 1, delta, deltaUnit, goodWhen, spark, color, note, delay }: {
  icon: typeof Scale; label: string; value: number | null; unit: string; decimals?: number; delta: number | null; deltaUnit: string; goodWhen: "down" | "up"; spark: (number | null)[]; color: string; note?: string; delay: number;
}) {
  return <div style={{ ...glow(color), animationDelay: `${delay}ms` }} className="accent-card group animate-rise p-5">
    <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl transition-opacity group-hover:opacity-50" style={{ background: color }} />
    <span className="health-shine pointer-events-none absolute inset-0" />
    <div className="relative flex items-center gap-4">
      <span className="icon-tile h-12 w-12 shrink-0"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}{note && <span className="ml-1 font-mono text-[9px] uppercase tracking-wider opacity-70">{note}</span>}</p>
        <p className="font-display-h text-3xl font-semibold leading-tight"><Counter value={value} decimals={decimals} /><span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span></p>
      </div>
      <DeltaPill value={delta} unit={deltaUnit} goodWhen={goodWhen} />
    </div>
    <div className="relative mt-3"><Sparkline values={spark} color={color} id={label.replace(/\W/g, "")} /></div>
  </div>;
}

/** Silhueta holográfica com plataforma girando, varredura e pontos das medidas. */
function Hologram({ active, onHover, measures }: { active: string | null; onHover: (k: string | null) => void; measures: Analysis["measures"] }) {
  return <div className="relative mx-auto aspect-[3/4] w-full max-w-[300px]">
    <div className="absolute inset-x-[10%] bottom-[2%] h-[16%] [perspective:500px]">
      {[0, 1, 2].map((i) => <div key={i} className="absolute inset-0 rounded-[50%] border-2 border-cyan/50 [transform:rotateX(72deg)]" style={{ inset: `${i * 14}%`, boxShadow: "0 0 24px var(--cyan), inset 0 0 24px var(--cyan)", opacity: 1 - i * 0.25 }}>
        <div className="h-full w-full rounded-[50%] border-t-2 border-dashed border-violet motion-safe:animate-[spin_8s_linear_infinite]" style={{ animationDirection: i % 2 ? "reverse" : "normal", animationDuration: `${8 + i * 4}s` }} />
      </div>)}
      <div className="absolute inset-x-[20%] bottom-[40%] h-[200%] origin-bottom bg-gradient-to-t from-cyan/25 to-transparent blur-md [clip-path:polygon(10%_100%,90%_100%,100%_0,0_0)]" />
    </div>
    <div className="scan-line absolute inset-0 overflow-hidden rounded-3xl">
      <img src={bodyAsset} alt="Silhueta holográfica do corpo" className="holo-float h-full w-full object-contain mix-blend-screen [filter:saturate(1.6)_brightness(1.35)_drop-shadow(0_0_18px_var(--cyan))] [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_75%)]" />
    </div>
    {[...Array(14)].map((_, i) => <span key={i} className="absolute h-1 w-1 rounded-full bg-cyan motion-safe:animate-float" style={{ left: `${(i * 37) % 90 + 5}%`, top: `${(i * 53) % 80 + 6}%`, opacity: 0.25 + ((i * 7) % 5) / 10, animationDelay: `${i * 0.4}s`, boxShadow: "0 0 6px var(--cyan)" }} />)}
    {measures.filter((m) => m.last !== null).map((m) => { const [x, y] = BODY_SPOTS[m.key] ?? [50, 50]; const on = active === m.key; const col = MEASURE_COLOR[m.key] ?? C.cyan; return <button key={m.key} type="button" aria-label={`${m.label}: ${n1(m.last)} cm`} onMouseEnter={() => onHover(m.key)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(m.key)} onBlur={() => onHover(null)} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
      <span className="relative block rounded-full transition-all" style={{ width: on ? 14 : 9, height: on ? 14 : 9, background: col, boxShadow: `0 0 ${on ? 20 : 10}px ${col}` }}><span className="absolute inset-0 animate-ping rounded-full" style={{ background: col, opacity: 0.5 }} /></span>
      {on && <span className="glass absolute left-4 top-1/2 z-10 -translate-y-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] animate-[health-pop_.3s_ease-out]"><b style={{ color: col }}>{m.label}</b> {n1(m.last)} cm</span>}
    </button>; })}
  </div>;
}

function TrainingDiet({ workout: legacy, diet, demo, program }: { workout: WorkoutSheet | null; diet: DietSheet | null; demo: boolean; program: Program | null }) {
  const days = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  // com programa de treino, o resumo vem dele (dias e exercícios reais); senão, da ficha antiga
  const workout: WorkoutSheet | null = program ? { nome: program.nome, sessoes: program.dias.filter((d) => d.tipo !== "descanso").map((d, i) => ({ id: i + 1, nome: d.titulo, dias: [days[d.dia]!], exercicios: d.exercicios.map((e) => ({ nome: e.nome, grupo: e.grupo })) })) } : legacy;
  const w = workout ?? (demo ? { nome: "Exemplo", sessoes: [{ id: 1, nome: "A", dias: ["seg", "qui"], exercicios: Array(6).fill({ nome: "", grupo: "" }) }, { id: 2, nome: "B", dias: ["ter", "sex"], exercicios: Array(5).fill({ nome: "", grupo: "" }) }, { id: 3, nome: "C", dias: ["qua"], exercicios: Array(6).fill({ nome: "", grupo: "" }) }] } : null);
  const d = diet ?? (demo ? { name: "Exemplo", goal: "", notes: "", macros: { calories: "1650", protein: "120", carbs: "170", fat: "55" }, meals: Array.from({ length: 5 }, (_, i) => ({ id: i, name: "", time: "", foods: [] })) } : null);
  const trainDays = new Set(w?.sessoes.flatMap((s) => s.dias) ?? []);
  const perWeek = w?.sessoes.reduce((s, x) => s + x.dias.length, 0) ?? 0;
  const exercises = w?.sessoes.reduce((s, x) => s + x.exercicios.length, 0) ?? 0;
  const num = (v: string | undefined) => { const n = parseFloat((v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const p = num(d?.macros.protein) * 4, c = num(d?.macros.carbs) * 4, f = num(d?.macros.fat) * 9, tot = p + c + f;
  const today = days[new Date().getDay()];
  // Layout pela largura do cartão (não da tela): em cartão estreito, treino e dieta ficam um embaixo do outro e os dias cabem na linha.
  return <div className="@container space-y-4">
    <div className="grid gap-3 @[560px]:grid-cols-2">
      <div className="min-w-0 rounded-2xl border border-cyan/25 bg-cyan/5 p-4">
        <div className="flex items-center gap-3"><span className="icon-tile h-11 w-11" style={glow(C.cyan)}><Dumbbell className="h-5 w-5" /></span><div><p className="text-xs text-muted-foreground">Treinos por semana</p><p className="font-display-h text-2xl font-semibold">{w ? perWeek : "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">{w ? `· ${exercises} exercícios` : ""}</span></p></div></div>
        <div className="mt-3 grid grid-cols-7 gap-1">{days.map((day) => { const on = trainDays.has(day); return <span key={day} className={`grid h-8 min-w-0 place-items-center overflow-hidden rounded-lg text-[9px] font-medium uppercase transition ${on ? "bg-cyan/20 text-cyan shadow-[0_0_12px_-2px_var(--cyan)]" : "bg-border/40 text-muted-foreground"} ${day === today ? "ring-1 ring-violet" : ""}`}>{day.slice(0, 3)}</span>; })}</div>
        {!w && <Button asChild size="sm" variant="outline" className="mt-3 w-full rounded-full border-cyan/40 text-cyan"><Link to="/treino/nova"><Plus />Montar treino</Link></Button>}
      </div>
      <div className="min-w-0 rounded-2xl border border-violet/25 bg-violet/5 p-4">
        <div className="flex items-center gap-3"><span className="icon-tile h-11 w-11" style={glow(C.violet)}><Utensils className="h-5 w-5" /></span><div><p className="text-xs text-muted-foreground">Dieta por dia</p><p className="font-display-h text-2xl font-semibold">{d && num(d.macros.calories) ? num(d.macros.calories) : "—"}<span className="ml-1 text-xs font-normal text-muted-foreground">{d ? `kcal · ${d.meals.length} refeições` : ""}</span></p></div></div>
        {d && tot > 0 ? <>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full">{[{ v: p, c: C.cyan }, { v: c, c: C.violet }, { v: f, c: C.amber }].map((m, i) => <span key={i} className="bar-grow h-full" style={{ width: `${(m.v / tot) * 100}%`, background: m.c, boxShadow: `0 0 10px ${m.c}`, animationDelay: `${i * 150}ms` }} />)}</div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-muted-foreground"><span className="text-cyan">P {d.macros.protein}g</span><span className="text-violet">C {d.macros.carbs}g</span><span className="text-amber">G {d.macros.fat}g</span></div>
        </> : !d ? <Button asChild size="sm" variant="outline" className="mt-3 w-full rounded-full border-violet/40 text-violet"><Link to="/dieta/nova"><Plus />Montar dieta</Link></Button> : <p className="mt-3 text-xs text-muted-foreground">Informe os macros na dieta para ver a divisão.</p>}
      </div>
    </div>
    <div className="relative overflow-hidden rounded-2xl border border-emerald/30 bg-emerald/5 p-4">
      <div className="shine pointer-events-none absolute inset-0 opacity-30" />
      <p className="relative flex gap-3 text-sm"><Zap className="h-5 w-5 shrink-0 text-emerald" />{w && d ? `Você tem ${perWeek} treinos na semana e ${d.meals.length} refeições por dia planejadas. Constância nos dois é o que mais acelera a evolução das medidas.` : "Monte sua ficha de treino e de dieta para cruzar com a evolução das medidas."}</p>
    </div>
  </div>;
}

/** Meta de peso e de cintura: o quanto já andou do início até o alvo e quando chega no ritmo atual. */
function GoalCard({ icon: Icon, title, unit, start, current, target, pacePerWeek, color, goingHint, onSave, today }: {
  icon: typeof Scale; title: string; unit: string; start: number | null; current: number | null; target: number | null; pacePerWeek: number | null; color: string; goingHint: string; onSave: (v: number | null) => void; today: string;
}) {
  const [text, setText] = useState(target === null ? "" : String(target).replace(".", ","));
  useEffect(() => { setText(target === null ? "" : String(target).replace(".", ",")); }, [target]);
  const commit = () => {
    const raw = text.trim().replace(",", ".");
    if (!raw) return void (target !== null && onSave(null));
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n !== target) onSave(Math.round(n * 10) / 10); else setText(target === null ? "" : String(target).replace(".", ","));
  };
  const g = goalProgress(start, current, target, pacePerWeek);
  return <div className="rounded-2xl border p-4" style={{ ...glow(color), borderColor: `color-mix(in oklab, ${color} 30%, transparent)` }}>
    <div className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm font-medium"><span className="icon-tile h-9 w-9"><Icon className="h-4 w-4" /></span>{title}</p>
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">Meta
        <input aria-label={`Meta de ${title.toLowerCase()}`} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} placeholder="—" className="w-20 rounded-lg border border-border bg-card/60 px-2 py-1 text-right font-mono text-sm text-foreground outline-none focus:border-cyan/60" /> {unit}
      </label>
    </div>
    {g ? <>
      <div className="mt-4 flex items-end justify-between font-mono text-[11px] text-muted-foreground"><span>início {n1(start)} {unit}</span><span className="text-foreground">agora {n1(current)} {unit}</span><span style={{ color }}>meta {n1(target)} {unit}</span></div>
      <div className="mt-1.5"><GlowBar pct={g.pct} from={color} to="var(--emerald)" /></div>
      <p className="mt-3 text-sm">{g.reached ? <span className="flex items-center gap-2 text-emerald"><CheckCircle2 className="h-4 w-4" />Meta atingida. Parabéns!</span>
        : <>Faltam <b style={{ color }}>{n1(g.remaining)} {unit}</b> ({Math.round(g.pct)}% do caminho).{g.etaDays !== null ? ` No ritmo atual, você chega por volta de ${new Date(`${addDays(today, g.etaDays)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}.` : ` ${goingHint}`}</>}</p>
    </> : <p className="mt-3 text-xs text-muted-foreground">{target === null ? "Defina uma meta para acompanhar o quanto falta e quando você chega nela." : "A meta precisa ser diferente do ponto de partida."}</p>}
  </div>;
}

export function AnalysisPage() {
  const { measurementHistory, workout, diet, ready } = useHealthPreview();
  const { prefs, update } = useAnalysisPrefs();
  const { sexo, period, hidden } = prefs;
  const chooseSexo = (v: Sexo) => update({ sexo: v });
  const setPeriod = (v: PeriodKey) => update({ period: v });
  const setHidden = (f: (h: string[]) => string[]) => update({ hidden: f(hidden) });
  const [spot, setSpot] = useState<string | null>(null);

  const { bundle: prog } = useProgramBundle(), [view, setView] = useState<"analise" | ProgressView>("analise"), { aba } = useSearch({ strict: false }) as { aba?: ProgressView };
  // links como "Registrar" (Hoje) abrem direto na aba pedida
  useEffect(() => { if (aba) setView(aba); }, [aba]);
  const today = todayIso();
  const demo = ready && measurementHistory.length === 0;
  const source: MeasurementSheet[] = useMemo(() => (demo ? demoHistory(today) : measurementHistory), [demo, measurementHistory, today]);
  const a = useMemo(() => analyze(periodSlice(source, period, today), sexo, today) ?? analyze(source, sexo, today), [source, period, sexo, today]);

  if (!ready) return <HealthLoading />;
  if (!a) return null;

  const { first, last, entries, delta } = a;
  const dates = entries.map((e) => e.date);
  const series: Series[] = a.measures.filter((m) => !hidden.includes(m.key) && m.last !== null).map((m) => ({ key: m.key, label: m.label, color: MEASURE_COLOR[m.key] ?? C.cyan, values: entries.map((e) => e.values[m.key] ?? null) }));
  const photoFirst = source.find((h) => Object.keys(h.fotos).length), photoLast = [...source].reverse().find((h) => Object.keys(h.fotos).length);
  const projection = a.projection30 !== null && entries.length > 1 ? { date: addDays(last.date, 30), value: a.projection30 } : null;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "";

  return <div className="health-area relative min-h-screen overflow-hidden bg-background font-body text-foreground">
    <div className="aurora pointer-events-none absolute inset-0" />
    <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
    <div className="pointer-events-none absolute -left-40 top-32 h-[30rem] w-[30rem] rounded-full bg-violet/20 blur-3xl motion-safe:animate-[float_9s_ease-in-out_infinite]" />
    <div className="pointer-events-none absolute -right-40 top-[36rem] h-[30rem] w-[30rem] rounded-full bg-cyan/15 blur-3xl motion-safe:animate-[float_11s_ease-in-out_infinite]" />
    <div className="pointer-events-none absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-emerald/10 blur-3xl" />

    <main className="relative z-10 mx-auto max-w-[1480px] px-4 py-6 sm:px-8 lg:px-10">
      <HealthTabs active="analise" />

      <header className="mb-7 flex flex-wrap items-center justify-between gap-5 animate-rise">
        <div className="flex items-center gap-5">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-brand shadow-glow">
            <HeartPulse className="h-8 w-8 text-primary-foreground" />
            <span className="absolute inset-0 animate-ping rounded-2xl bg-cyan/20 [animation-duration:3s]" />
          </div>
          <div>
            <p className="mono-caps mb-1 text-[10px] text-cyan">Módulo · Saúde</p>
            <h1 className="font-display-h text-4xl font-semibold sm:text-5xl">Análise<span className="text-cyan">.</span></h1>
            <p className="mt-1 text-sm text-muted-foreground">Acompanhe sua evolução, analise seus dados e veja o progresso do seu corpo.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger aria-label="Período" className="glass-h h-11 w-[200px] rounded-2xl border-cyan/25"><CalendarDays className="h-4 w-4 text-cyan" /><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button asChild className="h-11 rounded-2xl bg-gradient-brand text-primary-foreground shadow-glow"><Link to="/medidas/nova"><Plus />Nova medição</Link></Button>
        </div>
      </header>

      {demo && <div className="glass relative mb-6 flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-2xl border-violet/40 px-5 py-3 animate-rise">
        <div className="shine pointer-events-none absolute inset-0 opacity-20" />
        <p className="relative flex items-center gap-3 text-sm"><span className="tag" style={glow(C.violet)}>Exemplo</span>Você ainda não registrou medições — estes números são só uma demonstração.</p>
        <Button asChild size="sm" variant="outline" className="relative rounded-full border-violet/50 text-violet"><Link to="/medidas/nova"><Ruler />Registrar minha primeira medição</Link></Button>
      </div>}

      <HealthSheetTabs active="progresso" />
      {prog && <ProgramHeader b={prog} onMeasures={() => setView("medidas")} />}
      {prog && <SubTabs testId="analise-abas" value={view} onChange={setView} tabs={[{ id: "analise" as const, label: "Análise corporal", Icon: Activity }, ...PROGRESS_TABS(prog)]} />}
      {prog && view !== "analise" ? <ProgramProgressView b={prog} view={view} /> : <>
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Scale} label="Peso atual" value={last.weight} unit="kg" delta={delta.weight} deltaUnit="kg" goodWhen="down" spark={entries.map((e) => e.weight)} color={C.emerald} delay={0} />
        <Kpi icon={Ruler} label="Cintura" value={last.waist} unit="cm" decimals={last.waist !== null && Number.isInteger(last.waist) ? 0 : 1} delta={delta.waist} deltaUnit="cm" goodWhen="down" spark={entries.map((e) => e.waist)} color={C.cyan} delay={80} />
        <Kpi icon={Dumbbell} label="Massa magra" note={last.fatManual ? "c/ gordura medida" : "est."} value={last.leanKg} unit="kg" delta={delta.lean} deltaUnit="kg" goodWhen="up" spark={entries.map((e) => e.leanKg)} color={C.violet} delay={160} />
        <Kpi icon={Droplet} label="% Gordura" note={last.fatManual ? "medida" : "est."} value={last.fatPct} unit="%" delta={delta.fatPct} deltaUnit="p.p." goodWhen="down" spark={entries.map((e) => e.fatPct)} color={C.pink} delay={240} />
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        <Panel title="Evolução geral" icon={ScanLine} className="xl:col-span-4 xl:row-span-2" delay={100}
          right={<span className="tag flex items-center gap-1.5" style={glow(C.emerald)}><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald" />scan ativo</span>}>
          {/* O cartão pode ficar estreito (coluna de 4/12): o layout muda pela largura DO CARTÃO, não da tela, para nada sair cortado. */}
          <div className="@container">
          <div className="grid gap-5 @[520px]:grid-cols-[1.1fr_1fr] @[520px]:gap-4">
            <Hologram active={spot} onHover={setSpot} measures={a.measures} />
            <div className="flex min-w-0 flex-col items-center gap-4">
              <ScoreRing value={a.score} label="pontuação de saúde" />
              <p className="-mt-2 flex items-center gap-1 text-center text-[10px] text-muted-foreground"><Info className="h-3 w-3" />média dos indicadores ao lado</p>
              <ul className="w-full space-y-1">
                <li className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"><span className="flex items-center gap-2"><Scale className="h-4 w-4 text-emerald" />Peso</span><b className="font-mono" style={{ color: (delta.weight ?? 0) <= 0 ? C.emerald : C.amber }}>{signed(delta.weight, 1, " kg")}</b></li>
                {a.measures.filter((m) => m.last !== null).map((m) => { const col = MEASURE_COLOR[m.key] ?? C.cyan; return <li key={m.key} onMouseEnter={() => setSpot(m.key)} onMouseLeave={() => setSpot(null)} className={`flex cursor-default items-center justify-between rounded-lg px-2 py-1.5 text-sm transition ${spot === m.key ? "bg-foreground/5" : ""}`}>
                  <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />{m.label}</span>
                  <b className="font-mono" style={{ color: m.delta === null ? "var(--muted-foreground)" : m.delta <= 0 ? C.emerald : C.violet }}>{signed(m.delta, 1, " cm")}</b>
                </li>; })}
              </ul>
            </div>
          </div>
          </div>
        </Panel>

        <Panel title="Evolução do peso" icon={Activity} color={C.violet} className="xl:col-span-5" delay={160}
          right={<DeltaPill value={delta.weight} unit={`kg${delta.weightPct !== null ? ` (${signed(delta.weightPct, 1, "%")})` : ""}`} goodWhen="down" />}>
          <WeightChart points={entries.map((e) => ({ date: e.date, value: e.weight }))} projection={projection} />
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[{ l: "Ritmo semanal", v: a.paceKgWeek !== null ? signed(a.paceKgWeek, 2, " kg") : "—", c: C.violet }, { l: "Em 30 dias", v: a.projection30 !== null && entries.length > 1 ? `${n1(a.projection30)} kg` : "—", c: C.cyan }, { l: "Período", v: `${a.days} dias`, c: C.emerald }].map((m) => <div key={m.l} className="rounded-xl border border-border bg-card/30 px-2 py-2" style={glow(m.c)}><p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{m.l}</p><p className="font-display-h text-base" style={{ color: m.c }}>{m.v}</p></div>)}
          </div>
        </Panel>

        <Panel title="Composição corporal" icon={Droplet} color={C.emerald} className="xl:col-span-3" delay={220}>
          <div className="flex flex-col items-center gap-4">
            <Donut segments={[{ value: last.leanKg ?? 0, color: C.emerald }, { value: last.fatKg ?? 0, color: C.violet }]} size={170}>
              <div><p className="font-display-h text-2xl font-semibold">{n1(last.weight)} kg</p><p className="text-[11px] text-muted-foreground">peso atual</p></div>
            </Donut>
            <ul className="w-full space-y-2 text-sm">
              {[{ l: "Massa magra", v: last.leanKg, c: C.emerald }, { l: "Gordura corporal", v: last.fatKg, c: C.violet }].map((r) => <li key={r.l} className="flex items-center justify-between"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: r.c, boxShadow: `0 0 8px ${r.c}` }} />{r.l}</span><span className="font-mono text-xs">{n1(r.v)} kg {last.weight && r.v !== null ? <span className="text-muted-foreground">({n1((r.v / last.weight) * 100)}%)</span> : null}</span></li>)}
            </ul>
            <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card/30 p-1 text-xs">
              <span className="pl-2 text-muted-foreground">Fórmula</span>
              <div className="flex gap-1">{(["feminino", "masculino"] as Sexo[]).map((s) => <button key={s} type="button" onClick={() => chooseSexo(s)} aria-pressed={sexo === s} className={`rounded-lg px-3 py-1 transition ${sexo === s ? "bg-emerald/20 text-emerald" : "text-muted-foreground hover:text-foreground"}`}>{s === "feminino" ? "Feminina" : "Masculina"}</button>)}</div>
            </div>
            {last.fatPct === null && <p className="text-center text-[11px] text-muted-foreground">Informe altura e cintura na medição para estimar a composição.</p>}
          </div>
        </Panel>

        <Panel title={<>Evolução das medidas <span className="text-sm font-normal text-muted-foreground">(cm)</span></>} icon={TrendingUp} color={C.cyan} className="xl:col-span-5" delay={280}>
          <div className="mb-3 flex flex-wrap gap-1.5">{a.measures.filter((m) => m.last !== null).map((m) => { const on = !hidden.includes(m.key); const col = MEASURE_COLOR[m.key] ?? C.cyan; return <button key={m.key} type="button" aria-pressed={on} onClick={() => setHidden((h) => (on ? [...h, m.key] : h.filter((x) => x !== m.key)))} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition" style={on ? { borderColor: col, color: col, boxShadow: `0 0 14px -6px ${col}` } : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: col }} />{m.label}</button>; })}</div>
          <MultiLine dates={dates} series={series} />
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">{a.measures.filter((m) => m.last !== null && !hidden.includes(m.key)).map((m) => <li key={m.key} className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: MEASURE_COLOR[m.key] }} />{m.label}</span><span className="font-mono">{n1(m.last)} <span style={{ color: (m.delta ?? 0) <= 0 ? C.emerald : C.violet }}>{m.delta !== null ? signed(m.delta) : ""}</span></span></li>)}</ul>
        </Panel>

        <Panel title="Indicadores de saúde" icon={Gauge} color={C.amber} className="xl:col-span-3" delay={340}>
          {a.indicators.length ? <ul className="space-y-5">{a.indicators.map((i) => { const col = STATUS_COLOR[i.status]; return <li key={i.key}>
            <div className="flex items-baseline justify-between gap-2"><p className="text-sm">{i.label}</p><p className="font-display-h text-lg font-semibold" style={{ color: col }}>{i.display}</p></div>
            <ZoneBar value={i.value} scale={i.scale} ideal={i.ideal} color={col} />
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px]"><span className="text-muted-foreground">{i.hint}</span><span className="tag shrink-0 px-2 py-0.5 text-[10px]" style={glow(col)}>{i.statusLabel}</span></div>
          </li>; })}</ul> : <p className="text-sm text-muted-foreground">Informe altura, cintura e quadril na medição para calcular os indicadores.</p>}
        </Panel>

        <Panel title="Comparativo de fotos" icon={Camera} color={C.pink} className="xl:col-span-4" delay={400}>
          {photoFirst && photoLast && photoFirst !== photoLast ? <>
            <PhotoCompare before={Object.values(photoFirst.fotos)[0]!} after={Object.values(photoLast.fotos)[0]!} beforeLabel={`Início · ${shortDate(photoFirst.data)}`} afterLabel={`Atual · ${shortDate(photoLast.data)}`} />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Arraste a linha para comparar.</p>
          </> : <div className="relative grid min-h-[260px] place-items-center overflow-hidden rounded-2xl border border-dashed border-pink/30 bg-pink/5 p-6 text-center">
            <div className="absolute inset-0 grid-bg opacity-40" />
            <div className="relative">
              <div className="relative mx-auto mb-4 grid h-20 w-20 place-items-center"><span className="absolute inset-0 rounded-full border border-pink/40 motion-safe:animate-[spin_10s_linear_infinite] [border-style:dashed]" /><span className="absolute inset-3 rounded-full bg-pink/15 blur-md" /><Camera className="relative h-8 w-8 text-pink" /></div>
              <p className="font-display-h text-lg">{photoFirst ? "Falta a foto de agora" : "Sem fotos ainda"}</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">Adicione fotos nas medições para comparar o antes e o agora lado a lado.</p>
              <Button asChild size="sm" variant="outline" className="mt-4 rounded-full border-pink/40 text-pink"><Link to="/medidas/nova"><Camera />Adicionar fotos</Link></Button>
            </div>
          </div>}
        </Panel>

        <Panel title="Resumo do treino e dieta" icon={Target} color={C.cyan} className="xl:col-span-4" delay={460}>
          <TrainingDiet workout={workout} diet={diet} demo={demo} program={prog?.p ?? null} />
        </Panel>

        <Panel title="Análise inteligente" icon={Sparkles} color={C.violet} className="xl:col-span-4" delay={520}
          right={<span className="relative grid h-8 w-8 place-items-center"><span className="absolute inset-0 rounded-full border border-violet/50 motion-safe:animate-ping" /><BrainCircuit className="h-4 w-4 text-violet" /></span>}>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{periodLabel} · {longDate(first.date)} → {longDate(last.date)}</p>
          <ul className="space-y-2.5">{a.insights.map((ins, i) => { const col = ins.tone === "good" ? C.emerald : ins.tone === "warn" ? C.amber : C.cyan; const Icon = ins.tone === "good" ? CheckCircle2 : ins.tone === "warn" ? TriangleAlert : Info; return <li key={i} className="flex gap-3 rounded-xl border border-transparent p-2 text-sm transition hover:border-border hover:bg-foreground/5 animate-rise" style={{ animationDelay: `${600 + i * 90}ms` }}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: col, filter: `drop-shadow(0 0 6px ${col})` }} /><span>{ins.text}</span>
          </li>; })}</ul>
          <p className="mt-4 text-[10px] text-muted-foreground">{last.fatManual ? "A gordura é a que você informou; a massa magra é calculada a partir dela." : "Massa magra e gordura são estimativas pela altura e cintura; informe a gordura medida na medição para mais precisão."} Não substituem avaliação profissional.</p>
        </Panel>

        <Panel title="Minhas metas" icon={Target} color={C.emerald} className="xl:col-span-12" delay={560}>
          <div className="grid gap-4 md:grid-cols-2">
            <GoalCard icon={Scale} title="Peso" unit="kg" start={source[0] ? toNum(source[0].peso) : null} current={last.weight} target={prefs.goalWeight} pacePerWeek={a.paceKgWeek} color={C.emerald} goingHint="Mantenha as medições em dia para eu calcular o seu ritmo." onSave={(v) => update({ goalWeight: v })} today={today} />
            <GoalCard icon={Ruler} title="Cintura" unit="cm" start={source[0] ? toNum(source[0].valores["cintura"]) : null} current={last.waist} target={prefs.goalWaist} pacePerWeek={(() => { const sl = slopePerDay(entries.map((e) => ({ date: e.date, value: e.waist }))); return sl === null ? null : sl * 7; })()} color={C.cyan} goingHint="Mantenha as medições em dia para eu calcular o seu ritmo." onSave={(v) => update({ goalWaist: v })} today={today} />
          </div>
        </Panel>

        {!demo && <Panel title="Mapa do corpo" icon={ScanLine} color={C.cyan} className={source.length > 1 ? "xl:col-span-7" : "xl:col-span-12"} delay={540}><BodyPanel history={source} /></Panel>}
        {!demo && source.length > 1 && <div className="space-y-6 xl:col-span-5">
          <Panel title="Antes × agora" icon={ScanLine} color={C.violet} delay={560} right={<span className="flex gap-3 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet" />{shortDate(source[0]!.data)}</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan shadow-glow" />{shortDate(source.at(-1)!.data)}</span></span>}><Radar first={source[0]!} last={source.at(-1)!} /></Panel>
          <Panel title="Variação por medida" icon={Ruler} color={C.violet} delay={580}><DeltaBars history={source} /></Panel>
        </div>}
        <Panel title="Linha do tempo das medições" icon={CalendarDays} color={C.emerald} className="xl:col-span-12" delay={580}
          right={<span className="tag" style={glow(C.emerald)}>{entries.length} registro{entries.length === 1 ? "" : "s"}</span>}>
          <div className="scroll-neon -mx-2 overflow-x-auto px-2 pb-2">
            <ol className="relative flex min-w-max gap-4 pt-6">
              <span className="absolute left-0 right-0 top-[11px] h-px bg-gradient-to-r from-emerald/0 via-emerald/60 to-cyan/0" />
              {entries.map((e, i) => { const prev = entries[i - 1]; const dw = prev && prev.weight !== null && e.weight !== null ? e.weight - prev.weight : null; const isLast = i === entries.length - 1; return <li key={e.date} className="relative w-44 shrink-0">
                <span className={`absolute -top-[19px] left-5 h-3 w-3 rounded-full ${isLast ? "bg-gradient-brand shadow-glow motion-safe:animate-pulse" : "border border-emerald/60 bg-background"}`} />
                <div className={`rounded-2xl border p-3 transition hover:-translate-y-1 ${isLast ? "border-cyan/50 bg-cyan/10 shadow-[0_0_24px_-10px_var(--cyan)]" : "border-border bg-card/30"}`}>
                  <p className="font-mono text-[10px] text-cyan">{longDate(e.date)}</p>
                  <p className="mt-1 font-display-h text-xl">{n1(e.weight)} <span className="text-xs text-muted-foreground">kg</span></p>
                  <p className="font-mono text-[10px]" style={{ color: dw === null ? "var(--muted-foreground)" : dw <= 0 ? C.emerald : C.amber }}>{dw === null ? "início" : signed(dw, 1, " kg")}</p>
                  {e.waist !== null && <GlowBar pct={((e.waist - 50) / 80) * 100} />}
                  {e.waist !== null && <p className="mt-1 text-[10px] text-muted-foreground">cintura {n1(e.waist)} cm</p>}
                </div>
              </li>; })}
            </ol>
          </div>
        </Panel>
      </div>
      </>}
    </main>
  </div>;
}
