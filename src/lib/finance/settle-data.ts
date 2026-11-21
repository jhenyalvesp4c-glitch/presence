/** Acerto de contas na nuvem (tabelas fin_settlements e fin_settlement_items): só quem está logado, só as próprias linhas. */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { must, supabase } from "../data/db";
import type { SettleItem } from "./settle";

export type Settlement = { id: string; person: string; note: string; closed: boolean; createdAt: string; /** % das contas da casa que fica com a outra pessoa (null = não definido). */ defaultShare: number | null };
export type ItemDraft = Omit<SettleItem, "id">;

const LIST = ["settlements"] as const;
const itemsKey = (id: string | null) => ["settlement-items", id] as const;

type SRow = { id: string; person: string; note: string; closed: boolean; created_at: string; default_share: number | null };
type IRow = { id: string; kind: SettleItem["kind"]; item_date: string | null; description: string; amount: number | string; payer: SettleItem["payer"]; other_share: number; installment: string; source_ref?: string | null };

const toSettlement = (r: SRow): Settlement => ({ id: r.id, person: r.person, note: r.note, closed: r.closed, createdAt: r.created_at, defaultShare: r.default_share });
const toItem = (r: IRow): SettleItem => ({ id: r.id, kind: r.kind, date: r.item_date, description: r.description, amount: Number(r.amount), payer: r.payer, otherShare: r.other_share, installment: r.installment, linked: !!r.source_ref });
const toRow = (d: ItemDraft, settlementId: string, position: number) => ({
  settlement_id: settlementId, kind: d.kind, item_date: d.date || null, description: d.description.trim().slice(0, 200), amount: Math.round(d.amount * 100) / 100,
  payer: d.payer, other_share: Math.min(100, Math.max(0, Math.round(d.otherShare))), installment: d.installment.trim().slice(0, 20), position,
});

export function useSettlements() {
  return useQuery({
    queryKey: LIST,
    queryFn: async () => (must(await supabase.from("fin_settlements").select("id, person, note, closed, created_at, default_share").order("closed").order("created_at", { ascending: false })) as SRow[]).map(toSettlement),
  });
}

export function useSettlementItems(id: string | null) {
  return useQuery({
    queryKey: itemsKey(id), enabled: !!id,
    queryFn: async () => (must(await supabase.from("fin_settlement_items").select("id, kind, item_date, description, amount, payer, other_share, installment, source_ref").eq("settlement_id", id!).order("position").order("created_at")) as IRow[]).map(toItem),
  });
}

export function useSettleActions() {
  const qc = useQueryClient();
  const refresh = useCallback((id?: string) => Promise.all([qc.invalidateQueries({ queryKey: LIST }), id ? qc.invalidateQueries({ queryKey: itemsKey(id) }) : Promise.resolve()]), [qc]);
  const create = useMutation({ mutationFn: async (person: string) => (must(await supabase.from("fin_settlements").insert({ person: person.trim().slice(0, 80) }).select("id, person, note, closed, created_at, default_share")) as SRow[]).map(toSettlement)[0]!, onSuccess: () => void refresh() });
  const patch = useMutation({
    mutationFn: async (v: { id: string; person?: string; closed?: boolean; note?: string; defaultShare?: number | null }) => { const { id, defaultShare, ...rest } = v; must(await supabase.from("fin_settlements").update({ ...rest, ...(defaultShare !== undefined ? { default_share: defaultShare } : {}), updated_at: new Date().toISOString() }).eq("id", id).select("id")); },
    onSuccess: () => void refresh(),
  });
  const remove = useMutation({ mutationFn: async (id: string) => { must(await supabase.from("fin_settlements").delete().eq("id", id).select("id")); }, onSuccess: () => void refresh() });
  const addItems = useMutation({
    mutationFn: async (v: { settlementId: string; drafts: ItemDraft[]; start: number }) => { if (v.drafts.length) must(await supabase.from("fin_settlement_items").insert(v.drafts.map((d, i) => toRow(d, v.settlementId, v.start + i))).select("id")); },
    onSuccess: (_d, v) => void refresh(v.settlementId),
  });
  const updateItem = useMutation({
    mutationFn: async (v: { settlementId: string; id: string; draft: ItemDraft }) => { const { settlement_id: _s, position: _p, ...cols } = toRow(v.draft, v.settlementId, 0); must(await supabase.from("fin_settlement_items").update(cols).eq("id", v.id).select("id")); },
    onSuccess: (_d, v) => void refresh(v.settlementId),
  });
  const removeItem = useMutation({
    mutationFn: async (v: { settlementId: string; id: string }) => { must(await supabase.from("fin_settlement_items").delete().eq("id", v.id).select("id")); },
    onSuccess: (_d, v) => void refresh(v.settlementId),
  });
  return { create, patch, remove, addItems, updateItem, removeItem };
}
