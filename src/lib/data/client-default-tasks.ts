/** Tarefas padrão dos clientes: ler/gravar o modelo e criar as tarefas de um cliente (novo ou já existente). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cleanTemplate, missingTitles, SEED_DEFAULT_TASKS } from "../default-tasks";
import { must, supabase } from "./db";
import { createTaskRow, ensureClientCategory, nextClientOrder } from "./tasks";

type Row = { id: string; kind: "task" | "off"; title: string; position: number };
export type DefaultTemplate = { titles: string[]; auto: boolean; saved: boolean };

export async function loadTemplate(): Promise<DefaultTemplate> {
  const rows = must(await supabase.from("client_default_tasks").select("id, kind, title, position").order("position")) as Row[];
  const tasks = rows.filter((r) => r.kind === "task").map((r) => r.title).filter(Boolean), off = rows.some((r) => r.kind === "off");
  // sem nada salvo, vale o modelo que já vem com o Orion
  return { titles: tasks.length || off ? tasks : SEED_DEFAULT_TASKS, auto: !off, saved: rows.length > 0 };
}
export const useDefaultTemplate = () => useQuery({ queryKey: ["client-default-tasks"], queryFn: loadTemplate });

/** Grava o modelo (lista de títulos + criar automático ligado/desligado). */
export async function saveTemplate(titles: string[], auto: boolean): Promise<void> {
  const clean = cleanTemplate(titles);
  must(await supabase.from("client_default_tasks").delete().not("id", "is", null).select("id"));
  const rows = [...clean.map((title, position) => ({ kind: "task", title, position })), ...(auto ? [] : [{ kind: "off", title: "", position: 0 }])];
  if (rows.length) must(await supabase.from("client_default_tasks").insert(rows).select("id"));
}

/** Cria as tarefas do modelo para o cliente, uma depois da outra (a ordem de criação é a ordem das etapas). Não repete as que ele já tem. */
export async function createDefaultTasks(clientId: string, opts: { force?: boolean } = {}): Promise<number> {
  const tpl = await loadTemplate();
  if (!tpl.titles.length || (!tpl.auto && !opts.force)) return 0;
  const have = must(await supabase.from("tasks").select("title").eq("client_id", clientId)) as { title: string }[];
  const todo = missingTitles(tpl.titles, have.map((h) => h.title));
  if (!todo.length) return 0;
  const category_id = await ensureClientCategory().catch(() => null);
  const base = await nextClientOrder(clientId).catch(() => null);
  let i = 0;
  for (const title of todo) await createTaskRow({ title, category_id, due_date: null, due_time: null }, { client_id: clientId, ...(base !== null ? { client_order: base + i++ } : {}) });
  return todo.length;
}

/** Clientes que ainda não têm nenhuma tarefa. */
export async function clientsWithoutTasks(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = must(await supabase.from("tasks").select("client_id").in("client_id", ids)) as { client_id: string }[];
  const have = new Set(rows.map((r) => r.client_id));
  return ids.filter((id) => !have.has(id));
}

export function useSaveDefaultTemplate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { titles: string[]; auto: boolean }) => saveTemplate(v.titles, v.auto), onSuccess: () => qc.invalidateQueries({ queryKey: ["client-default-tasks"] }) });
}

/** Apaga uma tarefa (usado ao deixar um cliente igual ao padrão). */
export async function deleteTaskById(id: string): Promise<void> { must(await supabase.from("tasks").delete().eq("id", id).select("id")); }
