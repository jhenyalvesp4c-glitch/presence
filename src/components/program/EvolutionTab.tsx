/** Análise: o que evoluiu (cargas, recordes, volume por músculo, aderência, disposição e recuperação, peso e medidas). */
import { useMemo, useState } from "react";
import { Activity, Award, CalendarCheck, Dumbbell, Flame, Moon, Scale, TrendingUp } from "lucide-react";

import { AreaChart, Ring, Sparkline } from "@/components/finance/charts";
import { Tilt } from "@/components/finance/fx";
import { adherenceByWeek, insights, loadSeries, personalRecords, volumeByMuscle, type Program, type SetLog, type Weekly } from "@/lib/program";
import type { MeasurementEntry } from "@/lib/data/health";

const kg = (n: number) => `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`;
const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const Box = ({ title, Icon, color = "var(--cyan)", n = 0, children, className = "" }: { title: string; Icon: typeof Activity; color?: string; n?: number; children: React.ReactNode; className?: string }) => (
  <section className={`glass relative overflow-hidden rounded-3xl p-5 ${className}`} style={{ animation: "fin-rise .6s both", animationDelay: `${n * 80}ms` }}>
    <span aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-15 blur-3xl" style={{ background: color }} />
    <h3 className="relative mb-3 flex items-center gap-2.5 font-display text-sm font-semibold uppercase tracking-[0.16em]"><span className="grid h-8 w-8 place-items-center rounded-xl border" style={{ color, borderColor: `color-mix(in oklab, ${color} 40%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)` }}><Icon size={15} /></span>{title}</h3>
    <div className="relative">{children}</div>
  </section>
);

export function EvolutionTab({ program, week, logs, weeklies, measures }: { program: Program; week: number; logs: SetLog[]; weeklies: Weekly[]; measures: MeasurementEntry[] }) {
  const exs = useMemo(() => program.dias.flatMap((d) => d.exercicios.filter((e) => e.tipo === "forca")), [program]);
  const withData = exs.filter((e) => loadSeries(logs, e.id).length > 0), [selId, setSel] = useState<string | null>(null);
  const sel = withData.find((e) => e.id === selId) ?? withData[0], series = sel ? loadSeries(logs, sel.id) : [];
  const prs = useMemo(() => personalRecords(logs).slice(0, 6), [logs]), tips = useMemo(() => insights(program, logs), [program, logs]);
  const groupOf = (id: string) => exs.find((e) => e.id === id)?.grupo ?? "Outros";
  const vol = useMemo(() => volumeByMuscle(logs, groupOf), [logs, exs]); // eslint-disable-line react-hooks/exhaustive-deps
  const thisWeek = week <= program.semanas ? week : program.semanas, volWeek = vol.filter((v) => v.week === Math.max(1, thisWeek)), maxSeries = Math.max(1, ...volWeek.map((v) => v.series));
  const adh = adherenceByWeek(program, logs, Math.min(Math.max(week, 1), program.semanas)), totalDays = new Set(logs.filter((l) => !l.warmup).map((l) => l.date)).size, totalSets = logs.filter((l) => !l.warmup && l.reps !== null).length;
  const weeklyPoints = (k: "energy" | "recovery") => weeklies.filter((w) => w[k] !== null).map((w) => w[k] as number);
  const weights = [...measures.map((m) => ({ d: m.measuredOn, v: Number(m.sheet.peso.replace(",", ".")) })), ...weeklies.filter((w) => w.weight !== null).map((w) => ({ d: w.date, v: w.weight as number }))].filter((x) => Number.isFinite(x.v) && x.v > 0).sort((a, b) => a.d.localeCompare(b.d));
  const wFirst = weights[0], wLast = weights.at(-1);

  if (!logs.length && !weeklies.length && !measures.length) return <Box title="Sua evolução vai aparecer aqui" Icon={TrendingUp}><p className="text-sm text-muted-foreground">Registre as séries na aba Hoje, a avaliação semanal e as medidas. A cada treino, o Orion mostra as cargas, os recordes, o volume por músculo e a aderência.</p></Box>;

  return (
    <div className="space-y-4" data-testid="evolucao">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{([["Treinos feitos", totalDays, Dumbbell, "var(--cyan)"], ["Séries registradas", totalSets, Flame, "var(--violet)"], ["Recordes", personalRecords(logs).length, Award, "var(--amber)"], ["Semana", Math.min(Math.max(week, 1), program.semanas), CalendarCheck, "var(--emerald)"]] as const).map(([k, v, I, c]) => (
        <Tilt key={k} max={6} className="rounded-2xl"><div className="glass rounded-2xl p-4"><I size={15} style={{ color: c }} /><p className="mt-2 font-display text-3xl font-semibold tabular-nums" style={{ color: c, textShadow: `0 0 22px ${c}` }}>{v}</p><p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{k}</p></div></Tilt>))}</div>

      {tips.length > 0 && <Box title="O que o Orion percebeu" Icon={TrendingUp} color="var(--emerald)" n={1}><ul className="space-y-2">{tips.map((t) => <li key={t.texto} className={`rounded-xl border px-3 py-2 text-sm ${t.tom === "bom" ? "border-emerald/30 bg-emerald/[0.06]" : "border-amber/30 bg-amber/[0.06]"}`}>{t.texto}</li>)}</ul></Box>}

      {sel && <Box title="Carga por exercício" Icon={Dumbbell} n={2} color="var(--cyan)">
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Exercício">{withData.map((e) => <button key={e.id} role="tab" aria-selected={e.id === sel.id} onClick={() => setSel(e.id)} className={`rounded-full border px-3 py-1 text-xs transition ${e.id === sel.id ? "border-cyan/60 bg-cyan/15 text-cyan" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{e.nome}</button>)}</div>
        {series.length >= 2 ? <AreaChart points={series.map((s) => ({ label: dm(s.date), value: s.load }))} format={kg} height={200} color="var(--cyan)" /> : <p className="text-sm text-muted-foreground">Mais um treino deste exercício e o gráfico aparece.</p>}
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[380px] text-sm"><thead><tr className="text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground"><th className="pb-1 font-medium">Data</th><th className="pb-1 font-medium">Semana</th><th className="pb-1 text-right font-medium">Carga</th><th className="pb-1 text-right font-medium">Repetições</th></tr></thead>
          <tbody>{[...series].reverse().slice(0, 8).map((s) => <tr key={s.date} className="border-t border-white/10"><td className="py-1.5">{dm(s.date)}</td><td className="py-1.5">{s.week}</td><td className="py-1.5 text-right tabular-nums">{kg(s.load)}</td><td className="py-1.5 text-right tabular-nums">{s.reps.join(", ")}</td></tr>)}</tbody></table></div></Box>}

      <div className="grid gap-4 lg:grid-cols-2">
        {prs.length > 0 && <Box title="Recordes" Icon={Award} color="var(--amber)" n={3}><ul className="space-y-2">{prs.map((p, i) => <li key={p.exerciseId} className="flex items-center gap-3 text-sm"><span className="grid h-6 w-6 place-items-center rounded-full bg-amber/20 text-xs font-bold text-amber">{i + 1}</span><span className="min-w-0 flex-1 truncate">{p.nome}</span><span className="tabular-nums">{kg(p.load)} × {p.reps}</span><span className="text-[0.65rem] text-muted-foreground">≈ {kg(p.e1rm)} (1 rep)</span></li>)}</ul></Box>}
        <Box title={`Volume por músculo · semana ${Math.max(1, thisWeek)}`} Icon={Flame} color="var(--violet)" n={4}>{volWeek.length ? <ul className="space-y-2">{volWeek.map((v) => <li key={v.grupo} className="text-sm"><div className="flex justify-between"><span>{v.grupo}</span><span className="tabular-nums text-muted-foreground">{v.series} séries · {Math.round(v.tonelagem)} kg</span></div><span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-gradient-to-r from-violet to-cyan transition-[width] duration-700" style={{ width: `${(v.series / maxSeries) * 100}%` }} /></span></li>)}</ul> : <p className="text-sm text-muted-foreground">Sem séries registradas nesta semana ainda.</p>}</Box>
      </div>

      <Box title="Aderência semana a semana" Icon={CalendarCheck} color="var(--emerald)" n={5}>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">{adh.map((a) => <li key={a.week} className="flex flex-col items-center gap-1"><Ring pct={a.planejados ? (a.feitos / a.planejados) * 100 : 0} size={44} thickness={5} color="var(--emerald)"><span className="text-[0.65rem] font-semibold tabular-nums">{a.feitos}/{a.planejados}</span></Ring><span className="text-[0.6rem] text-muted-foreground">sem {a.week}</span></li>)}</ul></Box>

      <div className="grid gap-4 lg:grid-cols-2">
        <Box title="Disposição e recuperação" Icon={Moon} color="var(--pink)" n={6}>{weeklies.length ? <div className="space-y-3 text-sm"><div><p className="mb-1 text-xs text-muted-foreground">Disposição (1–5)</p><Sparkline values={weeklyPoints("energy")} color="var(--cyan)" width={260} height={40} /></div><div><p className="mb-1 text-xs text-muted-foreground">Recuperação muscular (1–5)</p><Sparkline values={weeklyPoints("recovery")} color="var(--pink)" width={260} height={40} /></div></div> : <p className="text-sm text-muted-foreground">Preencha a avaliação semanal para ver como estão a disposição e a recuperação.</p>}</Box>
        <Box title="Peso" Icon={Scale} color="var(--cyan)" n={7}>{wFirst && wLast && weights.length > 1 ? <div><p className="font-display text-3xl font-semibold tabular-nums">{kg(wLast.v)}</p><p className="text-sm text-muted-foreground">{wLast.v - wFirst.v === 0 ? "sem variação" : `${wLast.v - wFirst.v > 0 ? "+" : ""}${kg(wLast.v - wFirst.v)} desde ${dm(wFirst.d)}`}</p><div className="mt-2"><Sparkline values={weights.map((w) => w.v)} color="var(--cyan)" width={260} height={40} /></div><p className="mt-2 text-[0.7rem] text-muted-foreground">Uma medida isolada não diz ganho ou perda de músculo: olhe a tendência junto com as medidas, as fotos e as cargas.</p></div> : <p className="text-sm text-muted-foreground">Registre o peso na avaliação semanal ou nas medidas para ver a tendência.</p>}</Box>
      </div>
    </div>
  );
}
