/** O programa de treino dentro da tela de Saúde (Hoje · Treino · Dieta · Progresso): dados, cabeçalho, treino/plano e as abas de progresso. */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Activity, ArrowUpRight, CalendarCheck, ClipboardList, Dumbbell, FileText, FileUp, Ruler, Target } from "lucide-react";
import { ImportDialog } from "@/components/program/ImportDialog";

import { Ring } from "@/components/finance/charts";
import { LiveDot, Tilt } from "@/components/finance/fx";
import { EvolutionTab } from "@/components/program/EvolutionTab";
import { MeasuresTab, WeeklyTab } from "@/components/program/CheckinTabs";
import { PlanTab } from "@/components/program/PlanTab";
import { ReportTab } from "@/components/program/ReportTab";
import { TodayTab } from "@/components/program/TodayTab";
import { useHealthMeasurement } from "@/lib/data/health";
import { useProgram, useProgramActions, useProgramLogs, useWeeklies } from "@/lib/data/program";
import { adherence, checkinDue, faseDaSemana, isoOf, sessionsOf, suggest, weekOf, type Action, type ProgExercise } from "@/lib/program";
import { buildReport } from "@/lib/program-report";

const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

/** Tudo do programa ativo (ou `null` se não há programa). */
export function useProgramBundle() {
  const q = useProgram(), row = q.data ?? null, logsQ = useProgramLogs(row?.id), weekliesQ = useWeeklies(row?.id), measuresQ = useHealthMeasurement(), actions = useProgramActions(row?.id);
  const logs = logsQ.data ?? [], weeklies = weekliesQ.data ?? [], measures = measuresQ.data ?? [], today = isoOf(new Date());
  return useMemo(() => {
    if (!row) return { loading: q.isLoading, bundle: null };
    const p = row.program, week = weekOf(row.startDate, today), wk = Math.min(Math.max(week, 1), p.semanas);
    const dow = new Date().getDay(), day = p.dias.find((d) => d.dia === dow) ?? null;
    const adh = adherence(p, logs, wk);
    const due = checkinDue(row.startDate, today, measures.filter((m) => m.measuredOn >= row.startDate).map((m) => m.measuredOn), measures.filter((m) => m.measuredOn >= row.startDate && Object.keys(m.photoPaths).length).map((m) => m.measuredOn));
    const lastWeight = (() => { const w = [...weeklies].reverse().find((x) => x.weight !== null)?.weight ?? null; if (w !== null) return w; const m = [...measures].reverse().find((x) => x.sheet.peso); return m ? Number(m.sheet.peso.replace(",", ".")) || null : p.perfil.pesoKg; })();
    const report = buildReport(p, row.startDate, today, week, logs, weeklies, measures.map((m) => ({ date: m.measuredOn, peso: m.sheet.peso, valores: m.sheet.valores })));
    return { loading: false, bundle: { row, p, week, wk, day, adh, due, lastWeight, report, logs, weeklies, measures, actions, today } };
  }, [row, q.isLoading, logs, weeklies, measures, actions, today]);
}
export type Bundle = NonNullable<ReturnType<typeof useProgramBundle>["bundle"]>;

const doneEx = (ex: ProgExercise, logs: Bundle["logs"], date: string) => { const n = logs.filter((l) => l.exerciseId === ex.id && l.date === date && !l.warmup).length; return ex.tipo === "forca" ? n >= ex.series : n >= 1; };
/** Resumo de hoje: dia, exercícios feitos e a sugestão de cada um. */
export function todaySummary(b: Bundle) {
  const day = b.day, items = (day?.exercicios ?? []).map((ex) => ({ ex, done: doneEx(ex, b.logs, b.today), sug: suggest(ex, sessionsOf(b.logs.filter((l) => l.date < b.today), ex.id)) }));
  return { day, items, done: items.filter((i) => i.done).length, total: items.length, fase: faseDaSemana(b.p, b.wk) };
}

const CHIP: Record<Action, { c: string; t: string }> = { aumentar: { c: "var(--emerald)", t: "Progredir" }, subir_reps: { c: "var(--cyan)", t: "Mais reps" }, manter: { c: "var(--cyan)", t: "Manter" }, reduzir: { c: "oklch(0.8 0.15 75)", t: "Reduzir" }, interromper: { c: "oklch(0.7 0.18 10)", t: "Avaliar" }, aferir: { c: "var(--violet)", t: "Achar carga" }, fixo: { c: "var(--cyan)", t: "" } };

/** Treino de hoje, em formato compacto (cartão da tela Hoje): lista, sugestões e atalho para registrar. */
export function ProgramTodayPanel({ b }: { b: Bundle }) {
  const s = todaySummary(b), day = s.day;
  return (
    <div data-testid="hoje-programa">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="font-display-h text-xl">{day ? day.titulo : "Dia livre"}</h3><p className="text-xs text-muted-foreground">Semana {b.wk} de {b.p.semanas}{s.fase ? ` · ${s.fase.objetivo}` : ""}{day?.foco ? ` · ${day.foco}` : ""}</p></div>
        {s.total > 0 && <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs tabular-nums">{s.done}/{s.total}</span>}
      </div>
      {s.fase && <p className="mb-3 rounded-xl border border-violet/30 bg-violet/10 px-3 py-2 text-xs"><b className="text-violet">{s.fase.objetivo}.</b> {s.fase.orientacao}.</p>}
      {day && day.aquecimento.length > 0 && <p className="mb-3 text-xs text-muted-foreground"><b>Aquecimento:</b> {day.aquecimento.join(" ")}</p>}
      {s.total ? <ul className="space-y-2">{s.items.map(({ ex, done, sug }) => { const chip = CHIP[sug.acao]; return (
        <li key={ex.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${done ? "border-primary/40 bg-primary/10" : "border-border bg-card/20"}`}>
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${done ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{done ? "✓" : ""}</span>
          <span className="min-w-0 flex-1"><span className={`block truncate ${done ? "text-muted-foreground line-through" : ""}`}>{ex.nome}</span><span className="block text-[0.7rem] text-muted-foreground">{ex.tipo === "forca" ? `${ex.series} × ${ex.repsMin === ex.repsMax ? ex.repsMin : `${ex.repsMin}–${ex.repsMax}`}${ex.repsNota ? ` ${ex.repsNota}` : ""} · ${ex.descansoS} s` : ex.prescricao}</span></span>
          {ex.tipo === "forca" && chip.t && <span className="shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium" style={{ color: chip.c, borderColor: `color-mix(in oklab, ${chip.c} 45%, transparent)`, background: `color-mix(in oklab, ${chip.c} 10%, transparent)` }}>{sug.acao === "aumentar" && sug.cargaAlvo ? `${chip.t} ${String(sug.cargaAlvo).replace(".", ",")} kg` : chip.t}</span>}
        </li>); })}</ul>
        : <p className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Dia de recuperação. {day?.cardio || "Uma caminhada leve é bem-vinda."}</p>}
      {day?.cardio && s.total > 0 && <p className="mt-3 text-xs text-muted-foreground"><b>Cardio:</b> {day.cardio}.</p>}
      <Link to="/saude/treino" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/20" data-testid="abrir-treino">Abrir treino e registrar séries <ArrowUpRight className="h-4 w-4" /></Link>
    </div>
  );
}

/** Cabeçalho do programa (nome, semana, números) usado no Treino e no Progresso. */
export function ProgramHeader({ b, onMeasures }: { b: Bundle; onMeasures?: () => void }) {
  const { p, wk, week, adh, due, row } = b, done = p.metas.filter((m) => m.feita).length, before = week < 1, [importing, setImporting] = useState(false);
  return (
    <section className="glass relative mb-6 overflow-hidden rounded-[2rem] p-5 sm:p-6" style={{ animation: "fin-rise .6s both" }} data-testid="programa-cabecalho">
      <span aria-hidden className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-cyan opacity-15 blur-3xl" /><span aria-hidden className="pointer-events-none absolute -bottom-24 right-0 h-60 w-60 rounded-full bg-violet opacity-15 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0"><p className="mono-caps flex flex-wrap items-center gap-3">Programa de treino <LiveDot color="var(--emerald)" label={before ? `começa em ${dm(row.startDate)}` : week > p.semanas ? "ciclo concluído" : `semana ${wk} de ${p.semanas}`} /></p>
          <h2 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl"><span className="text-gradient inline-block pr-3 italic">{p.nome}</span></h2></div>
        <div className="flex flex-wrap items-center gap-3">
          <Tilt max={7} className="rounded-2xl"><div className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5"><Ring pct={adh.planejados ? (adh.feitos / adh.planejados) * 100 : 0} color="var(--emerald)" size={46} thickness={5}><span className="text-[0.65rem] font-semibold tabular-nums">{adh.feitos}/{adh.planejados}</span></Ring><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">treinos<br />na semana</p></div></Tilt>
          <Tilt max={7} className="rounded-2xl"><div className="glass rounded-2xl px-4 py-2.5"><p className="font-display text-xl font-semibold tabular-nums">{done}/{p.metas.length}</p><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground"><Target size={10} className="mr-1 inline" />metas</p></div></Tilt>
          <Tilt max={7} className="rounded-2xl"><button type="button" onClick={onMeasures} className={`glass block rounded-2xl px-4 py-2.5 text-left ${due.medidas.due ? "!border-amber/50" : ""}`}><p className={`font-display text-xl font-semibold ${due.medidas.due ? "text-amber" : ""}`}>{due.medidas.due ? "Agora" : dm(due.medidas.proxima)}</p><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">próximas medidas</p></button></Tilt>
        </div>
      </div>
      <button type="button" onClick={() => setImporting(true)} className="relative mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground" data-testid="trocar-ficha"><FileUp size={12} /> Enviar outra ficha</button>
      {importing && <ImportDialog onClose={() => setImporting(false)} saving={b.actions.create.isPending} onSave={async (program, start) => { try { await b.actions.create.mutateAsync({ program, startDate: start }); setImporting(false); toast.success("Programa trocado"); } catch (e) { toast.error((e as Error).message); } }} />}
    </section>
  );
}

export function SubTabs<T extends string>({ tabs, value, onChange, testId }: { tabs: { id: T; label: string; Icon: typeof Dumbbell; dot?: boolean }[]; value: T; onChange: (t: T) => void; testId: string }) {
  return (
    <div className="glass fin-frame sticky top-3 z-20 mb-6 rounded-2xl">
      <nav className="scroll-thin flex gap-1 overflow-x-auto rounded-2xl p-1.5" role="tablist" data-testid={testId}>
        {tabs.map(({ id, label, Icon, dot }) => { const on = id === value; return (
          <button key={id} role="tab" aria-selected={on} onClick={() => onChange(id)} data-testid={`${testId}-${id}`} className={`relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-sm transition ${on ? "text-cyan shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--cyan)_45%,transparent),0_0_28px_-6px_var(--cyan)]" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"}`}>
            {on && <span aria-hidden className="absolute inset-0 bg-gradient-to-br from-cyan/20 via-cyan/5 to-violet/20" />}<Icon size={16} className="relative" /><span className="relative">{label}</span>{dot && <span aria-hidden className="relative h-2 w-2 rounded-full bg-amber shadow-[0_0_8px_var(--amber)]" />}</button>); })}
      </nav>
    </div>
  );
}

/** Aba Treino da tela de Saúde: treino da semana (registrar séries) e o plano completo. */
export function ProgramTreino({ b }: { b: Bundle }) {
  const [view, setView] = useState<"treino" | "plano">("treino");
  const toggleGoal = (i: number) => b.actions.save.mutate({ program: { ...b.p, metas: b.p.metas.map((m, k) => (k === i ? { ...m, feita: !m.feita } : m)) } }, { onError: (e) => toast.error(e.message) });
  return (
    <div data-testid="programa-treino"><ProgramHeader b={b} />
      <SubTabs testId="treino-abas" value={view} onChange={setView} tabs={[{ id: "treino", label: "Treino da semana", Icon: Dumbbell }, { id: "plano", label: "Meu plano", Icon: ClipboardList }]} />
      <div key={view} style={{ animation: "fin-rise .5s both" }}>
        {view === "treino" ? <TodayTab program={b.p} startDate={b.row.startDate} logs={b.logs} actions={b.actions} /> : <PlanTab program={b.p} week={b.week} onToggleGoal={toggleGoal} />}
      </div>
    </div>
  );
}

export type ProgressView = "evolucao" | "semana" | "medidas" | "relatorio";
export const PROGRESS_TABS = (b: Bundle) => [
  { id: "evolucao" as const, label: "Evolução do treino", Icon: Activity }, { id: "semana" as const, label: "Avaliação semanal", Icon: CalendarCheck },
  { id: "medidas" as const, label: "Medidas e fotos", Icon: Ruler, dot: b.due.medidas.due }, { id: "relatorio" as const, label: "Relatório", Icon: FileText },
];
/** Conteúdo das abas de progresso do programa (evolução, avaliação semanal, medidas e relatório). */
export function ProgramProgressView({ b, view }: { b: Bundle; view: ProgressView }) {
  return (
    <div key={view} style={{ animation: "fin-rise .5s both" }} data-testid="programa-progresso">
      {view === "evolucao" && <EvolutionTab program={b.p} week={b.week} logs={b.logs} weeklies={b.weeklies} measures={b.measures} />}
      {view === "semana" && <WeeklyTab program={b.p} week={b.week} logs={b.logs} weeklies={b.weeklies} actions={b.actions} lastWeight={b.lastWeight} />}
      {view === "medidas" && <MeasuresTab program={b.p} startDate={b.row.startDate} measures={b.measures} today={b.today} />}
      {view === "relatorio" && <ReportTab report={b.report} />}
    </div>
  );
}
