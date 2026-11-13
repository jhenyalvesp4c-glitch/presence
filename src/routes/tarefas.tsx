import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlarmClock, BarChart3, CalendarDays, Check, CheckCircle2, Clock, Flag, Layers, ListTodo, ListChecks, Loader2, Plus, Search,
  SlidersHorizontal, Sparkles, Target, Trash2, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PlanShell, Panel, colorVar } from "@/components/PlanShell";
import holo from "@/assets/tarefas-holo.jpg";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, format, isSameDay, isSameMonth, isSameWeek, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fromIsoDate as fromIso, hhmm, isoDate as iso } from "@/lib/dates";
import { getIcon } from "@/lib/icons";
import type { Color, Priority } from "@/lib/types";
import { useCategories, useCreateCategory, useCreateTask, useDeleteTask, useTasks, useToggleTask, useUpdateTask } from "@/lib/data/tasks";
import { TaskEditDialog } from "@/components/TaskEditDialog";
import { ListsView } from "@/components/lists/ListsView";

const T0 = new Date(); T0.setHours(0, 0, 0, 0);

export const Route = createFileRoute("/tarefas")({
  validateSearch: (s: Record<string, unknown>): { aba?: "listas" } => (s["aba"] === "listas" ? { aba: "listas" } : {}),
  head: () => ({
    meta: [
      { title: "Presence · Minhas tarefas" },
      { name: "description", content: "Central de tarefas do Presence: rotina, compromissos e autocuidado em um só lugar." },
      { property: "og:title", content: "Presence · Minhas tarefas" },
      { property: "og:description", content: "Organize rotina, compromissos e autocuidado com o Presence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TarefasPage,
});

type C = Color;
type Row = {
  id: string; t: string; d: string; tag: string; c: C; Icon: ReturnType<typeof getIcon>; time: string; done: boolean; cat: string; date: string; priority: Priority;
};

const tabs = ["Hoje", "Esta semana", "Este mês", "Todas"];
const weekLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const RANK: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };
const prioLabel: Record<Priority, string> = { alta: "Prioridade alta", media: "Prioridade normal", baixa: "Prioridade baixa" };
const prioNext: Record<Priority, Priority> = { media: "alta", alta: "baixa", baixa: "media" };

function TarefasPage() {
  const { aba } = Route.useSearch();
  const navigate = useNavigate();
  const catsQ = useCategories();
  const tasksQ = useTasks();
  const createTask = useCreateTask();
  const toggle = useToggleTask();
  const del = useDeleteTask();
  const createCat = useCreateCategory();
  const updateTask = useUpdateTask();
  const [editingId, setEditingId] = useState<string | null>(null);

  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [newCat, setNewCat] = useState("");
  const [newPrio, setNewPrio] = useState<Priority>("media");
  const [time, setTime] = useState("");
  const [day, setDay] = useState<Date>(T0);
  const [newDate, setNewDate] = useState<Date | undefined>();
  const [addingCat, setAddingCat] = useState(false);
  const [catName, setCatName] = useState("");

  const categories = catsQ.data ?? [];
  const editingTask = (tasksQ.data ?? []).find((t) => t.id === editingId);
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const compId = categories.find((c) => c.slug === "comp")?.id;

  const tasks: Row[] = useMemo(
    () =>
      (tasksQ.data ?? [])
        .map((t): Row => {
          const c = t.category_id ? catById.get(t.category_id) : undefined;
          return {
            id: t.id, t: t.title, d: t.description ?? c?.name ?? "Sem categoria", tag: c ? c.name.split(" ")[0]! : "Tarefa",
            c: (c?.color ?? "cyan") as C, Icon: getIcon(c?.icon ?? "check"), time: t.due_time ? hhmm(t.due_time) : "—",
            done: t.done, cat: t.category_id ?? "", date: t.due_date ?? "", priority: t.priority,
          };
        })
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [tasksQ.data, catById],
  );

  const cats = useMemo(
    () =>
      categories.map((c) => {
        const mine = tasks.filter((t) => t.cat === c.id);
        return { id: c.id, t: c.name, Icon: getIcon(c.icon), c: c.color as C, n: mine.length, p: mine.length ? Math.round((mine.filter((t) => t.done).length / mine.length) * 100) : 0 };
      }),
    [categories, tasks],
  );
  const catId = newCat || cats[0]?.id || "";

  // Tarefas sem data aparecem em "Hoje" (quando o dia é hoje) e em "Todas".
  const onDay = (t: Row) => (t.date ? isSameDay(fromIso(t.date), day) : isSameDay(day, T0));
  const inRange = (t: Row) => {
    if (tab === 3) return true;
    if (!t.date) return tab === 0 && isSameDay(day, T0);
    const d = fromIso(t.date);
    return tab === 0 ? isSameDay(d, day) : tab === 1 ? isSameWeek(d, day, { weekStartsOn: 1 }) : isSameMonth(d, day);
  };
  const dayTasks = tasks.filter(onDay);
  const taskDays = useMemo(() => [...new Set(tasks.map((t) => t.date).filter(Boolean))].map(fromIso), [tasks]);
  const upcoming = tasks.filter((t) => t.date && !t.done && fromIso(t.date) >= T0 && t.cat === compId).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 3);
  const done = tasks.filter((t) => t.done).length;
  const pct = dayTasks.length ? Math.round((dayTasks.filter((t) => t.done).length / dayTasks.length) * 100) : 0;
  const shown = useMemo(() => tasks.filter((t) => inRange(t) && (!cat || t.cat === cat) && t.t.toLowerCase().includes(q.toLowerCase())), [tasks, cat, q, tab, day]);
  const lastTime = shown.length ? shown.map((t) => t.time).filter((t) => t !== "—").sort().at(-1) : null;

  const weekStart = startOfWeek(day, { weekStartsOn: 1 });
  const week = weekLabels.map((label, i) => {
    const d = addDays(weekStart, i);
    const mine = tasks.filter((t) => t.date && isSameDay(fromIso(t.date), d));
    return [label, mine.length, mine.length > 0 && mine.every((t) => t.done) ? 1 : 0] as const;
  });
  const dayPrios = dayTasks.filter((t) => !t.done).sort((a, b) => RANK[a.priority] - RANK[b.priority]).slice(0, 3);

  const add = () => {
    if (!title.trim() || createTask.isPending) return;
    createTask.mutate(
      { title: title.trim(), category_id: catId || null, priority: newPrio, due_date: iso(newDate ?? day), due_time: time || null },
      {
        onSuccess: () => {
          if (newDate) setDay(newDate);
          setTitle(""); setTime(""); setNewDate(undefined); setNewPrio("media");
          toast.success("Tarefa adicionada");
        },
        onError: (e) => toast.error(`Não consegui salvar: ${e.message}`),
      },
    );
  };
  const addCategory = () => {
    if (!catName.trim()) return;
    createCat.mutate(
      { name: catName, color: "violet", icon: "star" },
      {
        onSuccess: (c) => { setCatName(""); setAddingCat(false); setNewCat(c.id); toast.success("Categoria criada"); },
        onError: (e) => toast.error(`Não consegui criar: ${e.message}`),
      },
    );
  };

  const stats = [
    { n: tasks.length, l: "Tarefas", Icon: ListTodo, c: "cyan" },
    { n: tasks.length - done, l: "Pendentes", Icon: Clock, c: "violet" },
    { n: done, l: "Concluídas", Icon: CheckCircle2, c: "emerald" },
  ];

  return (
    <PlanShell active={3}>
      {/* HERO */}
      <section className="relative grid items-center gap-6 overflow-hidden rounded-3xl px-2 lg:grid-cols-[1.1fr_0.9fr_1.4fr]">
        <div className="animate-rise">
          <p className="mono-caps">Central de tarefas</p>
          <h1 className="mt-2 font-serif text-5xl leading-none md:text-6xl">Minhas <span className="text-gradient italic">tarefas</span></h1>
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">Organize sua rotina, compromissos, autocuidado e tudo o que precisa fazer em um só lugar.</p>
        </div>
        <div className="relative mx-auto h-44 w-64">
          <div className="absolute inset-6 rounded-full bg-violet/30 blur-3xl animate-pulse-ring" />
          <img src={holo} alt="Prancheta holográfica de tarefas" width={1024} height={768}
            className="holo-float relative h-full w-full object-contain mix-blend-screen [mask-image:radial-gradient(closest-side,black_65%,transparent)]" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {stats.map(({ n, l, Icon, c }, i) => (
            <div key={l} className="accent-card flex items-center gap-3 px-4 py-3 animate-rise" style={{ "--glow": `var(--${c})`, animationDelay: `${i * 0.1}s` } as React.CSSProperties}>
              <span className="icon-tile h-11 w-11 rounded-full"><Icon size={20} /></span>
              <span><b className="block font-display text-2xl leading-none">{n}</b><span className="text-xs text-muted-foreground">{l}</span></span>
            </div>
          ))}
          <Ring pct={pct} />
        </div>
      </section>

      {/* TAREFAS | LISTAS */}
      <div className="glass mx-auto flex w-full max-w-sm gap-1 rounded-2xl p-1.5" role="tablist" data-testid="aba-tarefas-listas">
        {([["tarefas", "Tarefas", ListChecks], ["listas", "Listas", ListTodo]] as const).map(([k, t, Icon]) => {
          const on = (aba ?? "tarefas") === k;
          return (
            <button key={k} role="tab" aria-selected={on} onClick={() => void navigate({ to: "/tarefas", search: k === "listas" ? { aba: "listas" } : {}, replace: true })}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm transition ${on ? "bg-cyan/10 text-cyan shadow-[inset_0_0_0_1px_var(--cyan)]" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon size={15} /> {t}
            </button>
          );
        })}
      </div>
      {aba === "listas" ? <ListsView /> : (
      <>
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <Panel c="violet" className="flex flex-col">
          <Head Icon={Layers} t="Categorias" s="Organize por áreas da sua vida." />
          <ul className="mt-4 space-y-1.5">
            {cats.map(({ id, t, Icon, c, n }) => {
              const on = cat === id;
              return (
                <li key={id}>
                  <button onClick={() => setCat(on ? null : id)} style={{ "--glow": colorVar(c) } as React.CSSProperties}
                    className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left text-sm transition hover:translate-x-1 ${on ? "border-[color-mix(in_oklab,var(--glow)_60%,transparent)] bg-[color-mix(in_oklab,var(--glow)_12%,transparent)] shadow-[0_0_24px_-10px_var(--glow)]" : "border-border bg-secondary/30 hover:border-[color-mix(in_oklab,var(--glow)_40%,transparent)]"}`}>
                    <Icon size={17} className="text-[color:var(--glow)] transition group-hover:scale-110" />
                    <span className="flex-1 truncate">{t}</span>
                    <span className="font-mono text-xs text-muted-foreground">{n}</span>
                    <span className="grid h-5 w-5 place-items-center rounded-md bg-[color:var(--glow)] text-background"><Check size={13} strokeWidth={3} /></span>
                  </button>
                </li>
              );
            })}
          </ul>
          {addingCat ? (
            <form onSubmit={(e) => { e.preventDefault(); addCategory(); }} className="mt-4 flex items-center gap-2 rounded-2xl border border-violet/50 p-1.5 pl-3">
              <input autoFocus value={catName} onChange={(e) => setCatName(e.target.value)} maxLength={60} placeholder="Nome da categoria"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              <button type="submit" disabled={createCat.isPending} className="rounded-xl bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">Criar</button>
            </form>
          ) : (
            <button onClick={() => setAddingCat(true)} className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-2.5 text-sm text-muted-foreground transition hover:border-violet hover:text-violet">
              <Plus size={15} /> Nova categoria
            </button>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="glass flex gap-1 rounded-2xl p-1.5">
            {tabs.map((t, i) => (
              <button key={t} onClick={() => setTab(i)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-sm transition ${tab === i ? "bg-cyan/10 text-cyan shadow-[inset_0_0_0_1px_var(--cyan),0_0_20px_-6px_var(--cyan)]" : "text-muted-foreground hover:text-foreground"}`}>
                <CalendarDays size={15} /> {t}
              </button>
            ))}
          </div>
          <Panel c="cyan" className="scan-line flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Head Icon={CalendarDays} t={`Tarefas · ${tabs[tab]}`} s={cat ? `Filtrando: ${cats.find((c) => c.id === cat)?.t}` : cap(format(day, "EEEE, d 'de' MMMM", { locale: ptBR }))} />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-sm focus-within:border-cyan">
                  <Search size={14} className="text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tarefa..." className="w-32 bg-transparent outline-none placeholder:text-muted-foreground" />
                </label>
                <button aria-label="Filtros" className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground hover:text-cyan"><SlidersHorizontal size={14} /></button>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-border">
              {shown.map((tk, i) => (
                <li key={tk.id} style={{ "--glow": colorVar(tk.c), animationDelay: `${i * 0.05}s` } as React.CSSProperties}
                  className="group grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 py-3 animate-rise sm:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto]">
                  <button aria-label="Concluir" onClick={() => toggle.mutate({ id: tk.id, done: !tk.done }, { onError: (e) => toast.error(e.message) })}
                    className={`grid h-5 w-5 place-items-center rounded-md border transition ${tk.done ? "border-cyan bg-cyan text-background shadow-[0_0_12px_var(--cyan)]" : "border-muted-foreground/50 hover:border-cyan"}`}>
                    {tk.done && <Check size={13} strokeWidth={3} />}
                  </button>
                  <span className="flex items-center gap-2.5">
                    <span className="h-8 w-0.5 rounded-full bg-[color:var(--glow)] shadow-[0_0_8px_var(--glow)]" />
                    <tk.Icon size={20} className="text-[color:var(--glow)] transition group-hover:scale-110" />
                  </span>
                  <button type="button" onClick={() => setEditingId(tk.id)} aria-label={`Editar tarefa ${tk.t}`} className="min-w-0 text-left">
                    <b className={`block truncate text-sm font-semibold transition ${tk.done ? "text-muted-foreground line-through" : ""}`}>{tk.t}</b>
                    <span className="block truncate text-xs text-muted-foreground">{tk.d}</span>
                  </button>
                  <span className="tag hidden sm:inline">{tk.tag}</span>
                  <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">{tab !== 0 && tk.date && <span className="text-cyan">{format(fromIso(tk.date), "dd/MM")}</span>}<Clock size={13} /> {tk.time}</span>
                  <span className="hidden items-center gap-2 text-muted-foreground sm:flex">
                    <AlarmClock size={15} className="text-[color:var(--glow)]" />
                    <button aria-label="Excluir tarefa" onClick={() => del.mutate(tk.id, { onError: (e) => toast.error(e.message) })} className="opacity-40 transition hover:text-destructive group-hover:opacity-100"><Trash2 size={15} /></button>
                  </span>
                </li>
              ))}
              {tasksQ.isPending && <li className="flex justify-center py-10"><Loader2 className="animate-spin text-cyan" /></li>}
              {tasksQ.isError && <li className="py-10 text-center text-sm text-destructive">Não consegui carregar as tarefas: {tasksQ.error.message}</li>}
              {tasksQ.isSuccess && shown.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">{tasks.length === 0 ? "Você ainda não tem tarefas. Crie a primeira ao lado." : "Nenhuma tarefa encontrada."}</li>}
            </ul>
            <div className="relative flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
              <div className="absolute inset-x-10 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan/25 to-transparent" />
              <div className="relative grid h-16 w-16 place-items-center">
                <span className="absolute inset-0 rounded-full border border-cyan/30 animate-pulse-ring" />
                <span className="absolute inset-2 rounded-full bg-cyan/10 blur-md" />
                <Clock size={24} className="relative text-cyan" />
              </div>
              <p className="relative mono-caps text-[10px] tracking-[0.25em] text-muted-foreground">
                {lastTime ? `Última tarefa às ${lastTime}` : "Nada marcado neste dia"}
              </p>
            </div>
            <div className="flex items-center gap-3 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              <span className="mono-caps whitespace-nowrap">{shown.filter((t) => t.done).length}/{shown.length} concluídas</span>
              <span className="h-px flex-1 bg-gradient-to-r from-cyan/40 via-violet/20 to-transparent" />
              <Sparkles size={12} className="text-cyan animate-pulse" />
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel c="violet">
            <Head Icon={Sparkles} t="Criar nova tarefa" s="Adicione à sua rotina." />
            <div className="mt-4 space-y-2.5">
              <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Título da tarefa" maxLength={80}
                className="w-full rounded-xl border border-border bg-secondary/40 px-3.5 py-2.5 text-sm outline-none transition focus:border-violet focus:shadow-[0_0_18px_-6px_var(--violet)]" />
              <select value={catId} onChange={(e) => setNewCat(e.target.value)} className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none focus:border-violet">
                {cats.map((c) => <option key={c.id} value={c.id} className="bg-popover">{c.t}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button className={`flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-left text-sm outline-none hover:border-violet ${newDate ? "" : "text-muted-foreground"}`}>
                    <CalendarDays size={14} /> {format(newDate ?? day, "dd/MM/yyyy")}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newDate ?? day} onSelect={setNewDate} locale={ptBR} initialFocus className="pointer-events-auto p-3" />
                </PopoverContent>
              </Popover>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full min-w-0 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none [color-scheme:dark] focus:border-violet" />
              </div>
              <button type="button" onClick={() => setNewPrio(prioNext[newPrio])} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:border-violet"><Flag size={14} style={{ color: newPrio === "alta" ? colorVar("rose") : newPrio === "baixa" ? colorVar("emerald") : undefined }} /> {prioLabel[newPrio]}</button>
              <button onClick={add} disabled={createTask.isPending} className="shine flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-8px_var(--cyan)] transition hover:scale-[1.02] disabled:opacity-60">
                {createTask.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Adicionar tarefa
              </button>
            </div>
          </Panel>
          <Panel c="cyan">
            <Head Icon={CalendarDays} t="Calendário" s="Escolha um dia para ver as tarefas." />
            <Calendar mode="single" selected={day} onSelect={(d) => d && setDay(d)} locale={ptBR} weekStartsOn={1}
              modifiers={{ hasTask: taskDays }} modifiersClassNames={{ hasTask: "task-dot" }}
              className="mx-auto mt-2 bg-transparent p-0 [--cell-size:2.1rem]" />
            {!isSameDay(day, T0) && <button onClick={() => setDay(T0)} className="mt-2 w-full rounded-xl border border-border py-1.5 text-xs text-cyan hover:border-cyan">Voltar para hoje</button>}
          </Panel>
          <Panel c="cyan">
            <Head Icon={CalendarDays} t="Próximos compromissos" />
            <ul className="mt-3 space-y-2.5 text-sm">
              {upcoming.map(({ id, t: tt, date, time: tm, c: cc }) => [id, tt, `${isSameDay(fromIso(date), T0) ? "Hoje" : cap(format(fromIso(date), "dd/MM", { locale: ptBR }))} · ${tm}`, cc] as const).map(([id, t, w, c]) => (
                <li key={id} onClick={() => { const tk = tasks.find((x) => x.id === id)!; setDay(fromIso(tk.date)); setTab(0); }} className="flex cursor-pointer items-center gap-3 hover:text-cyan">
                  <span className="h-2 w-2 rounded-full animate-pulse-ring" style={{ background: `var(--${c})`, boxShadow: `0 0 10px var(--${c})` }} />
                  <span className="flex-1 font-medium">{t}</span><span className="font-mono text-xs text-muted-foreground">{w}</span>
                </li>
              ))}
            {upcoming.length === 0 && <li className="text-xs text-muted-foreground">Nenhum compromisso por vir.</li>}
            </ul>
          </Panel>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel c="cyan">
          <Head Icon={BarChart3} t="Progresso por categoria" s="Andamento das suas tarefas." />
          <ul className="mt-4 space-y-3">
            {[...cats].sort((a, b) => b.n - a.n).slice(0, 5).map(({ t, Icon, c, p }) => (
              <li key={t} className="grid grid-cols-[18px_120px_1fr_36px] items-center gap-3 text-sm" style={{ "--glow": colorVar(c) } as React.CSSProperties}>
                <Icon size={16} className="text-[color:var(--glow)]" /><span className="truncate">{t}</span>
                <span className="h-2 overflow-hidden rounded-full bg-secondary"><span className="bar-grow block h-full rounded-full bg-[color:var(--glow)] shadow-[0_0_10px_var(--glow)]" style={{ width: `${p}%` }} /></span>
                <span className="text-right font-mono text-xs text-muted-foreground">{p}%</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel c="violet">
          <Head Icon={CalendarDays} t="Visão da semana" s="Distribuição das tarefas." />
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {week.map(([d, n, ok], i) => {
              const today = isSameDay(addDays(weekStart, i), T0);
              return (
                <div key={d} className={`flex flex-col items-center gap-1.5 rounded-xl border py-2.5 text-xs transition hover:-translate-y-1 ${today ? "border-cyan bg-cyan/10 shadow-[0_0_20px_-6px_var(--cyan)]" : "border-border bg-secondary/30"}`}>
                  <span className="text-muted-foreground">{d}</span><b className="font-display text-base">{n}</b>
                  <span className={`grid h-5 w-5 place-items-center rounded-full border ${ok ? "border-cyan text-cyan" : "border-muted-foreground/40"}`}>{ok ? <Check size={11} strokeWidth={3} /> : null}</span>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel c="violet">
          <Head Icon={Target} t="Prioridades do dia" s="Suas 3 principais tarefas." />
          <ol className="mt-4 space-y-2">
            {dayPrios.length === 0 && <li className="rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">Sem pendências para este dia.</li>}
            {dayPrios.map(({ id, t }, i) => (
              <li key={id} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm transition hover:border-violet">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-brand font-mono text-xs text-primary-foreground">{i + 1}</span>
                <span className="flex-1">{t}</span><Zap size={14} className="text-violet" />
              </li>
            ))}
          </ol>
        </Panel>
      </div>
      </>
      )}
      {editingTask && (
        <TaskEditDialog task={editingTask} categories={categories} saving={updateTask.isPending} onClose={() => setEditingId(null)}
          onSave={(patch) => updateTask.mutate({ id: editingTask.id, patch }, { onSuccess: () => { setEditingId(null); toast.success("Tarefa atualizada"); }, onError: (e) => toast.error(e.message) })}
          onDelete={() => del.mutate(editingTask.id, { onSuccess: () => { setEditingId(null); toast.success("Tarefa excluída"); }, onError: (e) => toast.error(e.message) })} />
      )}
    </PlanShell>
  );
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function Head({ Icon, t, s }: { Icon: ReturnType<typeof getIcon>; t: string; s?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="icon-tile h-10 w-10 rounded-full"><Icon size={18} /></span>
      <span><b className="block font-display text-base">{t}</b>{s && <span className="text-xs text-muted-foreground">{s}</span>}</span>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <div className="relative grid h-28 w-28 place-items-center">
      <svg viewBox="0 0 110 110" className="absolute inset-0 -rotate-90 drop-shadow-[0_0_10px_var(--cyan)]">
        <defs><linearGradient id="rg" x1="0" x2="1"><stop offset="0" stopColor="var(--cyan)" /><stop offset="1" stopColor="var(--violet)" /></linearGradient></defs>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--secondary)" strokeWidth="7" />
        <circle cx="55" cy="55" r={r} fill="none" stroke="url(#rg)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <span className="text-center"><b className="block font-display text-2xl">{pct}%</b><span className="text-[10px] text-muted-foreground">Progresso do dia</span></span>
    </div>
  );
}
