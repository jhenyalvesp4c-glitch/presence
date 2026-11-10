/**
 * Roteiros de treinamento de um projeto (aba Treinamentos). Cada roteiro é um JSON na tabela
 * training_scripts. Na primeira abertura de cada projeto, os roteiros de exemplo entram uma vez só.
 */
import { must, supabase } from "./db";

type Row = { project_id: string; id: string; data: unknown; position: number };

export async function loadTrainingScripts<T extends { id: string }>(
  projectId: string, seed: T[], encode: (s: T) => unknown, decode: (raw: unknown) => T,
): Promise<T[]> {
  const proj = must(await supabase.from("projects").select("id, training_seeded").eq("id", projectId).limit(1)) as { id: string; training_seeded: boolean }[];
  // Sem linha do projeto ainda (a página de Demandas cria): mostra os exemplos sem gravar.
  if (!proj[0]) return seed;
  if (!proj[0].training_seeded) {
    const rows: Row[] = seed.map((s, i) => ({ project_id: projectId, id: s.id, data: encode(s), position: i }));
    if (rows.length) must(await supabase.from("training_scripts").upsert(rows, { onConflict: "project_id,id" }).select("id"));
    must(await supabase.from("projects").update({ training_seeded: true }).eq("id", projectId).select("id"));
    return seed;
  }
  const rows = must(await supabase.from("training_scripts").select("id, data, position").eq("project_id", projectId).order("position").order("created_at")) as { id: string; data: unknown }[];
  return rows.map((r) => decode(r.data));
}

export async function saveTrainingScripts<T extends { id: string }>(
  projectId: string, prev: T[], next: T[], encode: (s: T) => unknown,
) {
  const ids = new Set(next.map((s) => s.id));
  const gone = prev.filter((s) => !ids.has(s.id)).map((s) => s.id);
  if (gone.length) must(await supabase.from("training_scripts").delete().eq("project_id", projectId).in("id", gone).select("id"));
  const before = new Map(prev.map((s, i) => [s.id, JSON.stringify({ d: encode(s), p: i })]));
  const rows = next
    .map((s, i): Row => ({ project_id: projectId, id: s.id, data: encode(s), position: i }))
    .filter((r) => before.get(r.id) !== JSON.stringify({ d: r.data, p: r.position }));
  if (rows.length) must(await supabase.from("training_scripts").upsert(rows, { onConflict: "project_id,id" }).select("id"));
}
