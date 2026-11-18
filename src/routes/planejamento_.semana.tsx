import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { Panel, PlanShell, colorVar } from "@/components/PlanShell";
import { fromIsoDate, isoDate, todayIso } from "@/lib/dates";
import { useGenerateDay } from "@/lib/data/day";
import { DEFAULT_OPTS, useWeekPlan } from "@/lib/data/planning";

export const Route = createFileRoute("/planejamento_/semana")({
  head: () => ({ meta: [{ title: "Sua semana · Orion" }, { name: "description", content: "Veja a semana inteira: o peso de cada dia e onde ainda cabe algo." }] }),
  component: Semana,
});

const WD = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const fmtH = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

function Semana() {
  const [start, setStart] = useState(todayIso());
  const q = useWeekPlan(start), gen = useGenerateDay();
  const days = q.data ?? [];
  const load = (d: (typeof days)[number]) => (d.saved ? d.savedMin : d.plan.totalMin);
  const lightest = days.length ? [...days].filter((d) => d.date >= todayIso()).sort((a, b) => load(a) - load(b))[0] : undefined;
  const plan = (date: string) => gen.mutate({ mode: "planejamento", date, ...DEFAULT_OPTS }, { onSuccess: (r) => toast.success(`Plano montado: ${r.count} atividades`), onError: (e) => toast.error(e.message) });
  return (
    <PlanShell>
      <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div>
          <Link to="/planejamento" className="mono-caps mb-2 inline-flex items-center gap-2 !text-cyan hover:opacity-80"><ArrowLeft size={14} /> Planejamento</Link>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Sua <span className="text-gradient">semana</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">O peso de cada dia, com os seus dados reais e as fontes ligadas.</p>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Semana anterior" onClick={() => setStart(isoDate(addDays(fromIsoDate(start), -7)))} className="grid h-10 w-10 place-items-center rounded-full border border-border hover:text-cyan"><ChevronLeft size={18} /></button>
          <button onClick={() => setStart(todayIso())} className="rounded-full border border-border px-4 py-2 text-sm">Hoje</button>
          <button aria-label="Próxima semana" onClick={() => setStart(isoDate(addDays(fromIsoDate(start), 7)))} className="grid h-10 w-10 place-items-center rounded-full border border-border hover:text-cyan"><ChevronRight size={18} /></button>
        </div>
      </div>

      {lightest && days.length > 0 && <p className="rounded-2xl border border-emerald/30 bg-emerald/[0.06] px-4 py-3 text-sm" data-testid="melhor-dia">Melhor dia para encaixar algo novo: <b className="text-emerald">{WD[fromIsoDate(lightest.date).getDay()]}</b> ({fmtH(load(lightest))} planejadas).</p>}
      {q.isPending && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-cyan" /></div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="semana">
        {days.map((d) => {
          const dt = fromIsoDate(d.date), min = load(d), pct = Math.min(100, Math.round((min / (9 * 60)) * 100)), heavy = min > 9 * 60, isToday = d.date === todayIso();
          const n = (k: string) => d.plan.blocks.filter((b) => b.kind === k).length;
          return (
            <Panel key={d.date} c={heavy ? "rose" : "cyan"} className={isToday ? "ring-1 ring-cyan/60" : ""}>
              <div className="mb-3 flex items-baseline justify-between"><h2 className="font-display text-lg font-semibold capitalize">{WD[dt.getDay()]}</h2><span className="text-sm text-muted-foreground">{String(dt.getDate()).padStart(2, "0")}/{String(dt.getMonth() + 1).padStart(2, "0")}{isToday ? " · hoje" : ""}</span></div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{d.saved ? "plano salvo" : "prévia"}</span><span className={heavy ? "font-semibold text-rose" : ""}>{fmtH(min)}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: heavy ? colorVar("rose") : "linear-gradient(90deg, var(--cyan), var(--violet))" }} /></div>
              {heavy && <p className="mt-2 flex items-center gap-1.5 text-xs text-rose"><AlertTriangle size={13} /> Dia sobrecarregado</p>}
              <p className="mt-3 flex flex-wrap gap-x-3 text-xs text-muted-foreground"><span>{n("compromisso")} compromisso{n("compromisso") === 1 ? "" : "s"}</span><span>{n("tarefa")} tarefa{n("tarefa") === 1 ? "" : "s"}</span>{n("treino") > 0 && <span>treino</span>}{d.plan.unplaced.length > 0 && <span className="text-amber">{d.plan.unplaced.length} sobrando</span>}</p>
              <ul className="mt-3 space-y-1 text-xs">{d.plan.blocks.filter((b) => b.kind !== "pausa").slice(0, 5).map((b) => <li key={`${b.time}${b.title}`} className="flex gap-2"><span className="w-10 shrink-0 tabular-nums text-muted-foreground">{b.time}</span><span className="truncate">{b.title}</span></li>)}</ul>
              <div className="mt-4 flex gap-2">
                {isToday ? <Link to="/planejamento/dia" className="flex-1 rounded-full border border-border py-2 text-center text-xs hover:text-cyan">Abrir o dia</Link> : null}
                <button onClick={() => plan(d.date)} disabled={gen.isPending} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cyan/15 py-2 text-xs font-semibold text-cyan hover:bg-cyan/25 disabled:opacity-50"><Sparkles size={13} /> {d.saved ? "Refazer" : "Planejar"}</button>
              </div>
            </Panel>
          );
        })}
      </div>
    </PlanShell>
  );
}
