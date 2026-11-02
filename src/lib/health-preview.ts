export type WorkoutSession = { id: number; nome: string; dias: string[]; exercicios: { nome: string; grupo: string }[] };
export type WorkoutSheet = { nome: string; sessoes: WorkoutSession[] };
export type DietSheet = { name: string; goal: string; macros: { calories: string; protein: string; carbs: string; fat: string }; notes: string; meals: { id: number; name: string; time: string; foods: string[] }[] };
export type MeasurementSheet = { nome: string; data: string; altura: string; peso: string; valores: Record<string, string>; obs: string; fotos: Record<string, string> };
export const measurementLabels: Record<string, string> = { peito: "Peito", braco: "Braço", cintura: "Cintura", abdomen: "Abdômen", quadril: "Quadril", gluteo: "Glúteo", coxa: "Coxa" };
const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function workoutsForDate(sheet: WorkoutSheet | null, date: Date) {
  const day = weekdays[date.getDay()];
  return sheet?.sessoes.filter(session => day !== undefined && session.dias.includes(day)) ?? [];
}