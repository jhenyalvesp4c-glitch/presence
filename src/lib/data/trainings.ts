import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { trainingAppointment, type Training, type TrainingDraft } from "../trainings";
import { saveAppointment, syncSchedule } from "./appointments";
import { must, supabase } from "./db";

type Row = {
  id: string; task_id: string; group_name: string; people: number; script_key: string; script_title: string; notes: string;
  task: { due_date: string | null; due_time: string | null; end_time: string | null; place: string | null; done: boolean } | null;
};
const COLS = "id, task_id, group_name, people, script_key, script_title, notes, task:tasks(due_date, due_time, end_time, place, done)";
const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : undefined);

export function useTrainings() {
  return useQuery({
    queryKey: ["trainings"],
    queryFn: async () =>
      (must(await supabase.from("training_sessions").select(COLS)) as Row[])
        .filter((r) => r.task?.due_date)
        .map((r): Training => ({
          id: r.id, taskId: r.task_id, group: r.group_name, people: r.people, scriptKey: r.script_key, scriptTitle: r.script_title,
          notes: r.notes || undefined, date: r.task!.due_date!, time: hm(r.task!.due_time), end: hm(r.task!.end_time),
          place: r.task!.place || undefined, done: r.task!.done,
        })),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all(["trainings", "tasks", "schedule", "pending-count"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

function trainingRow(d: TrainingDraft) {
  return {
    group_name: d.group.trim().slice(0, 120), people: Math.max(0, Math.min(1000, Math.round(d.people || 0))),
    script_key: d.scriptKey.slice(0, 60), script_title: d.scriptTitle.trim().slice(0, 200), notes: (d.notes ?? "").trim().slice(0, 1500),
  };
}

/** Cria ou edita uma turma: grava o compromisso no calendário e os dados da turma. */
export function useSaveTraining(compId: string | undefined, projectId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ draft, existing }: { draft: TrainingDraft; existing?: Training | undefined }) => {
      const taskId = await saveAppointment(trainingAppointment(draft), compId, projectId, existing?.taskId);
      if (existing) must(await supabase.from("training_sessions").update(trainingRow(draft)).eq("id", existing.id).select("id"));
      else must(await supabase.from("training_sessions").insert({ ...trainingRow(draft), task_id: taskId }).select("id"));
    },
    onSuccess: invalidate,
  });
}

/** Exclui a turma (o compromisso some do calendário e da agenda do dia junto). */
export function useDeleteTraining() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (t: Training) => {
      await syncSchedule(t.taskId, null);
      must(await supabase.from("tasks").delete().eq("id", t.taskId).select("id"));
    },
    onSuccess: invalidate,
  });
}
