/** Dados do mapa de conexões: lê tudo o que o Orion guarda (cada parte falha sozinha, sem derrubar o mapa). */
import { useQuery } from "@tanstack/react-query";

import { emptyData, type MapData } from "../map-graph";
import { supabase } from "./db";

async function part<T>(q: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> { try { const r = await q; return r.error ? [] : (r.data ?? []); } catch { return []; } }

export async function loadMapData(): Promise<MapData> {
  const d = emptyData();
  const [projects, dossiers, demands, execs, pnotes, entries, tasks, ideas, meetings, requests] = await Promise.all([
    part(supabase.from("projects").select("id, name").limit(200)),
    part(supabase.from("dossiers").select("project_id, id, name").limit(1500)),
    part(supabase.from("project_demands").select("project_id, code, type, title, status, priority, dossier_name").limit(2500)),
    part(supabase.from("demand_executions").select("project_id, code, dossier_name, status").limit(4000)),
    part(supabase.from("project_notes").select("id, project_id, text, dossier_id").limit(800)),
    part(supabase.from("brain_entries").select("id, title, text, entry_date, project_id, dossier_names, source").order("entry_date", { ascending: false }).limit(600)),
    part(supabase.from("tasks").select("id, title, done, project_id, dossier_id, due_date").order("created_at", { ascending: false }).limit(500)),
    part(supabase.from("ideas").select("id, title, status, converted").limit(300)),
    part(supabase.from("meetings").select("id, title, analysis, happened_on").order("created_at", { ascending: false }).limit(200)),
    part(supabase.from("whatsapp_requests").select("key, title, asker, chat_name, is_group, status").order("created_at", { ascending: false }).limit(400)),
  ]);
  return { ...d, projects, dossiers, demands, execs, pnotes, entries: entries.map((e: Record<string, unknown>) => ({ id: String(e["id"]), title: String(e["title"] ?? ""), text: String(e["text"] ?? "").slice(0, 3000), date: String(e["entry_date"] ?? ""), project_id: (e["project_id"] as string | null) ?? null, dossier_names: (e["dossier_names"] as string[] | null) ?? [], source: String(e["source"] ?? "") })), tasks, ideas: ideas.map((i) => ({ ...i, converted: Array.isArray(i.converted) ? i.converted : [] })), meetings, requests } as unknown as MapData;
}
export const useMapData = () => useQuery({ queryKey: ["map-data"], queryFn: loadMapData, staleTime: 60_000 });
