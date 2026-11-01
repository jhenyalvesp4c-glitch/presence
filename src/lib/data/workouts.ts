import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subDays } from "date-fns";

import { isoDate, todayIso } from "../dates";
import type { Exercise, ExerciseLog, SplitDay, Workout, WorkoutSession } from "../types";
import { must, SINGLE_USER_ID, supabase } from "./db";

const SESSION_COLS = "id, workout_id, workout_name, session_date, started_at, finished_at, duration_min, kcal";

export function useWorkouts() {
  return useQuery({
    queryKey: ["workouts"],
    queryFn: async () => {
      const [workouts, exercises] = await Promise.all([
        supabase.from("workouts").select("id, name, duration_min, muscles, position").order("position").then((r) => must(r) as Workout[]),
        supabase.from("workout_exercises").select("id, workout_id, position, name, muscle, sets_reps, rest_seconds, instructions").order("position").then((r) => must(r) as Exercise[]),
      ]);
      return { workouts, exercises };
    },
  });
}

export function useSplit() {
  return useQuery({
    queryKey: ["workout-split"],
    queryFn: async () => must(await supabase.from("workout_split").select("id, weekday, title, workout_id")) as SplitDay[],
  });
}

export function useWeeklyGoal() {
  return useQuery({
    queryKey: ["weekly-goal"],
    queryFn: async () => {
      const row = must(await supabase.from("profiles").select("weekly_workout_goal").eq("id", SINGLE_USER_ID).maybeSingle()) as { weekly_workout_goal: number } | null;
      return row?.weekly_workout_goal ?? 5;
    },
  });
}

/** Sessões dos últimos 60 dias (hoje, semana, mês e "último treino" saem daqui). */
export function useRecentSessions() {
  return useQuery({
    queryKey: ["sessions-recent"],
    queryFn: async () =>
      must(
        await supabase.from("workout_sessions").select(SESSION_COLS).gte("session_date", isoDate(subDays(new Date(), 60))).order("started_at", { ascending: false }),
      ) as WorkoutSession[],
  });
}

export function useSessionLogs(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["session-logs", sessionId],
    enabled: !!sessionId,
    queryFn: async () =>
      must(await supabase.from("exercise_logs").select("id, session_id, exercise_id, exercise_name, done, load_kg").eq("session_id", sessionId!)) as ExerciseLog[],
  });
}

/** Quantos exercícios foram concluídos em uma sessão (para o "último treino"). */
export function useDoneCount(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["session-done-count", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { count, error } = await supabase.from("exercise_logs").select("id", { count: "exact", head: true }).eq("session_id", sessionId!).eq("done", true);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

/** Maior carga registrada de um exercício, com a data da sessão. */
export function useLoadHistory(exerciseName: string | undefined) {
  return useQuery({
    queryKey: ["load-history", exerciseName],
    enabled: !!exerciseName,
    queryFn: async () => {
      const rows = must(
        await supabase
          .from("exercise_logs")
          .select("load_kg, workout_sessions!inner(session_date)")
          .eq("exercise_name", exerciseName!)
          .not("load_kg", "is", null)
          .order("created_at", { ascending: false })
          .limit(300),
      ) as unknown as { load_kg: number; workout_sessions: { session_date: string } }[];
      return rows.map((r) => ({ kg: Number(r.load_kg), date: r.workout_sessions.session_date }));
    },
  });
}

function useInvalidateWorkouts() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      ["sessions-recent", "session-logs", "session-done-count", "load-history"].map((k) => qc.invalidateQueries({ queryKey: [k] })),
    );
}

/** Garante que existe uma sessão de hoje para a ficha (cria ao iniciar, marcar ou registrar carga). */
async function ensureSession(workout: Workout): Promise<WorkoutSession> {
  const today = todayIso();
  const existing = must(
    await supabase.from("workout_sessions").select(SESSION_COLS).eq("session_date", today).eq("workout_id", workout.id).order("started_at", { ascending: false }).limit(1),
  ) as WorkoutSession[];
  if (existing[0]) return existing[0];
  return must(
    await supabase.from("workout_sessions").insert({ workout_id: workout.id, workout_name: workout.name, session_date: today }).select(SESSION_COLS).single(),
  ) as WorkoutSession;
}

export function useStartSession() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({ mutationFn: ensureSession, onSuccess: invalidate });
}

export function useFinishSession() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({
    mutationFn: async (s: Pick<WorkoutSession, "id" | "started_at">) => {
      const minutes = Math.max(1, Math.round((Date.now() - new Date(s.started_at).getTime()) / 60000));
      must(await supabase.from("workout_sessions").update({ finished_at: new Date().toISOString(), duration_min: Math.min(minutes, 1000) }).eq("id", s.id).select("id"));
    },
    onSuccess: invalidate,
  });
}

export function useLogExercise() {
  const invalidate = useInvalidateWorkouts();
  return useMutation({
    mutationFn: async ({ workout, exercise, patch }: { workout: Workout; exercise: Exercise; patch: { done?: boolean; load_kg?: number } }) => {
      const session = await ensureSession(workout);
      must(
        await supabase
          .from("exercise_logs")
          .upsert({ session_id: session.id, exercise_id: exercise.id, exercise_name: exercise.name, ...patch }, { onConflict: "session_id,exercise_id" })
          .select("id"),
      );
    },
    onSuccess: invalidate,
  });
}
