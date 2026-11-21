/** Pedidos do WhatsApp já decididos (viraram demanda ou foram descartados): a próxima verificação não mostra de novo. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Req } from "../wa-requests";
import { must, supabase } from "./db";

const KEY = ["wa-requests"] as const;
export type Decided = { key: string; status: "enviada" | "descartada"; title: string; chat: string; quote: string; createdAt: string };
type Row = { key: string; status: "enviada" | "descartada"; title: string; chat_name: string; quote: string; created_at: string };

export const useDecided = () => useQuery({
  queryKey: KEY,
  queryFn: async (): Promise<Decided[]> => (must(await supabase.from("whatsapp_requests").select("key, status, title, chat_name, quote, created_at").order("created_at", { ascending: false }).limit(2000)) as Row[]).map((r) => ({ key: r.key, status: r.status, title: r.title, chat: r.chat_name, quote: r.quote, createdAt: r.created_at })),
});
export function useDecide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { reqs: Req[]; status: "enviada" | "descartada" }) => {
      if (!v.reqs.length) return;
      must(await supabase.from("whatsapp_requests").upsert(v.reqs.map((r) => ({ key: r.key, chat_name: r.chat, is_group: r.grupo, asker: r.quem, title: r.titulo, details: r.detalhes, quote: r.trecho, asked_label: r.quando, deadline: r.prazo, priority: r.prioridade, status: v.status })), { onConflict: "user_id,key" }).select("id"));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useUndecide() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (key: string) => { must(await supabase.from("whatsapp_requests").delete().eq("key", key).select("id")); }, onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }) });
}

/** O que conta como demanda para a pessoa (texto editável; vazio = padrão do CRM/P4C). */
export const useRules = () => useQuery({ queryKey: ["wa-rules"], queryFn: async (): Promise<string> => ((must(await supabase.from("wa_demand_rules").select("rules").limit(1)) as { rules: string }[])[0]?.rules ?? "") });
export function useSaveRules() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: async (rules: string) => { must(await supabase.from("wa_demand_rules").upsert({ rules, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("user_id")); }, onSuccess: () => void qc.invalidateQueries({ queryKey: ["wa-rules"] }) });
}
