/** A dieta dentro da tela de Saúde: dados do plano ativo, cabeçalho, abas (Hoje · Plano · Trocas · Guia · Semana) e o painel compacto da tela Hoje. */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpRight, BookOpen, CalendarCheck, Droplets, FileUp, Repeat, Utensils, ClipboardList } from "lucide-react";

import { DietGuide, DietSwaps } from "@/components/diet/DietGuide";
import { DietImport } from "@/components/diet/DietImport";
import { DietPlanView } from "@/components/diet/DietPlanView";
import { DietToday } from "@/components/diet/DietToday";
import { DietWeek } from "@/components/diet/DietWeek";
import { Ring } from "@/components/finance/charts";
import { LiveDot, Tilt } from "@/components/finance/fx";
import { SubTabs } from "@/components/program/ProgramHub";
import { useDiet, useDietActions, useDietLogs, useDietWeeklies } from "@/lib/data/diet-plan";
import { daySummary, weekOfPlan, type DayLog } from "@/lib/diet-plan";
import { isoOf } from "@/lib/program";

export const emptyDay = (date: string, optionId: string | null): DayLog => ({ date, optionId, mealsDone: [], extraProteinG: null, waterMl: null, energy: null, fullness: null, difficulty: null, training: null, discomfort: null, bowel: null, notes: "" });

/** Tudo da dieta ativa (ou `null` se não há dieta). */
export function useDietBundle() {
  const q = useDiet(), row = q.data ?? null, logsQ = useDietLogs(row?.id), weekQ = useDietWeeklies(row?.id), actions = useDietActions(row?.id);
  const logs = logsQ.data ?? [], weeklies = weekQ.data ?? [], today = isoOf(new Date());
  return useMemo(() => {
    if (!row) return { loading: q.isLoading, bundle: null };
    const todayLog = logs.find((l) => l.date === today) ?? null, sum = daySummary(row.plan, todayLog), week = Math.max(1, weekOfPlan(row.startDate, today));
    return { loading: false, bundle: { row, plan: row.plan, logs, weeklies, actions, today, todayLog, sum, week } };
  }, [row, q.isLoading, logs, weeklies, actions, today]);
}
export type DietBundle = NonNullable<ReturnType<typeof useDietBundle>["bundle"]>;

export const pct = (n: number, d: number) => (d > 0 ? Math.min(100, Math.round((n / d) * 100)) : 0);

/** Cabeçalho da dieta: nome, aviso de validação e os números do dia. */
export function DietHeader({ b }: { b: DietBundle }) {
  const { plan, sum, todayLog } = b, [importing, setImporting] = useState(false), pmax = plan.proteina.max ?? plan.proteina.min ?? sum.plannedProtein, pmin = plan.proteina.min ?? 0;
  const water = todayLog?.waterMl ?? 0;
  return (
    <section className="glass relative mb-6 overflow-hidden rounded-[2rem] p-5 sm:p-6" style={{ animation: "fin-rise .6s both" }} data-testid="dieta-cabecalho">
      <span aria-hidden className="pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-emerald opacity-15 blur-3xl" /><span aria-hidden className="pointer-events-none absolute -bottom-24 right-0 h-60 w-60 rounded-full bg-cyan opacity-15 blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0"><p className="mono-caps flex flex-wrap items-center gap-3">Plano alimentar <LiveDot color="var(--emerald)" label={`semana ${b.week}`} /></p>
          <h2 className="mt-2 font-serif text-3xl leading-tight sm:text-4xl"><span className="text-gradient inline-block pr-3 italic">{plan.nome}</span></h2>
          {plan.objetivo && <p className="mt-1 max-w-xl text-xs text-muted-foreground">{plan.objetivo}</p>}</div>
        <div className="flex flex-wrap items-center gap-3">
          <Tilt max={7} className="rounded-2xl"><div className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5"><Ring pct={pct(sum.protein, pmin || pmax)} color="var(--emerald)" size={46} thickness={5}><span className="text-[0.62rem] font-semibold tabular-nums">{sum.protein}</span></Ring><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">proteína hoje<br />meta {pmin ? `${pmin}–${pmax}` : pmax} g</p></div></Tilt>
          <Tilt max={7} className="rounded-2xl"><div className="glass flex items-center gap-3 rounded-2xl px-4 py-2.5"><Ring pct={pct(sum.done, sum.total)} color="var(--cyan)" size={46} thickness={5}><span className="text-[0.62rem] font-semibold tabular-nums">{sum.done}/{sum.total}</span></Ring><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">refeições<br />de hoje</p></div></Tilt>
          <Tilt max={7} className="rounded-2xl"><div className="glass rounded-2xl px-4 py-2.5"><p className="font-display text-xl font-semibold tabular-nums">{(water / 1000).toFixed(1).replace(".", ",")} L</p><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground"><Droplets size={10} className="mr-1 inline" />água hoje</p></div></Tilt>
        </div>
      </div>
      {plan.atencao && <p className="relative mt-4 rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">⚠ {plan.atencao}</p>}
      <button type="button" onClick={() => setImporting(true)} className="relative mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground" data-testid="trocar-dieta"><FileUp size={12} /> Enviar outra ficha</button>
      {importing && <DietImport onClose={() => setImporting(false)} saving={b.actions.create.isPending} onSave={async (p, start) => { try { await b.actions.create.mutateAsync({ plan: p, startDate: start }); setImporting(false); toast.success("Dieta trocada"); } catch (e) { toast.error((e as Error).message); } }} />}
    </section>
  );
}

type View = "hoje" | "plano" | "trocas" | "guia" | "semana";
/** Aba Dieta da tela de Saúde. */
export function DietView({ b }: { b: DietBundle }) {
  const [view, setView] = useState<View>("hoje");
  return (
    <div data-testid="dieta-hub"><DietHeader b={b} />
      <SubTabs testId="dieta-abas" value={view} onChange={setView} tabs={[{ id: "hoje", label: "Hoje", Icon: Utensils }, { id: "plano", label: "Meu plano", Icon: ClipboardList }, { id: "trocas", label: "Trocas", Icon: Repeat }, { id: "guia", label: "Guia", Icon: BookOpen }, { id: "semana", label: "Semana e comparação", Icon: CalendarCheck }]} />
      <div key={view} style={{ animation: "fin-rise .5s both" }}>
        {view === "hoje" && <DietToday b={b} />}{view === "plano" && <DietPlanView b={b} />}{view === "trocas" && <DietSwaps plan={b.plan} />}{view === "guia" && <DietGuide plan={b.plan} />}{view === "semana" && <DietWeek b={b} />}
      </div>
    </div>
  );
}

/** Alimentação de hoje, compacta (cartão da tela Hoje). */
export function DietTodayPanel({ b }: { b: DietBundle }) {
  const { sum, plan } = b, pmax = plan.proteina.max ?? sum.plannedProtein;
  return (
    <div data-testid="hoje-dieta">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-display-h text-xl">{sum.opt.nome}</h3><p className="text-xs text-muted-foreground">Proteína {sum.protein}/{pmax} g · {sum.done}/{sum.total} refeições</p></div></div>
      <ul className="space-y-2">{sum.opt.refeicoes.map((m) => { const done = b.todayLog?.mealsDone.includes(m.id) ?? false; return (
        <li key={m.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${done ? "border-emerald/40 bg-emerald/10" : "border-border bg-card/20"}`}>
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${done ? "border-emerald bg-emerald text-[#04121a]" : "border-border"}`}>{done ? "✓" : ""}</span>
          <span className="min-w-0 flex-1"><span className={`block truncate ${done ? "text-muted-foreground line-through" : ""}`}>{m.nome}</span><span className="block truncate text-[0.7rem] text-muted-foreground">{m.hora} · {m.itens.map((i) => i.alimento).join(", ")}</span></span>
        </li>); })}</ul>
      <Link to="/saude/dieta" className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald/40 bg-emerald/10 px-4 py-2 text-sm font-medium text-emerald transition hover:bg-emerald/20" data-testid="abrir-dieta">Abrir dieta e registrar o dia <ArrowUpRight className="h-4 w-4" /></Link>
    </div>
  );
}
