/** Plano alimentar na nuvem: o plano (documento), o registro de cada dia e o acompanhamento semanal. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cleanDietPlan, type DayLog, type Extra, type Swap, type DietPlan, type DietWeekly } from "../diet-plan";
import type { Food } from "../diet-foods";
import { must, supabase } from "./db";

export type DietRow = { id: string; name: string; startDate: string; plan: DietPlan };
const KEY = ["diet-plan"] as const;
const logsKey = (id: string) => ["diet-logs", id] as const;
const weeklyKey = (id: string) => ["diet-weekly", id] as const;

export async function loadDiet(): Promise<DietRow | null> {
  const rows = must(await supabase.from("diet_plans").select("id, name, start_date, data").eq("active", true).order("created_at", { ascending: false }).limit(1)) as { id: string; name: string; start_date: string; data: unknown }[];
  const r = rows[0], plan = r ? cleanDietPlan(r.data) : null;
  return r && plan ? { id: r.id, name: r.name, startDate: r.start_date, plan } : null;
}
export const useDiet = () => useQuery({ queryKey: KEY, queryFn: loadDiet });

const n = (v: number | string | null) => (v === null || v === undefined ? null : Number(v));
type DayRow = { swaps: Record<string, Swap> | null; extras: Extra[] | null; log_date: string; option_id: string | null; meals_done: string[] | null; extra_protein_g: number | string | null; water_ml: number | null; energy: number | null; fullness: number | null; difficulty: number | null; training: number | null; discomfort: number | null; bowel: boolean | null; notes: string };
export const useDietLogs = (planId: string | undefined) => useQuery({
  queryKey: logsKey(planId ?? ""), enabled: !!planId,
  queryFn: async (): Promise<DayLog[]> => (must(await supabase.from("diet_day_logs").select("swaps, extras, log_date, option_id, meals_done, extra_protein_g, water_ml, energy, fullness, difficulty, training, discomfort, bowel, notes").eq("plan_id", planId!).order("log_date").limit(800)) as DayRow[])
    .map((r) => ({ swaps: r.swaps ?? {}, extras: r.extras ?? [], date: r.log_date, optionId: r.option_id, mealsDone: r.meals_done ?? [], extraProteinG: n(r.extra_protein_g), waterMl: r.water_ml, energy: r.energy, fullness: r.fullness, difficulty: r.difficulty, training: r.training, discomfort: r.discomfort, bowel: r.bowel, notes: r.notes })),
});
type WeeklyRow = { week_no: number; logged_on: string; weight_kg: number | string | null; waist_cm: number | string | null; abdomen_cm: number | string | null; hip_cm: number | string | null; bowel_count: number | null; water_l: number | string | null; energy: number | null; training: number | null; difficulty: number | null; digestive: number | null; satiety: number | null; notes: string };
export const useDietWeeklies = (planId: string | undefined) => useQuery({
  queryKey: weeklyKey(planId ?? ""), enabled: !!planId,
  queryFn: async (): Promise<DietWeekly[]> => (must(await supabase.from("diet_weekly").select("week_no, logged_on, weight_kg, waist_cm, abdomen_cm, hip_cm, bowel_count, water_l, energy, training, difficulty, digestive, satiety, notes").eq("plan_id", planId!).order("week_no")) as WeeklyRow[])
    .map((r) => ({ week: r.week_no, date: r.logged_on, weight: n(r.weight_kg), waist: n(r.waist_cm), abdomen: n(r.abdomen_cm), hip: n(r.hip_cm), bowelCount: r.bowel_count, waterL: n(r.water_l), energy: r.energy, training: r.training, difficulty: r.difficulty, digestive: r.digestive, satiety: r.satiety, notes: r.notes })),
});

export function useDietActions(planId: string | undefined) {
  const qc = useQueryClient();
  return {
    create: useMutation({
      mutationFn: async (v: { plan: DietPlan; startDate: string }) => {
        must(await supabase.from("diet_plans").update({ active: false }).eq("active", true).select("id"));
        return must(await supabase.from("diet_plans").insert({ name: v.plan.nome, start_date: v.startDate, data: v.plan }).select("id").single()) as { id: string };
      },
      onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    }),
    /** Salva o dia inteiro (upsert pela data); mostra na hora e volta atrás se falhar. */
    saveDay: useMutation({
      onMutate: async (l: DayLog) => {
        const k = logsKey(planId ?? ""); await qc.cancelQueries({ queryKey: k }); const prev = qc.getQueryData<DayLog[]>(k);
        if (prev) qc.setQueryData(k, [...prev.filter((x) => x.date !== l.date), l].sort((a, b) => a.date.localeCompare(b.date)));
        return { prev };
      },
      onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(logsKey(planId ?? ""), ctx.prev); },
      mutationFn: async (l: DayLog) => { must(await supabase.from("diet_day_logs").upsert({ plan_id: planId!, swaps: l.swaps, extras: l.extras, log_date: l.date, option_id: l.optionId, meals_done: l.mealsDone, extra_protein_g: l.extraProteinG, water_ml: l.waterMl, energy: l.energy, fullness: l.fullness, difficulty: l.difficulty, training: l.training, discomfort: l.discomfort, bowel: l.bowel, notes: l.notes, updated_at: new Date().toISOString() }, { onConflict: "user_id,plan_id,log_date" }).select("id")); },
      onSettled: () => void (planId && qc.invalidateQueries({ queryKey: logsKey(planId) })),
    }),
    saveWeekly: useMutation({
      mutationFn: async (w: DietWeekly) => { must(await supabase.from("diet_weekly").upsert({ plan_id: planId!, week_no: w.week, logged_on: w.date, weight_kg: w.weight, waist_cm: w.waist, abdomen_cm: w.abdomen, hip_cm: w.hip, bowel_count: w.bowelCount, water_l: w.waterL, energy: w.energy, training: w.training, difficulty: w.difficulty, digestive: w.digestive, satiety: w.satiety, notes: w.notes, updated_at: new Date().toISOString() }, { onConflict: "user_id,plan_id,week_no" }).select("id")); },
      onSuccess: () => void (planId && qc.invalidateQueries({ queryKey: weeklyKey(planId) })),
    }),
  };
}

/** Meus alimentos (macros que eu cadastrei), para reusar nas refeições. */
const FOODS_KEY = ["diet-foods"] as const;
type FoodRow = { id: string; nome: string; kcal: number | string; p: number | string; c: number | string; f: number | string; medidas: { nome: string; g: number }[] | null };
export const useMyFoods = () => useQuery({
  queryKey: FOODS_KEY,
  queryFn: async (): Promise<Food[]> => (must(await supabase.from("diet_foods").select("id, nome, kcal, p, c, f, medidas").order("created_at", { ascending: false }).limit(300)) as FoodRow[])
    .map((r) => ({ id: `meu-${r.id}`, nome: r.nome, per100: { kcal: Number(r.kcal), p: Number(r.p), c: Number(r.c), f: Number(r.f) }, medidas: r.medidas ?? [], alias: "meu" })),
});
export function useMyFoodActions() {
  const qc = useQueryClient();
  return {
    save: useMutation({
      mutationFn: async (fd: Food) => { must(await supabase.from("diet_foods").upsert({ nome: fd.nome, kcal: Math.round(fd.per100.kcal * 100) / 100, p: Math.round(fd.per100.p * 100) / 100, c: Math.round(fd.per100.c * 100) / 100, f: Math.round(fd.per100.f * 100) / 100, medidas: fd.medidas }, { onConflict: "user_id,nome" }).select("id")); },
      onSuccess: () => void qc.invalidateQueries({ queryKey: FOODS_KEY }),
    }),
    remove: useMutation({
      mutationFn: async (id: string) => { must(await supabase.from("diet_foods").delete().eq("id", id.replace(/^meu-/, "")).select("id")); },
      onSuccess: () => void qc.invalidateQueries({ queryKey: FOODS_KEY }),
    }),
  };
}
