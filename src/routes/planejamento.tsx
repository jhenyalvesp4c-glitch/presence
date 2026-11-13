import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Clock, Dumbbell, Heart, Lightbulb, Link2, ListChecks, Moon, ScanFace, Smile, Sparkles, Zap } from "lucide-react";
import { LivingOrb } from "@/components/LivingOrb";
import { Panel, PlanShell, colorVar, tint } from "@/components/PlanShell";
import { tempoLabels, todayLabel, type Disposicao, type Tempo } from "@/lib/plan-data";
import { hhmm, todayIso } from "@/lib/dates";
import { getIcon } from "@/lib/icons";
import { useCategories, useTasks } from "@/lib/data/tasks";
import { useDayPlan, useGenerateDay, useRoutine, useSchedule } from "@/lib/data/day";
import { compromissosForDay } from "@/lib/appointments";
import { useSplit } from "@/lib/data/workouts";

export const Route = createFileRoute("/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento Inteligente · Presence" },
      { name: "description", content: "Conte como você está hoje e o Presence monta um plano personalizado para o seu dia." },
      { property: "og:title", content: "Planejamento Inteligente · Presence" },
      { property: "og:description", content: "Planeje seu dia com o Presence: disposição, tempo, prioridades e pausas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Planejamento,
});

const disp: { v: Disposicao; Icon: typeof Zap; l: string }[] = [
  { v: "alta", Icon: Zap, l: "Alta" }, { v: "normal", Icon: Smile, l: "Normal" }, { v: "baixa", Icon: Moon, l: "Baixa" },
];

function Planejamento() {
  const navigate = useNavigate();
  const today = todayIso();
  const routineQ = useRoutine();
  const schedQ = useSchedule(today);
  const tasksQ = useTasks();
  const catsQ = useCategories();
  const splitQ = useSplit();
  const planQ = useDayPlan(today);
  const generate = useGenerateDay();
  const [disposicao, setDisp] = useState<Disposicao>("normal");
  const [tempo, setTempo] = useState<Tempo>("completo");
  const [prioridade, setPrio] = useState("");
  const [pausas, setPausas] = useState(true);
  const loading = generate.isPending;

  // Reaproveita as preferências já salvas para hoje.
  const plan = planQ.data;
  useEffect(() => {
    if (!plan) return;
    setDisp(plan.disposicao); setTempo(plan.tempo); setPrio(plan.prioridade); setPausas(plan.pausas);
  }, [plan?.id]);

  const gerar = () => {
    generate.mutate(
      { mode: "planejamento", date: today, disposicao, tempo, prioridade, pausas },
      { onSuccess: () => navigate({ to: "/planejamento/dia" }), onError: (e) => toast.error(`Não consegui gerar o plano: ${e.message}`) },
    );
  };

  // Prévia do dia: o plano já gerado ou, antes disso, a rotina-base + tarefas de hoje.
  const generated = (schedQ.data?.length ?? 0) > 0;
  const compId = (catsQ.data ?? []).find((c) => c.slug === "comp")?.id;
  const allTasks = tasksQ.data ?? [];
  // Compromissos do calendário com horário já aparecem na prévia, no meio da rotina.
  const compPreview = useMemo(() => compromissosForDay(allTasks, compId, today), [allTasks, compId, today]);
  const agenda = useMemo(
    () => (generated ? schedQ.data! : [...(routineQ.data ?? []), ...compPreview].sort((a, b) => a.time.localeCompare(b.time))),
    [generated, schedQ.data, routineQ.data, compPreview],
  );
  const pending = allTasks.filter((t) => !t.done);
  const compToday = pending.filter((t) => t.category_id === compId && t.due_date === today).length;
  const overdue = pending.filter((t) => t.due_date && t.due_date < today).length;
  const count = (k: string) => agenda.filter((a) => a.kind === k).length;
  const nTarefas = count("tarefa") + (generated ? 0 : pending.filter((t) => t.category_id !== compId && t.due_date === today).length);
  const nComp = count("compromisso") + (generated ? 0 : compToday - compPreview.length);
  const nHabitos = count("habito");
  const todaySplit = splitQ.data?.find((x) => x.weekday === new Date().getDay());
  const doneCount = generated ? schedQ.data!.filter((a) => a.done).length : 0;
  const dayPct = generated ? Math.round((doneCount / schedQ.data!.length) * 100) : 0;

  const stats = [
    { Icon: CheckCircle2, n: nTarefas, t: "Tarefas", c: "cyan" },
    { Icon: CalendarDays, n: nComp, t: "Compromissos", c: "violet" },
    { Icon: Heart, n: nHabitos, t: "Hábitos", c: "emerald" },
  ];
  const integr = [
    { Icon: CalendarDays, t: "Calendário", d: `${nComp} compromisso${nComp === 1 ? "" : "s"} encontrado${nComp === 1 ? "" : "s"}` },
    { Icon: ListChecks, t: "Tarefas", d: `${pending.length} tarefa${pending.length === 1 ? "" : "s"} pendente${pending.length === 1 ? "" : "s"}` },
    { Icon: Heart, t: "Hábitos", d: `${nHabitos} hábito${nHabitos === 1 ? "" : "s"} previsto${nHabitos === 1 ? "" : "s"}` },
    { Icon: Dumbbell, t: "Saúde", d: todaySplit?.workout_id ? `Treino: ${todaySplit.title}` : (todaySplit?.title ?? "Sem treino cadastrado") },
  ];

  return (
    <PlanShell>
      {/* Hero */}
      <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)]">
        <div className="animate-rise text-center lg:text-left" style={{ animationDelay: ".05s" }}>
          <p className="mono-caps mb-3 !text-cyan">Planejamento inteligente</p>
          <h1 className="font-serif text-4xl leading-[1.02] tracking-tight sm:text-[clamp(2.2rem,3.6vw,3.6rem)]">
            Vamos planejar<br />seu dia de <span className="text-gradient">hoje?</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground lg:mx-0">
            Analisei sua agenda, suas tarefas e seus hábitos. Preparei um plano personalizado para você ser mais produtiva, cuidar de você e manter o equilíbrio. <span className="text-violet">✦</span>
          </p>
        </div>
        <div className="relative mx-auto aspect-[4/3] w-[clamp(220px,22vw,340px)] animate-rise" style={{ animationDelay: ".15s" }}>
          <div className="pointer-events-none absolute inset-0 scale-[1.3]">
            <div className="absolute inset-[18%] rounded-full blur-3xl" style={{ background: `color-mix(in oklab, var(--${loading ? "emerald" : "violet"}) 26%, transparent)` }} />
            <LivingOrb active={loading} />
          </div>
        </div>
        <div className="flex flex-col gap-3 animate-rise" style={{ animationDelay: ".25s" }}>
          <div className="grid grid-cols-3 gap-3">
            {stats.map(({ Icon, n, t, c }) => (
              <div key={t} className="glass flex items-center gap-3 rounded-2xl p-3.5 transition hover:shadow-[0_0_28px_-10px_var(--glow)]" style={tint(c)}>
                <span className="icon-tile hidden h-11 w-11 shrink-0 !rounded-full sm:grid"><Icon size={20} /></span>
                <span><span className="block font-display text-2xl font-semibold leading-none">{String(n).padStart(2, "0")}</span><span className="text-xs text-muted-foreground">{t}</span></span>
              </div>
            ))}
          </div>
          <div className="glass rounded-2xl px-5 py-4">
            <div className="mb-3 flex justify-between text-sm"><span className="text-muted-foreground">Progresso do dia</span><span className="font-semibold">{dayPct} %</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-brand transition-all duration-700" style={{ width: `${dayPct}%` }} /></div>
          </div>
        </div>
      </div>

      {/* Panels */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.55fr)_minmax(0,1fr)]">
        <Panel c="cyan" className="flex flex-col gap-5" style={{ animationDelay: ".3s" }}>
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <span className="icon-tile h-11 w-11 shrink-0 !rounded-full"><ScanFace size={20} /></span>
            <div><h2 className="font-display text-lg font-semibold">Antes de planejar…</h2><p className="text-sm text-muted-foreground">Me conte como você está hoje para personalizar seu plano.</p></div>
          </div>

          <div>
            <p className="mb-2.5 text-sm font-medium">Como está sua disposição?</p>
            <div className="grid grid-cols-3 gap-2">
              {disp.map(({ v, Icon, l }) => (
                <button key={v} type="button" onClick={() => setDisp(v)} aria-pressed={disposicao === v}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-sm transition ${disposicao === v ? "border-cyan bg-cyan/10 text-cyan shadow-[0_0_22px_-6px_var(--cyan)]" : "border-border text-muted-foreground hover:border-cyan/50 hover:text-foreground"}`}>
                  <Icon size={18} /> {l}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2.5 block text-sm font-medium">Quanto tempo você tem disponível?</span>
            <span className="relative flex items-center">
              <Clock size={16} className="pointer-events-none absolute left-3.5 text-muted-foreground" />
              <select value={tempo} onChange={(e) => setTempo(e.target.value as Tempo)}
                className="w-full appearance-none rounded-xl border border-border bg-background/40 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan">
                {(Object.keys(tempoLabels) as Tempo[]).map((k) => <option key={k} value={k} className="bg-card">{tempoLabels[k]}</option>)}
              </select>
            </span>
          </label>

          <label className="block">
            <span className="mb-2.5 block text-sm font-medium">Alguma prioridade especial hoje?</span>
            <textarea value={prioridade} onChange={(e) => setPrio(e.target.value)} rows={3} maxLength={120}
              placeholder="Ex: Finalizar um projeto, resolver pendências, estudar…"
              className="w-full resize-none rounded-xl border border-border bg-background/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/70 focus:border-cyan" />
          </label>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Incluir momentos de descanso?</span>
            <button type="button" role="switch" aria-checked={pausas} onClick={() => setPausas((p) => !p)}
              className={`relative h-7 w-12 rounded-full transition ${pausas ? "bg-cyan shadow-[0_0_16px_-2px_var(--cyan)]" : "bg-secondary"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-background transition-all ${pausas ? "left-6" : "left-1"}`} />
            </button>
          </div>

          <button type="button" onClick={gerar} disabled={loading}
            className="group mt-auto flex items-center justify-center gap-3 rounded-full py-4 font-semibold text-primary-foreground shadow-[0_0_40px_-10px_var(--cyan)] transition hover:shadow-[0_0_50px_-6px_var(--violet)] disabled:opacity-80"
            style={{ background: "linear-gradient(90deg, var(--cyan), oklch(0.66 0.19 265) 55%, var(--violet))" }}>
            <Sparkles size={18} className={loading ? "animate-spin" : ""} />
            {loading ? "Gerando seu plano…" : "Gerar planejamento"}
            {!loading && <ArrowRight size={18} className="transition group-hover:translate-x-1" />}
          </button>
        </Panel>

        <Panel c="cyan" style={{ animationDelay: ".38s" }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="icon-tile h-11 w-11 !rounded-full"><CalendarDays size={20} /></span>
              <h2 className="font-display text-lg font-semibold">Seu dia de hoje</h2>
            </div>
            <span className="text-sm font-medium text-muted-foreground">{todayLabel()}</span>
          </div>
          <ol className="relative space-y-2 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-px before:bg-cyan/40">
            {agenda.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Sua rotina-base está vazia.</li>}
            {agenda.slice(0, 8).map((a) => {
              const I = getIcon(a.icon);
              return (
                <li key={a.id} className="relative flex items-center gap-3 pl-6">
                  <span className="absolute left-0.5 h-3 w-3 rounded-full border-2 border-cyan bg-background" />
                  <span className="w-16 shrink-0 rounded-full border border-cyan/40 py-1.5 text-center text-sm font-semibold">{hhmm(a.time)}</span>
                  <span className="icon-tile hidden h-9 w-9 shrink-0 !rounded-full sm:grid" style={tint("cyan")}><I size={16} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.title}</span><span className="block truncate text-xs text-muted-foreground">{a.description}</span></span>
                  <span className="tag hidden shrink-0 sm:inline" style={{ "--glow": colorVar(a.color) } as React.CSSProperties}>{a.tag}</span>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 text-center text-xs text-muted-foreground">{generated ? "Plano de hoje já gerado · gere de novo para refazer" : "Prévia · o plano completo é montado ao gerar"}</p>
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel c="violet" style={{ animationDelay: ".46s" }}>
            <h2 className="mb-3 flex items-center gap-2.5 font-display text-lg font-semibold"><Sparkles size={20} className="text-violet" /> Análise do Presence</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">Hoje você tem {nTarefas} tarefa{nTarefas === 1 ? "" : "s"}, {nComp} compromisso{nComp === 1 ? "" : "s"} e {nHabitos} hábito{nHabitos === 1 ? "" : "s"} previstos{todaySplit?.workout_id ? `, além do treino ${todaySplit.title}` : ""}.</p>
            <div className="mt-4 flex gap-3 border-t border-border pt-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: colorVar("amber") }} />
              <p className="text-sm"><span className="font-semibold" style={{ color: colorVar("amber") }}>Atenção</span><br /><span className="text-muted-foreground">{overdue > 0 ? `Você tem ${overdue} tarefa${overdue === 1 ? "" : "s"} atrasada${overdue === 1 ? "" : "s"}. Recomendo encaixar ainda hoje.` : "Nenhuma tarefa atrasada. Bom trabalho!"}</span></p>
            </div>
            <div className="mt-4 flex gap-3 border-t border-border pt-4">
              <Lightbulb size={18} className="mt-0.5 shrink-0 text-cyan" />
              <p className="text-sm"><span className="font-semibold text-cyan">Sugestão inteligente</span><br /><span className="text-muted-foreground">Agrupe tarefas semelhantes no período da manhã para ganhar foco e produtividade.</span></p>
            </div>
          </Panel>
          <Panel c="cyan" style={{ animationDelay: ".54s" }}>
            <h2 className="mb-3 flex items-center gap-2.5 font-display text-lg font-semibold"><Link2 size={20} className="text-cyan" /> Integrações do planejamento</h2>
            <ul className="space-y-2">
              {integr.map(({ Icon, t, d }) => (
                <li key={t} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                  <span className="icon-tile h-9 w-9 shrink-0 !rounded-xl" style={tint("violet")}><Icon size={16} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
                  <CheckCircle2 size={20} className="text-emerald" />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </PlanShell>
  );
}
