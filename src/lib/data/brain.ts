/** Segundo cérebro (Orion): anotações, arquivos e espelhos da Documentação (presence_app.brain_entries + Storage). */
import { mentionedDossiers } from "../orion";
import { must, supabase, SINGLE_USER_ID } from "./db";

export const BUCKET = "presence-app-brain-files";
export type Attachment = { path: string; name: string; mime: string; size: number };
export type BrainSource = "orion" | "assistente" | "documentacao";
export type BrainEntry = {
  id: string; title: string; text: string; date: string; dossiers: string[]; source: BrainSource; refId: string | null;
  summary: string; attachments: Attachment[]; createdAt: string;
};
type Row = {
  id: string; title: string; text: string; entry_date: string; dossier_names: string[]; source: BrainSource; ref_id: string | null;
  ai_summary: string; attachments: Attachment[] | null; created_at: string;
};
const COLS = "id, title, text, entry_date, dossier_names, source, ref_id, ai_summary, attachments, created_at";
const toEntry = (r: Row): BrainEntry => ({
  id: r.id, title: r.title, text: r.text, date: r.entry_date, dossiers: r.dossier_names ?? [], source: r.source, refId: r.ref_id,
  summary: r.ai_summary, attachments: Array.isArray(r.attachments) ? r.attachments : [], createdAt: r.created_at,
});

export const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export async function listEntries(limit = 8): Promise<BrainEntry[]> {
  return (must(await supabase.from("brain_entries").select(COLS).neq("source", "documentacao").order("created_at", { ascending: false }).limit(limit)) as Row[]).map(toEntry);
}

/** Tudo o que o segundo cérebro guarda (anotações, arquivos e espelhos da Documentação), mais recente primeiro. */
export async function listAllEntries(limit = 1000): Promise<BrainEntry[]> {
  return (must(await supabase.from("brain_entries").select(COLS).order("entry_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit)) as Row[]).map(toEntry);
}

const dossierNames = async () => (must(await supabase.from("dossiers").select("name")) as { name: string }[]).map((d) => d.name);
const safeName = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "arquivo";

export type NewFile = { name: string; mime: string; blob: Blob };

/** Salva a anotação (com arquivos, se houver). Os dossiês citados no texto viram etiquetas. */
export async function addEntry(input: { text: string; date?: string; title?: string; files?: NewFile[]; summary?: string }): Promise<BrainEntry> {
  const files = input.files ?? [];
  const clean = input.text.trim().slice(0, 6000);
  if (!clean && !files.length) throw new Error("Escreva ou anexe algo para documentar.");
  const names = await dossierNames();
  const id = crypto.randomUUID();
  const attachments: Attachment[] = [];
  try {
    for (const [i, f] of files.entries()) {
      const path = `${SINGLE_USER_ID}/${id}/${i}-${safeName(f.name)}`;
      const up = await supabase.storage.from(BUCKET).upload(path, f.blob, { contentType: f.mime || "application/octet-stream", upsert: true });
      if (up.error) throw new Error(`Não consegui guardar "${f.name}": ${up.error.message}`);
      attachments.push({ path, name: f.name, mime: f.mime, size: f.blob.size });
    }
    const row = must(await supabase.from("brain_entries").insert({
      id, user_id: SINGLE_USER_ID, text: clean, title: (input.title ?? "").slice(0, 200), entry_date: input.date || todayIso(),
      dossier_names: mentionedDossiers(`${clean} ${input.title ?? ""} ${files.map((f) => f.name).join(" ")}`, names),
      attachments, ai_summary: (input.summary ?? "").slice(0, 20000),
    }).select(COLS).single()) as Row;
    return toEntry(row);
  } catch (e) {
    if (attachments.length) await supabase.storage.from(BUCKET).remove(attachments.map((a) => a.path));
    throw e;
  }
}

export async function updateEntry(id: string, patch: { text: string; title: string; date: string }): Promise<BrainEntry> {
  const names = await dossierNames();
  const text = patch.text.trim().slice(0, 6000);
  const row = must(await supabase.from("brain_entries")
    .update({ text, title: patch.title.trim().slice(0, 200), entry_date: patch.date, dossier_names: mentionedDossiers(`${text} ${patch.title}`, names) })
    .eq("id", id).select(COLS).single()) as Row;
  return toEntry(row);
}

export async function deleteEntry(id: string) {
  const cur = must(await supabase.from("brain_entries").select("attachments").eq("id", id)) as { attachments: Attachment[] | null }[];
  const paths = (cur[0]?.attachments ?? []).map((a) => a.path);
  must(await supabase.from("brain_entries").delete().eq("id", id).select("id"));
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}

/** Endereços temporários (1 h) para mostrar/baixar os arquivos. */
export async function signedUrls(paths: string[]): Promise<Record<string, { view: string; download: string }>> {
  const out: Record<string, { view: string; download: string }> = {};
  if (!paths.length) return out;
  const [view, down] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUrls(paths, 3600),
    supabase.storage.from(BUCKET).createSignedUrls(paths, 3600, { download: true }),
  ]);
  for (const v of view.data ?? []) if (v.path && v.signedUrl) out[v.path] = { view: v.signedUrl, download: down.data?.find((d) => d.path === v.path)?.signedUrl ?? v.signedUrl };
  return out;
}

/* ───────── Espelhos da Documentação (logins sem senha, documentos criados) ───────── */
export type Mirror = { refId: string; title: string; text: string; dossier?: string | undefined };

/** Cria ou atualiza os espelhos; devolve quando termina. Nunca recebe senhas. */
export async function upsertMirrors(list: Mirror[]) {
  if (!list.length) return;
  const names = await dossierNames();
  const rows = list.map((m) => ({
    user_id: SINGLE_USER_ID, ref_id: m.refId, source: "documentacao", title: m.title.slice(0, 200), text: m.text.slice(0, 6000),
    dossier_names: [...new Set([...(m.dossier ? [m.dossier] : []), ...mentionedDossiers(m.text, names)])],
  }));
  must(await supabase.from("brain_entries").upsert(rows, { onConflict: "user_id,ref_id" }).select("id"));
}

export async function deleteMirrors(refIds: string[]) {
  if (!refIds.length) return;
  must(await supabase.from("brain_entries").delete().eq("user_id", SINGLE_USER_ID).in("ref_id", refIds).select("id"));
}

const mirrorHash = new Map<string, string>();
/** Deixa os espelhos iguais à Documentação: cria/atualiza o que mudou e apaga o que não existe mais. */
export async function syncMirrors(list: Mirror[]) {
  const existing = (must(await supabase.from("brain_entries").select("ref_id").eq("source", "documentacao")) as { ref_id: string | null }[]).map((r) => r.ref_id).filter((r): r is string => !!r);
  const keep = new Set(list.map((m) => m.refId)), known = new Set(existing);
  const hash = (m: Mirror) => JSON.stringify([m.title, m.text, m.dossier ?? ""]);
  const changed = list.filter((m) => !known.has(m.refId) || mirrorHash.get(m.refId) !== hash(m));
  await deleteMirrors(existing.filter((r) => !keep.has(r)));
  await upsertMirrors(changed);
  for (const m of changed) mirrorHash.set(m.refId, hash(m));
}

/** Endereços temporários (1 h) para arquivos de qualquer bucket do Presence (anotações e anexos de demandas). */
export async function signedUrlsFor(files: { bucket: string; path: string }[]): Promise<Record<string, { view: string; download: string }>> {
  const out: Record<string, { view: string; download: string }> = {};
  const byBucket = new Map<string, string[]>();
  for (const f of files) { const l = byBucket.get(f.bucket) ?? []; if (!l.includes(f.path)) l.push(f.path); byBucket.set(f.bucket, l); }
  await Promise.all([...byBucket.entries()].map(async ([bucket, paths]) => {
    const [view, down] = await Promise.all([supabase.storage.from(bucket).createSignedUrls(paths, 3600), supabase.storage.from(bucket).createSignedUrls(paths, 3600, { download: true })]);
    for (const v of view.data ?? []) if (v.path && v.signedUrl) out[`${bucket}/${v.path}`] = { view: v.signedUrl, download: down.data?.find((d) => d.path === v.path)?.signedUrl ?? v.signedUrl };
  }));
  return out;
}
