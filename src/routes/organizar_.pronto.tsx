import { createFileRoute, Link } from "@tanstack/react-router";
import calendar3d from "@/assets/plan-calendar-3d.jpg";
import { useEffect, useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast as notify } from "sonner";
import {
  ArrowLeft, ArrowRight, Calendar, Check, Dumbbell, GripVertical, Heart, Loader2,
  MoreHorizontal, Pause, Pencil, Play, Plus, RefreshCw, Settings, Shuffle, Sparkles, Star, Target, Circle,
} from "lucide-react";
import { PlanShell, Panel, tint, colorVar } from "@/components/PlanShell";
import { fromIsoDate, fromMin, isoDate, toMin } from "@/lib/dates";
import { getIcon } from "@/lib/icons";
import type { ScheduleItem } from "@/lib/types";
import {
  kindToCat, useDayPlan, useDayPriorities, useDeleteScheduleItem, useSaveAsRoutine, useSaveScheduleItem, useSchedule, useSetItemTimes,
  useSetPriority, useStarPriority, useStartDay, useToggleScheduleItem,
} from "@/lib/data/day";

export const Route = createFileRoute("/organizar_/pronto")({
  head: () => ({
    meta: [
      { title: "Seu dia está pronto! · Presence" },
      { name: "description", content: "Seu planejamento diário organizado pela Presence: timeline, prioridades, progresso e foco." },
      { property: "og:title", content: "Seu dia está pronto! · Presence" },
      { property: "og:description", content: "Plano do dia organizado, com prioridades, progresso e temporizador de foco." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pronto,
});

type Kind = "tarefas" | "comp" | "habitos" | "treino" | "auto" | "fin";
type Item = { id: string; h: string; Icon: ReturnType<typeof getIcon>; t: string; d: string; tag: string; c: string; cat: Kind; done: boolean; raw: ScheduleItem };

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function Head({ Icon, t, d, c, right }: { Icon: ReturnType<typeof getIcon>; t: string; d?: string; c: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="icon-tile h-12 w-12 shrink-0 !rounded-full" style={tint(c)}><Icon size={20} /></span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold leading-tight">{t}</h2>
        {d && <p className="text-xs text-muted-foreground">{d}</p>}
      </div>
      {right}
    </div>
  );
}

function Pronto() {
  const [day, setDay] = useState(1);
  const dates = [-1, 0, 1].map((n) => addDays(new Date(), n));
  const date = isoDate(dates[day]!);
  const planQ = useDayPlan(date);
  const schedQ = useSchedule(date);
  const priosQ = useDayPriorities(date);
  const toggleItem = useToggleScheduleItem();
  const saveItem = useSaveScheduleItem();
  const deleteItem = useDeleteScheduleItem();
  const setTimes = useSetItemTimes();
  const setPriority = useSetPriority();
  const starPriority = useStarPriority(date);
  const startDay = useStartDay(date);
  const saveRoutine = useSaveAsRoutine();

  const items: Item[] = useMemo(
    () => (schedQ.data ?? []).map((r) => ({ id: r.id, h: r.time, Icon: getIcon(r.icon), t: r.title, d: r.description, tag: r.tag, c: r.color, cat: kindToCat(r.kind), done: r.done, raw: r })),
    [schedQ.data],
  );
  const prioItems = (priosQ.data ?? []).map((p) => ({ id: p.id, t: p.title, done: p.done, star: p.starred }));
  const started = !!planQ.data?.started_at;

  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [adding, setAdding] = useState(false);
  const [newT, setNewT] = useState("");
  const fail = (e: Error) => setToast(`Erro: ${e.message}`);

  const [preset, setPreset] = useState(25);
  const [secs, setSecs] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [cfg, setCfg] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSecs((s) => { if (s <= 1) { setRunning(false); return 0; } return s - 1; }), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 2500); return () => clearTimeout(id); }, [toast]);

  const by = (k: Kind | Kind[]) => items.filter((i) => (Array.isArray(k) ? k : [k]).includes(i.cat));
  const tarefas = by(["tarefas", "fin"]).length + prioItems.length;
  const tarefasDone = by(["tarefas", "fin"]).filter((i) => i.done).length + prioItems.filter((p) => p.done).length;
  const groups = [
    { t: "Tarefas", c: "cyan", n: tarefas, done: tarefasDone },
    { t: "Compromissos", c: "violet", n: by("comp").length, done: by("comp").filter((i) => i.done).length },
    { t: "Hábitos", c: "emerald", n: by(["habitos", "auto"]).length, done: by(["habitos", "auto"]).filter((i) => i.done).length },
    { t: "Treino", c: "rose", n: by("treino").length, done: by("treino").filter((i) => i.done).length },
  ];
  const totalN = groups.reduce((a, g) => a + g.n, 0) || 1;
  const pct = Math.round((groups.reduce((a, g) => a + g.done, 0) / totalN) * 100);

  const toggle = (id: string) => { const it = items.find((x) => x.id === id); if (it) toggleItem.mutate(it.raw, { onError: fail }); };
  // Trocar de lugar mantém os horários e troca as atividades entre eles.
  const move = (id: string, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const a = items[i]!, b = items[j]!;
    setTimes.mutate([{ id: a.id, time: b.h, position: j }, { id: b.id, time: a.h, position: i }], { onError: fail });
  };
  const shift = (id: string, d: number) => {
    const it = items.find((x) => x.id === id);
    if (it) setTimes.mutate([{ id, time: fromMin(Math.min(23 * 60 + 59, Math.max(0, toMin(it.h) + d))), position: it.raw.position }], { onError: fail });
  };
  const remove = (id: string) => deleteItem.mutate(id, { onError: fail });
  const reorganize = () => {
    const hours = items.map((i) => i.h);
    const sorted = [...items].sort((a, b) => Number(a.done) - Number(b.done) || (a.cat === "tarefas" ? -1 : 0));
    setTimes.mutate(sorted.map((i, k) => ({ id: i.id, time: hours[k]!, position: k })), { onSuccess: () => setToast("Horários reorganizados: pendentes primeiro."), onError: fail });
  };
  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newT.trim()) return;
    const last = items.length ? toMin(items[items.length - 1]!.h) : 600;
    saveItem.mutate(
      { plan_date: date, time: fromMin(Math.min(last + 30, 23 * 60 + 30)), title: newT.trim(), description: "Adicionada por você", tag: "Nova", color: "cyan", icon: "star", kind: "tarefa" },
      { onSuccess: () => { setNewT(""); setAdding(false); setToast("Tarefa adicionada ao plano."); }, onError: fail },
    );
  };
  const saveAsRoutine = () => {
    if (!window.confirm("Isso substitui a sua rotina-base pelas atividades deste dia. Continuar?")) return;
    saveRoutine.mutate(items.map((i) => i.raw), { onSuccess: () => notify.success("Plano salvo como a sua rotina"), onError: fail });
  };

  const main = prioItems.find((p) => p.star) ?? prioItems[0];
  const highlights = [
    main && { Icon: Star, t: "Prioridade principal", d: main.t, c: "amber" },
    ...by("treino").slice(0, 1).map((i) => ({ Icon: Dumbbell, t: "Treino", d: i.d, c: "violet" })),
    ...by("auto").slice(0, 1).map((i) => ({ Icon: Heart, t: "Autocuidado", d: i.d, c: "cyan" })),
    ...by("comp").slice(0, 1).map((i) => ({ Icon: Calendar, t: "Compromisso", d: `${i.t} – ${i.h}`, c: "violet" })),
  ].filter(Boolean) as { Icon: ReturnType<typeof getIcon>; t: string; d: string; c: string }[];

  const mm = String(Math.floor(secs / 60)).padStart(2, "0"), ss = String(secs % 60).padStart(2, "0");
  const ringDeg = pct * 3.6;

  const stats = [
    { Icon: Calendar, n: format(dates[day]!, "dd"), t: cap(format(dates[day]!, "MMM", { locale: ptBR }).replace(".", "")), c: "violet" },
    { Icon: Check, n: String(tarefas).padStart(2, "0"), t: "Tarefas", c: "cyan" },
    { Icon: Heart, n: String(groups[2]!.n).padStart(2, "0"), t: "Hábitos", c: "emerald" },
    { Icon: Dumbbell, n: String(groups[3]!.n).padStart(2, "0"), t: "Treino", c: "violet" },
  ];

  return (
    <PlanShell active={1}>
      {/* Hero */}
      <section className="grid items-center gap-6 px-2 lg:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)]">
        <div className="animate-rise text-center lg:text-left">
          <p className="mono-caps mb-2 !tracking-[0.4em] text-cyan">Plano do dia · Organizado</p>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Seu dia está <span className="text-gradient">pronto!</span> <Sparkles className="inline text-violet" size={32} /></h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground lg:mx-0">
            Organizei suas tarefas, compromissos, hábitos e rotinas de forma equilibrada e realista. Você pode ajustar, reordenar ou marcar como concluído ao longo do dia.
          </p>
        </div>
        <div className="relative mx-auto h-44 w-64 animate-rise">
          <img src={calendar3d} alt="" width={1024} height={768} className="h-full w-full object-contain animate-float" style={{ maskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 60%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 50% 50% at 50% 50%, black 60%, transparent 100%)" }} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ Icon, n, t, c }, i) => (
            <div key={t} className="glass flex items-center gap-2.5 rounded-2xl p-3 pr-4 animate-rise" style={{ ...tint(c), animationDelay: `${0.1 + i * 0.06}s` }}>
              <span className="icon-tile h-9 w-9 shrink-0 !rounded-full"><Icon size={17} /></span>
              <div className="min-w-0">
                <p className="font-display text-2xl font-semibold leading-none">{n}</p>
                <p className="whitespace-nowrap text-xs text-muted-foreground">{t}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.9fr)_minmax(0,1.1fr)]">
        {/* Left */}
        <div className="flex flex-col gap-5">
          <Panel c="violet">
            <Head Icon={Sparkles} t="Visão do dia" d="Resumo do seu planejamento." c="violet" />
            <div className="mx-auto mb-4 grid h-32 w-32 place-items-center rounded-full p-2 transition-all duration-700"
              style={{ background: `conic-gradient(var(--cyan) 0deg, var(--violet) ${ringDeg}deg, color-mix(in oklab, var(--cyan) 18%, transparent) ${ringDeg}deg)` }}>
              <div className="grid h-full w-full place-items-center rounded-full bg-background text-center">
                <div><p className="font-display text-3xl font-semibold">{pct}%</p><p className="text-xs text-muted-foreground">do dia</p></div>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              {groups.map((g) => (
                <li key={g.t} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colorVar(g.c) }} /><span className="flex-1">{g.t}</span><span className="font-semibold">{String(g.n).padStart(2, "0")}</span></li>
              ))}
            </ul>
          </Panel>
          <Panel c="violet">
            <Head Icon={Target} t="Destaques de hoje" c="violet" />
            <ul className="space-y-2">
              {highlights.map(({ Icon, t, d, c }) => (
                <li key={t} className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 p-2.5">
                  <span className="icon-tile h-9 w-9 shrink-0 !rounded-full" style={tint(c === "amber" ? "violet" : c)}><Icon size={16} style={c === "amber" ? { color: colorVar("amber") } : undefined} /></span>
                  <div className="min-w-0"><p className="text-sm font-medium">{t}</p><p className="truncate text-xs text-muted-foreground">{d}</p></div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        {/* Center */}
        <Panel c="cyan" className="flex flex-col">
          <Head Icon={Calendar} t="Planejamento do dia" c="cyan"
            right={
              <div className="flex shrink-0 items-center gap-1 text-sm">
                <button aria-label="Dia anterior" disabled={day === 0} onClick={() => setDay((d) => d - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-secondary disabled:opacity-30"><ArrowLeft size={14} /></button>
                <span className="w-36 text-center">{cap(format(dates[day]!, "EEEE, d 'de' MMM", { locale: ptBR }))}</span>
                <button aria-label="Próximo dia" disabled={day === 2} onClick={() => setDay((d) => d + 1)} className="grid h-8 w-8 place-items-center rounded-full border border-border hover:bg-secondary disabled:opacity-30"><ArrowRight size={14} /></button>
              </div>
            } />
          {schedQ.isPending ? (
            <div className="grid flex-1 place-items-center py-16"><Loader2 className="animate-spin text-cyan" /></div>
          ) : items.length === 0 ? (
            <p className="flex-1 py-16 text-center text-sm text-muted-foreground">
              {day === 1 ? "Seu dia ainda não foi organizado." : "Nada organizado para este dia."}<br />
              <Link to="/organizar" className="mt-3 inline-block text-cyan">Organizar o dia agora</Link>
            </p>
) : (
            <ol className="relative flex-1 space-y-1.5 pl-6 before:absolute before:left-[7px] before:top-3 before:bottom-3 before:w-0.5 before:bg-cyan/60 before:shadow-[0_0_8px_var(--cyan)]">
              {items.map((i, k) => (
                <li key={i.id} className="relative flex items-center gap-3 border-b border-border/40 py-1.5 last:border-0">
                  <span className="absolute -left-[22px] h-3 w-3 rounded-full bg-cyan shadow-[0_0_10px_var(--cyan)]" />
                  <span className="w-16 shrink-0 rounded-full border border-cyan/50 py-1.5 text-center text-sm">{i.h}</span>
                  <span className="icon-tile h-9 w-9 shrink-0 !rounded-full" style={tint("violet")}><i.Icon size={16} /></span>
                  <div className={`min-w-0 flex-1 transition ${i.done ? "opacity-50" : ""}`}>
                    <p className={`truncate text-sm font-medium ${i.done ? "line-through" : ""}`}>{i.t}</p>
                    <p className="truncate text-xs text-muted-foreground">{i.d}</p>
                  </div>
                  <span className="tag hidden shrink-0 !text-[0.65rem] sm:inline" style={{ "--glow": colorVar(i.c) } as React.CSSProperties}>{i.tag}</span>
                  {editing ? (
                    <div className="flex shrink-0 gap-1">
                      <button aria-label="Subir" onClick={() => move(i.id, -1)} disabled={k === 0} className="grid h-7 w-7 place-items-center rounded-full border border-border text-xs disabled:opacity-30">↑</button>
                      <button aria-label="Descer" onClick={() => move(i.id, 1)} disabled={k === items.length - 1} className="grid h-7 w-7 place-items-center rounded-full border border-border text-xs disabled:opacity-30">↓</button>
                      <button aria-label="Remover" onClick={() => remove(i.id)} className="grid h-7 w-7 place-items-center rounded-full border border-border text-xs hover:text-[color:oklch(0.7_0.18_10)]">✕</button>
                    </div>
                  ) : (
                    <>
                      <button aria-label="Concluir" onClick={() => toggle(i.id)} className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${i.done ? "border-cyan bg-cyan text-background shadow-[0_0_10px_var(--cyan)]" : "border-foreground/60 hover:border-cyan"}`}>
                        {i.done && <Check size={13} />}
                      </button>
                      <div className="relative shrink-0">
                        <button aria-label="Mais opções" onClick={() => setMenu(menu === i.id ? null : i.id)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-secondary"><MoreHorizontal size={16} /></button>
                        {menu === i.id && (
                          <div className="glass absolute right-0 top-8 z-20 w-40 rounded-xl p-1 text-xs">
                            {[["Adiar 30 min", () => shift(i.id, 30)], ["Antecipar 30 min", () => shift(i.id, -30)], ["Remover", () => remove(i.id)]].map(([l, fn]) => (
                              <button key={l as string} onClick={() => { (fn as () => void)(); setMenu(null); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-secondary">{l as string}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
          {adding && (
            <form onSubmit={addTask} className="mt-3 flex items-center gap-2 rounded-full border border-cyan/40 p-1.5 pl-4">
              <input autoFocus value={newT} onChange={(e) => setNewT(e.target.value)} maxLength={80} placeholder="Nova tarefa…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              <button type="submit" className="rounded-full bg-gradient-brand px-4 py-1.5 text-xs font-semibold text-primary-foreground">Adicionar</button>
            </form>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-4">
            {[
              { Icon: Plus, t: "Adicionar tarefa", fn: () => setAdding((a) => !a), on: adding },
              { Icon: Shuffle, t: "Reorganizar", fn: reorganize, on: false },
              { Icon: Pencil, t: editing ? "Concluir edição" : "Editar plano", fn: () => setEditing((e) => !e), on: editing },
              { Icon: RefreshCw, t: "Salvar como rotina", fn: saveAsRoutine, on: false },
            ].map(({ Icon, t, fn, on }) => (
              <button key={t} onClick={fn} className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2 text-xs transition hover:border-cyan/60 ${on ? "border-cyan text-cyan" : "border-border text-foreground/85"}`}><Icon size={13} /> {t}</button>
            ))}
            <button onClick={() => { if (!started) startDay().then(() => setToast("Bom dia! Seu dia começou ✦")).catch(fail); }}
              className="ml-auto flex items-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_30px_-8px_var(--cyan)]"
              style={{ background: "linear-gradient(90deg, var(--cyan), var(--violet))" }}>
              <Check size={16} /> {started ? "Dia iniciado" : "Iniciar dia"}
            </button>
          </div>
          {toast && <p className="mt-3 text-center text-xs text-cyan animate-rise">{toast}</p>}
        </Panel>

        {/* Right */}
        <div className="flex flex-col gap-5">
          <Panel c="violet">
            <Head Icon={Target} t="Prioridades do dia" d="O que merece mais foco hoje." c="violet" />
            <ul className="space-y-1.5">
              {prioItems.length === 0 && <li className="rounded-xl border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">Nenhuma prioridade definida para este dia.</li>}
              {prioItems.map((p) => (
                <li key={p.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${p.done ? "border-cyan/60 bg-cyan/10" : "border-border/60"}`}>
                  <button aria-label="Concluir prioridade" onClick={() => setPriority.mutate({ id: p.id, patch: { done: !p.done } }, { onError: fail })}
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${p.done ? "border-cyan bg-cyan text-background" : "border-muted-foreground/60"}`}>{p.done && <Check size={12} />}</button>
                  <span className={`min-w-0 flex-1 truncate text-sm ${p.done ? "text-muted-foreground line-through" : ""}`}>{p.t}</span>
                  <button aria-label="Destacar" onClick={() => starPriority.mutate(p.id, { onError: fail })}>
                    <Star size={15} style={{ color: p.star ? colorVar("amber") : undefined }} fill={p.star ? "currentColor" : "none"} className={p.star ? "" : "text-muted-foreground/50"} />
                  </button>
                  <GripVertical size={15} className="shrink-0 text-muted-foreground" />
                </li>
              ))}
            </ul>
          </Panel>

          <Panel c="cyan">
            <Head Icon={Calendar} t="Progresso do dia" c="cyan" right={<span className="text-sm font-semibold">{pct}%</span>} />
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-secondary/60">
              <div className="h-full rounded-full bg-gradient-brand transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <ul className="space-y-1.5 text-sm">
              {groups.map((g) => (
                <li key={g.t} className="flex items-center gap-2">
                  {g.n > 0 && g.done === g.n ? <Check size={16} className="text-cyan" /> : <Circle size={16} className="text-cyan" />}
                  {g.t} ({g.done}/{g.n})
                </li>
              ))}
            </ul>
          </Panel>

          <Panel c="cyan" className="overflow-hidden">
            <Head Icon={Target} t="Foco agora" d={`Foco em: ${main?.t ?? "sua próxima tarefa"}`} c="cyan" />
            <div className="flex items-center justify-center gap-5">
              <button aria-label="Menos 5 min" onClick={() => { const p = Math.max(5, preset - 5); setPreset(p); setSecs(p * 60); setRunning(false); }} className="grid h-8 w-8 place-items-center rounded-full border border-border"><ArrowLeft size={14} /></button>
              <span className="font-display text-5xl font-semibold tabular-nums">{mm}:{ss}</span>
              <button aria-label="Mais 5 min" onClick={() => { const p = Math.min(90, preset + 5); setPreset(p); setSecs(p * 60); setRunning(false); }} className="grid h-8 w-8 place-items-center rounded-full border border-border"><ArrowRight size={14} /></button>
            </div>
            <div className="relative mt-4 flex items-center justify-center gap-6">
              <button aria-label={running ? "Pausar" : "Iniciar"} onClick={() => setRunning((r) => !r)}
                className={`grid h-16 w-16 place-items-center rounded-full border-2 border-cyan text-cyan shadow-[0_0_30px_-4px_var(--cyan)] transition hover:scale-105 ${running ? "animate-pulse-ring" : ""}`}>
                {running ? <Pause size={26} /> : <Play size={26} className="translate-x-0.5" />}
              </button>
              <button aria-label="Configurar" onClick={() => setCfg((c) => !c)} className="grid h-10 w-10 place-items-center rounded-full border border-violet/60 text-violet"><Settings size={17} /></button>
            </div>
            {cfg && (
              <div className="mt-4 flex flex-wrap justify-center gap-2 animate-rise">
                {[15, 25, 45, 60].map((m) => (
                  <button key={m} onClick={() => { setPreset(m); setSecs(m * 60); setRunning(false); setCfg(false); }}
                    className={`rounded-full border px-3 py-1 text-xs ${preset === m ? "border-cyan text-cyan" : "border-border"}`}>{m} min</button>
                ))}
                <button onClick={() => { setSecs(preset * 60); setRunning(false); }} className="rounded-full border border-border px-3 py-1 text-xs">Zerar</button>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground"><Link to="/organizar" className="hover:text-cyan">← Voltar para Organize o seu dia</Link></p>
    </PlanShell>
  );
}
