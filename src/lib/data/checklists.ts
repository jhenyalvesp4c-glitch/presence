/** Banco das listas (checklists). Cada pessoa vê só as suas, pela regra de acesso. */
import { cleanLabel, colorFor, type CItem, type CList } from "../checklist";
import { must, supabase } from "./db";

export type NewItem = { texto: string; grupo?: string | undefined };

export async function loadLists(): Promise<CList[]> {
  const [l, i] = await Promise.all([
    supabase.from("checklists").select("id, title, color, updated_at").order("updated_at", { ascending: false }).limit(100),
    supabase.from("checklist_items").select("id, list_id, section, label, done, position").order("position", { ascending: true }).limit(5000),
  ]);
  const items = must(i) as CItem[];
  return (must(l) as Omit<CList, "items">[]).map((x) => ({ ...x, items: items.filter((it) => it.list_id === x.id) }));
}

const touch = async (id: string) => { await supabase.from("checklists").update({ updated_at: new Date().toISOString() }).eq("id", id); };

export async function createList(title: string, items: NewItem[]): Promise<string> {
  const n = (must(await supabase.from("checklists").select("id").limit(1000)) as unknown[]).length;
  const r = must(await supabase.from("checklists").insert({ title: cleanLabel(title) || "Lista", color: colorFor(n) }).select("id")) as { id: string }[];
  const id = r[0]!.id;
  if (items.length) await addItems(id, items, 0);
  return id;
}

/** Acrescenta itens (sem repetir o que já está na lista) e devolve só os realmente novos. */
export async function addItems(listId: string, items: NewItem[], startAt?: number): Promise<string[]> {
  const cur = must(await supabase.from("checklist_items").select("label, position").eq("list_id", listId)) as { label: string; position: number }[];
  const seen = new Set(cur.map((c) => c.label.toLowerCase()));
  let pos = startAt ?? cur.reduce((m, c) => Math.max(m, c.position), -1) + 1;
  const rows: { list_id: string; label: string; section: string; position: number }[] = [];
  for (const it of items) {
    const label = cleanLabel(it.texto);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    rows.push({ list_id: listId, label, section: cleanLabel(it.grupo ?? ""), position: pos++ });
  }
  if (rows.length) { must(await supabase.from("checklist_items").insert(rows).select("id")); await touch(listId); }
  return rows.map((r) => r.label);
}

export async function setItemDone(id: string, done: boolean): Promise<void> {
  must(await supabase.from("checklist_items").update({ done }).eq("id", id).select("id"));
}
export async function setManyDone(ids: string[], done: boolean, listId: string): Promise<void> {
  if (!ids.length) return;
  must(await supabase.from("checklist_items").update({ done }).in("id", ids).select("id"));
  await touch(listId);
}
export async function removeItems(ids: string[], listId: string): Promise<void> {
  if (!ids.length) return;
  must(await supabase.from("checklist_items").delete().in("id", ids).select("id"));
  await touch(listId);
}
export async function renameList(id: string, title: string): Promise<void> {
  must(await supabase.from("checklists").update({ title: cleanLabel(title), updated_at: new Date().toISOString() }).eq("id", id).select("id"));
}
export async function deleteList(id: string): Promise<void> {
  must(await supabase.from("checklists").delete().eq("id", id).select("id"));
}
