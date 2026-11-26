import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deadlineIso, type Demand } from "../demands";
import type { Category, Color, Priority, Task } from "../types";
import { must, supabase } from "./db";

const TASK_COLS = "id, title, description, category_id, priority, due_date, due_time, done, done_at, position, created_at, end_time, place, color, project_id, dossier_id, remind_before, client_id, attachments";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      must(await supabase.from("task_categories").select("id, slug, name, icon, color, position").order("position")) as Category[],
  });
}

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () =>
      must(
        await supabase
          .from("tasks")
          .select(TASK_COLS)
          .order("position")
          .order("created_at"),
      ) as Task[],
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all(["tasks", "schedule", "pending-count", "trainings"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export type NewTask = {
  title: string;
  description?: string | null;
  category_id?: string | null;
  priority?: Priority;
  due_date?: string | null;
  due_time?: string | null;
  remind_before?: number[] | null;
  client_id?: string | null;
  attachments?: { path: string; name: string; mime: string; size: number }[];
};

/** Cria a tarefa no topo da lista manual (usado pela tela e pelo MCP). `extra` leva os campos novos (origem, vínculos). */
export async function createTaskRow(t: NewTask, extra: Record<string, unknown> = {}): Promise<Task> {
  const { data: first } = await supabase.from("tasks").select("position").order("position").limit(1).maybeSingle();
  const position = (first?.position ?? 1) - 1;
  return must(
    await supabase
      .from("tasks")
      .insert({ ...t, ...extra, title: t.title.trim().slice(0, 200), position })
      .select(TASK_COLS)
      .single(),
  ) as Task;
}

export function useCreateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (t: NewTask) => createTaskRow(t),
    onSuccess: invalidate,
  });
}

export function useToggleTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      must(await supabase.from("tasks").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id).select("id"));
      // Mantém a agenda do dia em sincronia com a tarefa.
      must(await supabase.from("schedule_items").update({ done }).eq("task_id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      must(await supabase.from("tasks").delete().eq("id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}

/** Persiste a ordem manual (arrastar e soltar) gravando `position` de cada tarefa. */
export function useReorderTasks() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map(async (id, position) => must(await supabase.from("tasks").update({ position }).eq("id", id).select("id"))),
      );
    },
    onSuccess: invalidate,
  });
}

export function useUpdateTaskPriority() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: Priority }) => {
      must(await supabase.from("tasks").update({ priority }).eq("id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color, icon }: { name: string; color: Color; icon: string }) => {
      const clean = name.trim().slice(0, 60);
      const base = clean.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "cat";
      const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: last } = await supabase.from("task_categories").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
      return must(
        await supabase
          .from("task_categories")
          .insert({ name: clean, color, icon, slug, position: (last?.position ?? 0) + 1 })
          .select("id, slug, name, icon, color, position")
          .single(),
      ) as Category;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Task, "title" | "description" | "category_id" | "priority" | "due_date" | "due_time" | "remind_before" | "client_id" | "attachments">> }) => {
      const clean = { ...patch, ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 200) } : {}) };
      must(await supabase.from("tasks").update(clean).eq("id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}


/** Tarefas que já nasceram de demandas deste projeto (código da demanda → id da tarefa). */
export function useDemandTasks(projectId: string | null) {
  return useQuery({
    queryKey: ["demand-tasks", projectId],
    enabled: !!projectId,
    queryFn: async () => new Map((must(await supabase.from("tasks").select("id, demand_code").eq("project_id", projectId!).not("demand_code", "is", null)) as { id: string; demand_code: string }[]).map((r) => [r.demand_code, r.id])),
  });
}

/** Texto e dados da tarefa que representa uma demanda. */
export function taskFromDemand(d: Demand, now: Date = new Date()): NewTask {
  const check = d.checklist?.length ? `\n\nChecklist da demanda:\n${d.checklist.map((c) => `${c.done ? "[x]" : "[ ]"} ${c.text}`).join("\n")}` : "";
  return {
    title: `${d.id.replace(/^#/, "")} · ${d.title}`.slice(0, 200),
    description: `${d.polo ? `Dossiê: ${d.polo}\n` : ""}${d.desc.trim()}${check}`.trim().slice(0, 2000) || null,
    priority: d.priority, due_date: deadlineIso(d.deadline, now),
  };
}

/** A categoria "Demandas" das Tarefas (cria na primeira vez; se já existir uma com esse nome, usa ela). */
export async function ensureDemandCategory(): Promise<string> {
  const all = must(await supabase.from("task_categories").select("id, slug, name, position")) as { id: string; slug: string; name: string; position: number }[];
  const hit = all.find((c) => c.slug === "demandas" || c.name.trim().toLowerCase() === "demandas");
  if (hit) return hit.id;
  const last = all.reduce((m, c) => Math.max(m, c.position), 0);
  return (must(await supabase.from("task_categories").insert({ name: "Demandas", color: "violet", icon: "layers", slug: "demandas", position: last + 1 }).select("id").single()) as { id: string }).id;
}

/** A categoria "Clientes" das Tarefas: tudo o que se faz para os clientes/polos (cria na primeira vez; se já existir uma com esse nome, usa ela). */
export async function ensureClientCategory(): Promise<string> {
  const all = must(await supabase.from("task_categories").select("id, slug, name, position")) as { id: string; slug: string; name: string; position: number }[];
  const hit = all.find((c) => c.slug === "clientes" || c.name.trim().toLowerCase() === "clientes");
  if (hit) return hit.id;
  const last = all.reduce((m, c) => Math.max(m, c.position), 0);
  return (must(await supabase.from("task_categories").insert({ name: "Clientes", color: "cyan", icon: "laptop", slug: "clientes", position: last + 1 }).select("id").single()) as { id: string }).id;
}

/** Coloca a demanda na lista de Tarefas (uma vez só: se já existe, devolve a existente). */
export async function addDemandAsTask(projectId: string, d: Demand): Promise<{ id: string; created: boolean }> {
  const have = must(await supabase.from("tasks").select("id").eq("project_id", projectId).eq("demand_code", d.id).limit(1)) as { id: string }[];
  if (have[0]) return { id: have[0].id, created: false };
  const category_id = await ensureDemandCategory();
  const t = await createTaskRow({ ...taskFromDemand(d), category_id }, { project_id: projectId, demand_code: d.id, source: "manual" });
  return { id: t.id, created: true };
}
