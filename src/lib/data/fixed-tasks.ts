/** Tarefas fixas na nuvem: a regra (título, dias da semana, horário) e a marcação de feito de cada dia. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { FixedTask } from "../fixed-tasks";
import type { Priority } from "../types";
import { must, supabase } from "./db";

const COLS = "id, title, category_id, priority, due_time, weekdays, active, position";
type Row = Omit<FixedTask, "weekdays"> & { weekdays: number[] | null };
export const useFixedTasks = () => useQuery({
  queryKey: ["fixed-tasks"],
  queryFn: async (): Promise<FixedTask[]> => (must(await supabase.from("fixed_tasks").select(COLS).order("position").order("created_at")) as Row[]).map((r) => ({ ...r, weekdays: r.weekdays ?? [] })),
});
/** Conjunto "fixedId|data" das ocorrências concluídas entre duas datas. */
export const useFixedDone = (from: string, to: string) => useQuery({
  queryKey: ["fixed-done", from, to],
  queryFn: async (): Promise<Set<string>> => new Set((must(await supabase.from("fixed_task_done").select("fixed_id, done_date").gte("done_date", from).lte("done_date", to).limit(2000)) as { fixed_id: string; done_date: string }[]).map((r) => `${r.fixed_id}|${r.done_date}`)),
});

export type NewFixed = { title: string; category_id: string | null; priority: Priority; due_time: string | null; weekdays: number[] };
export function useFixedActions() {
  const qc = useQueryClient(), refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["fixed-tasks"] }), qc.invalidateQueries({ queryKey: ["fixed-done"] })]);
  return {
    create: useMutation({ mutationFn: async (t: NewFixed) => { must(await supabase.from("fixed_tasks").insert({ ...t, title: t.title.trim().slice(0, 200) }).select("id")); }, onSuccess: refresh }),
    update: useMutation({ mutationFn: async (v: { id: string; patch: Partial<NewFixed & { active: boolean }> }) => { must(await supabase.from("fixed_tasks").update(v.patch).eq("id", v.id).select("id")); }, onSuccess: refresh }),
    remove: useMutation({ mutationFn: async (id: string) => { must(await supabase.from("fixed_tasks").delete().eq("id", id).select("id")); }, onSuccess: refresh }),
    toggle: useMutation({
      mutationFn: async (v: { id: string; date: string; done: boolean }) => {
        if (v.done) must(await supabase.from("fixed_task_done").upsert({ fixed_id: v.id, done_date: v.date }, { onConflict: "fixed_id,done_date" }).select("id"));
        else must(await supabase.from("fixed_task_done").delete().eq("fixed_id", v.id).eq("done_date", v.date).select("id"));
      },
      onSuccess: () => void qc.invalidateQueries({ queryKey: ["fixed-done"] }),
    }),
  };
}
