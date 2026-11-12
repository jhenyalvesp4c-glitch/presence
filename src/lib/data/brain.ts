/** Anotações do Orion (segundo cérebro) no banco (presence_app.brain_entries). */
import { mentionedDossiers } from "../orion";
import { must, supabase, SINGLE_USER_ID } from "./db";

export type BrainEntry = { id: string; text: string; date: string; dossiers: string[]; createdAt: string };
type Row = { id: string; text: string; entry_date: string; dossier_names: string[]; created_at: string };
const toEntry = (r: Row): BrainEntry => ({ id: r.id, text: r.text, date: r.entry_date, dossiers: r.dossier_names ?? [], createdAt: r.created_at });
const COLS = "id, text, entry_date, dossier_names, created_at";

export const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export async function listEntries(limit = 8): Promise<BrainEntry[]> {
  return (must(await supabase.from("brain_entries").select(COLS).order("created_at", { ascending: false }).limit(limit)) as Row[]).map(toEntry);
}

/** Salva a anotação; os dossiês (polos) citados no texto viram etiquetas para facilitar achar depois. */
export async function addEntry(text: string, date = todayIso()): Promise<BrainEntry> {
  const clean = text.trim().slice(0, 6000);
  if (!clean) throw new Error("Escreva o que quer documentar.");
  const names = (must(await supabase.from("dossiers").select("name")) as { name: string }[]).map((d) => d.name);
  const row = must(await supabase.from("brain_entries")
    .insert({ user_id: SINGLE_USER_ID, text: clean, entry_date: date, dossier_names: mentionedDossiers(clean, names) })
    .select(COLS).single()) as Row;
  return toEntry(row);
}

export async function deleteEntry(id: string) {
  must(await supabase.from("brain_entries").delete().eq("id", id).select("id"));
}
