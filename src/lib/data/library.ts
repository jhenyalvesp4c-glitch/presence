/** Documentação (Biblioteca): documentos e pastas editáveis, salvos no banco (library_docs / library_folders). */
import { must, supabase, ownerId } from "./db";
import { BUCKET, type Attachment } from "./brain";

export type DocRow = {
  id: string; folder_id: string; title: string; description: string; kind: string; color: string; fav: boolean;
  rules: string[]; steps: string[]; attachments: Attachment[]; ai_summary: string; deleted: boolean; updated_label: string;
};
export type FolderRow = { id: string; name: string; color: string; position: number };
const DOC_COLS = "id, folder_id, title, description, kind, color, fav, rules, steps, attachments, ai_summary, deleted, updated_label";

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export async function loadLibraryRows(): Promise<{ docs: DocRow[]; folders: FolderRow[] }> {
  const [d, f] = await Promise.all([
    supabase.from("library_docs").select(DOC_COLS).order("created_at"),
    supabase.from("library_folders").select("id, name, color, position").order("position").order("created_at"),
  ]);
  const docs = (must(d) as DocRow[]).map((r) => ({ ...r, rules: arr<string>(r.rules), steps: arr<string>(r.steps), attachments: arr<Attachment>(r.attachments) }));
  return { docs, folders: must(f) as FolderRow[] };
}

export async function saveDocRow(row: DocRow) {
  must(await supabase.from("library_docs").upsert({
    user_id: ownerId(), ...row, title: row.title.slice(0, 200), description: row.description.slice(0, 6000), ai_summary: row.ai_summary.slice(0, 20000),
  }, { onConflict: "user_id,id" }).select("id"));
}

/** Apaga o documento. Exemplo do app (seed) vira "apagado"; documento criado pela usuária some de vez com seus arquivos. */
export async function removeDocRow(row: DocRow, isSeed: boolean) {
  if (isSeed) { await saveDocRow({ ...row, deleted: true }); return; }
  must(await supabase.from("library_docs").delete().eq("id", row.id).select("id"));
  if (row.attachments.length) await supabase.storage.from(BUCKET).remove(row.attachments.map((a) => a.path));
}

export async function removeFiles(paths: string[]) {
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

export async function saveFolderRow(f: FolderRow) {
  must(await supabase.from("library_folders").upsert({ user_id: ownerId(), ...f }, { onConflict: "user_id,id" }).select("id"));
}
