/**
 * Central do dia (/central): tudo de hoje numa tela só, vindo dos módulos reais (tarefas, agenda, fixas, hábitos, treino, dieta,
 * demandas, faturas, contratos de clientes e reuniões). Cada seção carrega sozinha; se uma falhar, só ela avisa.
 */
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, Building2, Rocket, CalendarClock, Check, ClipboardList, Droplets, Dumbbell, HeartPulse, Mic, Repeat, Sparkles, Sprout, Utensils, Wallet } from "lucide-react";

import { Meter, Ring, useCountUp } from "@/components/finance/charts";
import { BrandTile, brandOf } from "@/components/finance/brands";
import { FinBackdrop, HeroPanel, LiveDot } from "@/components/finance/fx";
import { dayProgress, daysBetween, greeting } from "@/lib/central";
import { useCentralContracts, useCentralDemands, useCentralDiet, useCentralMeetings, useCentralMoney } from "@/lib/data/central";
import { useSetupSummaries } from "@/lib/data/client-setup";
import { useFixedActions, useFixedDone, useFixedTasks } from "@/lib/data/fixed-tasks";
import { useHabitCompletions, useHabits, useToggleHabit } from "@/lib/data/habits";
import { useTasks, useToggleTask } from "@/lib/data/tasks";
import { useSplit } from "@/lib/data/workouts";
import { expandFixed } from "@/lib/fixed-tasks";
import { brl, dateBR } from "@/lib/clients";

const tint = (v: string) => ({ "--glow": `var(--${v})` }) as CSSProperties;
const isoLocal = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "");

function Section({ title, tone, icon: I, to, count, children, wide }: { title: string; tone: string; icon: typeof Check; to?: string; count?: number | undefined; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`ex-card p-4 ${wide ? "lg:col-span-2" : ""}`} style={{ "--rail": `var(--${tone})`, animation: "fin-rise .5s both" } as CSSProperties}>
      <div className="mb-3 flex items-center gap-2.5"><span className="icon-tile h-8 w-8 shrink-0 !rounded-xl" style={tint(tone)}><I size={15} /></span><h2 className="flex-1 font-display text-base font-semibold">{title}</h2>{count !== undefined && <span className="tag !py-0 !text-[0.7rem]" style={tint(tone)}>{count}</span>}{to && <Link to={to as "/"} className="text-muted-foreground transition hover:text-foreground" aria-label={`Abrir ${title}`}><ArrowUpRight size={15} /></Link>}</div>
      {children}
    </section>
  );
}
const Empty = ({ children }: { children: ReactNode }) => <p className="rounded-xl border border-dashed border-white/12 px-3 py-4 text-center text-xs text-muted-foreground">{children}</p>;
const Box = ({ on, onClick, label, sub, time, late }: { on: boolean; onClick: () => void; label: string; sub?: string | undefined; time?: string | undefined; late?: boolean | undefined }) => (
  <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.05]" aria-pressed={on}>
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? "border-emerald bg-emerald/20 text-emerald" : late ? "border-destructive/60" : "border-white/25"}`}>{on && <Check size={12} style={{ animation: "ex-tick .4s both" }} />}</span>
    <span className="min-w-0 flex-1"><span className={`block truncate text-sm ${on ? "text-muted-foreground line-through" : ""}`}>{label}</span>{sub && <span className={`block truncate text-[0.7rem] ${late ? "text-destructive" : "text-muted-foreground"}`}>{sub}</span>}</span>
    {time && <span className="shrink-0 font-mono text-xs text-muted-foreground">{time}</span>}
  </button>
);
const Failed = () => <p className="text-xs text-muted-foreground">Não consegui carregar esta parte agora.</p>;

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const when = (d: number) => (d === 0 ? "hoje" : d === 1 ? "amanhã" : `em ${d} dias`);

export function CentralDoDia() {
  const now = useMemo(() => new Date(), []), today = isoLocal(now), tomorrow = isoLocal(new Date(now.getTime() + 864e5));
  const tasksQ = useTasks(), toggleTask = useToggleTask();
  const fixedQ = useFixedTasks(), doneQ = useFixedDone(today, today), fixedActs = useFixedActions();
  const habitsQ = useHabits(), compQ = useHabitCompletions(), toggleHabit = useToggleHabit();
  const setupQ = useSetupSummaries(), splitQ = useSplit(), demandsQ = useCentralDemands(today), meetQ = useCentralMeetings(today), dietQ = useCentralDiet(today), moneyQ = useCentralMoney(today), contractsQ = useCentralContracts(today);

  const tasks = tasksQ.data ?? [], overdue = tasks.filter((t) => !t.done && t.due_date && t.due_date < today), todays = tasks.filter((t) => t.due_date === today);
  const agenda = todays.filter((t) => t.due_time).sort((a, b) => (a.due_time ?? "").localeCompare(b.due_time ?? ""));
  const noTime = todays.filter((t) => !t.due_time), tomorrowCount = tasks.filter((t) => !t.done && t.due_date === tomorrow).length;
  const fixed = expandFixed(fixedQ.data ?? [], new Set(doneQ.data ?? []), today, today);
  const habits = habitsQ.data ?? [], habitDone = new Set((compQ.data ?? []).filter((c) => c.completed_on === today).map((c) => c.habit_id));
  const split = (splitQ.data ?? []).find((s) => s.weekday === now.getDay());
  const demands = (demandsQ.data ?? []).filter((d) => d.bucket === "late" || d.bucket === "today" || d.bucket === "soon").sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""));
  const openDemands = (demandsQ.data ?? []).length;

  const prog = dayProgress([{ done: todays.filter((t) => t.done).length, total: todays.length + overdue.length }, { done: fixed.filter((f) => f.done).length, total: fixed.length }, { done: habits.filter((h) => habitDone.has(h.id)).length, total: habits.length }]);
  const pct = useCountUp(prog.pct, 900);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(now);
  const attention = overdue.length + demands.filter((d) => d.bucket === "late").length + (contractsQ.data ?? []).length + (moneyQ.data?.alerts.filter((a) => a.inDays <= 2).length ?? 0) + (moneyQ.data?.renewals.filter((r) => r.inDays <= 3).length ?? 0);

  return (
    <main className="relative mx-auto min-h-screen max-w-[1500px] px-4 pb-32 pt-6 md:py-8" data-testid="central-do-dia"><FinBackdrop />
      <HeroPanel glow="var(--cyan)" className="mb-5" data-testid="central-hero">
        <div className="grid items-center gap-6 md:grid-cols-[1.4fr_auto]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5"><p className="mono-caps">{dateLabel}</p><LiveDot color="var(--cyan)" label="ao vivo" /></div>
            <h1 className="mt-2 font-serif text-5xl leading-[0.95] tracking-tight md:text-6xl">{greeting(Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(now)) % 24)}, <span className="text-gradient inline-block pr-3 italic">hoje</span></h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">{prog.total ? `${prog.done} de ${prog.total} itens do dia concluídos.` : "Nada marcado para hoje ainda."} {attention > 0 ? `${attention} ponto${attention === 1 ? " pede" : "s pedem"} atenção.` : "Nada urgente."}{tomorrowCount > 0 && ` Amanhã: ${tomorrowCount} tarefa${tomorrowCount === 1 ? "" : "s"}.`}</p>
            <div className="mt-4 flex flex-wrap gap-2">{[["Tarefas", "/tarefas", ClipboardList], ["Calendário", "/calendario", CalendarClock], ["Demandas", "/projetos", ClipboardList], ["Financeiro", "/financeiro", Wallet], ["Saúde", "/saude", HeartPulse]].map(([l, to, I]) => { const Ic = I as typeof Check; return <Link key={String(l)} to={to as "/"} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-cyan/50 hover:text-foreground"><Ic size={12} /> {String(l)}</Link>; })}</div>
          </div>
          <div className="flex justify-center"><Ring pct={prog.pct} size={180} thickness={13} color="var(--cyan)"><div className="text-center"><p className="font-display text-4xl font-semibold tabular-nums">{Math.round(pct)}%</p><p className="text-[0.65rem] text-muted-foreground">do dia</p></div></Ring></div>
        </div>
      </HeroPanel>

      <div className="grid gap-4 lg:grid-cols-3">
        {attention > 0 && (
          <section className="rounded-2xl border border-amber/40 bg-amber/10 p-4 lg:col-span-3" data-testid="central-atencao" role="region" aria-label="Pontos de atenção">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber"><AlertTriangle size={15} /> Precisa de atenção</p>
            <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {overdue.slice(0, 3).map((t) => <li key={t.id}>Tarefa atrasada: <b>{t.title}</b> <span className="text-muted-foreground">(desde {dateBR(t.due_date)})</span></li>)}
              {demands.filter((d) => d.bucket === "late").slice(0, 3).map((d) => <li key={d.code}>Demanda atrasada: <b>{d.title}</b> <span className="text-muted-foreground">(prazo {dateBR(d.deadline)})</span></li>)}
              {(contractsQ.data ?? []).slice(0, 3).map((c) => <li key={c.id}>Contrato de <b>{c.name}</b> {daysBetween(today, c.contractEnd) < 0 ? "venceu" : "vence"} em {dateBR(c.contractEnd)}</li>)}
              {(moneyQ.data?.alerts ?? []).filter((a) => a.inDays <= 2).map((a) => <li key={`${a.card}${a.kind}`}>Fatura {a.card} {a.kind === "fecha" ? "fecha" : "vence"} {a.inDays === 0 ? "hoje" : a.inDays === 1 ? "amanhã" : `em ${a.inDays} dias`}</li>)}
              {(moneyQ.data?.renewals ?? []).filter((r) => r.inDays <= 3).map((r) => <li key={`ren${r.id}`}>Assinatura <b>{r.name}</b> renova {when(r.inDays)} <span className="text-muted-foreground">({money(r.amount)})</span></li>)}
            </ul>
          </section>)}

        <Section title="Agenda de hoje" tone="cyan" icon={CalendarClock} to="/calendario" count={agenda.length} wide>
          {tasksQ.isError ? <Failed /> : agenda.length === 0 ? <Empty>Nenhum compromisso com horário hoje.</Empty> : <ol className="space-y-1 border-l border-white/10 pl-4">{agenda.map((t) => <li key={t.id} className="relative"><span className="absolute -left-[21px] top-3 h-2 w-2 rounded-full bg-cyan shadow-[0_0_10px_var(--cyan)]" /><Box on={t.done} onClick={() => toggleTask.mutate({ id: t.id, done: !t.done })} label={t.title} sub={t.place || (t.kind === "lembrete" ? "lembrete" : undefined)} time={hhmm(t.due_time)} /></li>)}</ol>}
        </Section>

        <Section title="Tarefas" tone="violet" icon={ClipboardList} to="/tarefas" count={overdue.length + noTime.filter((t) => !t.done).length}>
          {tasksQ.isError ? <Failed /> : overdue.length + noTime.length === 0 ? <Empty>Sem tarefas para hoje. Respire.</Empty> : <div className="space-y-0.5">{[...overdue, ...noTime].map((t) => <Box key={t.id} on={t.done} onClick={() => toggleTask.mutate({ id: t.id, done: !t.done })} label={t.title} late={!!t.due_date && t.due_date < today} sub={t.due_date && t.due_date < today ? `atrasada desde ${dateBR(t.due_date)}` : undefined} />)}</div>}
        </Section>

        <Section title="Rotina fixa" tone="emerald" icon={Repeat} to="/tarefas" count={fixed.filter((f) => !f.done).length}>
          {fixedQ.isError ? <Failed /> : fixed.length === 0 ? <Empty>Nenhuma tarefa fixa hoje.</Empty> : <div className="space-y-0.5">{fixed.map((f) => <Box key={f.key} on={f.done} onClick={() => fixedActs.toggle.mutate({ id: f.fixed.id, date: today, done: !f.done })} label={f.fixed.title} time={hhmm(f.fixed.due_time)} />)}</div>}
        </Section>

        <Section title="Hábitos" tone="emerald" icon={Sprout} to="/habitos" count={habits.length - habits.filter((h) => habitDone.has(h.id)).length}>
          {habitsQ.isError ? <Failed /> : habits.length === 0 ? <Empty>Nenhum hábito ativo.</Empty> : <div className="space-y-0.5">{habits.map((h) => <Box key={h.id} on={habitDone.has(h.id)} onClick={() => toggleHabit.mutate({ habitId: h.id, date: today, done: habitDone.has(h.id) })} label={h.name} />)}</div>}
        </Section>

        <Section title="Corpo" tone="pink" icon={HeartPulse} to="/hoje">
          <div className="space-y-2.5">
            <Link to="/treino" className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-pink/50"><span className="icon-tile h-9 w-9 shrink-0 !rounded-lg" style={tint("pink")}><Dumbbell size={15} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Treino de hoje</span><span className="block truncate text-xs text-muted-foreground">{splitQ.isError ? "indisponível" : split ? split.title : "sem treino definido"}</span></span><ArrowUpRight size={14} className="text-muted-foreground" /></Link>
            <Link to="/dieta" className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 transition hover:border-emerald/50"><span className="icon-tile h-9 w-9 shrink-0 !rounded-lg" style={tint("emerald")}><Utensils size={15} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Dieta</span><span className="block truncate text-xs text-muted-foreground">{dietQ.isError ? "indisponível" : dietQ.data ? `${dietQ.data.meals} refeição(ões) registrada(s)` : "nada registrado hoje"}</span></span>{dietQ.data && dietQ.data.water > 0 && <span className="flex shrink-0 items-center gap-1 text-xs text-cyan"><Droplets size={12} />{(dietQ.data.water / 1000).toFixed(1).replace(".", ",")} L</span>}</Link>
          </div>
        </Section>

        <Section title="Demandas" tone="violet" icon={ClipboardList} to="/projetos" count={openDemands}>
          {demandsQ.isError ? <Failed /> : demands.length === 0 ? <Empty>{openDemands ? `${openDemands} em aberto, nenhuma com prazo para os próximos dias.` : "Nenhuma demanda em aberto."}</Empty> : <ul className="space-y-1.5">{demands.slice(0, 6).map((d) => <li key={`${d.projectId}${d.code}`} className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm"><span className={`h-2 w-2 shrink-0 rounded-full ${d.bucket === "late" ? "bg-destructive" : d.bucket === "today" ? "bg-amber" : "bg-cyan"}`} /><span className="min-w-0 flex-1 truncate">{d.title}{d.dossier && <span className="text-muted-foreground"> · {d.dossier}</span>}</span><span className={`shrink-0 text-xs tabular-nums ${d.bucket === "late" ? "text-destructive" : "text-muted-foreground"}`}>{d.bucket === "today" ? "hoje" : dateBR(d.deadline)}</span></li>)}</ul>}
        </Section>

        <Section title="Dinheiro" tone="emerald" icon={Wallet} to="/financeiro">
          {moneyQ.isError ? <Failed /> : !moneyQ.data ? <Empty>Financeiro ainda sem dados.</Empty> : <div className="space-y-3">
            {moneyQ.data.alerts.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma fatura fecha ou vence nos próximos 7 dias.</p> : <ul className="space-y-1.5">{moneyQ.data.alerts.map((a) => <li key={`${a.card}${a.kind}`} className="flex items-center justify-between gap-3 text-sm"><span>{a.card} <span className="text-muted-foreground">{a.kind === "fecha" ? "fecha" : "vence"}</span></span><span className={`text-xs tabular-nums ${a.inDays <= 2 ? "font-semibold text-amber" : "text-muted-foreground"}`}>{a.inDays === 0 ? "hoje" : a.inDays === 1 ? "amanhã" : `em ${a.inDays} dias`}</span></li>)}</ul>}
            {moneyQ.data.renewals.length > 0 && (
              <div className="space-y-2 border-t border-white/10 pt-3" data-testid="central-renovacoes">
                <p className="mono-caps flex items-center justify-between gap-2"><span className="flex items-center gap-1.5 whitespace-nowrap"><Repeat size={11} className="text-violet" /> Renovações</span><span className="whitespace-nowrap normal-case tracking-normal text-muted-foreground">{money(moneyQ.data.renewals.reduce((n, r) => n + r.amount, 0))} em 30 dias</span></p>
                <ul className="space-y-1.5">{moneyQ.data.renewals.slice(0, 6).map((r) => { const b = brandOf(r.name), soon = r.inDays <= 3; return (
                  <li key={r.id} className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition duration-300 hover:bg-white/[0.05]" data-testid="central-renovacao" style={soon ? { boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--amber) 45%, transparent)", background: "color-mix(in oklab, var(--amber) 8%, transparent)" } : undefined}>
                    {b ? <BrandTile brand={b} size={30} className="!rounded-lg transition duration-300 group-hover:scale-110" /> : <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-[0.7rem] font-bold">{r.name.slice(0, 1).toUpperCase()}</span>}
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm">{r.name}</span><span className="block truncate text-[0.62rem] text-muted-foreground">{dateBR(r.date)}{r.where ? ` · ${r.where}` : ""}</span></span>
                    <span className="shrink-0 text-right"><b className="block text-sm tabular-nums">{money(r.amount)}</b><span className={`block text-[0.62rem] ${soon ? "font-semibold text-amber" : "text-muted-foreground"}`}>{when(r.inDays)}</span></span>
                  </li>); })}</ul>
                {moneyQ.data.renewals.length > 6 && <p className="text-[0.65rem] text-muted-foreground">+ {moneyQ.data.renewals.length - 6} nos próximos 30 dias</p>}
              </div>)}
            {moneyQ.data.open.length > 0 && <div className="space-y-1.5 border-t border-white/10 pt-3"><p className="mono-caps">Fatura aberta (só a minha parte)</p>{moneyQ.data.open.map((o) => <div key={o.card} className="flex items-center justify-between text-sm"><span>{o.card}</span><b className="tabular-nums">{brl(o.total)}</b></div>)}</div>}</div>}
        </Section>

        <Section title="Clientes" tone="amber" icon={Building2} to="/projetos" count={(contractsQ.data ?? []).length}>
          {contractsQ.isError ? <Failed /> : (contractsQ.data ?? []).length === 0 ? <Empty>Nenhum contrato vencendo nos próximos 30 dias.</Empty> : <ul className="space-y-2">{(contractsQ.data ?? []).map((c) => { const d = daysBetween(today, c.contractEnd); return <li key={c.id}><div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate">{c.name}</span><span className={`shrink-0 text-xs tabular-nums ${d < 0 ? "text-destructive" : d <= 7 ? "text-amber" : "text-muted-foreground"}`}>{d < 0 ? `venceu há ${-d} d` : d === 0 ? "vence hoje" : `em ${d} d`}</span></div><Meter pct={d < 0 ? 100 : Math.max(5, 100 - (d / 30) * 100)} color={d < 0 ? "var(--destructive)" : d <= 7 ? "var(--amber)" : "var(--cyan)"} height={4} warn={false} /></li>; })}</ul>}
        </Section>

        <Section title="Implantações" tone="cyan" icon={Rocket} to="/projetos" count={(setupQ.data ?? []).filter((x) => x.finished < x.total).length}>
          {setupQ.isError ? <Failed /> : (setupQ.data ?? []).filter((x) => x.finished < x.total).length === 0 ? <Empty>Nenhuma implantação em andamento.</Empty> : <ul className="space-y-3">{(setupQ.data ?? []).filter((x) => x.finished < x.total).map((x) => <li key={x.clientId}><div className="flex items-center justify-between gap-3 text-sm"><span className="min-w-0 truncate font-medium">{x.client}</span><span className="shrink-0 text-xs tabular-nums text-muted-foreground">{x.finished}/{x.total}{x.blocked > 0 && <span className="text-destructive"> · {x.blocked} travado</span>}</span></div><Meter pct={Math.round((x.finished / x.total) * 100)} color="var(--cyan)" height={4} warn={false} />{x.next && <p className="mt-1 truncate text-[0.7rem] text-muted-foreground">Próximo: {x.next}</p>}</li>)}</ul>}
        </Section>

        <Section title="Reuniões de hoje" tone="violet" icon={Mic} to="/reunioes" count={(meetQ.data ?? []).length}>
          {meetQ.isError ? <Failed /> : (meetQ.data ?? []).length === 0 ? <Empty>Nenhuma reunião registrada hoje.</Empty> : <ul className="space-y-1.5">{(meetQ.data ?? []).map((m) => <li key={m.id} className="truncate rounded-xl px-2.5 py-1.5 text-sm">{m.title}</li>)}</ul>}
        </Section>
      </div>
      <p className="mt-6 flex items-center gap-2 text-[0.7rem] text-muted-foreground"><Sparkles size={12} className="text-cyan" /> Marque aqui e o resto do Orion acompanha: é a mesma informação das telas de Tarefas, Hábitos e Demandas.</p>
    </main>
  );
}
