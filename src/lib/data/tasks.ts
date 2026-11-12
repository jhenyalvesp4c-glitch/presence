import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Category, Color, Priority, Task } from "../types";
import { must, supabase } from "./db";

const TASK_COLS = "id, title, description, category_id, priority, due_date, due_time, done, done_at, position, created_at, end_time, place, color, project_id, dossier_id";

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
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Task, "title" | "description" | "category_id" | "priority" | "due_date" | "due_time">> }) => {
      const clean = { ...patch, ...(patch.title !== undefined ? { title: patch.title.trim().slice(0, 200) } : {}) };
      must(await supabase.from("tasks").update(clean).eq("id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}
