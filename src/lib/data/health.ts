import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { todayIso } from "../dates";
import { dietFromRows, dietToRow, measurementFromRow, measurementToRow, photoSlug, splitFromSessions, uniqueMuscles, workoutSheetFromRows } from "../health-db";
import type { DietSheet, MeasurementSheet, WorkoutSheet } from "../health-preview";
import type { Exercise, Workout } from "../types";
import { must, SINGLE_USER_ID, supabase } from "./db";

export const PHOTO_BUCKET = "presence-app-photos";
export const healthKeys = {
  workout: ["health", "workout"] as const,
  diet: ["health", "diet"] as const,
  measurement: ["health", "measurement"] as const,
  todayExercises: ["health", "today-exercise-logs"] as const,
  todayMeals: ["health", "today-meal-logs"] as const,
};

// ───────────── Treino (unificado com /treino) ─────────────
export type WorkoutDb = Workout & { days: string[] };
export type WorkoutData = { sheetId: string | null; sheet: WorkoutSheet; workouts: WorkoutDb[]; exercises: Exercise[] };

async function loadWorkout(): Promise<WorkoutData | null> {
  const sheet = must(await supabase.from("workout_sheets").select("id, name").eq("active", true).maybeSingle()) as { id: string; name: string } | null;
  if (!sheet) return null;
  const workouts = must(
    await supabase.from("workouts").select("id, name, duration_min, muscles, position, days").eq("sheet_id", sheet.id).order("position"),
  ) as WorkoutDb[];
  const ids = workouts.map((w) => w.id);
  const exercises = ids.length
    ? (must(
        await supabase.from("workout_exercises").select("id, workout_id, position, name, muscle, sets_reps, rest_seconds, instructions").in("workout_id", ids).order("position"),
      ) as Exercise[])
    : [];
  return { sheetId: sheet.id, sheet: workoutSheetFromRows(sheet.name, workouts, exercises), workouts, exercises };
}

export function useHealthWorkout() {
  return useQuery({ queryKey: healthKeys.workout, queryFn: loadWorkout });
}

/** Grava a ficha: cada sessão vira um `workouts`, os dias alimentam `workout_split` (o que o /treino lê). */
export async function saveWorkoutSheetDb(sheet: WorkoutSheet): Promise<void> {
  const name = sheet.nome.trim().slice(0, 120) || "Minha ficha de treino";
  let sheetRow = must(await supabase.from("workout_sheets").select("id").eq("active", true).maybeSingle()) as { id: string } | null;
  if (sheetRow) must(await supabase.from("workout_sheets").update({ name }).eq("id", sheetRow.id).select("id"));
  else sheetRow = must(await supabase.from("workout_sheets").insert({ name }).select("id").single()) as { id: string };
  const sheetId = sheetRow.id;

  const existing = must(await supabase.from("workouts").select("id").eq("sheet_id", sheetId).order("position")) as { id: string }[];
  const existingEx = existing.length
    ? (must(await supabase.from("workout_exercises").select("id, workout_id, name").in("workout_id", existing.map((w) => w.id))) as { id: string; workout_id: string; name: string }[])
    : [];

  const workoutIds: string[] = [];
  for (const [i, sess] of sheet.sessoes.entries()) {
    const row = { name: (sess.nome.trim() || `Treino ${i + 1}`).slice(0, 80), days: sess.dias, muscles: uniqueMuscles(sess.exercicios), position: i, sheet_id: sheetId };
    const base = existing[i];
    let workoutId: string;
    if (base) {
      must(await supabase.from("workouts").update(row).eq("id", base.id).select("id"));
      workoutId = base.id;
    } else {
      workoutId = (must(await supabase.from("workouts").insert({ ...row, duration_min: 60 }).select("id").single()) as { id: string }).id;
    }
    workoutIds.push(workoutId);

    // Exercícios: mantém os que têm o mesmo nome (preserva séries/descanso editados no /treino).
    const have = existingEx.filter((e) => e.workout_id === workoutId);
    const used = new Set<string>();
    for (const [j, ex] of sess.exercicios.entries()) {
      const exName = ex.nome.trim().slice(0, 80);
      if (!exName) continue;
      const exRow = { name: exName, muscle: (ex.grupo ?? "").trim().slice(0, 80), position: j };
      const match = have.find((h) => !used.has(h.id) && h.name.trim().toLowerCase() === exName.toLowerCase());
      if (match) {
        used.add(match.id);
        must(await supabase.from("workout_exercises").update(exRow).eq("id", match.id).select("id"));
      } else {
        must(await supabase.from("workout_exercises").insert({ ...exRow, workout_id: workoutId, sets_reps: "3 x 12", rest_seconds: 60 }).select("id"));
      }
    }
    const stale = have.filter((h) => !used.has(h.id)).map((h) => h.id);
    if (stale.length) must(await supabase.from("workout_exercises").delete().in("id", stale).select("id"));
  }

  const removed = existing.slice(sheet.sessoes.length).map((w) => w.id);
  if (removed.length) must(await supabase.from("workouts").delete().in("id", removed).select("id"));

  must(
    await supabase
      .from("workout_split")
      .upsert(
        splitFromSessions(sheet.sessoes).map((d) => ({ weekday: d.weekday, title: d.title, workout_id: d.sessionIndex === null ? null : (workoutIds[d.sessionIndex] ?? null) })),
        { onConflict: "user_id,weekday" },
      )
      .select("id"),
  );
}

// ───────────── Dieta ─────────────
export type DietMealDb = { id: string; position: number };
export type DietData = { sheetId: string | null; diet: DietSheet; meals: DietMealDb[] };

async function loadDiet(): Promise<DietData | null> {
  const sheet = must(
    await supabase.from("diet_sheets").select("id, name, goal, calories, protein, carbs, fat, notes").eq("active", true).maybeSingle(),
  ) as { id: string; name: string; goal: string; calories: number | null; protein: number | null; carbs: number | null; fat: number | null; notes: string } | null;
  if (!sheet) return null;
  const meals = must(await supabase.from("diet_meals").select("id, position, name, meal_time, foods").eq("sheet_id", sheet.id).order("position")) as { id: string; position: number; name: string; meal_time: string; foods: string[] }[];
  return { sheetId: sheet.id, diet: dietFromRows(sheet, meals), meals: meals.map((m) => ({ id: m.id, position: m.position })) };
}

export function useHealthDiet() {
  return useQuery({ queryKey: healthKeys.diet, queryFn: loadDiet });
}

export async function saveDietDb(diet: DietSheet): Promise<void> {
  const row = dietToRow(diet);
  let sheet = must(await supabase.from("diet_sheets").select("id").eq("active", true).maybeSingle()) as { id: string } | null;
  if (sheet) must(await supabase.from("diet_sheets").update(row).eq("id", sheet.id).select("id"));
  else sheet = must(await supabase.from("diet_sheets").insert(row).select("id").single()) as { id: string };
  const sheetId = sheet.id;

  // Refeições por posição (preserva o "feito hoje" das que continuam existindo).
  const existing = must(await supabase.from("diet_meals").select("id").eq("sheet_id", sheetId).order("position")) as { id: string }[];
  for (const [i, m] of diet.meals.entries()) {
    const mealRow = { name: m.name.trim().slice(0, 120), meal_time: m.time.slice(0, 5), foods: m.foods.map((f) => f.trim()).filter(Boolean), position: i };
    const base = existing[i];
    if (base) must(await supabase.from("diet_meals").update(mealRow).eq("id", base.id).select("id"));
    else must(await supabase.from("diet_meals").insert({ ...mealRow, sheet_id: sheetId }).select("id"));
  }
  const removed = existing.slice(diet.meals.length).map((m) => m.id);
  if (removed.length) must(await supabase.from("diet_meals").delete().in("id", removed).select("id"));
}

export function useTodayMealLogs() {
  return useQuery({
    queryKey: healthKeys.todayMeals,
    queryFn: async () => (must(await supabase.from("diet_meal_logs").select("meal_id").eq("log_date", todayIso())) as { meal_id: string }[]).map((r) => r.meal_id),
  });
}

export function useToggleMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ mealId, done }: { mealId: string; done: boolean }) => {
      const date = todayIso();
      if (done) must(await supabase.from("diet_meal_logs").delete().eq("meal_id", mealId).eq("log_date", date).select("id"));
      else must(await supabase.from("diet_meal_logs").upsert({ meal_id: mealId, log_date: date }, { onConflict: "meal_id,log_date" }).select("id"));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: healthKeys.todayMeals }),
  });
}

// ───────────── Peso e medidas (+ fotos) ─────────────
export type MeasurementEntry = { measuredOn: string; photoPaths: Record<string, string>; sheet: MeasurementSheet };
type MeasurementRowDb = { name: string; measured_on: string; height_m: number | null; weight_kg: number | null; values: Record<string, string>; notes: string; photos: Record<string, string> };

/** Todos os registros (um por data), do mais antigo ao mais novo, com as fotos como links assinados. */
async function loadMeasurements(): Promise<MeasurementEntry[]> {
  const rows = must(
    await supabase.from("body_measurements").select("name, measured_on, height_m, weight_kg, values, notes, photos").order("measured_on", { ascending: true }).limit(1000),
  ) as MeasurementRowDb[];
  const paths = [...new Set(rows.flatMap((r) => Object.values(r.photos ?? {})))];
  const urlByPath = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) urlByPath.set(d.path, d.signedUrl);
  }
  return rows.map((r) => {
    const photoPaths = r.photos ?? {};
    const urls = Object.fromEntries(Object.entries(photoPaths).flatMap(([slot, path]) => (urlByPath.has(path) ? [[slot, urlByPath.get(path)!]] : [])));
    return { measuredOn: r.measured_on, photoPaths, sheet: measurementFromRow(r, urls) };
  });
}

export function useHealthMeasurement() {
  // As fotos usam links assinados de 1 h; renova antes de vencer.
  return useQuery({ queryKey: healthKeys.measurement, queryFn: loadMeasurements, staleTime: 30 * 60 * 1000 });
}

/** Coloca/substitui um registro (mesma data substitui) e mantém a lista do mais antigo ao mais novo. */
export function upsertEntry(list: MeasurementEntry[], entry: MeasurementEntry): MeasurementEntry[] {
  return [...list.filter((e) => e.measuredOn !== entry.measuredOn), entry].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
}

async function uploadPhoto(slot: string, blobUrl: string, date: string): Promise<string> {
  const blob = await (await fetch(blobUrl)).blob();
  const ext = (blob.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${SINGLE_USER_ID}/${date}-${photoSlug(slot)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`Não consegui enviar a foto "${slot}": ${error.message}`);
  return path;
}

/** Salva um registro por data (`current` = o registro dessa mesma data, se já existir). Fotos novas (blob:) sobem ao Storage; as que já existem mantêm o caminho. */
export async function saveMeasurementDb(m: MeasurementSheet, current: MeasurementEntry | null): Promise<void> {
  const row = measurementToRow(m, todayIso());
  const photos: Record<string, string> = {};
  for (const [slot, src] of Object.entries(m.fotos)) {
    if (src.startsWith("blob:")) photos[slot] = await uploadPhoto(slot, src, row.measured_on);
    else if (current && current.sheet.fotos[slot] === src && current.photoPaths[slot]) photos[slot] = current.photoPaths[slot]!;
  }
  must(await supabase.from("body_measurements").upsert({ ...row, photos }, { onConflict: "user_id,measured_on" }).select("id"));
}

// ───────────── Feitos de hoje (treino e refeições) ─────────────
export function useTodayExerciseLogs() {
  return useQuery({
    queryKey: healthKeys.todayExercises,
    queryFn: async () =>
      (
        must(
          await supabase.from("exercise_logs").select("exercise_id, workout_sessions!inner(session_date)").eq("done", true).eq("workout_sessions.session_date", todayIso()),
        ) as unknown as { exercise_id: string | null }[]
      ).flatMap((r) => (r.exercise_id ? [r.exercise_id] : [])),
  });
}
