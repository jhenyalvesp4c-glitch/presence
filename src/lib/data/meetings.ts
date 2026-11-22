/** Reuniões na nuvem: o texto original, a análise do Orion e o que já foi enviado para a Central de entrada. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cleanAnalysis, type Analysis, type Mode, type Source } from "../meetings";
import { defaultProjectId } from "../dossiers";
import { must, supabase } from "./db";

export type Meeting = { id: string; title: string; source: Source; mode: Mode; raw: string; analysis: Analysis; sent: number[]; happenedOn: string; createdAt: string; dossierId: string | null; clientId: string | null };
const KEY = ["meetings"] as const;
/** Vínculo da reunião com um polo (dossiê) e/ou cliente: é o que faz ela aparecer na página do cliente. */
export type MeetingLink = { dossierId: string | null; clientId: string | null };
const linkCols = (l?: MeetingLink) => (l ? { dossier_id: l.dossierId, dossier_project: l.dossierId ? defaultProjectId() : null, client_id: l.clientId } : {});
type Row = { id: string; title: string; source: Source; mode: Mode; raw: string; analysis: unknown; created: unknown; happened_on: string; created_at: string; dossier_id: string | null; client_id: string | null };
const toMeeting = (r: Row): Meeting | null => { const a = cleanAnalysis(r.analysis); return a ? { id: r.id, title: r.title, source: r.source, mode: r.mode, raw: r.raw, analysis: a, sent: Array.isArray(r.created) ? (r.created as number[]).filter((n) => Number.isInteger(n)) : [], happenedOn: r.happened_on, createdAt: r.created_at, dossierId: r.dossier_id ?? null, clientId: r.client_id ?? null } : null; };

export const useMeetings = () => useQuery({
  queryKey: KEY,
  queryFn: async (): Promise<Meeting[]> => (must(await supabase.from("meetings").select("id, title, source, mode, raw, analysis, created, happened_on, created_at, dossier_id, client_id").order("created_at", { ascending: false }).limit(100)) as Row[]).flatMap((r) => toMeeting(r) ?? []),
});
export function useMeetingActions() {
  const qc = useQueryClient(), refresh = () => qc.invalidateQueries({ queryKey: KEY });
  return {
    save: useMutation({
      mutationFn: async (v: { title: string; source: Source; mode: Mode; raw: string; analysis: Analysis; happenedOn: string; link?: MeetingLink }) => (must(await supabase.from("meetings").insert({ ...linkCols(v.link), title: v.title.slice(0, 200), source: v.source, mode: v.mode, raw: v.raw.slice(0, 80000), analysis: v.analysis, happened_on: v.happenedOn }).select("id").single()) as { id: string }).id,
      onSuccess: refresh,
    }),
    link: useMutation({ mutationFn: async (v: { id: string; link: MeetingLink }) => { must(await supabase.from("meetings").update({ ...linkCols(v.link), updated_at: new Date().toISOString() }).eq("id", v.id).select("id")); }, onSuccess: () => { void refresh(); void qc.invalidateQueries({ queryKey: ["clients"] }); } }),
    markSent: useMutation({ mutationFn: async (v: { id: string; sent: number[] }) => { must(await supabase.from("meetings").update({ created: v.sent, updated_at: new Date().toISOString() }).eq("id", v.id).select("id")); }, onSuccess: refresh }),
    remove: useMutation({ mutationFn: async (id: string) => { must(await supabase.from("meetings").delete().eq("id", id).select("id")); }, onSuccess: refresh }),
  };
}
