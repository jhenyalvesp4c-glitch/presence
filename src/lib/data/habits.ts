import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subDays } from "date-fns";

import { isoDate } from "../dates";
import type { Color, Habit, HabitCompletion } from "../types";
import { must, supabase } from "./db";

export function useHabits() {
  return useQuery({
    queryKey: ["habits"],
    queryFn: async () => must(await supabase.from("habits").select("id, name, icon, color, position, active").eq("active", true).order("position").order("created_at")) as Habit[],
  });
}

/** Conclusões dos últimos 60 dias (sequências e os 7 pontinhos saem daqui). */
export function useHabitCompletions() {
  return useQuery({
    queryKey: ["habit-completions"],
    queryFn: async () =>
      must(await supabase.from("habit_completions").select("id, habit_id, completed_on").gte("completed_on", isoDate(subDays(new Date(), 60)))) as HabitCompletion[],
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["habits"] }), qc.invalidateQueries({ queryKey: ["habit-completions"] })]);
}

export function useCreateHabit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ name, icon, color }: { name: string; icon: string; color: Color }) => {
      const { data: last } = await supabase.from("habits").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
      return must(await supabase.from("habits").insert({ name: name.trim().slice(0, 80), icon, color, position: (last?.position ?? 0) + 1 }).select("id").single());
    },
    onSuccess: invalidate,
  });
}

export function useToggleHabit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async ({ habitId, date, done }: { habitId: string; date: string; done: boolean }) => {
      if (done) must(await supabase.from("habit_completions").delete().eq("habit_id", habitId).eq("completed_on", date).select("id"));
      else must(await supabase.from("habit_completions").upsert({ habit_id: habitId, completed_on: date }, { onConflict: "habit_id,completed_on" }).select("id"));
    },
    onSuccess: invalidate,
  });
}

/** Arquiva o hábito (some da lista, mas o histórico fica guardado). */
export function useArchiveHabit() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      must(await supabase.from("habits").update({ active: false }).eq("id", id).select("id"));
    },
    onSuccess: invalidate,
  });
}
