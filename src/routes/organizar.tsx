import { createFileRoute, Link } from "@tanstack/react-router";
import calendar3d from "@/assets/plan-calendar-3d.jpg";
import { useState } from "react";
import {
  ArrowLeft, ArrowRight, Book, Calendar, CalendarCheck, Check, Database, Dumbbell, Flag, Flower2, GripVertical, Heart,
  Home, Laptop, Layers, Moon, Plus, Scale, Sparkles, Sun, Target, Utensils, Wallet, Briefcase, User, CheckSquare,
} from "lucide-react";
import { PlanShell, Panel, tint, colorVar } from "@/components/PlanShell";

export const Route = createFileRoute("/organizar")({
  head: () => ({
    meta: [
      { title: "Organize o seu dia · Presence" },
      { name: "description", content: "Centralize tarefas, prioridades e compromissos numa rotina prática e equilibrada com a Presence." },
      { property: "og:title", content: "Organize o seu dia · Presence" },
      { property: "og:description", content: "Tarefas, agenda, prioridades e equilíbrio da rotina num só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Organizar,
});

type Prio = "alta" | "media" | "baixa";
type Task = { id: number; t: string; tag: string; c: string; p: Prio; done: boolean };

const prioColor: Record<Prio, string> = { alta: "rose", media: "amber", baixa: "emerald" };

const initialTasks: Task[] = [
  { id: 1, t: "Finalizar ajustes da Presence", tag: "Projeto", c: "violet", p: "alta", done: false },
  { id: 2, t: "Responder mensagens do suporte", tag: "Trabalho", c: "amber", p: "media", done: false },
  { id: 3, t: "Gravar tutorial do novo módulo", tag: "Tutorial", c: "violet", p: "alta", done: false },
  { id: 4, t: "Organizar demandas dos polos", tag: "P4C", c: "cyan", p: "media", done: false },
  { id: 5, t: "Planejar cardápio da semana", tag: "Saúde", c: "emerald", p: "baixa", done: false },
  { id: 6, t: "Revisar contrato do cliente", tag: "Trabalho", c: "amber", p: "alta", done: false },
  { id: 7, t: "Atualizar planilha de metas", tag: "Projeto", c: "violet", p: "media", done: false },
  { id: 8, t: "Comprar suplementos", tag: "Saúde", c: "emerald", p: "baixa", done: false },
];

const cats = [
  { k: "tarefas", Icon: CheckSquare, t: "Minhas tarefas", d: "Pendências, projetos e afazeres", c: "cyan" },
  { k: "comp", Icon: Calendar, t: "Compromissos", d: "Reuniões, horários e eventos", c: "violet" },
  { k: "habitos", Icon: Heart, t: "Hábitos", d: "Rotinas e metas diárias", c: "cyan" },
  { k: "treino", Icon: Dumbbell, t: "Treino", d: "Atividade física e bem-estar", c: "violet" },
  { k: "auto", Icon: Flower2, t: "Autocuidado", d: "Skincare, cabelo, leitura, etc.", c: "violet" },
  { k: "fin", Icon: Database, t: "Financeiro", d: "Contas e lembretes importantes", c: "cyan" },
];

const days = [
  { label: "Qui, 30 de Out", items: [
    { h: "08:00", Icon: Sun, t: "Rotina da manhã", d: "Higiene · Café", cat: "habitos" },
    { h: "10:00", Icon: Laptop, t: "Reunião de equipe", d: "Planejamento semanal", cat: "comp" },
    { h: "13:00", Icon: Utensils, t: "Almoço", d: "Pausa e descanso", cat: "habitos" },
    { h: "15:00", Icon: Layers, t: "Projetos da Presence", d: "Revisão de telas", cat: "tarefas" },
    { h: "19:00", Icon: Dumbbell, t: "Treino", d: "Superiores · ~50 min", cat: "treino" },
    { h: "22:00", Icon: Moon, t: "Rotina noturna", d: "Planejar amanhã", cat: "habitos" },
  ] },
  { label: "Sex, 31 de Out", items: [
    { h: "09:00", Icon: Sun, t: "Rotina da manhã", d: "Higiene · Skincare · Café", cat: "habitos" },
    { h: "10:00", Icon: Laptop, t: "Trabalho e demandas", d: "Responder e-mails e suporte", cat: "tarefas" },
    { h: "12:30", Icon: Utensils, t: "Almoço e pausa", d: "Alimentação e descanso", cat: "habitos" },
    { h: "14:00", Icon: Layers, t: "Projetos da Presence", d: "Ajustes e novas implementações", cat: "tarefas" },
    { h: "16:30", Icon: Dumbbell, t: "Treino", d: "Glúteos e Posterior · ~60 min", cat: "treino" },
    { h: "18:00", Icon: Flower2, t: "Autocuidado", d: "Banho, cabelo e cuidados pessoais", cat: "auto" },
    { h: "21:00", Icon: Book, t: "Tempo livre", d: "Leitura, série ou hobby", cat: "habitos" },
    { h: "22:00", Icon: Moon, t: "Rotina noturna", d: "Planejar amanhã e descanso", cat: "habitos" },
  ] },
  { label: "Sáb, 1 de Nov", items: [
    { h: "09:30", Icon: Sun, t: "Manhã tranquila", d: "Café sem pressa", cat: "habitos" },
    { h: "11:00", Icon: Dumbbell, t: "Corrida leve", d: "5 km no parque", cat: "treino" },
    { h: "14:00", Icon: Flower2, t: "Autocuidado", d: "Máscara capilar e skincare", cat: "auto" },
    { h: "17:00", Icon: Wallet, t: "Revisar gastos", d: "Fechamento do mês", cat: "fin" },
    { h: "20:00", Icon: Book, t: "Tempo livre", d: "Filme ou leitura", cat: "habitos" },
  ] },
];

const priorities = [
  { Icon: Target, t: "Projetos" }, { Icon: Briefcase, t: "Trabalho" }, { Icon: Heart, t: "Saúde" },
  { Icon: Home, t: "Casa" }, { Icon: Wallet, t: "Financeiro" }, { Icon: User, t: "Pessoal" },
];

const balanceBase = [
  { t: "Trabalho", c: "cyan", k: "Trabalho" }, { t: "Projetos", c: "violet", k: "Projetos" },
  { t: "Saúde", c: "emerald", k: "Saúde" }, { t: "Pessoal", c: "rose", k: "Pessoal" },
];

function PanelHead({ Icon, t, d, c, right }: { Icon: typeof Home; t: string; d: string; c: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="icon-tile h-12 w-12 shrink-0 !rounded-full" style={tint(c)}><Icon size={20} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold leading-tight">{t}</h2>
        <p className="text-xs text-muted-foreground">{d}</p>
      </div>
      {right}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition ${on ? "border-cyan bg-cyan shadow-[0_0_14px_-2px_var(--cyan)]" : "border-border bg-secondary/60"}`}>
      <span className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full transition-all ${on ? "left-6 bg-background" : "left-1 bg-foreground"}`} />
    </button>
  );
}

function Organizar() {
  const [tasks, setTasks] = useState(initialTasks);
  const [filter, setFilter] = useState<"todas" | Prio>("todas");
  const [catOn, setCatOn] = useState<Record<string, boolean>>({ tarefas: true, comp: true, habitos: true, treino: true, auto: true, fin: false });
  const [prios, setPrios] = useState<string[]>(["Projetos"]);
  const [day, setDay] = useState(1);
  const [adding, setAdding] = useState(false);
  const [newT, setNewT] = useState("");
  const [newP, setNewP] = useState<Prio>("media");
  const [dragId, setDragId] = useState<number | null>(null);
  const [organized, setOrganized] = useState(false);

  const count = (p: Prio) => tasks.filter((t) => t.p === p).length;
  const visible = catOn["tarefas"] ? tasks.filter((t) => filter === "todas" || t.p === filter) : [];
  const agenda = days[day]!.items.filter((i) => catOn[i.cat]);

  const weights: Record<string, number> = { Trabalho: 38, Projetos: 24, Saúde: 24, Pessoal: 19 };
  prios.forEach((p) => { if (weights[p] !== undefined) weights[p] += 10; });
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const balance = balanceBase.map((b) => ({ ...b, v: Math.round((weights[b.k]! / total) * 100) }));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newT.trim()) return;
    setTasks((l) => [{ id: Date.now(), t: newT.trim().slice(0, 80), tag: "Nova", c: "cyan", p: newP, done: false }, ...l]);
    setNewT(""); setAdding(false);
  };
  const drop = (target: number) => {
    if (dragId === null || dragId === target) return;
    setTasks((l) => {
      const from = l.findIndex((t) => t.id === dragId), to = l.findIndex((t) => t.id === target);
      const n = [...l]; const [m] = n.splice(from, 1); n.splice(to, 0, m!); return n;
    });
  };

  const stats = [
    { Icon: Check, n: tasks.filter((t) => !t.done).length, t: "Tarefas", c: "cyan" },
    { Icon: Calendar, n: days[day]!.items.filter((i) => i.cat === "comp").length + 2, t: "Compromissos", c: "violet" },
    { Icon: Heart, n: days[day]!.items.filter((i) => i.cat === "habitos").length, t: "Hábitos", c: "emerald" },
    { Icon: Dumbbell, n: days[day]!.items.filter((i) => i.cat === "treino").length, t: "Treino", c: "violet" },
  ];

  return (
    <PlanShell active={1}>
      {/* Hero */}
      <section className="grid items-center gap-6 px-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)]">
        <div className="animate-rise text-center lg:text-left">
          <p className="mono-caps mb-2 !tracking-[0.4em] text-cyan">Organização diária</p>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Organize o <span className="text-gradient">seu dia</span></h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground lg:mx-0">
            Centralize suas tarefas, prioridades e compromissos. A Presence organiza tudo para você em uma rotina prática e equilibrada.
          </p>
        </div>
        <div className="relative mx-auto h-44 w-64 animate-rise">
          <img src={calendar3d} alt="" width={1024} height={768} className="h-full w-full object-contain animate-float" style={{ maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 60%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 60%, transparent 100%)" }} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
          {stats.map(({ Icon, n, t, c }, i) => (
            <div key={t} className="glass flex items-center gap-3 rounded-2xl p-3 pr-4 animate-rise" style={{ ...tint(c), animationDelay: `${0.1 + i * 0.06}s` }}>
              <span className="icon-tile h-10 w-10 shrink-0 !rounded-full"><Icon size={17} /></span>
              <div className="min-w-0">
                <p className="font-display text-2xl font-semibold leading-none">{String(n).padStart(2, "0")}</p>
                <p className="whitespace-nowrap text-xs text-muted-foreground">{t}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            {/* Categories */}
            <Panel c="violet">
              <PanelHead Icon={Layers} t="O que vamos organizar?" d="Selecione o que deseja incluir no seu dia." c="violet" />
              <ul className="divide-y divide-border/60">
                {cats.map(({ k, Icon, t, d, c }) => (
                  <li key={k} className={`flex items-center gap-3 py-2.5 transition ${catOn[k] ? "" : "opacity-60"}`}>
                    <span className="icon-tile h-10 w-10 shrink-0 !rounded-xl" style={tint(c)}><Icon size={18} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t}</p>
                      <p className="truncate text-xs text-muted-foreground">{d}</p>
                    </div>
                    <Toggle on={!!catOn[k]} label={t} onClick={() => setCatOn((s) => ({ ...s, [k]: !s[k] }))} />
                  </li>
                ))}
              </ul>
            </Panel>

            {/* Tasks */}
            <Panel c="cyan">
              <PanelHead Icon={CheckSquare} t="Minhas tarefas de hoje" d="Revise, organize e priorize suas tarefas." c="cyan"
                right={<button onClick={() => setAdding((a) => !a)} className="flex shrink-0 items-center gap-1.5 rounded-full border border-cyan/60 px-3.5 py-2 text-xs text-cyan transition hover:shadow-[0_0_18px_-4px_var(--cyan)]"><Plus size={14} /> Adicionar tarefa</button>} />
              {adding && (
                <form onSubmit={add} className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-cyan/40 p-2">
                  <input autoFocus value={newT} onChange={(e) => setNewT(e.target.value)} placeholder="Nova tarefa…" maxLength={80}
                    className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" />
                  {(["alta", "media", "baixa"] as Prio[]).map((p) => (
                    <button type="button" key={p} onClick={() => setNewP(p)} aria-label={p}
                      className={`grid h-7 w-7 place-items-center rounded-full border ${newP === p ? "border-current" : "border-transparent"}`} style={{ color: colorVar(prioColor[p]) }}><Flag size={13} /></button>
                  ))}
                  <button type="submit" className="rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-semibold text-primary-foreground">Salvar</button>
                </form>
              )}
              <div className="mb-3 flex flex-wrap gap-2">
                {([["todas", `Todas (${tasks.length})`], ["alta", `Alta (${count("alta")})`], ["media", `Média (${count("media")})`], ["baixa", `Baixa (${count("baixa")})`]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setFilter(k)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition ${filter === k ? "border-cyan bg-cyan/15 text-foreground shadow-[0_0_14px_-4px_var(--cyan)]" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {k !== "todas" && <Flag size={12} style={{ color: colorVar(prioColor[k]) }} />} {l}
                  </button>
                ))}
              </div>
              <ul className="max-h-[300px] space-y-2 overflow-y-auto scroll-neon pr-2">
                {!catOn["tarefas"] && <li className="py-8 text-center text-sm text-muted-foreground">Categoria "Minhas tarefas" desativada.</li>}
                {visible.map((t) => (
                  <li key={t.id} draggable onDragStart={() => setDragId(t.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(t.id)} onDragEnd={() => setDragId(null)}
                    className={`flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 transition hover:border-cyan/40 ${dragId === t.id ? "opacity-40" : ""}`}>
                    <button onClick={() => setTasks((l) => l.map((x) => x.id === t.id ? { ...x, done: !x.done } : x))} aria-label="Concluir"
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${t.done ? "border-cyan bg-cyan text-background" : "border-muted-foreground/60"}`}>
                      {t.done && <Check size={12} />}
                    </button>
                    <span className="h-5 w-1 shrink-0 rounded-full" style={{ background: colorVar(prioColor[t.p]) }} />
                    <span className={`min-w-0 flex-1 truncate text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>{t.t}</span>
                    <span className="tag shrink-0 !text-[0.65rem]" style={tint(t.c === "amber" ? "violet" : t.c)}>{t.tag}</span>
                    <GripVertical size={16} className="shrink-0 cursor-grab text-muted-foreground" />
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Priorities */}
            <Panel c="violet">
              <PanelHead Icon={Target} t="Prioridades de hoje" d="Defina o foco principal do seu dia." c="violet" />
              <div className="grid grid-cols-3 gap-2">
                {priorities.map(({ Icon, t }) => {
                  const on = prios.includes(t);
                  return (
                    <button key={t} onClick={() => setPrios((l) => on ? l.filter((x) => x !== t) : [...l, t])}
                      className={`flex items-center justify-center gap-1.5 rounded-full border px-2 py-2.5 text-sm transition ${on ? "border-cyan bg-cyan/15 shadow-[0_0_16px_-4px_var(--cyan)]" : "border-border text-muted-foreground hover:text-foreground"}`}>
                      {on ? <Check size={14} className="text-cyan" /> : <Icon size={14} />} {t}
                    </button>
                  );
                })}
              </div>
            </Panel>

            {/* Balance */}
            <Panel c="cyan">
              <PanelHead Icon={Scale} t="Equilíbrio do dia" d="Acompanhe a distribuição do seu tempo." c="cyan" />
              <div className="flex h-3 overflow-hidden rounded-full">
                {balance.map((b) => <span key={b.t} className="h-full transition-all duration-700" style={{ width: `${b.v}%`, background: colorVar(b.c) }} />)}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {balance.map((b) => (
                  <div key={b.t} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorVar(b.c) }} />
                    <span className="flex-1">{b.t}</span><span className="font-semibold">{b.v}%</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {/* Agenda */}
          <Panel c="cyan">
            <PanelHead Icon={CalendarCheck} t="Agenda do dia" d="Sua rotina organizada por horários." c="cyan"
              right={
                <div className="flex shrink-0 items-center gap-1 rounded-full border border-border px-1.5 py-1 text-xs">
                  <button aria-label="Dia anterior" disabled={day === 0} onClick={() => setDay((d) => d - 1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-secondary disabled:opacity-30"><ArrowLeft size={14} /></button>
                  <span className="w-24 text-center">{days[day]!.label}</span>
                  <button aria-label="Próximo dia" disabled={day === days.length - 1} onClick={() => setDay((d) => d + 1)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-secondary disabled:opacity-30"><ArrowRight size={14} /></button>
                </div>
              } />
            <ol key={day} className="relative space-y-2 pl-6 before:absolute before:left-[7px] before:top-3 before:bottom-3 before:w-0.5 before:bg-cyan/60 before:shadow-[0_0_8px_var(--cyan)]">
              {agenda.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">Nenhuma categoria ativa para este dia.</li>}
              {agenda.map(({ h, Icon, t, d }, i) => (
                <li key={h + t} className="relative flex items-center gap-3 animate-rise" style={{ animationDelay: `${i * 0.05}s` }}>
                  <span className="absolute -left-[22px] h-3 w-3 rounded-full bg-cyan shadow-[0_0_10px_var(--cyan)]" />
                  <span className="w-16 shrink-0 rounded-full border border-cyan/50 py-1.5 text-center text-sm">{h}</span>
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2 transition hover:border-violet/50">
                    <span className="icon-tile h-9 w-9 shrink-0 !rounded-full" style={tint("violet")}><Icon size={16} /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t}</p>
                      <p className="truncate text-xs text-muted-foreground">{d}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Link to="/organizar/pronto" search={{ cats: Object.keys(catOn).filter((k) => catOn[k]).join(","), prios: prios.join(",") }}
            onClick={() => setOrganized(true)}
            className="flex items-center justify-center gap-3 rounded-full py-5 text-lg font-semibold text-primary-foreground shadow-[0_0_50px_-12px_var(--cyan)] transition hover:shadow-[0_0_60px_-8px_var(--violet)]"
            style={{ background: "linear-gradient(90deg, var(--cyan), oklch(0.66 0.19 265) 55%, var(--violet))" }}>
            <Sparkles size={20} /> {organized ? "Organizando…" : "Organizar meu dia agora"} <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </PlanShell>
  );
}
