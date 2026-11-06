/**
 * Calendário: compromissos são tarefas da categoria "Compromissos" (slug "comp") com dia e, se quiser,
 * horário. Assim eles entram sozinhos no "Organize meu dia" e no "Planeje meu dia". As outras tarefas
 * com data também aparecem no calendário.
 */
import type { Priority, RoutineItem, Task } from "./types";

export type CalKind = "compromisso" | "tarefa";
export type CalItem = {
  id: string;
  kind: CalKind;
  title: string;
  /** AAAA-MM-DD */
  date: string;
  /** HH:MM; vazio = dia todo. */
  time?: string | undefined;
  end?: string | undefined;
  place?: string | undefined;
  notes?: string | undefined;
  color: string;
  dossierId?: string | undefined;
  done: boolean;
  priority: Priority;
};
export type AppointmentDraft = {
  title: string; date: string; time?: string | undefined; end?: string | undefined;
  place?: string | undefined; notes?: string | undefined; color: string; dossierId?: string | undefined;
};
export const APPT_COLORS = ["cyan", "violet", "emerald", "amber", "pink"] as const;

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : undefined);

/** Tarefas com data viram itens do calendário; as da categoria Compromissos viram compromissos. */
export function calendarItems(tasks: Task[], compId: string | undefined): CalItem[] {
  return tasks
    .filter((t) => !!t.due_date)
    .map((t) => {
      const comp = !!compId && t.category_id === compId;
      return {
        id: t.id, kind: comp ? "compromisso" : "tarefa", title: t.title, date: t.due_date!,
        time: hm(t.due_time), end: hm(t.due_time) ? hm(t.end_time) : undefined,
        place: t.place || undefined, notes: t.description || undefined,
        color: t.color || (comp ? "violet" : "cyan"), dossierId: t.dossier_id || undefined,
        done: t.done, priority: t.priority,
      };
    });
}

/** Dados da tarefa que guarda o compromisso. Sem horário de início, o fim é ignorado. */
export function appointmentRow(d: AppointmentDraft, compId: string | null, projectId: string | null) {
  const time = d.time || null;
  return {
    title: d.title.trim().slice(0, 200),
    description: d.notes?.trim() || null,
    category_id: compId,
    due_date: d.date,
    due_time: time,
    end_time: time && d.end ? d.end : null,
    place: d.place?.trim() || null,
    color: d.color,
    project_id: projectId,
    dossier_id: d.dossierId || null,
  };
}

/** Itens de um dia: primeiro os de dia todo, depois por horário. */
export const appointmentsOn = <T extends { date: string; time?: string | undefined; title: string }>(list: T[], date: string): T[] =>
  list.filter((a) => a.date === date).sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));

/**
 * Prévia da agenda antes de gerar o plano: compromissos do dia com horário e ainda não concluídos,
 * no mesmo formato da rotina-base.
 */
export function compromissosForDay(tasks: Task[], compId: string | undefined, date: string): RoutineItem[] {
  if (!compId) return [];
  return tasks
    .filter((t) => t.category_id === compId && t.due_date === date && !!t.due_time && !t.done)
    .map((t, i) => ({
      id: `comp-${t.id}`, time: t.due_time!.slice(0, 5), title: t.title,
      description: [t.end_time ? `até ${t.end_time.slice(0, 5)}` : "", t.place ?? ""].filter(Boolean).join(" · ") || "Compromisso do calendário",
      tag: "Compromisso", color: "violet", icon: "calendar", kind: "compromisso", position: 1000 + i,
    }));
}

/** Linha da agenda do dia para um compromisso com horário (quando o dia já tem plano gerado). */
export function compromissoScheduleRow(d: AppointmentDraft, taskId: string) {
  if (!d.time) return null;
  const color = d.color === "pink" ? "rose" : (["cyan", "violet", "emerald", "amber", "rose"].includes(d.color) ? d.color : "violet");
  return {
    plan_date: d.date, time: d.time, title: d.title.trim().slice(0, 120),
    description: ([d.end ? `até ${d.end}` : "", d.place?.trim() ?? ""].filter(Boolean).join(" · ") || "Compromisso do calendário").slice(0, 300),
    tag: "Compromisso", color, icon: "calendar", kind: "compromisso", task_id: taskId, position: 999, done: false,
  };
}

/** Na lista "Minhas tarefas de hoje", um compromisso só aparece no próprio dia (não acumula como atrasado). */
export function showInTodayTasks(t: Task, compId: string | undefined, today: string) {
  if (compId && t.category_id === compId) return t.due_date === today;
  const doneToday = t.done && !!t.done_at && isoDay(new Date(t.done_at)) === today;
  return (!t.done && (!t.due_date || t.due_date <= today)) || doneToday;
}

/** AAAA-MM-DD no fuso local. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 42 dias (6 semanas, começando no domingo) que cobrem o mês. `month` é 0–11. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** Compromissos antigos que ficavam só neste navegador (versão anterior do calendário). */
type Legacy = { title: string; date: string; time?: string; end?: string; place?: string; notes?: string; color: string; dossierId?: string };
const legacyKey = (projectId: string) => `presence.appointments.${projectId}`;
export function takeLegacyAppointments(projectId: string): AppointmentDraft[] {
  try {
    const raw = localStorage.getItem(legacyKey(projectId));
    if (!raw) return [];
    const list = JSON.parse(raw) as Legacy[];
    return Array.isArray(list) ? list.filter((a) => a?.title && a?.date) : [];
  } catch {
    return [];
  }
}
export function clearLegacyAppointments(projectId: string) {
  try { localStorage.removeItem(legacyKey(projectId)); } catch { /* ignora */ }
}
