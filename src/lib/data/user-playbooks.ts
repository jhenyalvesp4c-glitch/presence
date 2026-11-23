/** Playbooks da pessoa: lista (modelos do Orion + os dela), salvar (editar/criar) e excluir. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PLAYBOOKS, mergePlaybooks, type Playbook, type PlaybookRow, stepsKey } from "../playbooks";
import { must, supabase } from "./db";

const KEY = ["user-playbooks"] as const;
const COLS = "id, name, tagline, tone, docs, checklist, steps, deleted, position";

export function usePlaybooks() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Playbook[]> => mergePlaybooks(PLAYBOOKS, must(await supabase.from("user_playbooks").select(COLS)) as PlaybookRow[]),
    placeholderData: PLAYBOOKS,
  });
}

const forget = (id: string) => { try { localStorage.removeItem(stepsKey(id)); } catch { /* sem armazenamento */ } };

export function usePlaybookActions() {
  const qc = useQueryClient(), refresh = () => qc.invalidateQueries({ queryKey: KEY });
  return {
    save: useMutation({
      mutationFn: async (p: Playbook & { position?: number }) => {
        const { data: last } = await supabase.from("user_playbooks").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
        must(await supabase.from("user_playbooks").upsert({ id: p.id, name: p.name.trim().slice(0, 120) || "Playbook", tagline: p.tagline.trim().slice(0, 500), tone: p.tone, docs: p.docs, checklist: p.checklist, steps: p.steps, deleted: false, position: p.position ?? ((last as { position?: number } | null)?.position ?? 0) + 1, updated_at: new Date().toISOString() }, { onConflict: "user_id,id" }).select("id"));
        forget(p.id); // as edições feitas na hora de executar davam outro modelo: agora vale o que foi salvo aqui
      },
      onSuccess: refresh,
    }),
    /** Excluir: o que a pessoa criou some de vez; o modelo do Orion fica marcado como excluído (dá para recriar). */
    remove: useMutation({
      mutationFn: async (p: Playbook) => {
        if (PLAYBOOKS.some((b) => b.id === p.id)) must(await supabase.from("user_playbooks").upsert({ id: p.id, name: p.name, tagline: p.tagline, tone: p.tone, docs: p.docs, checklist: p.checklist, steps: p.steps, deleted: true, updated_at: new Date().toISOString() }, { onConflict: "user_id,id" }).select("id"));
        else must(await supabase.from("user_playbooks").delete().eq("id", p.id).select("id"));
        forget(p.id);
      },
      onSuccess: refresh,
    }),
    /** Volta o modelo do Orion ao original (apaga a edição e a exclusão). */
    restore: useMutation({ mutationFn: async (id: string) => { must(await supabase.from("user_playbooks").delete().eq("id", id).select("id")); forget(id); }, onSuccess: refresh }),
  };
}
