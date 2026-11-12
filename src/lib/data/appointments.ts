import { useMutation, useQueryClient } from "@tanstack/react-query";

import { appointmentRow, compromissoScheduleRow, type AppointmentDraft } from "../appointments";
import { must, supabase } from "./db";

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["tasks"] }),
      qc.invalidateQueries({ queryKey: ["schedule"] }),
      qc.invalidateQueries({ queryKey: ["pending-count"] }),
      qc.invalidateQueries({ queryKey: ["trainings"] }),
    ]);
}

/**
 * Mantém a agenda do dia em sincronia: se o dia do compromisso já tem plano gerado
 * ("Organize/Planeje meu dia"), o compromisso entra (ou sai) dele na hora.
 */
export async function syncSchedule(taskId: string, d: AppointmentDraft | null) {
  must(await supabase.from("schedule_items").delete().eq("task_id", taskId).select("id"));
  const row = d ? compromissoScheduleRow(d, taskId) : null;
  if (!row) return;
  const { data: planned } = await supabase.from("schedule_items").select("id").eq("plan_date", row.plan_date).limit(1);
  if (planned?.length) must(await supabase.from("schedule_items").insert(row).select("id"));
}

/** Grava o compromisso (tarefa da categoria Compromissos) e devolve o id da tarefa. */
export async function saveAppointment(draft: AppointmentDraft, compId: string | undefined, projectId: string | null, id?: string): Promise<string> {
  if (!compId) throw new Error("A categoria Compromissos ainda não carregou.");
  let taskId = id;
  if (id) {
    const { project_id: _p, ...patch } = appointmentRow(draft, compId, projectId);
    must(await supabase.from("tasks").update(patch).eq("id", id).select("id"));
  } else {
    const row = must(await supabase.from("tasks").insert(appointmentRow(draft, compId, projectId)).select("id").single()) as { id: string };
    taskId = row.id;
  }
  await syncSchedule(taskId!, draft);
  return taskId!;
}

/** Cria ou edita um compromisso (guardado como tarefa da categoria Compromissos). */
export function useSaveAppointment(compId: string | undefined, projectId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ draft, id }: { draft: AppointmentDraft; id?: string | undefined }) => {
      await saveAppointment(draft, compId, projectId, id);
    },
    onSuccess: invalidate,
  });
}

/** Exclui o item do calendário e tira ele da agenda do dia. */
export function useDeleteCalendarItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      await syncSchedule(id, null);
      must(await supabase.from("tasks").delete().eq("id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}

/** Dossiê excluído: os compromissos dele continuam, mas viram gerais. */
export async function unlinkDossierAppointments(projectId: string, dossierId: string) {
  must(await supabase.from("tasks").update({ dossier_id: null }).eq("project_id", projectId).eq("dossier_id", dossierId).select("id"));
}

/** Leva para o banco os compromissos que estavam só neste navegador. */
export async function importAppointments(drafts: AppointmentDraft[], compId: string, projectId: string) {
  if (!drafts.length) return;
  const rows = must(await supabase.from("tasks").insert(drafts.map((d) => appointmentRow(d, compId, projectId))).select("id")) as { id: string }[];
  await Promise.all(rows.map((r, i) => syncSchedule(r.id, drafts[i]!)));
}
