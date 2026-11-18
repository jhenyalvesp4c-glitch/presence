/** Saúde → Análise: guarda na conta se a fórmula de gordura estimada é feminina ou masculina (antes ficava só no navegador). */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Sexo } from "../health-analysis";
import { must, ownerId, supabase } from "./db";

const KEY = ["analysis-sex"] as const;
const LOCAL = "orion-analise-sexo";
const valid = (v: unknown): v is Sexo => v === "feminino" || v === "masculino";
const local = (): Sexo | null => { try { const s = localStorage.getItem(LOCAL); return valid(s) ? s : null; } catch { return null; } };

async function save(sexo: Sexo) {
  must(await supabase.from("profiles").update({ analysis_sex: sexo }).eq("id", ownerId()).select("id"));
}

export function useAnalysisSex(): { sexo: Sexo; setSexo: (s: Sexo) => void } {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Sexo | null> => {
      const row = must(await supabase.from("profiles").select("analysis_sex").eq("id", ownerId()).maybeSingle()) as { analysis_sex: string | null } | null;
      if (valid(row?.analysis_sex)) return row.analysis_sex;
      const old = local(); // escolha feita antes de existir na conta: sobe uma vez
      if (old) await save(old).catch(() => undefined);
      return old;
    },
    staleTime: 10 * 60 * 1000,
  });
  const m = useMutation({
    mutationFn: save,
    onMutate: (s: Sexo) => { qc.setQueryData(KEY, s); try { localStorage.setItem(LOCAL, s); } catch { /* sem armazenamento */ } },
    onError: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
  return { sexo: q.data ?? "feminino", setSexo: useCallback((s: Sexo) => m.mutate(s), [m]) };
}
