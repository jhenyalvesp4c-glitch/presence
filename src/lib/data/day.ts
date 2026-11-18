import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fromMin, hhmm, isoDate, toMin } from "../dates";
import type { Category, Color, DayPlan, DayPriority, Kind, RoutineItem, ScheduleItem, Task } from "../types";
import { must, supabase } from "./db";
import { loadEngineInput, logPlanEvent, nowHHMM } from "./planning";
import { planDay } from "../planning/engine";

const ITEM_COLS = "id, plan_date, time, title, description, tag, color, icon, kind, done, position, task_id, duration_min, source, source_ref";
const ROUTINE_COLS = "id, time, title, description, tag, color, icon, kind, position";
const PLAN_COLS = "id, plan_date, disposicao, tempo, prioridade, pausas, categories, focus_areas, started_at";

const todayKey = () => isoDate(new Date());
const norm = <T extends { time: string }>(i: T): T => ({ ...i, time: hhmm(i.time) });

export function useRoutine() {
  return useQuery({
    queryKey: ["routine"],
    queryFn: async () => (must(await supabase.from("routine_items").select(ROUTINE_COLS).order("time").order("position")) as RoutineItem[]).map(norm),
  });
}

export function useDayPlan(date: string) {
  return useQuery({
    queryKey: ["day-plan", date],
    queryFn: async () => (must(await supabase.from("day_plans").select(PLAN_COLS).eq("plan_date", date).maybeSingle()) as DayPlan | null) ?? null,
  });
}

export function useSchedule(date: string) {
  return useQuery({
    queryKey: ["schedule", date],
    queryFn: async () =>
      (must(await supabase.from("schedule_items").select(ITEM_COLS).eq("plan_date", date).order("time").order("position")) as ScheduleItem[]).map(norm),
  });
}

export function useDayPriorities(date: string) {
  return useQuery({
    queryKey: ["day-priorities", date],
    queryFn: async () =>
      must(await supabase.from("day_priorities").select("id, plan_date, title, done, starred, position").eq("plan_date", date).order("position")) as DayPriority[],
  });
}

function useInvalidateDay() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["schedule"] }),
      qc.invalidateQueries({ queryKey: ["day-plan"] }),
      qc.invalidateQueries({ queryKey: ["day-priorities"] }),
      qc.invalidateQueries({ queryKey: ["routine"] }),
      qc.invalidateQueries({ queryKey: ["tasks"] }),
    ]);
}

// ───────────── edição do dia ─────────────

export function useToggleScheduleItem() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: async (item: Pick<ScheduleItem, "id" | "done" | "task_id"> & Partial<Pick<ScheduleItem, "time" | "title" | "kind" | "plan_date">>) => {
      const done = !item.done;
      must(await supabase.from("schedule_items").update({ done }).eq("id", item.id).select("id"));
      if (item.title) void logPlanEvent({ plan_date: item.plan_date ?? todayKey(), action: done ? "feito" : "desfeito", kind: item.kind ?? "extra", title: item.title, planned_time: item.time ?? null, at_time: done ? nowHHMM() : null });
      if (item.task_id) {
        must(await supabase.from("tasks").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", item.task_id).select("id"));
      }
    },
    onSuccess: invalidate,
  });
}

export type ItemDraft = Omit<ScheduleItem, "id" | "done" | "task_id" | "position"> & { id?: string };

export function useSaveScheduleItem() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: async (item: ItemDraft) => {
      const row = {
        plan_date: item.plan_date, time: item.time, title: item.title.trim().slice(0, 120), description: item.description.slice(0, 300),
        tag: item.tag.slice(0, 30), color: item.color, icon: item.icon, kind: item.kind, duration_min: Math.max(5, Math.min(720, Math.round(item.duration_min ?? 30))),
      };
      if (item.id) must(await supabase.from("schedule_items").update(row).eq("id", item.id).select("id"));
      else must(await supabase.from("schedule_items").insert({ ...row, source: "manual" }).select("id"));
      void logPlanEvent({ plan_date: item.plan_date, action: item.id ? "editado" : "adicionado", kind: item.kind, title: item.title, planned_time: item.time });
    },
    onSuccess: invalidate,
  });
}

export function useDeleteScheduleItem() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: async (id: string | { id: string; title: string; kind: string; time: string; plan_date: string }) => {
      const item = typeof id === "string" ? { id } : id;
      must(await supabase.from("schedule_items").delete().eq("id", item.id).select("id"));
      if ("title" in item) void logPlanEvent({ plan_date: item.plan_date, action: "removido", kind: item.kind, title: item.title, planned_time: item.time });
    },
    onSuccess: invalidate,
  });
}

/** Grava novos horários/ordem de vários itens de uma vez. */
export function useSetItemTimes() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: async (rows: { id: string; time: string; position: number }[]) => {
      await Promise.all(rows.map(async (r) => must(await supabase.from("schedule_items").update({ time: r.time, position: r.position }).eq("id", r.id).select("id"))));
    },
    onSuccess: invalidate,
  });
}

export function useSavePlanPrefs(date: string) {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: async (prefs: Partial<Omit<DayPlan, "id" | "plan_date">>) => {
      must(await supabase.from("day_plans").upsert({ plan_date: date, ...prefs }, { onConflict: "user_id,plan_date" }).select("id"));
    },
    onSuccess: invalidate,
  });
}

export function useStartDay(date: string) {
  const save = useSavePlanPrefs(date);
  return () => save.mutateAsync({ started_at: new Date().toISOString() });
}

export function useSetPriority() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<DayPriority, "done" | "starred">> }) => {
      must(await supabase.from("day_priorities").update(patch).eq("id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}

/** Só uma prioridade pode ser a principal (estrela). */
export function useStarPriority(date: string) {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: async (id: string) => {
      must(await supabase.from("day_priorities").update({ starred: false }).eq("plan_date", date).select("id"));
      must(await supabase.from("day_priorities").update({ starred: true }).eq("id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}

/** "Salvar como rotina": a rotina-base passa a ser o plano de hoje. */
export function useSaveAsRoutine() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: async (items: ScheduleItem[]) => {
      if (!items.length) throw new Error("Não há atividades para salvar.");
      must(await supabase.from("routine_items").delete().not("id", "is", null).select("id"));
      must(
        await supabase.from("routine_items").insert(
          items.map((i, position) => ({ time: i.time, title: i.title, description: i.description, tag: i.tag, color: i.color, icon: i.icon, kind: i.kind, position })),
        ).select("id"),
      );
    },
    onSuccess: invalidate,
  });
}

// ───────────── geração do plano ─────────────

export type GenerateOptions =
  | { mode: "planejamento"; date: string; disposicao: DayPlan["disposicao"]; tempo: DayPlan["tempo"]; prioridade: string; pausas: boolean }
  | { mode: "organizar"; date: string; categories: string[]; focusAreas: string[] };

type Draft = { time: string; title: string; description: string; tag: string; color: Color; icon: string; kind: Kind; task_id: string | null };

const CAT_KINDS: Record<string, Kind[]> = {
  tarefas: ["tarefa"], comp: ["compromisso"], habitos: ["habito", "pausa"], treino: ["treino"], auto: ["autocuidado"], fin: ["financeiro"],
};
const AREA_SLUGS: Record<string, string[]> = {
  Projetos: ["trab"], Trabalho: ["trab"], Saúde: ["saude"], Casa: ["casa"], Financeiro: ["fin"], Pessoal: ["pes"],
};
const RANK = { alta: 0, media: 1, baixa: 2 } as const;

const COLORS: Color[] = ["cyan", "violet", "emerald", "amber", "rose"];
/** Cor escolhida no calendário (o calendário chama o rosa de "pink"). */
const taskColor = (c: string | null | undefined): Color | undefined => {
  const x = c === "pink" ? "rose" : c;
  return COLORS.includes(x as Color) ? (x as Color) : undefined;
};

function taskDraft(t: Task, cat: Category | undefined): Draft {
  const comp = cat?.slug === "comp";
  // Compromisso do calendário: horário de fim e local entram na descrição.
  const extra = comp ? [t.end_time ? `até ${hhmm(t.end_time)}` : "", t.place ?? ""].filter(Boolean).join(" · ") : "";
  return {
    time: hhmm(t.due_time), title: t.title, description: extra || t.description || cat?.name || "Tarefa",
    tag: comp ? "Compromisso" : (cat?.name.split(" ")[0] ?? "Tarefa"), color: taskColor(t.color) ?? cat?.color ?? "cyan", icon: cat?.icon ?? "check",
    kind: comp ? "compromisso" : "tarefa", task_id: t.id,
  };
}

/** Plano do dia a partir dos dados reais (calendário, tarefas, hábitos, saúde, financeiro, demandas e a sua rotina). */
async function generatePlanned(opts: Extract<GenerateOptions, { mode: "planejamento" }>, now?: { date: string; time: string }) {
  const { date } = opts;
  const { input } = await loadEngineInput(date, { disposicao: opts.disposicao, tempo: opts.tempo, prioridade: opts.prioridade, pausas: opts.pausas }, undefined, now);
  const plan = planDay(input);
  const existing = must(await supabase.from("schedule_items").select("title, done").eq("plan_date", date)) as { title: string; done: boolean }[];
  const wasDone = new Set(existing.filter((e) => e.done).map((e) => e.title));
  must(await supabase.from("schedule_items").delete().eq("plan_date", date).select("id"));
  if (plan.blocks.length) {
    must(await supabase.from("schedule_items").insert(plan.blocks.map((b, position) => ({
      plan_date: date, time: b.time, title: b.title, description: b.description, tag: b.tag, color: b.color, icon: b.icon, kind: b.kind, task_id: b.taskId,
      duration_min: b.durationMin, source: b.source, source_ref: b.sourceRef, position, done: wasDone.has(b.title),
    }))).select("id"));
  }
  must(await supabase.from("day_plans").upsert({ plan_date: date, disposicao: opts.disposicao, tempo: opts.tempo, prioridade: opts.prioridade.trim().slice(0, 120), pausas: opts.pausas }, { onConflict: "user_id,plan_date" }).select("id"));
  return { count: plan.blocks.length, warnings: plan.warnings, unplaced: plan.unplaced };
}

export async function generateDay(opts: GenerateOptions, now?: { date: string; time: string }): Promise<{ count: number; warnings?: string[]; unplaced?: { title: string; reason: string }[] }> {
  if (opts.mode === "planejamento") return generatePlanned(opts, now);
  // "Organizar meu dia" (tela /organizar): monta o dia pela rotina e pelas tarefas das áreas escolhidas
  const { date } = opts;
  const [routine, tasks, cats, existing] = await Promise.all([
    supabase.from("routine_items").select(ROUTINE_COLS).order("time").order("position").then((r) => (must(r) as RoutineItem[]).map(norm)),
    supabase.from("tasks").select("id, title, description, category_id, priority, due_date, due_time, done, position, end_time, place, color").then((r) => must(r) as Task[]),
    supabase.from("task_categories").select("id, slug, name, icon, color, position").then((r) => must(r) as Category[]),
    supabase.from("schedule_items").select("title, done").eq("plan_date", date).then((r) => must(r) as { title: string; done: boolean }[]),
  ]);
  const catById = new Map(cats.map((c) => [c.id, c]));

  let list: Draft[] = routine.map((r) => ({ time: r.time, title: r.title, description: r.description, tag: r.tag, color: r.color, icon: r.icon, kind: r.kind, task_id: null }));
  for (const t of tasks) if (t.due_date === date && t.due_time && !t.done) list.push(taskDraft(t, t.category_id ? catById.get(t.category_id) : undefined));

  const allowed = new Set(opts.categories.flatMap((c) => CAT_KINDS[c] ?? []));
  list = list.filter((a) => a.kind === "extra" || allowed.has(a.kind));

  list.sort((a, b) => toMin(a.time) - toMin(b.time));
  const wasDone = new Set(existing.filter((e) => e.done).map((e) => e.title));

  must(await supabase.from("schedule_items").delete().eq("plan_date", date).select("id"));
  if (list.length) {
    must(await supabase.from("schedule_items").insert(list.map((d, position) => ({ ...d, plan_date: date, position, done: wasDone.has(d.title) }))).select("id"));
  }

  must(await supabase.from("day_plans").upsert({ plan_date: date, categories: opts.categories, focus_areas: opts.focusAreas }, { onConflict: "user_id,plan_date" }).select("id"));
  // Prioridades do dia: tarefas pendentes das áreas de foco, alta prioridade primeiro.
  const slugs = new Set(opts.focusAreas.flatMap((a) => AREA_SLUGS[a] ?? []));
  const picks = tasks
    .filter((t) => !t.done && t.category_id && slugs.has(catById.get(t.category_id)?.slug ?? ""))
    .sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.position - b.position)
    .slice(0, 5);
  must(await supabase.from("day_priorities").delete().eq("plan_date", date).select("id"));
  if (picks.length) {
    must(await supabase.from("day_priorities").insert(picks.map((t, position) => ({ plan_date: date, title: t.title, starred: position === 0, position }))).select("id"));
  }
  return { count: list.length };
}

/** Adia um item para amanhã (ou outro dia): vai para o plano daquele dia; se é uma tarefa, a tarefa muda de data. */
export function usePostponeItem() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: async ({ item, toDate }: { item: Pick<ScheduleItem, "id" | "title" | "description" | "tag" | "color" | "icon" | "kind" | "task_id" | "time" | "plan_date"> & { duration_min?: number }; toDate: string }) => {
      must(await supabase.from("schedule_items").delete().eq("id", item.id).select("id"));
      must(await supabase.from("schedule_items").insert({ plan_date: toDate, time: item.time, title: item.title, description: item.description, tag: item.tag, color: item.color, icon: item.icon, kind: item.kind, task_id: item.task_id, duration_min: item.duration_min ?? 30, source: "manual", position: 99, done: false }).select("id"));
      if (item.task_id) must(await supabase.from("tasks").update({ due_date: toDate }).eq("id", item.task_id).select("id"));
      void logPlanEvent({ plan_date: item.plan_date, action: "adiado", kind: item.kind, title: item.title, planned_time: item.time });
    },
    onSuccess: invalidate,
  });
}

export function useGenerateDay() {
  const invalidate = useInvalidateDay();
  return useMutation({ mutationFn: (o: GenerateOptions) => generateDay(o), onSuccess: invalidate });
}

export { fromMin };

/** Categorias da tela "Organizar" ↔ tipos de atividade do banco. */
export type OrgCat = "tarefas" | "comp" | "habitos" | "treino" | "auto" | "fin";
export const kindToCat = (k: Kind): OrgCat =>
  ({ tarefa: "tarefas", compromisso: "comp", habito: "habitos", pausa: "habitos", treino: "treino", autocuidado: "auto", financeiro: "fin", extra: "tarefas" } as const)[k];
