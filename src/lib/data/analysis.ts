/** Saúde → Análise: preferências da tela e metas, guardadas na conta (tabela profiles) para valer em qualquer aparelho. */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { PeriodKey, Sexo } from "../health-analysis";
import { must, ownerId, supabase } from "./db";

export type AnalysisPrefs = { sexo: Sexo; period: PeriodKey; hidden: string[]; goalWeight: number | null; goalWaist: number | null };
export const DEFAULT_PREFS: AnalysisPrefs = { sexo: "feminino", period: "90", hidden: ["abdomen", "gluteo"], goalWeight: null, goalWaist: null };

const KEY = ["analysis-prefs"] as const;
const LOCAL = "orion-analise-sexo";
const PERIODS = ["30", "90", "180", "365", "all"];
const valid = (v: unknown): v is Sexo => v === "feminino" || v === "masculino";
const local = (): Sexo | null => { try { const s = localStorage.getItem(LOCAL); return valid(s) ? s : null; } catch { return null; } };
const num = (v: unknown): number | null => { const n = typeof v === "number" ? v : Number(v); return v === null || v === undefined || !Number.isFinite(n) ? null : n; };

type Row = { analysis_sex: string | null; analysis_period: string | null; analysis_hidden: string[] | null; goal_weight_kg: number | string | null; goal_waist_cm: number | string | null };
const COLS = "analysis_sex, analysis_period, analysis_hidden, goal_weight_kg, goal_waist_cm";

export function prefsFromRow(r: Row | null): AnalysisPrefs {
  return {
    sexo: valid(r?.analysis_sex) ? r.analysis_sex : DEFAULT_PREFS.sexo,
    period: r?.analysis_period && PERIODS.includes(r.analysis_period) ? (r.analysis_period as PeriodKey) : DEFAULT_PREFS.period,
    hidden: r?.analysis_hidden ?? DEFAULT_PREFS.hidden,
    goalWeight: num(r?.goal_weight_kg), goalWaist: num(r?.goal_waist_cm),
  };
}

const toColumns = (p: Partial<AnalysisPrefs>) => ({
  ...(p.sexo !== undefined ? { analysis_sex: p.sexo } : {}),
  ...(p.period !== undefined ? { analysis_period: p.period } : {}),
  ...(p.hidden !== undefined ? { analysis_hidden: p.hidden } : {}),
  ...(p.goalWeight !== undefined ? { goal_weight_kg: p.goalWeight } : {}),
  ...(p.goalWaist !== undefined ? { goal_waist_cm: p.goalWaist } : {}),
});

async function save(patch: Partial<AnalysisPrefs>) {
  must(await supabase.from("profiles").update(toColumns(patch)).eq("id", ownerId()).select("id"));
}

export function useAnalysisPrefs(): { prefs: AnalysisPrefs; ready: boolean; update: (patch: Partial<AnalysisPrefs>) => void } {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<AnalysisPrefs> => {
      const row = must(await supabase.from("profiles").select(COLS).eq("id", ownerId()).maybeSingle()) as Row | null;
      const prefs = prefsFromRow(row);
      if (!valid(row?.analysis_sex)) { // escolha feita antes de existir na conta: sobe uma vez
        const old = local();
        if (old) { prefs.sexo = old; await save({ sexo: old }).catch(() => undefined); }
      }
      return prefs;
    },
    staleTime: 10 * 60 * 1000,
  });
  const m = useMutation({
    mutationFn: save,
    onMutate: (patch: Partial<AnalysisPrefs>) => {
      qc.setQueryData<AnalysisPrefs>(KEY, (cur) => ({ ...(cur ?? DEFAULT_PREFS), ...patch }));
      if (patch.sexo) { try { localStorage.setItem(LOCAL, patch.sexo); } catch { /* sem armazenamento */ } }
    },
    onError: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
  return { prefs: q.data ?? DEFAULT_PREFS, ready: q.isSuccess, update: useCallback((patch) => m.mutate(patch), [m]) };
}
