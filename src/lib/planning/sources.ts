/** Transforma os dados reais de cada área (linhas do banco) no que o motor do planejamento entende. Puro e testado. */
import { addMonths, brl, dayIn, invoiceLabel, isoOf, recurringActiveIn, upcomingInvoices, ymOf } from "../finance/calc";
import type { FinanceState } from "../finance/types";
import type { Category, Color, Habit, RoutineItem, SplitDay, Task, Workout } from "../types";
import type { DemandIn, FinanceIn, HabitIn, MealIn, RoutineIn, TaskIn, WorkoutIn } from "./engine";

const COLORS: Color[] = ["cyan", "violet", "emerald", "amber", "rose"];
const color = (c: string | null | undefined): Color | null => { const x = c === "pink" ? "rose" : c; return COLORS.includes(x as Color) ? (x as Color) : null; };
const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

export const toRoutineIn = (r: RoutineItem & { duration_min?: number; weekdays?: number[]; active?: boolean }): RoutineIn => ({
  id: r.id, time: hhmm(r.time), title: r.title, description: r.description, tag: r.tag, color: r.color, icon: r.icon, kind: r.kind,
  durationMin: r.duration_min ?? 30, weekdays: r.weekdays ?? [0, 1, 2, 3, 4, 5, 6], active: r.active ?? true,
});

export const toTaskIn = (t: Task, cats: Category[]): TaskIn => {
  const cat = cats.find((c) => c.id === t.category_id);
  return {
    id: t.id, title: t.title, description: t.description, priority: t.priority, dueDate: t.due_date, dueTime: t.due_time, endTime: t.end_time ?? null,
    place: t.place ?? null, done: t.done, isCompromisso: cat?.slug === "comp", color: color(t.color) ?? null, categoryName: cat?.name ?? null,
  };
};

/** Hábitos ativos; `doneToday` vem das conclusões de hoje. */
export const toHabitsIn = (habits: Habit[], completedToday: Set<string>): HabitIn[] => habits.filter((h) => h.active).map((h) => ({ id: h.id, name: h.name, icon: h.icon, color: h.color, doneToday: completedToday.has(h.id) }));

/** Treino do dia pela divisão da semana: com treino = título e duração; dia sem treino = "descanso"; sem divisão cadastrada = null (não sei). */
export function workoutFor(split: SplitDay[], workouts: Pick<Workout, "id" | "name" | "duration_min">[], weekday: number): WorkoutIn {
  if (!split.length) return null;
  const row = split.find((s) => s.weekday === weekday);
  if (!row || !row.workout_id) return "descanso";
  const w = workouts.find((x) => x.id === row.workout_id);
  return { title: w?.name ?? row.title, durationMin: w?.duration_min ?? 60 };
}

export const mealsFrom = (meals: { name: string; meal_time: string | null }[]): MealIn[] => meals.flatMap((m) => (m.meal_time && /^\d{1,2}:\d{2}/.test(m.meal_time) ? [{ name: m.name, time: m.meal_time.slice(0, 5).padStart(5, "0") }] : []));

/** Prazo de demanda escrito como "2026-11-17", "17/11/2026" ou "17/11" (ano atual). */
export function parseDeadline(text: string | null | undefined, today: string): string | null {
  const t = (text ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(t);
  if (!m) return null;
  const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today.slice(0, 4));
  return `${y}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[1])).padStart(2, "0")}`;
}

export function demandsDue(rows: { code: string; title: string; priority: string; status: string; deadline: string | null }[], date: string): DemandIn[] {
  return rows.filter((d) => d.status !== "concluida" && parseDeadline(d.deadline, date) === date).map((d) => ({ code: d.code, title: d.title, priority: d.priority === "alta" || d.priority === "baixa" ? d.priority : "media" }));
}

/** O que vence ou cai hoje no financeiro: faturas que vencem e contas fixas pagas em conta. */
export function financeEventsFor(s: FinanceState, date: string): FinanceIn[] {
  const out: FinanceIn[] = [], d = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
  const ref = new Date(d.getFullYear(), d.getMonth() - 1, d.getDate()); // faturas que vencem hoje já saíram da "aberta"
  for (const c of s.cards) for (const inv of upcomingInvoices(s, c, ref, 4)) if (inv.due === date && inv.total > 0) out.push({ id: `fat:${c.id}:${inv.ym}`, title: `Pagar a fatura ${c.name}`, detail: `Vence hoje · ${brl(inv.total)} · ${invoiceLabel(c, inv.ym)}` });
  const ym = ymOf(date);
  for (const r of s.recurring) if (r.kind === "despesa" && !r.cardId && r.method !== "credito" && recurringActiveIn(r, ym) && dayIn(ym, r.day) === date) out.push({ id: `rec:${r.id}`, title: `Pagar ${r.desc}`, detail: `Conta fixa de hoje · ${brl(r.amount)}` });
  return out;
}
export { addMonths, isoOf };
