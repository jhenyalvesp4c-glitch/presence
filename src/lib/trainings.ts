/**
 * Turmas de treinamento: cada turma é um compromisso do calendário (tarefa da categoria
 * Compromissos) + uma linha em training_sessions com os dados da turma. Assim ela entra
 * sozinha no Calendário, no "Organize/Planeje meu dia" e nas respostas do assistente.
 */
import type { AppointmentDraft } from "./appointments";

export type TrainingDraft = {
  group: string; people: number; scriptKey: string; scriptTitle: string;
  date: string; time?: string | undefined; end?: string | undefined; place?: string | undefined; notes?: string | undefined;
};
export type Training = TrainingDraft & { id: string; taskId: string; done: boolean };

export const TRAINING_COLOR = "amber";
export const trainingTitle = (group: string) => `Treinamento · ${group.trim()}`;

/** Resumo que vai para a descrição do compromisso (é o que o calendário e o assistente leem). */
export function trainingSummary(d: TrainingDraft) {
  const parts = [d.scriptTitle.trim() && `Roteiro: ${d.scriptTitle.trim()}`, d.people > 0 && `${d.people} ${d.people === 1 ? "pessoa" : "pessoas"}`].filter(Boolean);
  return [parts.join(" · "), d.notes?.trim() ?? ""].filter(Boolean).join("\n");
}

export function trainingAppointment(d: TrainingDraft): AppointmentDraft {
  return {
    title: trainingTitle(d.group), date: d.date, time: d.time || undefined, end: d.time && d.end ? d.end : undefined,
    place: d.place?.trim() || undefined, notes: trainingSummary(d) || undefined, color: TRAINING_COLOR,
  };
}

export type TrainingStatus = "feita" | "proxima" | "passou";
export const trainingStatus = (t: Pick<Training, "done" | "date">, today: string): TrainingStatus =>
  t.done ? "feita" : t.date >= today ? "proxima" : "passou";

/** Próximas primeiro (da mais perto para a mais longe), depois as que já passaram (mais recente primeiro). */
export function sortTrainings<T extends Pick<Training, "done" | "date" | "time">>(list: T[], today: string): T[] {
  const key = (t: T) => `${t.date}${t.time ?? ""}`;
  const up = list.filter((t) => trainingStatus(t, today) === "proxima").sort((a, b) => key(a).localeCompare(key(b)));
  const past = list.filter((t) => trainingStatus(t, today) !== "proxima").sort((a, b) => key(b).localeCompare(key(a)));
  return [...up, ...past];
}
