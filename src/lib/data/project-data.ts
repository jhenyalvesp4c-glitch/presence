/**
 * Projetos, dossiês, notas e demandas (Kanban) no banco (schema presence_app).
 * Cada tela edita uma lista em memória; estas funções levam a diferença para o banco.
 * Na primeira vez, o que estava só no navegador (localStorage) sobe para o banco, uma vez só.
 */
import { demandToRows, diffDemands, rowsToDemands, type Demand, type DemandRows } from "../demands";
import { DEFAULT_LABEL, P4C_ID, loadDossierState, seedDossiers, type Dossier, type DossierState } from "../dossiers";
import { loadNotes, type Note } from "../notes";
import { loadProjects as loadLocalProjects, seedProjects, type Project } from "../projects";
import { deleteProjectMaterials } from "../demand-materials";
import { must, supabase } from "./db";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ignoreLocal = (fn: () => void) => { try { fn(); } catch { /* sem armazenamento */ } };

/* ───────────── Projetos ───────────── */
type ProjectRow = {
  id: string; name: string; description: string; color: Project["color"]; status: Project["status"];
  due: string | null; position: number; created_at: string;
};
const MIGRATED_KEY = "presence.projects.migrated";

const projectRow = (p: Project, position: number) => ({
  id: p.id, name: p.name.trim().slice(0, 120) || "Projeto", description: p.desc.slice(0, 500), color: p.color,
  status: p.status, due: p.due || null, position,
});

/** Projetos para a tela /projetos. O padrão "p4c" (página de Demandas sem `?projeto=`) não aparece como cartão. */
export async function loadProjects(): Promise<Project[]> {
  let rows = must(await supabase.from("projects").select("id, name, description, color, status, due, position, created_at").neq("id", P4C_ID).order("position").order("created_at")) as ProjectRow[];
  let migrated = false;
  try { migrated = localStorage.getItem(MIGRATED_KEY) === "1"; } catch { /* ignora */ }
  if (!rows.length && !migrated) {
    // Primeira vez: leva os projetos do navegador (ou os de exemplo) para o banco.
    const list = loadLocalProjects();
    if (list.length) must(await supabase.from("projects").upsert(list.map(projectRow), { onConflict: "id" }).select("id"));
    ignoreLocal(() => localStorage.setItem(MIGRATED_KEY, "1"));
    rows = list.length ? (must(await supabase.from("projects").select("id, name, description, color, status, due, position, created_at").neq("id", P4C_ID).order("position").order("created_at")) as ProjectRow[]) : [];
  } else if (!migrated) {
    ignoreLocal(() => localStorage.setItem(MIGRATED_KEY, "1"));
  }
  const dem = must(await supabase.from("project_demands").select("project_id, status")) as { project_id: string; status: string }[];
  const total = new Map<string, number>(), done = new Map<string, number>();
  for (const d of dem) {
    total.set(d.project_id, (total.get(d.project_id) ?? 0) + 1);
    if (d.status === "done") done.set(d.project_id, (done.get(d.project_id) ?? 0) + 1);
  }
  return rows.map((r): Project => {
    const t = total.get(r.id) ?? 0, d = done.get(r.id) ?? 0;
    return { id: r.id, name: r.name, desc: r.description, color: r.color, status: r.status, due: r.due ?? "", demands: t, done: d, progress: t ? Math.round((d / t) * 100) : 0 };
  });
}

/** Cria, edita ou exclui projetos para a lista ficar igual à da tela. */
export async function saveProjects(prev: Project[], next: Project[]) {
  const ids = new Set(next.map((p) => p.id));
  const gone = prev.filter((p) => !ids.has(p.id)).map((p) => p.id);
  if (gone.length) {
    // Compromissos do calendário são tarefas com o id do projeto; o resto some por cascade.
    must(await supabase.from("tasks").delete().in("project_id", gone).select("id"));
    // Anexos das demandas (arquivos no Storage e linhas) não têm cascade: apaga antes do projeto.
    for (const id of gone) await deleteProjectMaterials(id).catch(() => undefined);
    must(await supabase.from("projects").delete().in("id", gone).select("id"));
  }
  const before = new Map(prev.map((p, i) => [p.id, JSON.stringify(projectRow(p, i))]));
  const rows = next.map((p, i) => projectRow(p, i)).filter((r) => before.get(r.id) !== JSON.stringify(r));
  if (rows.length) must(await supabase.from("projects").upsert(rows, { onConflict: "id" }).select("id"));
}

/* ───────────── Dossiês e notas de um projeto ───────────── */
export type ProjectState = { ds: DossierState; notes: Note[] };

/** Garante a linha do projeto "p4c" (padrão da página de Demandas). Os demais vêm da tela de projetos. */
async function ensureProject(pid: string) {
  const found = must(await supabase.from("projects").select("id, legacy_imported, label_singular, label_plural").eq("id", pid).limit(1)) as
    { id: string; legacy_imported: boolean; label_singular: string; label_plural: string }[];
  if (found[0]) return found[0];
  if (pid !== P4C_ID) return null;
  must(await supabase.from("projects").upsert({ id: P4C_ID, name: "P4C", description: "Juntos por dossiês mais fortes.", color: "cyan", status: "Ativo", position: -1 }, { onConflict: "id" }).select("id"));
  return { id: P4C_ID, legacy_imported: false, label_singular: DEFAULT_LABEL.singular, label_plural: DEFAULT_LABEL.plural };
}

const dossierRow = (pid: string, d: Dossier, position: number) => ({ project_id: pid, id: d.id, name: d.name.trim().slice(0, 120), description: d.desc.slice(0, 500), position });
const noteRow = (pid: string, n: Note, position: number) => ({
  id: n.id, project_id: pid, text: n.text.slice(0, 5000), color: n.color, dossier_id: n.dossierId ?? null, date_label: n.date, position,
});

/** Dossiês e notas do projeto; na primeira vez, importa os que estavam no navegador (ou os padrões). */
export async function loadProjectState(pid: string): Promise<ProjectState> {
  const proj = await ensureProject(pid);
  if (!proj) return { ds: seedDossiers(pid), notes: [] };
  if (!proj.legacy_imported) {
    const ds = loadDossierState(pid);
    const notes = loadNotes(pid);
    must(await supabase.from("projects").update({ label_singular: ds.label.singular, label_plural: ds.label.plural }).eq("id", pid).select("id"));
    if (ds.dossiers.length) must(await supabase.from("dossiers").upsert(ds.dossiers.map((d, i) => dossierRow(pid, d, i)), { onConflict: "project_id,id" }).select("id"));
    if (notes.length) must(await supabase.from("project_notes").upsert(notes.map((n, i) => noteRow(pid, n, i)), { onConflict: "id" }).select("id"));
    must(await supabase.from("projects").update({ legacy_imported: true }).eq("id", pid).select("id"));
    ignoreLocal(() => { localStorage.removeItem(`presence.dossiers.${pid}`); localStorage.removeItem(`presence.notes.${pid}`); });
    return { ds, notes };
  }
  const [doss, notes, label] = await Promise.all([
    supabase.from("dossiers").select("id, name, description, position").eq("project_id", pid).order("position").order("created_at"),
    supabase.from("project_notes").select("id, text, color, dossier_id, date_label, position").eq("project_id", pid).order("position"),
    supabase.from("projects").select("label_singular, label_plural").eq("id", pid).single(),
  ]);
  const l = must(label) as { label_singular: string; label_plural: string };
  return {
    ds: {
      label: { singular: l.label_singular, plural: l.label_plural },
      dossiers: (must(doss) as { id: string; name: string; description: string }[]).map((d) => ({ id: d.id, name: d.name, desc: d.description })),
    },
    notes: (must(notes) as { id: number; text: string; color: string; dossier_id: string | null; date_label: string }[])
      .map((n) => ({ id: Number(n.id), text: n.text, color: n.color, date: n.date_label, dossierId: n.dossier_id ?? undefined })),
  };
}

export async function saveDossiers(pid: string, prev: DossierState, next: DossierState) {
  if (!same(prev.label, next.label)) {
    must(await supabase.from("projects").update({ label_singular: next.label.singular.slice(0, 40) || "Dossiê", label_plural: next.label.plural.slice(0, 40) || "Dossiês" }).eq("id", pid).select("id"));
  }
  const ids = new Set(next.dossiers.map((d) => d.id));
  const gone = prev.dossiers.filter((d) => !ids.has(d.id)).map((d) => d.id);
  if (gone.length) must(await supabase.from("dossiers").delete().eq("project_id", pid).in("id", gone).select("id"));
  const before = new Map(prev.dossiers.map((d, i) => [d.id, JSON.stringify(dossierRow(pid, d, i))]));
  const rows = next.dossiers.map((d, i) => dossierRow(pid, d, i)).filter((r) => before.get(r.id) !== JSON.stringify(r));
  if (rows.length) must(await supabase.from("dossiers").upsert(rows, { onConflict: "project_id,id" }).select("id"));
}

export async function saveNotesDb(pid: string, prev: Note[], next: Note[]) {
  const ids = new Set(next.map((n) => n.id));
  const gone = prev.filter((n) => !ids.has(n.id)).map((n) => n.id);
  if (gone.length) must(await supabase.from("project_notes").delete().in("id", gone).select("id"));
  const before = new Map(prev.map((n, i) => [n.id, JSON.stringify(noteRow(pid, n, i))]));
  const rows = next.map((n, i) => noteRow(pid, n, i)).filter((r) => before.get(r.id) !== JSON.stringify(r));
  if (rows.length) must(await supabase.from("project_notes").upsert(rows, { onConflict: "id" }).select("id"));
}

/* ───────────── Demandas ───────────── */
export async function loadDemands(pid: string): Promise<Demand[]> {
  const [d, e, h, n] = await Promise.all([
    supabase.from("project_demands").select("project_id, code, type, title, description, priority, status, deadline, dossier_name").eq("project_id", pid).order("created_at", { ascending: false }).order("code", { ascending: false }),
    supabase.from("demand_executions").select("project_id, code, dossier_name, status, done_on, note, position").eq("project_id", pid),
    supabase.from("demand_history").select("project_id, code, label, text, status, position").eq("project_id", pid),
    supabase.from("demand_notes").select("project_id, code, text, position").eq("project_id", pid),
  ]);
  return rowsToDemands(
    must(d) as DemandRows["demand"][], must(e) as DemandRows["executions"], must(h) as DemandRows["history"], must(n) as DemandRows["notes"],
  );
}

/** Grava as mudanças de uma vez, numa transação só (função save_demands): nunca fica demanda pela metade. */
export async function saveDemands(pid: string, prev: Demand[], next: Demand[]) {
  const { upserts, deletes } = diffDemands(prev, next);
  if (!upserts.length && !deletes.length) return;
  const { error } = await supabase.rpc("save_demands", { p_project: pid, p_items: upserts.map((d) => demandToRows(pid, d)), p_delete: deletes });
  if (error) throw new Error(error.message);
}

export { seedProjects };
