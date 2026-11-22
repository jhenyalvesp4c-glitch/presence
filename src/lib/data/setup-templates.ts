/** Roteiro de implantação padrão do projeto (setup_templates): novos clientes já nascem com ele. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SETUP_TEMPLATE, sanitizeTemplate, type SetupPhaseDef } from "../setup";
import { must, supabase } from "./db";

export async function loadSetupTemplate(projectId: string): Promise<SetupPhaseDef[] | null> {
  const r = must(await supabase.from("setup_templates").select("phases").eq("project_id", projectId).limit(1)) as { phases: unknown }[];
  return r[0] ? sanitizeTemplate(r[0].phases) : null;
}
const KEY = ["setup-template"] as const;
/** `custom` = existe um padrão salvo pela usuária; senão vale o modelo de fábrica. */
export const useSetupTemplate = (projectId: string) => useQuery({ queryKey: [...KEY, projectId], queryFn: async () => { const t = await loadSetupTemplate(projectId); return { phases: t ?? SETUP_TEMPLATE, custom: !!t }; } });

export function useSetupTemplateActions(projectId: string) {
  const qc = useQueryClient(), refresh = () => qc.invalidateQueries({ queryKey: KEY });
  return {
    save: useMutation({ mutationFn: async (phases: SetupPhaseDef[]) => {
      const clean = sanitizeTemplate(phases); if (!clean) throw new Error("O roteiro precisa de ao menos uma fase com um passo.");
      must(await supabase.from("setup_templates").upsert({ project_id: projectId, phases: clean, updated_at: new Date().toISOString() }, { onConflict: "user_id,project_id" }).select("id"));
    }, onSuccess: refresh }),
    reset: useMutation({ mutationFn: async () => { must(await supabase.from("setup_templates").delete().eq("project_id", projectId).select("id")); }, onSuccess: refresh }),
  };
}
