/** Planejamento v2: busca os dados reais de cada área, guarda as preferências e o que o Orion aprende. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";

import { fromIsoDate, hhmm, isoDate, todayIso } from "../dates";
import { cloudFinanceRepo } from "../finance/cloud-repo";
import { DEFAULT_SETTINGS, DEFAULT_SOURCES, planDay, type EngineInput, type Learned, type Options, type Plan, type Settings, type SourceId } from "../planning/engine";
import { applyToLearned, insights, suggestionsFrom, type PlanEvent, type Suggestion } from "../planning/learn";
import { demandsDue, financeEventsFor, mealsFrom, toHabitsIn, toRoutineIn, toTaskIn, workoutFor } from "../planning/sources";
import type { Category, Habit, RoutineItem, SplitDay, Task } from "../types";
import { must, supabase } from "./db";

export type PlanPrefs = Learned;
export type PlanSettings = Settings & { prefs: PlanPrefs };
export const DEFAULT_PLAN_SETTINGS: PlanSettings = { ...DEFAULT_SETTINGS, prefs: {} };

const ROUTINE_FULL = "id, time, title, description, tag, color, icon, kind, position, duration_min, weekdays, active";

export async function loadSettings(): Promise<PlanSettings> {
  const r = must(await supabase.from("plan_settings").select("sources, day_start, day_end, travel_min, learn, prefs").maybeSingle()) as { sources: Partial<Record<SourceId, boolean>>; day_start: string; day_end: string; travel_min: number; learn: boolean; prefs: PlanPrefs } | null;
  if (!r) return DEFAULT_PLAN_SETTINGS;
  return { sources: { ...DEFAULT_SOURCES, ...r.sources }, dayStart: r.day_start, dayEnd: r.day_end, travelMin: r.travel_min, learn: r.learn, prefs: r.prefs ?? {} };
}

export function usePlanSettings() { return useQuery({ queryKey: ["plan-settings"], queryFn: loadSettings }); }

export function useSavePlanSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: PlanSettings) => {
      must(await supabase.from("plan_settings").upsert({ sources: s.sources, day_start: s.dayStart, day_end: s.dayEnd, travel_min: s.travelMin, learn: s.learn, prefs: s.prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("user_id"));
    },
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: ["plan-settings"] }), qc.invalidateQueries({ queryKey: ["plan-preview"] })]),
  });
}

/** Dados brutos de todas as áreas, buscados uma vez só (a semana inteira reaproveita). */
export type RawPlanData = {
  settings: PlanSettings;
  routine: (RoutineItem & { duration_min: number; weekdays: number[]; active: boolean })[]; tasks: Task[]; cats: Category[]; habits: Habit[];
  completions: { habit_id: string; completed_on: string }[]; split: SplitDay[]; workouts: { id: string; name: string; duration_min: number }[];
  meals: { name: string; meal_time: string | null }[]; demands: { code: string; title: string; priority: string; status: string; deadline: string | null }[]; finance: Awaited<ReturnType<typeof cloudFinanceRepo.readCloud>>;
};

export async function loadRaw(settings?: PlanSettings, fromDate = todayIso()): Promise<RawPlanData> {
  const st = settings ?? (await loadSettings());
  const [routine, tasks, cats, habits, completions, split, workouts, sheets, demands, finance] = await Promise.all([
    supabase.from("routine_items").select(ROUTINE_FULL).order("time").order("position").then((r) => must(r) as RawPlanData["routine"]),
    supabase.from("tasks").select("id, title, description, category_id, priority, due_date, due_time, done, position, end_time, place, color").then((r) => must(r) as Task[]),
    supabase.from("task_categories").select("id, slug, name, icon, color, position").then((r) => must(r) as Category[]),
    supabase.from("habits").select("id, name, icon, color, position, active").eq("active", true).then((r) => must(r) as Habit[]),
    supabase.from("habit_completions").select("habit_id, completed_on").gte("completed_on", fromDate).then((r) => must(r) as { habit_id: string; completed_on: string }[]),
    supabase.from("workout_split").select("id, weekday, title, workout_id").then((r) => must(r) as SplitDay[]),
    supabase.from("workouts").select("id, name, duration_min").then((r) => must(r) as RawPlanData["workouts"]),
    supabase.from("diet_sheets").select("id").eq("active", true).then((r) => must(r) as { id: string }[]),
    supabase.from("project_demands").select("code, title, priority, status, deadline").limit(2000).then((r) => must(r) as RawPlanData["demands"]),
    cloudFinanceRepo.readCloud().catch(() => null),
  ]);
  const ids = sheets.map((x) => x.id);
  const meals = ids.length ? (must(await supabase.from("diet_meals").select("name, meal_time").in("sheet_id", ids)) as RawPlanData["meals"]) : [];
  return { settings: st, routine, tasks, cats, habits, completions, split, workouts, meals, demands, finance };
}

/** Monta a entrada do motor para um dia, a partir dos dados brutos. `now` = data e hora "de agora" (o servidor da voz está em outro fuso). */
export function engineInputFrom(raw: RawPlanData, date: string, opts: Options, now?: { date: string; time: string }): EngineInput {
  const weekday = fromIsoDate(date).getDay(), n = new Date(), cur = now ?? { date: todayIso(), time: `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}` };
  return {
    date, weekday, settings: raw.settings, opts, learned: raw.settings.prefs,
    routine: raw.routine.map(toRoutineIn), tasks: raw.tasks.map((t) => toTaskIn(t, raw.cats)), habits: toHabitsIn(raw.habits, new Set(raw.completions.filter((c) => c.completed_on === date).map((c) => c.habit_id))),
    workout: workoutFor(raw.split, raw.workouts, weekday), meals: mealsFrom(raw.meals), finance: raw.finance ? financeEventsFor(raw.finance, date) : [], demands: demandsDue(raw.demands, date),
    from: date === cur.date ? cur.time : undefined,
  };
}

/** Tudo o que o motor precisa, vindo do banco (e do financeiro na nuvem). */
export async function loadEngineInput(date: string, opts: Options, settings?: PlanSettings, now?: { date: string; time: string }): Promise<{ input: EngineInput; settings: PlanSettings }> {
  const raw = await loadRaw(settings, date);
  return { input: engineInputFrom(raw, date, opts, now), settings: raw.settings };
}

export async function buildPlan(date: string, opts: Options, settings?: PlanSettings, now?: { date: string; time: string }): Promise<Plan> {
  const { input } = await loadEngineInput(date, opts, settings, now);
  return planDay(input);
}

/** Prévia do plano (não grava nada): muda sozinha quando as fontes, as opções ou os dados mudam. */
export function usePlanPreview(date: string, opts: Options, enabled = true) {
  const settings = usePlanSettings();
  return useQuery({
    queryKey: ["plan-preview", date, opts, settings.data?.sources, settings.data?.prefs, settings.data?.travelMin, settings.data?.dayStart, settings.data?.dayEnd],
    enabled: enabled && settings.isSuccess,
    queryFn: () => buildPlan(date, opts, settings.data),
  });
}

/* ───────────── rotina editável ───────────── */
export type RoutineDraft = { id?: string; time: string; title: string; description: string; tag: string; color: string; icon: string; kind: string; duration_min: number; weekdays: number[]; active: boolean };
export function useRoutineFull() {
  return useQuery({ queryKey: ["routine-full"], queryFn: async () => (must(await supabase.from("routine_items").select(ROUTINE_FULL).order("time").order("position")) as (RoutineItem & { duration_min: number; weekdays: number[]; active: boolean })[]).map((r) => ({ ...r, time: hhmm(r.time) })) });
}
function useRefreshRoutine() { const qc = useQueryClient(); return () => Promise.all(["routine-full", "routine", "plan-preview"].map((k) => qc.invalidateQueries({ queryKey: [k] }))); }
export function useSaveRoutineItem() {
  const refresh = useRefreshRoutine();
  return useMutation({
    mutationFn: async (r: RoutineDraft) => {
      const row = { time: r.time, title: r.title.trim().slice(0, 120), description: r.description.slice(0, 300), tag: r.tag.slice(0, 30) || "Rotina", color: r.color, icon: r.icon || "star", kind: r.kind, duration_min: Math.max(5, Math.min(720, Math.round(r.duration_min))), weekdays: r.weekdays, active: r.active };
      if (r.id) must(await supabase.from("routine_items").update(row).eq("id", r.id).select("id"));
      else must(await supabase.from("routine_items").insert(row).select("id"));
    },
    onSuccess: refresh,
  });
}
export function useDeleteRoutineItem() {
  const refresh = useRefreshRoutine();
  return useMutation({ mutationFn: async (id: string) => { must(await supabase.from("routine_items").delete().eq("id", id).select("id")); }, onSuccess: refresh });
}
/** Rotina modelo para quem está começando (editável depois). */
export const STARTER_ROUTINE: Omit<RoutineDraft, "id">[] = [
  { time: "07:00", title: "Rotina da manhã", description: "Higiene, café, organização", tag: "Rotina", color: "emerald", icon: "sun", kind: "habito", duration_min: 45, weekdays: [0, 1, 2, 3, 4, 5, 6], active: true },
  { time: "09:00", title: "Trabalho e demandas", description: "Responder demandas e priorizar tarefas", tag: "Foco", color: "violet", icon: "laptop", kind: "tarefa", duration_min: 180, weekdays: [1, 2, 3, 4, 5], active: true },
  { time: "12:30", title: "Almoço e pausa", description: "Alimentação e descanso", tag: "Pausa", color: "amber", icon: "food", kind: "pausa", duration_min: 60, weekdays: [0, 1, 2, 3, 4, 5, 6], active: true },
  { time: "16:30", title: "Treino", description: "Treino do dia", tag: "Saúde", color: "violet", icon: "dumbbell", kind: "treino", duration_min: 60, weekdays: [1, 2, 3, 4, 5], active: true },
  { time: "22:00", title: "Rotina noturna", description: "Planejar amanhã e descansar", tag: "Rotina", color: "cyan", icon: "moon", kind: "habito", duration_min: 30, weekdays: [0, 1, 2, 3, 4, 5, 6], active: true },
];
export function useStarterRoutine() {
  const refresh = useRefreshRoutine();
  return useMutation({ mutationFn: async () => { must(await supabase.from("routine_items").insert(STARTER_ROUTINE.map((r, position) => ({ ...r, position }))).select("id")); }, onSuccess: refresh });
}

/* ───────────── o que o Orion aprende ───────────── */
export type LogEvent = { plan_date: string; action: PlanEvent["action"]; kind: string; title: string; planned_time?: string | null; at_time?: string | null };
/** Registra o que você fez no dia (só se o aprendizado estiver ligado). Nunca atrapalha a ação principal. */
export async function logPlanEvent(e: LogEvent): Promise<void> {
  try { const st = await loadSettings(); if (!st.learn) return; await supabase.from("plan_events").insert({ plan_date: e.plan_date, action: e.action, kind: e.kind || "extra", title: e.title.slice(0, 120), planned_time: e.planned_time ?? null, at_time: e.at_time ?? null }); } catch { /* aprender é um extra: falhar não pode estragar o dia */ }
}
export const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export function usePlanEvents() {
  return useQuery({ queryKey: ["plan-events"], queryFn: async () => must(await supabase.from("plan_events").select("plan_date, action, kind, title, planned_time, at_time, created_at").gte("plan_date", isoDate(addDays(new Date(), -30))).order("created_at", { ascending: false }).limit(2000)) as PlanEvent[] });
}

export type StoredSuggestion = Suggestion & { id: string; status: "nova" | "aceita" | "ignorada" };
/** Gera sugestões novas a partir do histórico e devolve as que ainda esperam sua decisão. */
export function useSuggestions() {
  const events = usePlanEvents(), settings = usePlanSettings();
  return useQuery({
    queryKey: ["plan-suggestions", events.data?.length ?? 0, settings.data?.learn],
    enabled: events.isSuccess && settings.isSuccess,
    queryFn: async () => {
      const rows = must(await supabase.from("plan_suggestions").select("id, key, kind, title, detail, payload, status")) as StoredSuggestion[];
      if (settings.data?.learn) {
        const fresh = suggestionsFrom(events.data!, todayIso(), new Set(rows.map((r) => r.key)));
        if (fresh.length) must(await supabase.from("plan_suggestions").upsert(fresh.map((s) => ({ key: s.key, kind: s.kind, title: s.title, detail: s.detail, payload: s.payload })), { onConflict: "user_id,key", ignoreDuplicates: true }).select("id"));
      }
      const all = must(await supabase.from("plan_suggestions").select("id, key, kind, title, detail, payload, status").eq("status", "nova").order("created_at", { ascending: false }).limit(10)) as StoredSuggestion[];
      return { novas: all, resumo: insights(events.data!, todayIso()) };
    },
  });
}
export function useDecideSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ s, accept, current }: { s: StoredSuggestion; accept: boolean; current: PlanSettings }) => {
      must(await supabase.from("plan_suggestions").update({ status: accept ? "aceita" : "ignorada", decided_at: new Date().toISOString() }).eq("id", s.id).select("id"));
      if (!accept) return;
      if (s.kind === "mover" && typeof s.payload["title"] === "string" && typeof s.payload["to"] === "string") {
        // mexe no horário da rotina se o item é de lá; senão fica como horário preferido aprendido
        const r = must(await supabase.from("routine_items").select("id, title").limit(500)) as { id: string; title: string }[];
        const hit = r.find((x) => x.title.toLowerCase() === (s.payload["title"] as string).toLowerCase());
        if (hit) must(await supabase.from("routine_items").update({ time: s.payload["to"] as string }).eq("id", hit.id).select("id"));
      }
      const prefs = applyToLearned(current.prefs, s);
      must(await supabase.from("plan_settings").upsert({ sources: current.sources, day_start: current.dayStart, day_end: current.dayEnd, travel_min: current.travelMin, learn: current.learn, prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("user_id"));
    },
    onSuccess: () => Promise.all(["plan-suggestions", "plan-settings", "plan-preview", "routine-full", "routine"].map((k) => qc.invalidateQueries({ queryKey: [k] }))),
  });
}

/* ───────────── semana ───────────── */
export type WeekDay = { date: string; plan: Plan; saved: boolean; savedCount: number; savedMin: number };
export const DEFAULT_OPTS: Options = { disposicao: "normal", tempo: "completo", prioridade: "", pausas: false };
/** 7 dias a partir de `start`: o plano salvo do dia (se existe) ou a prévia do motor, com o peso de cada dia. */
export function useWeekPlan(start: string) {
  const settings = usePlanSettings();
  return useQuery({
    queryKey: ["week-plan", start, settings.data?.sources, settings.data?.prefs, settings.data?.dayStart, settings.data?.dayEnd, settings.data?.travelMin],
    enabled: settings.isSuccess,
    queryFn: async (): Promise<WeekDay[]> => {
      const raw = await loadRaw(settings.data, start), days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(fromIsoDate(start), i)));
      const saved = must(await supabase.from("schedule_items").select("plan_date, duration_min, kind").gte("plan_date", days[0]!).lte("plan_date", days[6]!)) as { plan_date: string; duration_min: number; kind: string }[];
      return days.map((date) => {
        const mine = saved.filter((x) => x.plan_date === date), plan = planDay(engineInputFrom(raw, date, DEFAULT_OPTS));
        return { date, plan, saved: mine.length > 0, savedCount: mine.length, savedMin: mine.filter((x) => x.kind !== "pausa").reduce((n, x) => n + x.duration_min, 0) };
      });
    },
  });
}
