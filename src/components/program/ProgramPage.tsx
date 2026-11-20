/** Programa de treino: o centro da Saúde. Hoje, plano, evolução, avaliação semanal, medidas e relatório. */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, CalendarCheck, ClipboardList, Dumbbell, FileText, FileUp, Loader2, Ruler, Sparkles, Target } from "lucide-react";

import { Ring } from "@/components/finance/charts";
import { FinBackdrop, HeroPanel, LiveDot, OrbitArt, Tilt } from "@/components/finance/fx";
import { CheckinTabsMeasures, CheckinTabsWeekly } from "@/components/program/exports";
import { EvolutionTab } from "@/components/program/EvolutionTab";
import { ImportDialog } from "@/components/program/ImportDialog";
import { PlanTab } from "@/components/program/PlanTab";
import { ReportTab } from "@/components/program/ReportTab";
import { TodayTab } from "@/components/program/TodayTab";
import { useHealthMeasurement } from "@/lib/data/health";
import { useProgram, useProgramActions, useProgramLogs, useWeeklies } from "@/lib/data/program";
import { adherence, checkinDue, isoOf, weekOf, type Program } from "@/lib/program";
import { RECOMP_12 } from "@/lib/program-recomp";
import { buildReport } from "@/lib/program-report";

export type Tab = "hoje" | "plano" | "evolucao" | "semana" | "medidas" | "relatorio";
const TABS: { id: Tab; label: string; Icon: typeof Dumbbell }[] = [
  { id: "hoje", label: "Hoje", Icon: Dumbbell }, { id: "plano", label: "Plano", Icon: ClipboardList }, { id: "evolucao", label: "Evolução", Icon: Activity },
  { id: "semana", label: "Avaliação semanal", Icon: CalendarCheck }, { id: "medidas", label: "Medidas e fotos", Icon: Ruler }, { id: "relatorio", label: "Relatório", Icon: FileText },
];
const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");

export function ProgramPage({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const prog = useProgram(), row = prog.data ?? null, logsQ = useProgramLogs(row?.id), weekliesQ = useWeeklies(row?.id), measuresQ = useHealthMeasurement(), actions = useProgramActions(row?.id);
  const [importing, setImporting] = useState(false), [start, setStart] = useState(isoOf(new Date()));
  const logs = logsQ.data ?? [], weeklies = weekliesQ.data ?? [], measures = measuresQ.data ?? [], today = isoOf(new Date());

  const create = async (program: Program, startDate: string) => { try { await actions.create.mutateAsync({ program, startDate }); setImporting(false); toast.success("Programa salvo", { description: "Abra a aba Hoje para começar." }); } catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); } };
  const week = row ? weekOf(row.startDate, today) : 0;
  const report = useMemo(() => row ? buildReport(row.program, row.startDate, today, week, logs, weeklies, measures.map((m) => ({ date: m.measuredOn, peso: m.sheet.peso, valores: m.sheet.valores }))) : null, [row, today, week, logs, weeklies, measures]);

  if (prog.isLoading) return <main className="grid min-h-[60vh] place-items-center"><span className="mono-caps animate-pulse">Carregando o programa…</span></main>;
  const shell = (children: React.ReactNode) => <main className="relative mx-auto min-h-screen max-w-6xl px-4 pb-40 pt-6 md:py-10 md:pl-24" data-testid="programa"><FinBackdrop />{children}</main>;

  if (!row) return shell(<>
    <HeroPanel glow="var(--violet)"><div className="grid items-center gap-6 lg:grid-cols-[1.3fr_0.7fr]"><div>
      <p className="mono-caps flex items-center gap-3">Saúde · Programa de treino <LiveDot color="var(--violet)" label="pronto para começar" /></p>
      <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-tight md:text-7xl">Seu <span className="text-gradient inline-block pr-3 italic">programa</span></h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">Coloque a sua ficha aqui e o Orion acompanha tudo: treino do dia, séries e cargas, quando progredir, avaliação semanal, medidas, fotos e a evolução.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={() => setImporting(true)} className="inline-flex items-center gap-2 rounded-full border border-cyan/50 bg-cyan/10 px-5 py-3 text-sm font-medium text-cyan hover:bg-cyan/20" data-testid="enviar-ficha"><FileUp size={16} /> Enviar minha ficha (prints, PDF ou texto)</button>
      </div></div><div className="mx-auto"><OrbitArt size={200}><Dumbbell size={34} className="text-violet drop-shadow-[0_0_14px_var(--violet)]" /></OrbitArt></div></div></HeroPanel>
    <section className="glass mt-5 rounded-3xl p-5 sm:p-6" style={{ animation: "fin-rise .6s both" }}>
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Sparkles size={18} className="text-violet" /> Ficha pronta: Recomposição corporal — 12 semanas</h2>
      <p className="mt-1 text-sm text-muted-foreground">A ficha que você me enviou: 5 dias por semana (inferiores A e B, superiores A e B + glúteos, cardio + abdômen), progressão dupla, RIR, 12 semanas, aquecimento, cardio e metas do ciclo.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3"><label className="text-xs text-muted-foreground">Começa em<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 block rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm" data-testid="inicio" /></label>
        <button onClick={() => void create(RECOMP_12(), start)} disabled={actions.create.isPending} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2.5 text-sm font-medium text-emerald hover:bg-emerald/25 disabled:opacity-50" data-testid="usar-recomposicao">{actions.create.isPending && <Loader2 size={15} className="animate-spin" />} Usar esta ficha</button></div></section>
    {importing && <ImportDialog onClose={() => setImporting(false)} onSave={create} saving={actions.create.isPending} />}
  </>);

  const p = row.program, wk = Math.min(Math.max(week, 1), p.semanas), adh = adherence(p, logs, wk), doneGoals = p.metas.filter((m) => m.feita).length;
  const due = checkinDue(row.startDate, today, measures.filter((m) => m.measuredOn >= row.startDate).map((m) => m.measuredOn), measures.filter((m) => m.measuredOn >= row.startDate && Object.keys(m.photoPaths).length).map((m) => m.measuredOn));
  const lastWeight = (() => { const w = [...weeklies].reverse().find((x) => x.weight !== null)?.weight ?? null; if (w !== null) return w; const m = [...measures].reverse().find((x) => x.sheet.peso); return m ? Number(m.sheet.peso.replace(",", ".")) || null : p.perfil.pesoKg; })();
  const toggleGoal = (i: number) => actions.save.mutate({ program: { ...p, metas: p.metas.map((m, k) => (k === i ? { ...m, feita: !m.feita } : m)) } }, { onError: (e) => toast.error(e.message) });
  const before = week < 1;

  return shell(<>
    <HeroPanel glow="var(--cyan)"><div className="grid items-center gap-6 lg:grid-cols-[1.35fr_0.65fr]"><div>
      <p className="mono-caps flex flex-wrap items-center gap-3">Saúde · Programa de treino <LiveDot color="var(--emerald)" label={before ? `começa em ${dm(row.startDate)}` : week > p.semanas ? "ciclo concluído" : `semana ${wk} de ${p.semanas}`} /></p>
      <h1 className="mt-3 font-serif text-4xl leading-[0.98] tracking-tight md:text-6xl" style={{ animation: "fin-rise .7s both" }}><span className="text-gradient inline-block pr-3 italic drop-shadow-[0_0_30px_color-mix(in_oklab,var(--cyan)_55%,transparent)]">{p.nome}</span></h1>
      <span aria-hidden className="mt-4 block h-px w-48 bg-gradient-to-r from-cyan via-violet to-transparent" />
      <div className="mt-5 flex flex-wrap items-center gap-3" data-testid="numeros">
        <Tilt max={8} className="rounded-2xl"><div className="glass flex items-center gap-3 rounded-2xl px-4 py-3"><Ring pct={adh.planejados ? (adh.feitos / adh.planejados) * 100 : 0} color="var(--emerald)" size={56} thickness={6}><span className="text-xs font-semibold tabular-nums">{adh.feitos}/{adh.planejados}</span></Ring><div><p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">treinos na semana</p></div></div></Tilt>
        <Tilt max={8} className="rounded-2xl"><div className="glass rounded-2xl px-4 py-3"><p className="font-display text-xl font-semibold tabular-nums">{doneGoals}/{p.metas.length}</p><p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground"><Target size={10} className="mr-1 inline" />metas do ciclo</p></div></Tilt>
        <Tilt max={8} className="rounded-2xl"><button onClick={() => onTab("medidas")} className={`glass block rounded-2xl px-4 py-3 text-left ${due.medidas.due ? "!border-amber/50" : ""}`}><p className={`font-display text-xl font-semibold ${due.medidas.due ? "text-amber" : ""}`}>{due.medidas.due ? "Agora" : dm(due.medidas.proxima)}</p><p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">próximas medidas</p></button></Tilt>
      </div></div>
      <div className="mx-auto"><OrbitArt size={190}><Ring pct={Math.min(100, (Math.max(0, week - 1) / p.semanas) * 100)} size={96} thickness={8} color="var(--cyan)"><span className="text-center leading-tight"><b className="block text-lg tabular-nums">{before ? "—" : `${Math.min(wk, p.semanas)}/${p.semanas}`}</b><span className="text-[0.55rem] uppercase tracking-wider text-muted-foreground">semanas</span></span></Ring></OrbitArt></div></div>
      <button onClick={() => setImporting(true)} className="absolute right-4 top-4 hidden items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground sm:inline-flex" data-testid="trocar-ficha"><FileUp size={12} /> Enviar outra ficha</button></HeroPanel>

    <div className="glass fin-frame sticky top-3 z-20 my-6 rounded-2xl">
      <nav className="scroll-thin flex gap-1 overflow-x-auto rounded-2xl p-1.5" role="tablist" aria-label="Seções do programa" data-testid="programa-abas">
        {TABS.map(({ id, label, Icon }) => { const on = id === tab; return (
          <button key={id} role="tab" aria-selected={on} onClick={() => onTab(id)} data-testid={`aba-${id}`} className={`relative flex shrink-0 items-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 text-sm transition ${on ? "text-cyan shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--cyan)_45%,transparent),0_0_28px_-6px_var(--cyan)]" : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"}`}>
            {on && <span aria-hidden className="absolute inset-0 bg-gradient-to-br from-cyan/20 via-cyan/5 to-violet/20" />}<Icon size={16} className="relative" /><span className="relative">{label}</span>
            {id === "medidas" && due.medidas.due && <span aria-hidden className="relative h-2 w-2 rounded-full bg-amber shadow-[0_0_8px_var(--amber)]" />}</button>); })}
      </nav>
    </div>

    <div key={tab} style={{ animation: "fin-rise .5s both" }}>
      {tab === "hoje" && <TodayTab program={p} startDate={row.startDate} logs={logs} actions={actions} />}
      {tab === "plano" && <PlanTab program={p} week={week} onToggleGoal={toggleGoal} />}
      {tab === "evolucao" && <EvolutionTab program={p} week={week} logs={logs} weeklies={weeklies} measures={measures} />}
      {tab === "semana" && <CheckinTabsWeekly program={p} week={week} logs={logs} weeklies={weeklies} actions={actions} lastWeight={lastWeight} />}
      {tab === "medidas" && <CheckinTabsMeasures program={p} startDate={row.startDate} measures={measures} today={today} />}
      {tab === "relatorio" && report && <ReportTab report={report} />}
    </div>
    {importing && <ImportDialog onClose={() => setImporting(false)} onSave={create} saving={actions.create.isPending} />}
  </>);
}
