import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { addDays, format, startOfWeek, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeftRight, BarChart3, Calendar, Check, CheckCircle2, Clock, Dumbbell, Flame, Layers, Loader2, Minus, Pause, Pencil, Play, Plus, Target, Timer,
} from "lucide-react";
import { PlanShell, Panel, tint } from "@/components/PlanShell";
import orb from "@/assets/treino-orb.jpg";
import musculos from "@/assets/treino-musculos.jpg";
import { WorkoutEditDialog } from "@/components/WorkoutEditDialog";
import { fromIsoDate, isoDate, todayIso } from "@/lib/dates";
import {
  useDoneCount, useFinishSession, useLoadHistory, useLogExercise, useRecentSessions, useSessionLogs, useSplit, useStartSession, useWeeklyGoal, useWorkouts,
} from "@/lib/data/workouts";

export const Route = createFileRoute("/treino")({
  head: () => ({
    meta: [
      { title: "Presence · Meu treino" },
      { name: "description", content: "Seu treino do dia, divisão semanal, evolução de cargas e timer de descanso." },
      { property: "og:title", content: "Presence · Meu treino" },
      { property: "og:description", content: "Treino de hoje, divisão semanal e evolução de cargas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Treino,
});

const fade = { maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 62%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 62%, transparent 100%)" };

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function Head({ Icon, t, d, right }: { Icon: typeof Dumbbell; t: string; d?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="icon-tile h-11 w-11 shrink-0 !rounded-full"><Icon size={19} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-lg font-semibold">{t}</h2>
        {d && <p className="text-xs text-muted-foreground">{d}</p>}
      </div>
      {right}
    </div>
  );
}

function Treino() {
  const wq = useWorkouts();
  const splitQ = useSplit();
  const goalQ = useWeeklyGoal();
  const sessQ = useRecentSessions();
  const startSession = useStartSession();
  const finishSession = useFinishSession();
  const logEx = useLogExercise();

  const [pickedId, setPickedId] = useState<string | null>(null);
  const [chartIdx, setChartIdx] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [rest, setRest] = useState(90);
  const [left, setLeft] = useState(90);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState("");

  const workouts = wq.data?.workouts ?? [];
  const todayDow = new Date().getDay();
  const todaySplit = splitQ.data?.find((x) => x.weekday === todayDow);
  const workout = workouts.find((w) => w.id === pickedId) ?? workouts.find((w) => w.id === todaySplit?.workout_id) ?? workouts[0];
  const exercises = workout ? (wq.data?.exercises ?? []).filter((e) => e.workout_id === workout.id) : [];
  const exs = exercises.map((e) => ({ n: e.name, m: e.muscle, s: e.sets_reps, r: `${e.rest_seconds}s` }));
  const ficha = workout?.name ?? "—";

  const today = todayIso();
  const sessions = sessQ.data ?? [];
  const current = workout ? sessions.find((x) => x.session_date === today && x.workout_id === workout.id) : undefined;
  const logs = useSessionLogs(current?.id).data ?? [];
  const logByEx = new Map(logs.map((l) => [l.exercise_id, l]));
  const done = new Set<number>(exercises.flatMap((e, i) => (logByEx.get(e.id)?.done ? [i] : [])));
  const carga: Record<number, string> = {};
  exercises.forEach((e, i) => { const kg = logByEx.get(e.id)?.load_kg; if (kg != null) carga[i] = String(Number(kg)); });
  const started = !!current;
  const finished = !!current?.finished_at;

  // Semana (segunda a domingo)
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDows = [1, 2, 3, 4, 5, 6, 0];
  const weekDates = weekDows.map((_, i) => isoDate(addDays(weekStart, i)));
  const finishedDates = new Set(sessions.filter((x) => x.finished_at).map((x) => x.session_date));
  const semana = weekDows.map((dow, i) => ({
    d: dayLabels[i]!, t: splitQ.data?.find((x) => x.weekday === dow)?.title ?? "—", done: finishedDates.has(weekDates[i]!), hoje: dow === todayDow,
  }));
  const weekDone = sessions.filter((x) => x.finished_at && x.session_date >= weekDates[0]! && x.session_date <= weekDates[6]!).length;
  const goal = goalQ.data ?? 5;
  const weekPct = Math.min(100, Math.round((weekDone / goal) * 100));

  // Último treino concluído
  const last = sessions.find((x) => x.finished_at);
  const lastDone = useDoneCount(last?.id).data;

  // Evolução de cargas: maior carga por semana nas últimas 5 semanas
  const chartEx = exercises[chartIdx] ?? exercises[0];
  const hist = useLoadHistory(chartEx?.name).data ?? [];
  const weekStarts = [4, 3, 2, 1, 0].map((n) => startOfWeek(subWeeks(new Date(), n), { weekStartsOn: 1 }));
  const buckets = weekStarts.map((st) => {
    const from = isoDate(st), to = isoDate(addDays(st, 6));
    const kgs = hist.filter((h) => h.date >= from && h.date <= to).map((h) => h.kg);
    return kgs.length ? Math.max(...kgs) : null;
  });
  const withData = buckets.flatMap((v, i) => (v == null ? [] : [{ v, i }]));
  const lastKg = withData.at(-1)?.v ?? null;

  const fail = (e: Error) => setToast(`Erro: ${e.message}`);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((s) => (s <= 1 ? (setRunning(false), setToast("Descanso finalizado! Próxima série."), rest) : s - 1)), 1000);
    return () => clearInterval(id);
  }, [running, rest]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 2800); return () => clearTimeout(id); }, [toast]);

  const toggle = (i: number) => { if (workout && exercises[i]) logEx.mutate({ workout, exercise: exercises[i]!, patch: { done: !done.has(i) } }, { onError: fail }); };
  const adj = (d: number) => { const v = Math.max(15, Math.min(300, rest + d)); setRest(v); setLeft(v); };
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const pct = exs.length ? Math.round((done.size / exs.length) * 100) : 0;

  const stats = [
    { Icon: Dumbbell, t: "Treino de hoje", v: ficha, c: "cyan", hl: true },
    { Icon: Clock, t: "Duração estimada", v: `${workout?.duration_min ?? 60} min`, c: "violet" },
    { Icon: Layers, t: "Exercícios", v: `${done.size}/${exs.length}`, c: "violet" },
  ];

  const W = 300, H = 110;
  const vals = withData.map((p) => p.v);
  const lo = vals.length ? Math.min(...vals) * 0.8 : 0;
  const hi = vals.length ? Math.max(Math.max(...vals) * 1.1, lo + 1) : 1;
  const pts = withData.map((p) => [10 + (p.i * (W - 20)) / 4, H - ((p.v - lo) / (hi - lo)) * H] as const);
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");

  if (wq.isPending || splitQ.isPending) {
    return <PlanShell active={5}><div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-cyan" /></div></PlanShell>;
  }
  if (wq.isError || !workout) {
    return <PlanShell active={5}><p className="py-24 text-center text-sm text-muted-foreground">{wq.isError ? `Não consegui carregar o treino: ${wq.error.message}` : "Nenhuma ficha de treino cadastrada ainda."}</p></PlanShell>;
  }

  return (
    <PlanShell active={5}>
      <section className="grid items-center gap-5 px-2 lg:grid-cols-[auto_auto_minmax(0,1fr)]">
        <div className="animate-rise">
          <p className="mono-caps mb-2 !tracking-[0.4em] text-muted-foreground">Saúde &amp; Performance</p>
          <h1 className="font-serif text-5xl leading-tight">Meu <span className="text-gradient">treino</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Sua evolução começa com consistência.</p>
        </div>
        <div className="mx-auto h-40 w-48 animate-rise">
          <img src={orb} alt="" width={816} height={816} className="h-full w-full object-contain animate-float" style={fade} />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {stats.map(({ Icon, t, v, c, hl }, i) => (
            <div key={t} className="glass rounded-2xl p-4 animate-rise" style={{ ...tint(c), animationDelay: `${0.1 + i * 0.06}s` }}>
              <Icon size={22} style={{ color: "var(--glow)" }} />
              <p className="mt-2 text-xs text-muted-foreground">{t}</p>
              <p className={`font-display font-semibold leading-tight ${hl ? "text-base text-cyan" : "text-2xl"}`}>{v}</p>
            </div>
          ))}
          <div className="glass rounded-2xl p-4 animate-rise" style={tint("cyan")}>
            <BarChart3 size={22} className="text-cyan" />
            <p className="mt-2 text-xs text-muted-foreground">Progresso semanal</p>
            <div className="flex items-center gap-3">
              <p className="font-display text-2xl font-semibold">{weekDone}/{goal}</p>
              <div className="h-1.5 flex-1 rounded-full bg-secondary"><div className="h-full rounded-full bg-cyan shadow-[0_0_10px_var(--cyan)] transition-all" style={{ width: `${weekPct}%` }} /></div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.75fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-5">
          <Panel c="cyan">
            <Head Icon={Calendar} t="Divisão semanal" d="Seu plano de treino da semana." />
            <ul className="space-y-2">
              {semana.map((s) => (
                <li key={s.d} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${s.hoje ? "border-cyan bg-[color-mix(in_oklab,var(--cyan)_10%,transparent)] shadow-[0_0_20px_-8px_var(--cyan)]" : "border-border/60"}`}>
                  <span className="w-9 font-medium">{s.d}</span>
                  <Dumbbell size={14} className="text-violet" />
                  <span className="flex-1 truncate text-foreground/85">{s.t}</span>
                  {s.done && <CheckCircle2 size={16} className="text-emerald" />}
                  {s.hoje && <Play size={13} className="fill-cyan text-cyan" />}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel c="violet">
            <Head Icon={Target} t="Meta da semana" />
            <div className="flex justify-between text-sm"><span>{weekDone} de {goal} treinos</span><span>{weekPct}%</span></div>
            <div className="mt-2 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-brand transition-all" style={{ width: `${weekPct}%` }} /></div>
          </Panel>
        </div>

        <Panel c="cyan">
          <Head Icon={Dumbbell} t="Treino de hoje" d={`${ficha} · ${exs.length} exercícios · ~${workout.duration_min} minutos · ${pct}% concluído`}
            right={<button onClick={() => { const next = workouts[(workouts.findIndex((w) => w.id === workout.id) + 1) % workouts.length]!; setPickedId(next.id); setChartIdx(0); setOpen(null); setToast(`Treino trocado: ${next.name}.`); }}
              className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm transition hover:border-cyan/60"><ArrowLeftRight size={15} /> Trocar treino</button>} />
          <ul className="divide-y divide-border/50">
            {exs.map((e, i) => (
              <li key={e.n} className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border text-sm">{i + 1}</span>
                  <span className="icon-tile grid h-12 w-16 shrink-0 place-items-center !rounded-xl" style={tint(i % 2 ? "violet" : "cyan")}><Dumbbell size={20} /></span>
                  <div className="min-w-[9rem] flex-[1_1_10rem]">
                    <p className={`truncate text-sm font-medium ${done.has(i) ? "text-muted-foreground line-through" : ""}`}>{e.n}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.m}</p>
                  </div>
                  <div className="w-20 shrink-0 text-xs"><p>{e.s}</p><p className="flex items-center gap-1 text-muted-foreground"><Timer size={11} /> {e.r}</p></div>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <button onClick={() => setOpen(open === i ? null : i)} className="hidden items-center gap-1 whitespace-nowrap rounded-full border border-cyan/50 px-3 py-1.5 text-[0.7rem] text-cyan md:flex"><Play size={11} /> Ver execução</button>
                    <button onClick={() => setOpen(open === i + 100 ? null : i + 100)} className="hidden items-center gap-1 whitespace-nowrap rounded-full border border-violet/50 px-3 py-1.5 text-[0.7rem] text-violet md:flex"><Dumbbell size={11} /> {carga[i] ? `${carga[i]} kg` : "Registrar carga"}</button>
                    <button onClick={() => toggle(i)} aria-label="Concluir exercício" className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition ${done.has(i) ? "border-cyan bg-cyan text-primary-foreground" : "border-border"}`}>{done.has(i) && <Check size={14} />}</button>
                  </div>
                </div>
                {open === i && <p className="ml-11 mt-2 rounded-xl border border-cyan/30 p-3 text-xs text-muted-foreground animate-rise">Execução: mantenha a postura neutra, controle a descida em 2–3s e contraia o músculo-alvo no topo. Respire na fase de esforço.</p>}
                {open === i + 100 && (
                  <form className="ml-11 mt-2 flex items-center gap-2 animate-rise" onSubmit={(ev) => { ev.preventDefault(); const v = new FormData(ev.currentTarget).get("kg"); const kg = Number(v); if (v && Number.isFinite(kg) && kg >= 0) { logEx.mutate({ workout, exercise: exercises[i]!, patch: { load_kg: kg } }, { onSuccess: () => { setChartIdx(i); setOpen(null); setToast(`Carga de ${kg} kg registrada em ${e.n}.`); }, onError: fail }); } }}>
                    <input name="kg" type="number" step="0.5" min={0} max={500} autoFocus placeholder="kg" className="w-24 rounded-full border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:border-violet" />
                    <button className="rounded-full bg-violet px-3 py-1.5 text-xs text-primary-foreground">Salvar</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <div className="grid content-start gap-5">
          <Panel c="violet">
            <Head Icon={Layers} t="Resumo muscular" d="Grupos trabalhados hoje." />
            <div className="flex flex-wrap items-center gap-2">
              <img src={musculos} alt="Mapa muscular com glúteos e posterior destacados" loading="lazy" width={816} height={816} className="h-40 w-40 shrink-0 object-contain" style={fade} />
              <ul className="space-y-2 text-xs">
                {(workout.muscles.length ? workout.muscles : ["—"]).map((m, i) => (
                  <li key={m} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: i < 2 ? "var(--violet)" : "var(--cyan)" }} />{m}</li>
                ))}
              </ul>
            </div>
          </Panel>
          <Panel c="cyan">
            <Head Icon={Calendar} t="Último treino" d={last ? cap(format(fromIsoDate(last.session_date), "EEE, d 'de' MMM", { locale: ptBR })) : "Nenhum ainda"} right={last ? <span className="tag" style={tint("emerald")}><Check size={12} /> Concluído</span> : undefined} />
            {!last && <p className="text-xs text-muted-foreground">Conclua um treino para ver o resumo aqui.</p>}
            {last && <div className="grid grid-cols-3 gap-2 text-xs">
              {([[Clock, `${last.duration_min ?? "—"} min`], [Dumbbell, `${lastDone ?? "—"} exercícios`], ...(last.kcal ? [[Flame, `${last.kcal} kcal`]] : [])] as [unknown, string][]).map(([I, t]) => {
                const Ic = I as typeof Clock;
                return <span key={t as string} className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 py-2"><Ic size={13} className="text-cyan" />{t as string}</span>;
              })}
            </div>}
          </Panel>
          <Panel c="violet">
            <Head Icon={BarChart3} t="Evolução de cargas" d={`${chartEx?.name ?? "—"} (carga máxima)`} right={<span className="tag" style={tint("violet")}>{lastKg != null ? `${lastKg} kg` : "— kg"}</span>} />
            {pts.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Registre a carga de {chartEx?.name ?? "um exercício"} para ver a evolução.</p>}
            <svg viewBox={`-12 -10 ${W + 24} ${H + 30}`} className={`h-36 w-full ${pts.length === 0 ? "hidden" : ""}`}>
              <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--violet)" stopOpacity=".35" /><stop offset="1" stopColor="var(--violet)" stopOpacity="0" /></linearGradient></defs>
              {pts.length > 0 && <path d={`${path} L${pts.at(-1)![0]},${H} L${pts[0]![0]},${H} Z`} fill="url(#g)" />}
              <path d={path} fill="none" stroke="var(--violet)" strokeWidth="2.5" style={{ filter: "drop-shadow(0 0 4px var(--violet))" }} />
              {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="var(--foreground)" />)}
              {[0, 1, 2, 3, 4].map((i) => <text key={i} x={10 + (i * (W - 20)) / 4} y={H + 18} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">Sem {i + 1}</text>)}
            </svg>
          </Panel>
        </div>
      </div>

      <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]">
        <div className="glass flex flex-wrap items-center gap-4 rounded-3xl p-4" style={tint("cyan")}>
          <span className="icon-tile h-11 w-11 !rounded-full"><Timer size={19} /></span>
          <div className="flex-1"><p className="font-display font-semibold">Timer de descanso</p><p className="text-xs text-muted-foreground">Pronto para o próximo exercício?</p></div>
          <button onClick={() => adj(-15)} aria-label="Menos 15 segundos" className="grid h-9 w-9 place-items-center rounded-full border border-border"><Minus size={15} /></button>
          <span className="font-display text-4xl font-semibold tabular-nums">{mm}:{ss}</span>
          <button onClick={() => adj(15)} aria-label="Mais 15 segundos" className="grid h-9 w-9 place-items-center rounded-full border border-border"><Plus size={15} /></button>
          <button onClick={() => setRunning((r) => !r)} aria-label={running ? "Pausar" : "Iniciar"} className="grid h-12 w-12 place-items-center rounded-full border-2 border-cyan text-cyan shadow-[0_0_20px_-4px_var(--cyan)]">{running ? <Pause size={20} /> : <Play size={20} className="fill-cyan" />}</button>
        </div>
        <button disabled={finished || startSession.isPending || finishSession.isPending}
          onClick={() => {
            if (!started) startSession.mutate(workout, { onSuccess: () => setToast("Treino iniciado! Bora 💪"), onError: fail });
            else if (current) finishSession.mutate(current, { onSuccess: () => setToast("Treino concluído! 🎉"), onError: fail });
          }}
          className="flex items-center justify-center gap-3 rounded-full py-4 font-display text-xl font-semibold text-primary-foreground shadow-[0_0_40px_-10px_var(--cyan)] disabled:opacity-70" style={{ background: "linear-gradient(90deg, var(--cyan), var(--violet))" }}>
          {finished ? <><Check size={22} /> Treino concluído</> : started ? <><Check size={22} /> Finalizar treino</> : <><Play size={22} /> Iniciar treino</>}
        </button>
        <div className="flex gap-3">
          <button onClick={() => setEditOpen(true)} className="glass flex items-center gap-2 rounded-2xl px-5 py-4 text-sm"><Pencil size={17} /> Editar ficha</button>
          <button onClick={() => { const n = sessions.filter((x) => x.finished_at && x.session_date.startsWith(today.slice(0, 7))).length; setToast(`Histórico: ${n} treino${n === 1 ? "" : "s"} concluído${n === 1 ? "" : "s"} neste mês.`); }} className="glass flex items-center gap-2 rounded-2xl px-5 py-4 text-sm"><BarChart3 size={17} /> Histórico</button>
        </div>
      </div>

      {editOpen && (
        <WorkoutEditDialog workouts={workouts} exercises={wq.data?.exercises ?? []} split={splitQ.data ?? []} goal={goal} currentId={workout.id}
          onClose={() => setEditOpen(false)} onSelect={(id) => { setPickedId(id); setChartIdx(0); setOpen(null); }} />
      )}
      {toast && <div role="status" className="glass fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm text-cyan animate-rise">{toast}</div>}
    </PlanShell>
  );
}
