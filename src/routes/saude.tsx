import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addDays, startOfWeek, subDays } from "date-fns";
import { ArrowRight, Check, CheckCircle2, Dumbbell, Flame, Heart, Loader2, Plus, Salad, Scale, Sprout, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Panel, PlanShell, colorVar, tint } from "@/components/PlanShell";
import { isoDate, todayIso } from "@/lib/dates";
import { getIcon } from "@/lib/icons";
import { useArchiveHabit, useCreateHabit, useHabitCompletions, useHabits, useToggleHabit } from "@/lib/data/habits";
import { useRecentSessions, useSplit, useWeeklyGoal } from "@/lib/data/workouts";

export const Route = createFileRoute("/saude")({
  head: () => ({
    meta: [
      { title: "Presence · Saúde e bem-estar" },
      { name: "description", content: "Treino, dieta, hábitos e evolução com a Presence." },
      { property: "og:title", content: "Presence · Saúde e bem-estar" },
      { property: "og:description", content: "Treino, dieta, hábitos e evolução." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Saude,
});

const dow = ["D", "S", "T", "Q", "Q", "S", "S"];

function Saude() {
  const habitsQ = useHabits();
  const compQ = useHabitCompletions();
  const toggle = useToggleHabit();
  const create = useCreateHabit();
  const archive = useArchiveHabit();
  const sessQ = useRecentSessions();
  const splitQ = useSplit();
  const goalQ = useWeeklyGoal();
  const [name, setName] = useState("");

  const today = todayIso();
  const habits = habitsQ.data ?? [];
  const doneByHabit = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of compQ.data ?? []) m.set(c.habit_id, (m.get(c.habit_id) ?? new Set()).add(c.completed_on));
    return m;
  }, [compQ.data]);

  /** Dias seguidos até hoje (se hoje ainda não foi feito, conta a partir de ontem). */
  const streak = (id: string) => {
    const set = doneByHabit.get(id) ?? new Set<string>();
    let d = set.has(today) ? new Date() : subDays(new Date(), 1);
    let n = 0;
    while (set.has(isoDate(d))) { n++; d = subDays(d, 1); }
    return n;
  };
  const last7 = (id: string) => Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i)).map((d) => ({ d, on: doneByHabit.get(id)?.has(isoDate(d)) ?? false }));

  const doneToday = habits.filter((h) => doneByHabit.get(h.id)?.has(today)).length;
  const best = habits.reduce((m, h) => Math.max(m, streak(h.id)), 0);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const from = isoDate(weekStart), to = isoDate(addDays(weekStart, 6));
  const weekWorkouts = (sessQ.data ?? []).filter((s) => s.finished_at && s.session_date >= from && s.session_date <= to).length;
  const goal = goalQ.data ?? 5;
  const weekPct = Math.min(100, Math.round((weekWorkouts / goal) * 100));
  const todaySplit = splitQ.data?.find((x) => x.weekday === new Date().getDay());
  const onErr = (e: Error) => toast.error(e.message);

  const add = () => {
    if (!name.trim() || create.isPending) return;
    create.mutate({ name, icon: "sprout", color: "emerald" }, { onSuccess: () => { setName(""); toast.success("Hábito criado"); }, onError: onErr });
  };

  const stats = [
    { n: `${doneToday}/${habits.length}`, l: "Hábitos hoje", Icon: Sprout, c: "emerald" },
    { n: `${best}`, l: best === 1 ? "Dia de sequência" : "Dias de sequência", Icon: Flame, c: "violet" },
    { n: `${weekWorkouts}/${goal}`, l: "Treinos na semana", Icon: Dumbbell, c: "cyan" },
  ];

  return (
    <PlanShell active={5}>
      <section className="flex flex-wrap items-center justify-between gap-6 px-2">
        <div className="animate-rise">
          <p className="mono-caps">Saúde &amp; bem-estar</p>
          <h1 className="mt-2 font-serif text-5xl leading-none md:text-6xl">Cuidar de <span className="text-gradient italic">você</span></h1>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">Hábitos diários, treino da semana e sua evolução num só lugar.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {stats.map(({ n, l, Icon, c }, i) => (
            <div key={l} className="accent-card flex items-center gap-3 px-4 py-3 animate-rise" style={{ ...tint(c), animationDelay: `${i * 0.1}s` }}>
              <span className="icon-tile h-11 w-11 rounded-full"><Icon size={20} /></span>
              <span><b className="block font-display text-2xl leading-none">{n}</b><span className="text-xs text-muted-foreground">{l}</span></span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel c="emerald">
          <div className="mb-4 flex items-center gap-3">
            <span className="icon-tile h-10 w-10 rounded-full"><Heart size={18} /></span>
            <span><b className="block font-display text-base">Hábitos de hoje</b><span className="text-xs text-muted-foreground">Marque o que você já fez e mantenha a sequência.</span></span>
          </div>
          <ul className="divide-y divide-border">
            {habitsQ.isPending && <li className="flex justify-center py-10"><Loader2 className="animate-spin text-cyan" /></li>}
            {habitsQ.isError && <li className="py-10 text-center text-sm text-destructive">Não consegui carregar: {habitsQ.error.message}</li>}
            {habitsQ.isSuccess && habits.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">Você ainda não tem hábitos. Crie o primeiro abaixo (ex.: beber 2 L de água).</li>}
            {habits.map((h) => {
              const Icon = getIcon(h.icon);
              const on = doneByHabit.get(h.id)?.has(today) ?? false;
              const s = streak(h.id);
              return (
                <li key={h.id} className="group grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 py-3" style={tint(h.color)}>
                  <button aria-label={on ? "Desmarcar hábito" : "Concluir hábito"} onClick={() => toggle.mutate({ habitId: h.id, date: today, done: on }, { onError: onErr })}
                    className={`grid h-7 w-7 place-items-center rounded-full border transition ${on ? "border-emerald bg-emerald text-background shadow-[0_0_12px_var(--emerald)]" : "border-muted-foreground/50 hover:border-emerald"}`}>
                    {on && <Check size={15} strokeWidth={3} />}
                  </button>
                  <Icon size={20} className="text-[color:var(--glow)]" />
                  <span className="min-w-0">
                    <b className={`block truncate text-sm font-semibold ${on ? "text-muted-foreground line-through" : ""}`}>{h.name}</b>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      {s > 0 ? <><Flame size={12} className="text-violet" /> {s} {s === 1 ? "dia" : "dias"} seguidos</> : "Sem sequência ainda"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="hidden gap-1 sm:flex" aria-label="Últimos 7 dias">
                      {last7(h.id).map(({ d, on: o }) => (
                        <span key={d.toISOString()} title={isoDate(d)} className={`grid h-5 w-5 place-items-center rounded-full text-[0.6rem] ${o ? "bg-emerald text-background" : "bg-secondary text-muted-foreground"}`}>{dow[d.getDay()]}</span>
                      ))}
                    </span>
                    <button aria-label="Arquivar hábito" onClick={() => archive.mutate(h.id, { onError: onErr })}
                      className="text-muted-foreground opacity-40 transition hover:text-destructive group-hover:opacity-100"><Trash2 size={15} /></button>
                  </span>
                </li>
              );
            })}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-4 flex items-center gap-2 rounded-full border border-border p-1.5 pl-4 focus-within:border-emerald">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Novo hábito…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <button type="submit" disabled={create.isPending || !name.trim()} className="flex items-center gap-1.5 rounded-full bg-gradient-brand px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"><Plus size={14} /> Adicionar</button>
          </form>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel c="cyan">
            <div className="mb-4 flex items-center gap-3">
              <span className="icon-tile h-10 w-10 rounded-full"><Dumbbell size={18} /></span>
              <span><b className="block font-display text-base">Treino da semana</b><span className="text-xs text-muted-foreground">Hoje: {todaySplit?.title ?? "—"}</span></span>
            </div>
            <div className="flex justify-between text-sm"><span>{weekWorkouts} de {goal} treinos</span><span>{weekPct}%</span></div>
            <div className="mt-2 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${weekPct}%` }} /></div>
            <Link to="/treino" className="glass mt-4 flex items-center justify-center gap-2 rounded-full py-2.5 text-sm transition hover:shadow-[0_0_24px_-8px_var(--cyan)]">Abrir meu treino <ArrowRight size={15} /></Link>
          </Panel>

          <Panel c="violet">
            <div className="mb-3 flex items-center gap-3">
              <span className="icon-tile h-10 w-10 rounded-full"><Target size={18} /></span>
              <span><b className="block font-display text-base">Em breve</b><span className="text-xs text-muted-foreground">O que ainda vamos conectar.</span></span>
            </div>
            <ul className="space-y-2 text-sm">
              {[[Salad, "Dieta e cardápio da semana"], [Scale, "Medidas e peso"], [CheckCircle2, "Fotos de evolução"]].map(([I, t]) => {
                const Ic = I as typeof Salad;
                return <li key={t as string} className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2 text-muted-foreground"><Ic size={15} style={{ color: colorVar("violet") }} /> {t as string}</li>;
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </PlanShell>
  );
}
