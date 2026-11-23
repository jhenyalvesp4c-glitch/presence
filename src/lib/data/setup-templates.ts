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

/** Aplica o padrão atual a TODOS os clientes do projeto (os que já têm roteiro mantêm o andamento dos passos que continuam). */
export async function applyToAllClients(projectId: string): Promise<{ total: number; created: number; updated: number; failed: number }> {
  const ids = (must(await supabase.from("clients").select("id").eq("project_id", projectId)) as { id: string }[]).map((c) => c.id);
  if (!ids.length) return { total: 0, created: 0, updated: 0, failed: 0 };
  const { applyDefaultToAll } = await import("./client-setup");
  return { total: ids.length, ...(await applyDefaultToAll(ids, projectId)) };
}

export function useSetupTemplateActions(projectId: string) {
  const qc = useQueryClient(), refresh = () => Promise.all([qc.invalidateQueries({ queryKey: KEY }), qc.invalidateQueries({ queryKey: ["client-setup"] }), qc.invalidateQueries({ queryKey: ["clients"] })]);
  return {
    /** Salvar o padrão já aplica em todos os clientes (novos já nascem com ele). */
    save: useMutation({ mutationFn: async (phases: SetupPhaseDef[]) => {
      const clean = sanitizeTemplate(phases); if (!clean) throw new Error("O roteiro precisa de ao menos uma fase com um passo.");
      must(await supabase.from("setup_templates").upsert({ project_id: projectId, phases: clean, updated_at: new Date().toISOString() }, { onConflict: "user_id,project_id" }).select("id"));
      return applyToAllClients(projectId);
    }, onSuccess: refresh }),
    reset: useMutation({ mutationFn: async () => { must(await supabase.from("setup_templates").delete().eq("project_id", projectId).select("id")); return applyToAllClients(projectId); }, onSuccess: refresh }),
  };
}
