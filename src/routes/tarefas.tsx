import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlarmClock, BarChart3, Book, CalendarDays, Check, CheckCircle2, Clock, Dumbbell, Flag, Flower2, GripVertical, Heart,
  Home, Laptop, Layers, ListTodo, Plus, Search, SlidersHorizontal, Sparkles, Sun, Target, Utensils, Wallet, Zap,
} from "lucide-react";
import { PlanShell, Panel, colorVar } from "@/components/PlanShell";
import holo from "@/assets/tarefas-holo.jpg";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { addDays, format, isSameDay, isSameMonth, isSameWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

const T0 = new Date(); T0.setHours(0, 0, 0, 0);
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const fromIso = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y!, m! - 1, d!); };

export const Route = createFileRoute("/tarefas")({
  head: () => ({
    meta: [
      { title: "Presence · Minhas tarefas" },
      { name: "description", content: "Central de tarefas da Presence: rotina, compromissos e autocuidado em um só lugar." },
      { property: "og:title", content: "Presence · Minhas tarefas" },
      { property: "og:description", content: "Organize rotina, compromissos e autocuidado com a Presence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TarefasPage,
});

type C = "cyan" | "violet" | "emerald" | "amber" | "rose";
const cats: { id: string; t: string; Icon: typeof Home; c: C; n: number; p: number }[] = [
  { id: "rotina", t: "Rotina do dia", Icon: Sun, c: "cyan", n: 6, p: 80 },
  { id: "comp", t: "Compromissos", Icon: CalendarDays, c: "violet", n: 3, p: 66 },
  { id: "auto", t: "Autocuidado", Icon: Flower2, c: "rose", n: 4, p: 60 },
  { id: "saude", t: "Saúde & Treino", Icon: Dumbbell, c: "emerald", n: 3, p: 70 },
  { id: "trab", t: "Trabalho / Projetos", Icon: Laptop, c: "cyan", n: 7, p: 75 },
  { id: "casa", t: "Casa & Organização", Icon: Home, c: "amber", n: 4, p: 50 },
  { id: "fin", t: "Financeiro", Icon: Wallet, c: "amber", n: 2, p: 40 },
  { id: "pes", t: "Pessoal", Icon: Heart, c: "violet", n: 3, p: 33 },
];

type Task = { id: number; t: string; d: string; tag: string; c: C; Icon: typeof Home; time: string; done: boolean; cat: string; date: string };
const initial: Task[] = ([
  { id: 1, t: "Rotina da manhã", d: "Higiene, skincare e organização", tag: "Rotina", c: "cyan", Icon: Sun, time: "09:00", done: true, cat: "rotina" },
  { id: 2, t: "Treino – Glúteo e Posterior", d: "Academia · ~60 min", tag: "Saúde", c: "emerald", Icon: Dumbbell, time: "10:00", done: true, cat: "saude" },
  { id: 3, t: "Responder demandas", d: "E-mails, suporte e ajustes", tag: "Trabalho", c: "amber", Icon: Laptop, time: "11:30", done: false, cat: "trab" },
  { id: 4, t: "Almoço e pausa", d: "Alimentação e descanso", tag: "Rotina", c: "cyan", Icon: Utensils, time: "12:30", done: false, cat: "rotina" },
  { id: 5, t: "Autocuidado", d: "Cabelo, banho e cuidados pessoais", tag: "Autocuidado", c: "rose", Icon: Flower2, time: "18:00", done: false, cat: "auto" },
  { id: 6, t: "Organizar a casa", d: "Limpeza rápida e manter tudo em ordem", tag: "Casa", c: "amber", Icon: Home, time: "19:00", done: false, cat: "casa" },
  { id: 7, t: "Leitura", d: "Tempo livre · 30 min", tag: "Pessoal", c: "violet", Icon: Book, time: "21:00", done: false, cat: "pes" },
  { id: 8, t: "Reunião de alinhamento", d: "Google Meet", tag: "Compromisso", c: "violet", Icon: CalendarDays, time: "15:00", done: false, cat: "comp", off: 1 },
  { id: 9, t: "Consulta médica", d: "Clínica · levar exames", tag: "Compromisso", c: "cyan", Icon: Heart, time: "14:00", done: false, cat: "comp", off: 4 },
  { id: 10, t: "Pagar fatura do cartão", d: "Vence em breve", tag: "Financeiro", c: "amber", Icon: Wallet, time: "10:00", done: false, cat: "fin", off: 9 },
] as (Omit<Task, "date"> & { off?: number })[]).map(({ off = 0, ...t }) => ({ ...t, date: iso(addDays(T0, off)) }));

const week = [["Seg", 12, 1], ["Ter", 14, 0], ["Qua", 11, 1], ["Qui", 10, 0], ["Sex", 9, 1], ["Sáb", 6, 0], ["Dom", 4, 0]] as const;
const tabs = ["Hoje", "Esta semana", "Este mês", "Todas"];

function TarefasPage() {
  const [tasks, setTasks] = useState(initial);
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [newCat, setNewCat] = useState("rotina");
  const [time, setTime] = useState("");
  const [day, setDay] = useState<Date>(T0);
  const [newDate, setNewDate] = useState<Date | undefined>();

  const inRange = (t: Task) => { const d = fromIso(t.date); return tab === 0 ? isSameDay(d, day) : tab === 1 ? isSameWeek(d, day, { weekStartsOn: 1 }) : tab === 2 ? isSameMonth(d, day) : true; };
  const dayTasks = tasks.filter((t) => isSameDay(fromIso(t.date), day));
  const taskDays = useMemo(() => [...new Set(tasks.map((t) => t.date))].map(fromIso), [tasks]);
  const upcoming = tasks.filter((t) => fromIso(t.date) >= T0 && t.cat === "comp").sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 3);
  const done = tasks.filter((t) => t.done).length;
  const pct = dayTasks.length ? Math.round((dayTasks.filter((t) => t.done).length / dayTasks.length) * 100) : 0;
  const shown = useMemo(() => tasks.filter((t) => inRange(t) && (!cat || t.cat === cat) && t.t.toLowerCase().includes(q.toLowerCase())), [tasks, cat, q, tab, day]);
  const lastTime = shown.length ? shown.map((t) => t.time).sort().at(-1) : null;

  const add = () => {
    if (!title.trim()) return;
    const c = cats.find((x) => x.id === newCat)!;
    setTasks((l) => [...l, { id: Date.now(), t: title.trim().slice(0, 80), d: "Adicionada agora", tag: c.t.split(" ")[0]!, c: c.c, Icon: c.Icon, time: time || "—", done: false, cat: c.id, date: iso(newDate ?? day) }]
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
    if (newDate) setDay(newDate);
    setTitle(""); setTime(""); setNewDate(undefined);
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

      {/* MAIN GRID */}
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
          <button className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-2.5 text-sm text-muted-foreground transition hover:border-violet hover:text-violet">
            <Plus size={15} /> Nova categoria
          </button>
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
                  <button aria-label="Concluir" onClick={() => setTasks((l) => l.map((x) => x.id === tk.id ? { ...x, done: !x.done } : x))}
                    className={`grid h-5 w-5 place-items-center rounded-md border transition ${tk.done ? "border-cyan bg-cyan text-background shadow-[0_0_12px_var(--cyan)]" : "border-muted-foreground/50 hover:border-cyan"}`}>
                    {tk.done && <Check size={13} strokeWidth={3} />}
                  </button>
                  <span className="flex items-center gap-2.5">
                    <span className="h-8 w-0.5 rounded-full bg-[color:var(--glow)] shadow-[0_0_8px_var(--glow)]" />
                    <tk.Icon size={20} className="text-[color:var(--glow)] transition group-hover:scale-110" />
                  </span>
                  <span className="min-w-0">
                    <b className={`block truncate text-sm font-semibold transition ${tk.done ? "text-muted-foreground line-through" : ""}`}>{tk.t}</b>
                    <span className="block truncate text-xs text-muted-foreground">{tk.d}</span>
                  </span>
                  <span className="tag hidden sm:inline">{tk.tag}</span>
                  <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">{tab !== 0 && <span className="text-cyan">{format(fromIso(tk.date), "dd/MM")}</span>}<Clock size={13} /> {tk.time}</span>
                  <span className="hidden items-center gap-2 text-muted-foreground sm:flex">
                    <AlarmClock size={15} className="text-[color:var(--glow)]" />
                    <GripVertical size={15} className="opacity-40 group-hover:opacity-100" />
                  </span>
                </li>
              ))}
              {shown.length === 0 && <li className="py-10 text-center text-sm text-muted-foreground">Nenhuma tarefa encontrada.</li>}
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
              <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className="w-full rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm outline-none focus:border-violet">
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
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm text-muted-foreground"><Flag size={14} /> Prioridade normal</div>
              <button onClick={add} className="shine flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-8px_var(--cyan)] transition hover:scale-[1.02]">
                <Check size={16} /> Adicionar tarefa
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
            </ul>
          </Panel>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel c="cyan">
          <Head Icon={BarChart3} t="Progresso por categoria" s="Andamento das suas tarefas." />
          <ul className="mt-4 space-y-3">
            {cats.slice(0, 5).map(({ t, Icon, c, p }) => (
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
              const today = i === 4;
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
            {["Responder demandas do suporte", "Treino – Glúteo e Posterior", "Organizar a casa"].map((t, i) => (
              <li key={t} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-sm transition hover:border-violet">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-brand font-mono text-xs text-primary-foreground">{i + 1}</span>
                <span className="flex-1">{t}</span><Zap size={14} className="text-violet" />
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </PlanShell>
  );
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function Head({ Icon, t, s }: { Icon: typeof Home; t: string; s?: string }) {
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
