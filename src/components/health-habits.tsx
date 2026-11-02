import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { subDays } from "date-fns";
import { ArrowUpRight, Check, ChartNoAxesColumn, Flame, Loader2, Plus, Sprout, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { HealthTabs } from "@/components/health-tabs";
import { Button } from "@/components/ui/button";
import { isoDate, todayIso } from "@/lib/dates";
import { useArchiveHabit, useCreateHabit, useHabitCompletions, useHabits, useToggleHabit } from "@/lib/data/habits";

const dow = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Aba "Hábitos" da Saúde, ligada ao banco (tabelas habits e habit_completions). */
export function HealthHabits() {
  const habitsQ = useHabits();
  const compQ = useHabitCompletions();
  const toggle = useToggleHabit();
  const create = useCreateHabit();
  const archive = useArchiveHabit();
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
  const onErr = (e: Error) => toast.error(e.message);

  const add = () => {
    if (!name.trim() || create.isPending) return;
    create.mutate({ name, icon: "sprout", color: "emerald" }, { onSuccess: () => { setName(""); toast.success("Hábito criado"); }, onError: onErr });
  };

  return (
    <div className="health-area relative min-h-screen overflow-hidden bg-background font-body text-foreground">
      <div className="aurora pointer-events-none absolute inset-0" />
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <main className="relative z-10 mx-auto max-w-7xl px-5 py-6 md:px-10">
        <HealthTabs active="habitos" />
        <header className="mb-8 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-primary shadow-glow"><ChartNoAxesColumn className="h-7 w-7 text-primary-foreground" /></div>
            <h1 className="font-display-h text-4xl font-semibold">Hábitos<span className="text-primary">.</span></h1>
          </div>
          <dl className="grid grid-cols-2 gap-6 text-right">
            <div><dt className="text-xs text-muted-foreground">Hoje</dt><dd className="font-display-h text-3xl">{doneToday}<span className="text-base text-muted-foreground">/{habits.length}</span></dd></div>
            <div><dt className="text-xs text-muted-foreground">Melhor sequência</dt><dd className="font-display-h text-3xl">{best}<span className="ml-1 text-base text-muted-foreground">{best === 1 ? "dia" : "dias"}</span></dd></div>
          </dl>
        </header>

        <section className="glass-h rounded-[2rem] p-6 md:p-8" aria-label="Hábitos de hoje">
          <ul className="divide-y divide-border">
            {habitsQ.isPending && <li className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></li>}
            {habitsQ.isError && <li className="py-10 text-center text-sm text-destructive">Não consegui carregar: {habitsQ.error.message}</li>}
            {habitsQ.isSuccess && habits.length === 0 && (
              <li className="py-12 text-center">
                <Sprout className="mx-auto mb-4 h-8 w-8 text-primary" />
                <h2 className="font-display-h text-xl">Nenhum hábito registrado</h2>
                <p className="mt-2 text-sm text-muted-foreground">Crie o primeiro abaixo (ex.: beber 2 L de água).</p>
              </li>
            )}
            {habits.map((h) => {
              const on = doneByHabit.get(h.id)?.has(today) ?? false;
              const s = streak(h.id);
              return (
                <li key={h.id} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-4">
                  <Button variant="outline" size="icon" className="rounded-full bg-card/40" aria-label={on ? "Desmarcar hábito" : "Concluir hábito"} aria-pressed={on}
                    onClick={() => toggle.mutate({ habitId: h.id, date: today, done: on }, { onError: onErr })}>
                    <Check className={on ? "text-primary" : "text-muted-foreground/30"} />
                  </Button>
                  <div className="min-w-0">
                    <p className={`break-words text-sm font-medium ${on ? "text-muted-foreground line-through" : ""}`}>{h.name}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      {s > 0 ? <><Flame className="h-3 w-3 text-primary" /> {s} {s === 1 ? "dia" : "dias"} seguidos</> : "Sem sequência ainda"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="hidden gap-1 sm:flex" aria-label="Últimos 7 dias">
                      {last7(h.id).map(({ d, on: o }) => (
                        <span key={d.toISOString()} title={isoDate(d)} className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${o ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{dow[d.getDay()]}</span>
                      ))}
                    </span>
                    <Button variant="ghost" size="icon" aria-label="Arquivar hábito" className="text-muted-foreground opacity-40 hover:text-destructive group-hover:opacity-100"
                      onClick={() => archive.mutate(h.id, { onError: onErr })}><Trash2 /></Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <form onSubmit={(e) => { e.preventDefault(); add(); }} className="mt-6 flex items-center gap-2 rounded-full border border-border p-1.5 pl-5 focus-within:border-primary">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Novo hábito…" aria-label="Novo hábito" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            <Button type="submit" size="sm" disabled={create.isPending || !name.trim()} className="rounded-full bg-gradient-primary text-primary-foreground"><Plus /> Adicionar</Button>
          </form>
        </section>

        <div className="mt-8">
          <Button asChild variant="outline" className="rounded-full border-primary/40 bg-primary/10 text-primary">
            <Link to="/treino">Abrir meu treino<ArrowUpRight /></Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
