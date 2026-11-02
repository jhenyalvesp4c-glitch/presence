// Conversões puras entre as fichas da tela (src/lib/health-preview.ts) e as linhas do banco.
import type { DietSheet, MeasurementSheet, WorkoutSession, WorkoutSheet } from "./health-preview";

/** Índice = dia da semana como no JavaScript (domingo = 0) e em workout_split.weekday. */
export const DAY_CODES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/** "1,70" → 1.7 · "80.5" → 80.5 · "" → null. Texto que não é número lança erro com o nome do campo. */
export function parseNumber(label: string, text: string | undefined, min: number, max: number, hint = ""): number | null {
  const clean = (text ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  if (!Number.isFinite(n)) throw new Error(`${label}: "${text}" não é um número.`);
  if (n < min || n > max) throw new Error(`${label} deve estar entre ${min} e ${max}${hint ? ` (${hint})` : ""}.`);
  return n;
}

/** 80 → "80" · 80.5 → "80,5" · null → "". */
export function formatNumber(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  return String(Number(n)).replace(".", ",");
}

export type SplitDayDraft = { weekday: number; title: string; sessionIndex: number | null };

/** Divisão semanal a partir dos dias de cada sessão. Dia sem sessão = descanso. */
export function splitFromSessions(sessions: Pick<WorkoutSession, "nome" | "dias">[]): SplitDayDraft[] {
  return DAY_CODES.map((code, weekday) => {
    const idx = sessions.flatMap((s, i) => (s.dias.includes(code) ? [i] : []));
    if (!idx.length) return { weekday, title: "Descanso", sessionIndex: null };
    return { weekday, title: idx.map((i) => sessions[i]!.nome.trim() || `Treino ${i + 1}`).join(" + ").slice(0, 80), sessionIndex: idx[0]! };
  });
}

/** Grupos musculares distintos de uma sessão, na ordem em que aparecem. */
export function uniqueMuscles(exercicios: { grupo?: string | undefined }[]): string[] {
  const seen = new Set<string>();
  for (const e of exercicios) {
    const g = (e.grupo ?? "").trim();
    if (g) seen.add(g);
  }
  return [...seen].slice(0, 8);
}

type WorkoutRow = { name: string; days: string[] };
type ExerciseRow = { workout_id: string; name: string; muscle: string };

/** Linhas do banco → ficha da tela. O id da sessão é a posição + 1 (a posição é a identidade). */
export function workoutSheetFromRows(name: string, workouts: (WorkoutRow & { id: string })[], exercises: ExerciseRow[]): WorkoutSheet {
  return {
    nome: name,
    sessoes: workouts.map((w, i) => ({
      id: i + 1,
      nome: w.name,
      dias: w.days,
      exercicios: exercises.filter((e) => e.workout_id === w.id).map((e) => ({ nome: e.name, grupo: e.muscle })),
    })),
  };
}

type DietRow = { name: string; goal: string; calories: number | string | null; protein: number | string | null; carbs: number | string | null; fat: number | string | null; notes: string };
type MealRow = { name: string; meal_time: string; foods: string[] };

export function dietFromRows(sheet: DietRow, meals: MealRow[]): DietSheet {
  return {
    name: sheet.name,
    goal: sheet.goal,
    macros: { calories: formatNumber(sheet.calories), protein: formatNumber(sheet.protein), carbs: formatNumber(sheet.carbs), fat: formatNumber(sheet.fat) },
    notes: sheet.notes,
    meals: meals.map((m, i) => ({ id: i + 1, name: m.name, time: m.meal_time, foods: m.foods })),
  };
}

/** Ficha da tela → colunas de diet_sheets (valida e converte os números). */
export function dietToRow(diet: DietSheet) {
  return {
    name: diet.name.trim().slice(0, 120),
    goal: diet.goal.trim().slice(0, 80),
    calories: parseNumber("Calorias", diet.macros.calories, 0, 20000),
    protein: parseNumber("Proteína", diet.macros.protein, 0, 2000),
    carbs: parseNumber("Carboidrato", diet.macros.carbs, 0, 2000),
    fat: parseNumber("Gordura", diet.macros.fat, 0, 2000),
    notes: diet.notes.slice(0, 5000),
  };
}

type MeasurementRow = { name: string; measured_on: string; height_m: number | string | null; weight_kg: number | string | null; values: Record<string, string>; notes: string };

export function measurementFromRow(row: MeasurementRow, photoUrls: Record<string, string>): MeasurementSheet {
  return {
    nome: row.name,
    data: row.measured_on,
    altura: formatNumber(row.height_m),
    peso: formatNumber(row.weight_kg),
    valores: row.values ?? {},
    obs: row.notes,
    fotos: photoUrls,
  };
}

/** Ficha da tela → colunas de body_measurements (sem as fotos). */
export function measurementToRow(m: MeasurementSheet, today: string) {
  return {
    name: m.nome.trim().slice(0, 120),
    measured_on: m.data || today,
    height_m: parseNumber("Altura", m.altura, 0.3, 3, "em metros, ex.: 1,70"),
    weight_kg: parseNumber("Peso", m.peso, 1, 700, "em kg"),
    values: Object.fromEntries(Object.entries(m.valores).map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v !== "")),
    notes: m.obs.slice(0, 5000),
  };
}

export function photoSlug(slot: string): string {
  return slot.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "foto";
}
