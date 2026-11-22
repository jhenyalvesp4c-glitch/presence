/** Roteiro de implantação do cliente (client_setup): passos com status e anotação. Só as linhas do dono. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SETUP_TEMPLATE, missingRows, type SetupStatus, type SetupStep } from "../setup";
import { must, supabase } from "./db";

type Row = { id: string; client_id: string; key: string; phase: string; phase_position: number; position: number; title: string; hint: string; status: SetupStatus; note: string; done_at: string | null };
const COLS = "id, client_id, key, phase, phase_position, position, title, hint, status, note, done_at";
const toStep = (r: Row): SetupStep => ({ id: r.id, key: r.key, phase: r.phase, phaseIndex: r.phase_position, position: r.position, title: r.title, hint: r.hint, status: r.status, note: r.note, doneAt: r.done_at });
const KEY = ["client-setup"] as const;

export const useClientSetup = (clientId: string) => useQuery({ queryKey: [...KEY, clientId], queryFn: async () => (must(await supabase.from("client_setup").select(COLS).eq("client_id", clientId).order("phase_position").order("position")) as Row[]).map(toStep) });

/** Andamento de todas as implantações (Central do dia). */
export type SetupSummary = { clientId: string; client: string; total: number; finished: number; blocked: number; next: string | null };
export const useSetupSummaries = () => useQuery({
  queryKey: [...KEY, "summaries"],
  queryFn: async (): Promise<SetupSummary[]> => {
    const rows = must(await supabase.from("client_setup").select("client_id, title, status, phase_position, position, clients(name)").limit(2000)) as unknown as { client_id: string; title: string; status: SetupStatus; phase_position: number; position: number; clients: { name: string } | { name: string }[] | null }[];
    const by = new Map<string, typeof rows>();
    for (const r of rows) (by.get(r.client_id) ?? by.set(r.client_id, []).get(r.client_id)!).push(r);
    return [...by.entries()].map(([clientId, list]) => {
      const sorted = [...list].sort((a, b) => a.phase_position - b.phase_position || a.position - b.position), open = sorted.filter((r) => r.status !== "done" && r.status !== "na");
      const c = sorted[0]?.clients, name = Array.isArray(c) ? c[0]?.name : c?.name;
      return { clientId, client: name ?? "Cliente", total: list.length, finished: list.length - open.length, blocked: list.filter((r) => r.status === "blocked").length, next: (open.find((r) => r.status === "doing") ?? open.find((r) => r.status !== "blocked") ?? open[0])?.title ?? null };
    });
  },
});

/** Cria os passos que faltam do modelo (idempotente). Usado pelo botão "Criar roteiro" e pelo playbook. */
export async function seedSetup(clientId: string): Promise<number> {
  const have = (must(await supabase.from("client_setup").select("key").eq("client_id", clientId)) as { key: string }[]).map((r) => r.key);
  const rows = missingRows(SETUP_TEMPLATE, have).map((r) => ({ ...r, client_id: clientId }));
  if (rows.length) must(await supabase.from("client_setup").insert(rows).select("id"));
  return rows.length;
}

export function useSetupActions(clientId: string) {
  const qc = useQueryClient(), refresh = () => Promise.all([qc.invalidateQueries({ queryKey: KEY }), qc.invalidateQueries({ queryKey: ["central"] })]);
  return {
    seed: useMutation({ mutationFn: () => seedSetup(clientId), onSuccess: refresh }),
    setStatus: useMutation({ mutationFn: async (v: { id: string; status: SetupStatus }) => { must(await supabase.from("client_setup").update({ status: v.status, done_at: v.status === "done" ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", v.id).select("id")); }, onSuccess: refresh }),
    setNote: useMutation({ mutationFn: async (v: { id: string; note: string }) => { must(await supabase.from("client_setup").update({ note: v.note.slice(0, 2000), updated_at: new Date().toISOString() }).eq("id", v.id).select("id")); }, onSuccess: refresh }),
    addStep: useMutation({ mutationFn: async (v: { phase: string; phaseIndex: number; title: string; position: number }) => { must(await supabase.from("client_setup").insert({ client_id: clientId, key: `custom-${Date.now().toString(36)}`, phase: v.phase, phase_position: v.phaseIndex, position: v.position, title: v.title.trim().slice(0, 200) }).select("id")); }, onSuccess: refresh }),
    rename: useMutation({ mutationFn: async (v: { id: string; title: string }) => { must(await supabase.from("client_setup").update({ title: v.title.trim().slice(0, 200), updated_at: new Date().toISOString() }).eq("id", v.id).select("id")); }, onSuccess: refresh }),
    remove: useMutation({ mutationFn: async (id: string) => { must(await supabase.from("client_setup").delete().eq("id", id).select("id")); }, onSuccess: refresh }),
  };
}
