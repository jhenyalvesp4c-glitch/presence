/** Programa de treino na nuvem: o programa (documento), as séries registradas e a avaliação semanal. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cleanProgram, type Program, type SetLog, type Weekly } from "../program";
import { must, supabase } from "./db";

export type ProgramRow = { id: string; name: string; startDate: string; program: Program };
const KEY = ["program"] as const;
const logsKey = (id: string) => ["program-logs", id] as const;
const weeklyKey = (id: string) => ["program-weekly", id] as const;

export async function loadProgram(): Promise<ProgramRow | null> {
  const rows = must(await supabase.from("training_programs").select("id, name, start_date, data").eq("active", true).order("created_at", { ascending: false }).limit(1)) as { id: string; name: string; start_date: string; data: unknown }[];
  const r = rows[0], program = r ? cleanProgram(r.data) : null;
  return r && program ? { id: r.id, name: r.name, startDate: r.start_date, program } : null;
}
export const useProgram = () => useQuery({ queryKey: KEY, queryFn: loadProgram });

type LogRow = { id: string; exercise_id: string; exercise_name: string; session_date: string; week_no: number; set_no: number; load_kg: number | string | null; reps: number | null; rir: number | null; warmup: boolean; flags: string[] | null };
const n = (v: number | string | null) => (v === null || v === undefined ? null : Number(v));
export const useProgramLogs = (programId: string | undefined) => useQuery({
  queryKey: logsKey(programId ?? ""), enabled: !!programId,
  queryFn: async (): Promise<SetLog[]> => (must(await supabase.from("program_set_logs").select("id, exercise_id, exercise_name, session_date, week_no, set_no, load_kg, reps, rir, warmup, flags").eq("program_id", programId!).order("session_date").order("set_no").limit(6000)) as LogRow[])
    .map((r) => ({ id: r.id, exerciseId: r.exercise_id, exerciseName: r.exercise_name, date: r.session_date, week: r.week_no, set: r.set_no, load: n(r.load_kg), reps: r.reps, rir: r.rir, warmup: r.warmup, flags: r.flags ?? [] })),
});
type WeeklyRow = { week_no: number; logged_on: string; weight_kg: number | string | null; days_trained: number | null; energy: number | null; recovery: number | null; notes: string };
export const useWeeklies = (programId: string | undefined) => useQuery({
  queryKey: weeklyKey(programId ?? ""), enabled: !!programId,
  queryFn: async (): Promise<Weekly[]> => (must(await supabase.from("program_weekly").select("week_no, logged_on, weight_kg, days_trained, energy, recovery, notes").eq("program_id", programId!).order("week_no")) as WeeklyRow[])
    .map((r) => ({ week: r.week_no, date: r.logged_on, weight: n(r.weight_kg), daysTrained: r.days_trained, energy: r.energy, recovery: r.recovery, notes: r.notes })),
});

export function useProgramActions(programId: string | undefined) {
  const qc = useQueryClient();
  const refreshLogs = () => programId && qc.invalidateQueries({ queryKey: logsKey(programId) });
  return {
    create: useMutation({
      mutationFn: async (v: { program: Program; startDate: string }) => {
        must(await supabase.from("training_programs").update({ active: false }).eq("active", true).select("id"));
        return must(await supabase.from("training_programs").insert({ name: v.program.nome, start_date: v.startDate, data: v.program }).select("id").single()) as { id: string };
      },
      onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    }),
    save: useMutation({
      // mostra a mudança na hora (marcar uma meta não precisa esperar a rede) e volta atrás se falhar
      onMutate: async (v: { program: Program; startDate?: string }) => { await qc.cancelQueries({ queryKey: KEY }); const prev = qc.getQueryData<ProgramRow | null>(KEY); if (prev) qc.setQueryData(KEY, { ...prev, program: v.program } as ProgramRow); return { prev }; },
      onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); },
      mutationFn: async (v: { program: Program; startDate?: string }) => { must(await supabase.from("training_programs").update({ name: v.program.nome, data: v.program, updated_at: new Date().toISOString(), ...(v.startDate ? { start_date: v.startDate } : {}) }).eq("id", programId!).select("id")); },
      onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
    }),
    logSet: useMutation({
      mutationFn: async (l: SetLog) => { must(await supabase.from("program_set_logs").upsert({ program_id: programId!, exercise_id: l.exerciseId, exercise_name: l.exerciseName, session_date: l.date, week_no: l.week, set_no: l.set, load_kg: l.load, reps: l.reps, rir: l.rir, warmup: l.warmup, flags: l.flags }, { onConflict: "user_id,program_id,exercise_id,session_date,set_no,warmup" }).select("id")); },
      onSuccess: () => void refreshLogs(),
    }),
    deleteSet: useMutation({
      mutationFn: async (id: string) => { must(await supabase.from("program_set_logs").delete().eq("id", id).select("id")); },
      onSuccess: () => void refreshLogs(),
    }),
    saveWeekly: useMutation({
      mutationFn: async (w: Weekly) => { must(await supabase.from("program_weekly").upsert({ program_id: programId!, week_no: w.week, logged_on: w.date, weight_kg: w.weight, days_trained: w.daysTrained, energy: w.energy, recovery: w.recovery, notes: w.notes, updated_at: new Date().toISOString() }, { onConflict: "user_id,program_id,week_no" }).select("id")); },
      onSuccess: () => void (programId && qc.invalidateQueries({ queryKey: weeklyKey(programId) })),
    }),
  };
}
