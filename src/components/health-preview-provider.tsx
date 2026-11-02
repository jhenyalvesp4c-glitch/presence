import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { todayIso } from "@/lib/dates";
import {
  healthKeys, saveDietDb, saveMeasurementDb, saveWorkoutSheetDb, useHealthDiet, useHealthMeasurement, useHealthWorkout, useTodayExerciseLogs, useTodayMealLogs,
  useToggleMeal, type DietData, type MeasurementData, type WorkoutData,
} from "@/lib/data/health";
import { useLogExercise } from "@/lib/data/workouts";
import { dietToRow, measurementToRow } from "@/lib/health-db";
import type { DietSheet, MeasurementSheet, WorkoutSheet } from "@/lib/health-preview";

/**
 * As fichas de Saúde (treino, dieta, medidas) agora vêm do banco. A interface continua a mesma que os
 * editores do Lovable usam (workout, diet, measurements, setWorkout, setDiet, setMeasurements); foram
 * acrescentados `ready` (carregou do banco) e `doneKeys`/`toggleDone` (feitos de hoje, também gravados).
 */
type Preview = {
  workout: WorkoutSheet | null; diet: DietSheet | null; measurements: MeasurementSheet | null;
  ready: boolean; doneKeys: string[]; toggleDone: (key: string) => void;
  setWorkout: (sheet: WorkoutSheet) => void; setDiet: (sheet: DietSheet) => void; setMeasurements: (sheet: MeasurementSheet) => void;
};

/** Mantido por compatibilidade com o __root; os dados são buscados por quem usa useHealthPreview (só nas telas de Saúde). */
export function HealthPreviewProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useHealthPreview(): Preview {
  const qc = useQueryClient();
  const w = useHealthWorkout();
  const d = useHealthDiet();
  const m = useHealthMeasurement();
  const exLogs = useTodayExerciseLogs();
  const mealLogs = useTodayMealLogs();
  const logExercise = useLogExercise();
  const toggleMeal = useToggleMeal();

  const refresh = (...keys: readonly (readonly string[])[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
  // Promessas (e não callbacks do React Query): continuam valendo depois que o editor sai da tela.
  const persist = (label: string, run: () => Promise<void>, ...keys: readonly (readonly string[])[]) => {
    run()
      .then(() => { toast.success(`${label} salva`); return refresh(...keys); })
      .catch((e: Error) => { toast.error(`Não consegui salvar ${label.toLowerCase()}: ${e.message}`); return refresh(...keys); });
  };

  const setWorkout = (sheet: WorkoutSheet) => {
    qc.setQueryData<WorkoutData | null>(healthKeys.workout, (old) => ({ sheetId: old?.sheetId ?? null, sheet, workouts: old?.workouts ?? [], exercises: old?.exercises ?? [] }));
    persist("Ficha de treino", () => saveWorkoutSheetDb(sheet), healthKeys.workout, ["workouts"], ["workout-split"], ["sessions-recent"]);
  };

  const setDiet = (sheet: DietSheet) => {
    try { dietToRow(sheet); } catch (e) { toast.error((e as Error).message); throw e; } // impede a navegação com dados inválidos
    qc.setQueryData<DietData | null>(healthKeys.diet, (old) => ({ sheetId: old?.sheetId ?? null, diet: sheet, meals: old?.meals ?? [] }));
    persist("Ficha de dieta", () => saveDietDb(sheet), healthKeys.diet, healthKeys.todayMeals);
  };

  const setMeasurements = (sheet: MeasurementSheet) => {
    try { measurementToRow(sheet, todayIso()); } catch (e) { toast.error((e as Error).message); throw e; }
    const current = qc.getQueryData<MeasurementData | null>(healthKeys.measurement) ?? null;
    qc.setQueryData<MeasurementData | null>(healthKeys.measurement, (old) => ({ measuredOn: sheet.data || todayIso(), photoPaths: old?.photoPaths ?? {}, sheet }));
    persist("Ficha de medidas", () => saveMeasurementDb(sheet, current), healthKeys.measurement);
  };

  // Feitos de hoje, no formato de chave que a tela já usa: ex-<sessão>-<índice> e meal-<refeição>.
  const doneExercises = new Set(exLogs.data ?? []);
  const doneMeals = new Set(mealLogs.data ?? []);
  const doneKeys: string[] = [];
  w.data?.workouts.forEach((wk, wi) => {
    w.data!.exercises.filter((e) => e.workout_id === wk.id).forEach((e, ei) => { if (doneExercises.has(e.id)) doneKeys.push(`ex-${wi + 1}-${ei}`); });
  });
  d.data?.meals.forEach((meal, mi) => { if (doneMeals.has(meal.id)) doneKeys.push(`meal-${mi + 1}`); });

  const toggleDone = (key: string) => {
    const done = doneKeys.includes(key);
    const fail = (e: Error) => toast.error(e.message);
    const parts = key.split("-");
    if (parts[0] === "ex" && w.data) {
      const workout = w.data.workouts[Number(parts[1]) - 1];
      const exercise = workout ? w.data.exercises.filter((e) => e.workout_id === workout.id)[Number(parts[2])] : undefined;
      if (workout && exercise) logExercise.mutate({ workout, exercise, patch: { done: !done } }, { onError: fail });
    } else if (parts[0] === "meal" && d.data) {
      const meal = d.data.meals[Number(parts[1]) - 1];
      if (meal) toggleMeal.mutate({ mealId: meal.id, done }, { onError: fail });
    }
  };

  return {
    workout: w.data?.sheet ?? null, diet: d.data?.diet ?? null, measurements: m.data?.sheet ?? null,
    ready: [w, d, m].every((q) => !q.isPending), doneKeys, toggleDone, setWorkout, setDiet, setMeasurements,
  };
}
