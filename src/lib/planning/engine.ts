/**
 * Motor do planejamento do dia. Puro (sem rede): recebe os dados REAIS de cada fonte (calendário, tarefas, hábitos, saúde, financeiro,
 * demandas, rotina) e devolve os blocos do dia, já sem conflito de horário. Quem busca os dados é `sources.ts`; quem grava é `data/day.ts`.
 *
 * Regras principais:
 * - Só entra o que estiver ligado em `settings.sources`.
 * - Compromissos e tarefas com horário são fixos. O resto (tarefas sem horário, hábitos, financeiro, demandas, pausas) é "flexível":
 *   vai para o horário preferido, ou para a próxima vaga livre.
 * - A rotina-base vale nos dias da semana escolhidos; o que a fonte real já cobre (treino do dia, hábito com o mesmo nome) não duplica.
 */
import { fromMin, toMin } from "../dates";
import type { Color, Kind, Priority } from "../types";

export type SourceId = "calendario" | "tarefas" | "habitos" | "saude" | "financeiro" | "demandas" | "rotina";
export type Sources = Record<SourceId, boolean>;
export const DEFAULT_SOURCES: Sources = { calendario: true, tarefas: true, habitos: true, saude: true, financeiro: true, demandas: true, rotina: true };
export const SOURCE_LABEL: Record<SourceId, string> = { calendario: "Calendário", tarefas: "Tarefas", habitos: "Hábitos", saude: "Saúde", financeiro: "Financeiro", demandas: "Demandas", rotina: "Minha rotina" };

export type Settings = { sources: Sources; dayStart: string; dayEnd: string; travelMin: number; learn: boolean };
export const DEFAULT_SETTINGS: Settings = { sources: DEFAULT_SOURCES, dayStart: "07:00", dayEnd: "22:00", travelMin: 30, learn: true };

export type Disposicao = "alta" | "normal" | "baixa";
export type Tempo = "completo" | "manha" | "tarde" | "pouco";
export type Options = { disposicao: Disposicao; tempo: Tempo; prioridade: string; pausas: boolean };

export type RoutineIn = { id: string; time: string; title: string; description: string; tag: string; color: Color; icon: string; kind: Kind; durationMin: number; weekdays: number[]; active: boolean };
export type TaskIn = { id: string; title: string; description: string | null; priority: Priority; dueDate: string | null; dueTime: string | null; endTime: string | null; place: string | null; done: boolean; isCompromisso: boolean; color: Color | null; categoryName: string | null };
export type HabitIn = { id: string; name: string; icon: string; color: Color; doneToday: boolean; preferredTime?: string | undefined };
export type WorkoutIn = { title: string; durationMin: number } | "descanso" | null; // null = sem informação; "descanso" = dia sem treino
export type MealIn = { name: string; time: string };
export type FinanceIn = { id: string; title: string; detail: string };
export type DemandIn = { code: string; title: string; priority: Priority };

/** O que o Orion aprendeu com o seu uso (veja learn.ts). */
export type Learned = { taskLimit?: number | undefined; peakStart?: string | undefined; habitTimes?: Record<string, string> | undefined };

export type EngineInput = {
  date: string; weekday: number; settings: Settings; opts: Options;
  routine: RoutineIn[]; tasks: TaskIn[]; habits: HabitIn[]; workout: WorkoutIn; meals: MealIn[]; finance: FinanceIn[]; demands: DemandIn[];
  /** Se o plano é para hoje, nada é colocado antes deste horário ("HH:mm"). */
  from?: string | undefined;
  learned?: Learned | undefined;
};

export type BlockSource = SourceId | "pausa" | "extra" | "manual";
export type Block = {
  time: string; durationMin: number; title: string; description: string; tag: string; color: Color; icon: string; kind: Kind;
  source: BlockSource; sourceRef: string | null; taskId: string | null; fixed: boolean;
};
export type Plan = { blocks: Block[]; unplaced: { title: string; reason: string }[]; warnings: string[]; totalMin: number; overload: boolean };

export const DEFAULT_TASK_MIN = 30;
const RANK: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Mesma atividade com outro nome? ("Leitura 20 min" × "Leitura") */
export const sameThing = (a: string, b: string): boolean => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.includes(y) || y.includes(x)); };

type Iv = { s: number; e: number };
class Timeline {
  private iv: Iv[] = [];
  constructor(private start: number, private end: number) {}
  busy(s: number, e: number) { return this.iv.some((x) => s < x.e && e > x.s); }
  add(s: number, e: number) { this.iv.push({ s, e }); }
  /** Primeira vaga livre de `dur` minutos a partir de `from`. */
  gap(from: number, dur: number, until = this.end): number | null {
    let t = Math.max(from, this.start);
    for (let guard = 0; guard < 600 && t + dur <= until; guard++) {
      const hit = this.iv.filter((x) => t < x.e && t + dur > x.s).sort((a, b) => b.e - a.e)[0];
      if (!hit) return t;
      t = hit.e;
    }
    return null;
  }
  /** Vaga no horário preferido; se ocupado, a mais próxima depois dele (até 4 h); se não houver, qualquer uma do dia. */
  near(pref: number, dur: number, from: number): number | null {
    const p = Math.max(pref, from);
    if (!this.busy(p, p + dur) && p >= this.start && p + dur <= this.end) return p;
    return this.gap(p, dur, Math.min(this.end, p + 240 + dur)) ?? this.gap(from, dur);
  }
}

const block = (b: Omit<Block, "taskId" | "fixed" | "sourceRef"> & Partial<Pick<Block, "taskId" | "fixed" | "sourceRef">>): Block => ({ taskId: null, fixed: false, sourceRef: null, ...b });

/** Monta o plano do dia a partir dos dados reais e das fontes ligadas. */
export function planDay(inp: EngineInput): Plan {
  const { settings: st, opts, weekday } = inp, on = st.sources;
  let dayStart = toMin(st.dayStart), dayEnd = toMin(st.dayEnd);
  if (opts.tempo === "manha") dayEnd = Math.min(dayEnd, 12 * 60 + 30);
  if (opts.tempo === "tarde") dayStart = Math.max(dayStart, 12 * 60);
  const from = Math.max(dayStart, inp.from ? Math.ceil(toMin(inp.from) / 5) * 5 : 0);
  const tl = new Timeline(dayStart, dayEnd), out: Block[] = [], unplaced: Plan["unplaced"] = [], warnings: string[] = [];
  const keepFixed = (b: Block) => { const s = toMin(b.time); tl.add(s, s + b.durationMin); out.push(b); };

  /* ── 1. fixos: compromissos e tarefas com horário ── */
  const today = inp.date;
  const withTime = inp.tasks.filter((t) => !t.done && t.dueDate === today && t.dueTime);
  for (const t of withTime) {
    if (t.isCompromisso ? !on.calendario : !on.tarefas) continue;
    const s = toMin(t.dueTime!.slice(0, 5)), e = t.endTime ? toMin(t.endTime.slice(0, 5)) : s + (t.isCompromisso ? 60 : DEFAULT_TASK_MIN);
    const dur = clamp(e - s, 5, 720);
    if (t.isCompromisso && t.place && st.travelMin > 0) {
      // sair com antecedência para chegar ao compromisso com local
      const leave = Math.max(0, s - st.travelMin);
      if (!tl.busy(leave, s)) keepFixed(block({ time: fromMin(leave), durationMin: st.travelMin, title: `Sair para ${t.title}`, description: `${t.place} · chegar às ${t.dueTime!.slice(0, 5)}`, tag: "Deslocamento", color: "amber", icon: "car", kind: "extra", source: "calendario", sourceRef: `go:${t.id}`, fixed: true }));
    }
    keepFixed(block({
      time: t.dueTime!.slice(0, 5), durationMin: dur, title: t.title,
      description: t.isCompromisso ? ([t.endTime ? `até ${t.endTime.slice(0, 5)}` : "", t.place ?? ""].filter(Boolean).join(" · ") || "Compromisso do calendário") : (t.description || t.categoryName || "Tarefa"),
      tag: t.isCompromisso ? "Compromisso" : (t.categoryName?.split(" ")[0] ?? "Tarefa"), color: t.color ?? (t.isCompromisso ? "violet" : "cyan"), icon: t.isCompromisso ? "calendar" : "check",
      kind: t.isCompromisso ? "compromisso" : "tarefa", source: t.isCompromisso ? "calendario" : "tarefas", sourceRef: t.id, taskId: t.id, fixed: true,
    }));
  }

  /* ── 2. rotina-base (com horário próprio), sem duplicar o que a fonte real já cobre ── */
  const realHabitNames = on.habitos ? inp.habits.map((h) => h.name) : [];
  const routineHabitCoversReal = new Set<string>();
  if (on.rotina) for (const r of inp.routine) {
    if (!r.active || !r.weekdays.includes(weekday)) continue;
    // treino: a ficha real do dia manda (se a fonte Saúde está ligada e há informação)
    if (r.kind === "treino" && on.saude && inp.workout !== null) {
      if (inp.workout === "descanso") continue; // dia de descanso: some o treino da rotina
      keepFixed(block({ time: r.time, durationMin: inp.workout.durationMin, title: inp.workout.title, description: "Treino do dia", tag: "Saúde", color: r.color, icon: "dumbbell", kind: "treino", source: "saude", sourceRef: `w:${weekday}`, fixed: true }));
      continue;
    }
    // hábito real com o mesmo nome: usa o horário da rotina e não repete
    const same = realHabitNames.find((n) => sameThing(n, r.title));
    if (same) routineHabitCoversReal.add(norm(same));
    keepFixed(block({ time: r.time, durationMin: r.durationMin, title: r.title, description: r.description, tag: r.tag, color: r.color, icon: r.icon, kind: r.kind, source: "rotina", sourceRef: r.id, fixed: true }));
  }

  /* ── 3. blocos flexíveis, em ordem de importância ── */
  const flex: { b: Block; pref: number | null; prio: number }[] = [];
  const add = (b: Block, pref: number | null, prio: number) => flex.push({ b, pref, prio });

  const p = opts.prioridade.trim();
  if (p) add(block({ time: "00:00", durationMin: 45, title: `Prioridade: ${p}`, description: "Escolhida por você antes de gerar o plano.", tag: "Prioridade", color: "amber", icon: "star", kind: "extra", source: "manual", sourceRef: "prioridade" }), toMin("09:00"), -1);

  if (on.financeiro) inp.finance.forEach((f, i) => add(block({ time: "00:00", durationMin: 10, title: f.title, description: f.detail, tag: "Financeiro", color: "amber", icon: "wallet", kind: "financeiro", source: "financeiro", sourceRef: f.id }), toMin("09:00") + i * 10, 0));

  if (on.saude) {
    if (inp.workout && inp.workout !== "descanso" && !out.some((b) => b.kind === "treino")) add(block({ time: "00:00", durationMin: inp.workout.durationMin, title: inp.workout.title, description: "Treino do dia", tag: "Saúde", color: "violet", icon: "dumbbell", kind: "treino", source: "saude", sourceRef: `w:${weekday}` }), toMin("17:30"), 1);
    for (const m of inp.meals) if (/^\d{1,2}:\d{2}$/.test(m.time) && !out.some((b) => sameThing(b.title, m.name) && b.kind === "pausa")) keepFixed(block({ time: m.time.padStart(5, "0"), durationMin: 20, title: m.name, description: "Refeição da sua dieta", tag: "Refeição", color: "amber", icon: "food", kind: "pausa", source: "saude", sourceRef: `meal:${m.name}`, fixed: true }));
  }

  if (on.habitos) {
    const spread = ["08:00", "12:00", "19:30", "21:00", "07:30", "18:00"];
    inp.habits.filter((h) => !h.doneToday && !routineHabitCoversReal.has(norm(h.name))).forEach((h, i) =>
      add(block({ time: "00:00", durationMin: 15, title: h.name, description: "Hábito de hoje", tag: "Hábito", color: h.color, icon: h.icon, kind: "habito", source: "habitos", sourceRef: h.id }), toMin(h.preferredTime ?? inp.learned?.habitTimes?.[norm(h.name)] ?? spread[i % spread.length]!), 2));
  }

  if (on.demandas) inp.demands.forEach((d) => add(block({ time: "00:00", durationMin: 45, title: d.title, description: `Demanda ${d.code} com prazo hoje`, tag: "Demanda", color: "violet", icon: "layers", kind: "tarefa", source: "demandas", sourceRef: `d:${d.code}` }), null, RANK[d.priority]));

  // tarefas sem horário: atrasadas primeiro, depois por prioridade
  if (on.tarefas) {
    const pend = inp.tasks.filter((t) => !t.done && !t.isCompromisso && !t.dueTime && t.dueDate !== null && t.dueDate <= today);
    const cap = Math.min(({ alta: 12, normal: 8, baixa: 5 })[opts.disposicao], inp.learned?.taskLimit ?? 99), limit = opts.tempo === "pouco" ? Math.min(3, cap) : cap;
    const factor = opts.disposicao === "baixa" ? 0.7 : 1;
    const sorted = [...pend].sort((a, b) => Number(b.dueDate! < today) - Number(a.dueDate! < today) || RANK[a.priority] - RANK[b.priority] || a.title.localeCompare(b.title));
    sorted.forEach((t, i) => {
      const dur = Math.max(15, Math.round((t.priority === "alta" ? 45 : DEFAULT_TASK_MIN) * factor / 5) * 5);
      if (i >= limit) { unplaced.push({ title: t.title, reason: "Fica para outro dia (o dia já está cheio)." }); return; }
      const late = t.dueDate! < today;
      add(block({ time: "00:00", durationMin: dur, title: t.title, description: late ? "Atrasada: vencia em " + t.dueDate!.split("-").reverse().join("/") : (t.description || t.categoryName || "Tarefa"), tag: late ? "Atrasada" : (t.categoryName?.split(" ")[0] ?? "Tarefa"), color: t.color ?? (late ? "rose" : "cyan"), icon: "check", kind: "tarefa", source: "tarefas", sourceRef: t.id, taskId: t.id }), t.priority === "alta" && inp.learned?.peakStart ? toMin(inp.learned.peakStart) : null, (late ? 2.5 : 3) + RANK[t.priority] * 0.2);
    });
  }

  if (opts.disposicao === "alta" && flex.some((f) => f.b.source === "tarefas")) {
    const top = flex.filter((f) => f.b.source === "tarefas").sort((a, b) => a.prio - b.prio)[0]!;
    add(block({ time: "00:00", durationMin: 60, title: `Foco profundo: ${top.b.title}`, description: "Aproveite a energia alta para a tarefa mais difícil.", tag: "Foco", color: "violet", icon: "layers", kind: "extra", source: "extra", sourceRef: "foco" }), toMin("09:30"), 0.5);
  }
  if (opts.pausas) {
    add(block({ time: "00:00", durationMin: 10, title: "Pausa para café", description: "10 min longe das telas.", tag: "Pausa", color: "amber", icon: "coffee", kind: "pausa", source: "pausa", sourceRef: "pausa1" }), toMin("10:45"), 4);
    add(block({ time: "00:00", durationMin: 10, title: "Alongamento e água", description: "Respire e se hidrate.", tag: "Pausa", color: "amber", icon: "coffee", kind: "pausa", source: "pausa", sourceRef: "pausa2" }), toMin("15:30"), 4);
  }
  if (opts.tempo === "pouco") {
    const firstHabit = flex.filter((f) => f.b.kind === "habito").sort((a, b) => (a.pref ?? 0) - (b.pref ?? 0))[0];
    for (let i = flex.length - 1; i >= 0; i--) if (flex[i]!.b.kind === "habito" && flex[i] !== firstHabit) flex.splice(i, 1);
  }
  if (opts.disposicao === "baixa") for (const f of flex) if (f.b.kind === "treino") { f.b.title = "Treino leve"; f.b.description = "Alongamento e mobilidade • ~30 min"; f.b.durationMin = 30; }

  flex.sort((a, b) => a.prio - b.prio);
  for (const f of flex) {
    const dur = f.b.durationMin;
    const s = f.pref !== null ? tl.near(f.pref, dur, from) : tl.gap(from, dur);
    if (s === null) { unplaced.push({ title: f.b.title, reason: "Não coube em nenhum horário livre." }); continue; }
    tl.add(s, s + dur); out.push({ ...f.b, time: fromMin(s) });
  }

  out.sort((a, b) => toMin(a.time) - toMin(b.time) || b.durationMin - a.durationMin);
  const totalMin = out.filter((b) => b.kind !== "pausa").reduce((n, b) => n + b.durationMin, 0);
  const window = Math.max(1, toMin(st.dayEnd) - toMin(st.dayStart)), overload = totalMin > window * 0.85 || totalMin > 9 * 60;
  if (overload) warnings.push(`O dia está pesado: ${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, "0")} de blocos. Vale tirar ou adiar alguma coisa.`);
  if (unplaced.length) warnings.push(`${unplaced.length} ${unplaced.length === 1 ? "item ficou" : "itens ficaram"} de fora do dia.`);
  return { blocks: out, unplaced, warnings, totalMin, overload };
}
