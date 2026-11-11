/**
 * Material de cada demanda (corpo do texto + prints e arquivos), guardado no banco:
 * texto em demand_materials, um registro por arquivo em demand_files e o arquivo em si no bucket
 * privado presence-app-demand-files. A chave é `${projeto}:${código da demanda}`.
 */
import { SINGLE_USER_ID, must, supabase } from "./data/db";

/**
 * Um arquivo da demanda. Arquivo novo (ainda não enviado) traz `blob`; o que já está no banco traz
 * `path` e os endereços temporários (`url` para ver, `downloadUrl` para baixar).
 */
export type MaterialFile = {
  id: string; name: string; type: string; size: number; addedAt: string; caption: string;
  blob?: Blob | undefined; path?: string | undefined; url?: string | undefined; downloadUrl?: string | undefined;
};
export type Materials = { body: string; files: MaterialFile[] };

export const EMPTY_MATERIALS: Materials = { body: "", files: [] };
export const MAX_FILE_MB = 25;
export const BUCKET = "presence-app-demand-files";
const EVENT = "presence:materials";

export const materialsKey = (projectId: string, code: string) => `${projectId}:${code}`;
export const isImage = (f: Pick<MaterialFile, "type">) => f.type.startsWith("image/");
export const isPdf = (f: Pick<MaterialFile, "type" | "name">) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
export const fileSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/** Separa os arquivos aceitos dos grandes demais. */
export function toMaterialFiles(files: File[], now = new Date()): { ok: MaterialFile[]; tooBig: string[] } {
  const ok: MaterialFile[] = [], tooBig: string[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE_MB * 1024 * 1024) { tooBig.push(f.name); continue; }
    const name = f.name && f.name !== "image.png" ? f.name : `print-${now.toISOString().slice(0, 19).replace(/[T:]/g, "-")}.${(f.type.split("/")[1] || "png").replace("jpeg", "jpg")}`;
    ok.push({ id: `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 7)}`, name, type: f.type || "application/octet-stream", size: f.size, addedAt: now.toISOString(), caption: "", blob: f });
  }
  return { ok, tooBig };
}

/* ───────────── caminhos no Storage ───────────── */
export function parseKey(key: string): { projectId: string; code: string } {
  const i = key.indexOf(":");
  return { projectId: key.slice(0, i), code: key.slice(i + 1) };
}
/** "#G040" -> "G040": nomes de pasta sem caracteres estranhos. */
const slug = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, "") || "x";
const safeName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "arquivo";
export const folderOf = (projectId: string, code: string) => `${SINGLE_USER_ID}/${slug(projectId)}/${slug(code)}`;
export const pathOf = (projectId: string, code: string, f: Pick<MaterialFile, "id" | "name">) => `${folderOf(projectId, code)}/${slug(f.id)}-${safeName(f.name)}`;

/* ───────────── banco ───────────── */
type FileRow = { id: string; name: string; mime_type: string; size_bytes: number | string; caption: string; storage_path: string; added_at: string };
const FILE_COLS = "id, name, mime_type, size_bytes, caption, storage_path, added_at";

async function fileRows(projectId: string, code: string): Promise<FileRow[]> {
  return must(await supabase.from("demand_files").select(FILE_COLS).eq("project_id", projectId).eq("code", code).order("added_at").order("id")) as FileRow[];
}

const notify = (key: string) => window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
export function onMaterialsChange(fn: (key: string) => void) {
  const h = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

export async function getMaterials(key: string): Promise<Materials> {
  const { projectId, code } = parseKey(key);
  const [body, rows] = await Promise.all([
    supabase.from("demand_materials").select("body").eq("project_id", projectId).eq("code", code).limit(1),
    fileRows(projectId, code),
  ]);
  const text = (must(body) as { body: string }[])[0]?.body ?? "";
  if (!rows.length) return { body: text, files: [] };
  const paths = rows.map((r) => r.storage_path);
  const [view, down] = await Promise.all([
    supabase.storage.from(BUCKET).createSignedUrls(paths, 3600),
    supabase.storage.from(BUCKET).createSignedUrls(paths, 3600, { download: true }),
  ]);
  const urlOf = (res: typeof view, p: string) => res.data?.find((x) => x.path === p)?.signedUrl ?? undefined;
  return {
    body: text,
    files: rows.map((r): MaterialFile => ({
      id: r.id, name: r.name, type: r.mime_type, size: Number(r.size_bytes), addedAt: r.added_at, caption: r.caption,
      path: r.storage_path, url: urlOf(view, r.storage_path), downloadUrl: urlOf(down, r.storage_path),
    })),
  };
}

// Uma gravação de cada vez por demanda (digitar rápido ou colar vários prints não se atropela).
const queues = new Map<string, Promise<unknown>>();

/** Deixa o banco igual a `m`: grava o texto, envia os arquivos novos, apaga os removidos, atualiza legendas. */
export function putMaterials(key: string, m: Materials, opts: { silent?: boolean } = {}): Promise<void> {
  const run = async () => {
    const { projectId, code } = parseKey(key);
    // O texto vai primeiro (é rápido); os arquivos podem demorar.
    if (m.body.trim() || m.files.length) {
      must(await supabase.from("demand_materials").upsert({ project_id: projectId, code, body: m.body.slice(0, 50000) }, { onConflict: "project_id,code" }).select("code"));
    }
    const current = await fileRows(projectId, code);
    const known = new Map(current.map((r) => [r.id, r]));
    const keep = new Set(m.files.map((f) => f.id));

    // Arquivos removidos: some do Storage e da lista.
    const gone = current.filter((r) => !keep.has(r.id));
    if (gone.length) {
      await supabase.storage.from(BUCKET).remove(gone.map((r) => r.storage_path));
      must(await supabase.from("demand_files").delete().in("id", gone.map((r) => r.id)).select("id"));
    }
    // Arquivos novos: envia e registra.
    for (const f of m.files) {
      if (known.has(f.id) || !f.blob) continue;
      const path = pathOf(projectId, code, f);
      const up = await supabase.storage.from(BUCKET).upload(path, f.blob, { contentType: f.type, upsert: true });
      if (up.error) throw new Error(`${f.name}: ${up.error.message}`);
      must(await supabase.from("demand_files").insert({
        id: f.id, project_id: projectId, code, name: f.name.slice(0, 300), mime_type: f.type.slice(0, 200), size_bytes: f.size,
        caption: f.caption.slice(0, 200), storage_path: path, added_at: f.addedAt,
      }).select("id"));
    }
    // Legendas alteradas.
    for (const f of m.files) {
      const r = known.get(f.id);
      if (r && r.caption !== f.caption) must(await supabase.from("demand_files").update({ caption: f.caption.slice(0, 200) }).eq("id", f.id).select("id"));
    }
    // Sem texto e sem arquivos, não deixa linha vazia.
    if (!m.body.trim() && !m.files.length) {
      must(await supabase.from("demand_materials").delete().eq("project_id", projectId).eq("code", code).select("code"));
    }
    if (!opts.silent) notify(key);
  };
  const next = (queues.get(key) ?? Promise.resolve()).then(run, run);
  queues.set(key, next.catch(() => undefined));
  return next;
}

/** Apaga o material de uma demanda: arquivos do Storage (a pasta inteira) e as linhas. */
export async function deleteMaterials(key: string): Promise<void> {
  const { projectId, code } = parseKey(key);
  await removeFolder(folderOf(projectId, code));
  must(await supabase.from("demand_files").delete().eq("project_id", projectId).eq("code", code).select("id"));
  must(await supabase.from("demand_materials").delete().eq("project_id", projectId).eq("code", code).select("code"));
  notify(key);
}

/** Projeto excluído: apaga o material de todas as demandas dele. */
export async function deleteProjectMaterials(projectId: string): Promise<void> {
  const root = `${SINGLE_USER_ID}/${slug(projectId)}`;
  const dirs = await supabase.storage.from(BUCKET).list(root, { limit: 1000 });
  for (const d of dirs.data ?? []) await removeFolder(`${root}/${d.name}`);
  must(await supabase.from("demand_files").delete().eq("project_id", projectId).select("id"));
  must(await supabase.from("demand_materials").delete().eq("project_id", projectId).select("code"));
}

async function removeFolder(folder: string) {
  const list = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 });
  const paths = (list.data ?? []).filter((o) => o.id).map((o) => `${folder}/${o.name}`);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}
