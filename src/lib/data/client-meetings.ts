/** Agendar uma reunião do cliente: vira compromisso (aparece no Calendário e nas Tarefas) já ligado ao cliente, com aviso antes. */
import { must, supabase } from "./db";
import { saveAppointment } from "./appointments";

export type ScheduleInput = { clientId: string; projectId: string; dossierId: string | null; compId: string | undefined; title: string; date: string; time: string; place: string; remind: number[] };

export async function scheduleClientMeeting(i: ScheduleInput): Promise<string> {
  const id = await saveAppointment({ title: i.title, date: i.date, time: i.time || undefined, place: i.place || undefined, color: "violet", dossierId: i.dossierId ?? undefined }, i.compId, i.projectId);
  must(await supabase.from("tasks").update({ client_id: i.clientId, remind_before: i.time && i.remind.length ? i.remind : null }).eq("id", id).select("id"));
  return id;
}
