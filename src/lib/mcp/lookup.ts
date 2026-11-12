/**
 * Consultas ao Presence para o MCP (somente leitura) e resolução de nomes em registros reais.
 * Usa o mesmo cliente e as mesmas tabelas das telas; nada de acesso livre ao banco.
 */
import { loadDemands } from "../data/project-data";
import { must, supabase } from "../data/db";
import { normalize } from "./records";
import type { Demand } from "../demands";

export type ProjectInfo = { id: string; nome: string; descricao: string; status: string; rotulo_dossie: { singular: string; plural: string } };
export type DossierInfo = { id: string; nome: string; descricao: string };
export type CategoryInfo = { id: string; slug: string; nome: string };

export class NeedsChoice extends Error {
  constructor(message: string, readonly options: string[]) { super(message); }
}

/* ───────────── projetos e dossiês ───────────── */
export async function listProjects(): Promise<(ProjectInfo & { dossies: number; demandas_abertas: number })[]> {
  const [pr, dr, mr] = await Promise.all([
    supabase.from("projects").select("id, name, description, status, label_singular, label_plural, position").order("position").order("created_at"),
    supabase.from("dossiers").select("project_id"),
    supabase.from("project_demands").select("project_id, status"),
  ]);
  const rows = must(pr) as { id: string; name: string; description: string; status: string; label_singular: string; label_plural: string }[];
  const dos = must(dr) as { project_id: string }[];
  const dem = must(mr) as { project_id: string; status: string }[];
  return rows.map((r) => ({
    id: r.id, nome: r.name, descricao: r.description, status: r.status, rotulo_dossie: { singular: r.label_singular, plural: r.label_plural },
    dossies: dos.filter((d) => d.project_id === r.id).length, demandas_abertas: dem.filter((d) => d.project_id === r.id && d.status !== "done").length,
  }));
}

/** Aceita o id exato ou o nome exato (sem acento/caixa). Ambíguo ou desconhecido: pede escolha, nunca adivinha. */
export async function resolveProject(idOrName: string): Promise<ProjectInfo> {
  const all = await listProjects();
  const byId = all.find((p) => p.id === idOrName);
  if (byId) return byId;
  const n = normalize(idOrName);
  const byName = all.filter((p) => normalize(p.nome) === n);
  if (byName.length === 1) return byName[0]!;
  const options = all.map((p) => `${p.nome} (id: ${p.id})`);
  throw new NeedsChoice(byName.length > 1 ? `Há mais de um projeto chamado "${idOrName}".` : `Projeto "${idOrName}" não encontrado.`, options);
}

export async function listDossiers(projectId: string): Promise<DossierInfo[]> {
  const rows = must(await supabase.from("dossiers").select("id, name, description, position").eq("project_id", projectId).order("position")) as { id: string; name: string; description: string }[];
  return rows.map((r) => ({ id: r.id, nome: r.name, descricao: r.description }));
}

/** Nome exato (sem acento/caixa). Parecido mas não igual: devolve as opções para o usuário escolher. */
export function pickDossier(list: DossierInfo[], name: string, label = "dossiê"): DossierInfo {
  const n = normalize(name);
  const exact = list.find((d) => d.id === name) ?? list.find((d) => normalize(d.nome) === n);
  if (exact) return exact;
  const near = list.filter((d) => normalize(d.nome).includes(n) || n.includes(normalize(d.nome))).map((d) => d.nome);
  throw new NeedsChoice(`${label} "${name}" não encontrado neste projeto.`, near.length ? near : list.map((d) => d.nome));
}

/* ───────────── categorias e status ───────────── */
export async function listCategories(): Promise<CategoryInfo[]> {
  const rows = must(await supabase.from("task_categories").select("id, slug, name, position").order("position")) as { id: string; slug: string; name: string }[];
  return rows.map((r) => ({ id: r.id, slug: r.slug, nome: r.name }));
}

/* ───────────── demandas ───────────── */
export async function demandsOf(projectId: string): Promise<Demand[]> { return loadDemands(projectId); }

export const demandBrief = (d: Demand) => ({
  codigo: d.id, tipo: d.type === "polo" ? "polo" : d.type === "multi" ? "multipolo" : "geral", titulo: d.title, status: d.status, prioridade: d.priority,
  prazo: d.deadline, dossie: d.polo, dossies: d.polos?.map((p) => ({ nome: p.name, status: p.status })),
});

/* ───────────── tarefas, calendário, lembretes ───────────── */
export type TaskRow = {
  id: string; title: string; description: string | null; category_id: string | null; priority: string; due_date: string | null; due_time: string | null;
  end_time: string | null; place: string | null; done: boolean; project_id: string | null; dossier_id: string | null; demand_code: string | null;
  related_task_id: string | null; kind: string; source: string;
};
const TASK_COLS = "id, title, description, category_id, priority, due_date, due_time, end_time, place, done, project_id, dossier_id, demand_code, related_task_id, kind, source";

export async function allTasks(): Promise<TaskRow[]> {
  return must(await supabase.from("tasks").select(TASK_COLS).order("due_date", { nullsFirst: false }).order("due_time", { nullsFirst: true })) as TaskRow[];
}

export const taskBrief = (t: TaskRow, cats: CategoryInfo[]) => ({
  id: t.id, titulo: t.title, descricao: t.description ?? undefined, categoria: cats.find((c) => c.id === t.category_id)?.slug, prioridade: t.priority,
  data: t.due_date ?? undefined, inicio: t.due_time?.slice(0, 5), fim: t.end_time?.slice(0, 5), local: t.place ?? undefined, feita: t.done,
  projeto_id: t.project_id ?? undefined, dossie_id: t.dossier_id ?? undefined, demanda: t.demand_code ?? undefined, vinculado_a: t.related_task_id ?? undefined,
  tipo: t.kind, origem: t.source,
});

/* ───────────── anotações e documentação ───────────── */
export async function notesOf(projectId: string) {
  return must(await supabase.from("project_notes").select("id, text, color, dossier_id, date_label, position").eq("project_id", projectId).order("position")) as
    { id: number; text: string; color: string; dossier_id: string | null; date_label: string }[];
}
export async function libraryOf(projectId: string) {
  const rows = must(await supabase.from("training_library").select("scripts, examples").eq("project_id", projectId).limit(1)) as { scripts: unknown; examples: unknown }[];
  return rows[0] ?? null;
}
