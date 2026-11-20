/** Caixa de ideias na nuvem (tabela ideas): listar, criar, editar, arquivar, desenvolver (plano) e transformar em projeto, tarefa, lembrete ou documentação. */
import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cleanBudget, cleanLinks, cleanPlan, cleanTags, demandsFromPlan, ideaText, type BudgetItem, type Conversion, type Idea, type IdeaArea, type IdeaFile, type IdeaKind, type IdeaPlan, type IdeaSource, type IdeaStatus } from "../ideas";
import { addEntry, signedUrls, uploadFiles, BUCKET, type NewFile } from "./brain";
import { must, supabase } from "./db";
import { saveDemands, saveProjects } from "./project-data";
import { createTaskRow } from "./tasks";

const KEY = ["ideas"] as const;
type Row = { id: string; title: string; body: string; kind: IdeaKind; area: IdeaArea; status: IdeaStatus; tags: string[] | null; links: string[] | null; attachments: IdeaFile[] | null; plan: unknown; budget: unknown; converted: Conversion[] | null; source: IdeaSource; touched_at: string; created_at: string };
const COLS = "id, title, body, kind, area, status, tags, links, attachments, plan, budget, converted, source, touched_at, created_at";
const toIdea = (r: Row): Idea => ({ id: r.id, title: r.title, body: r.body, kind: r.kind, area: r.area, status: r.status, tags: r.tags ?? [], links: r.links ?? [], attachments: r.attachments ?? [], plan: cleanPlan(r.plan), budget: cleanBudget(r.budget), converted: r.converted ?? [], source: r.source, touchedAt: r.touched_at, createdAt: r.created_at });

export type NewIdea = { title: string; body?: string; kind?: IdeaKind; area?: IdeaArea; tags?: string[]; links?: string[]; source?: IdeaSource; files?: NewFile[]; status?: IdeaStatus };

export async function listIdeas(): Promise<Idea[]> {
  return (must(await supabase.from("ideas").select(COLS).order("touched_at", { ascending: false }).limit(500)) as Row[]).map(toIdea);
}
export const useIdeas = () => useQuery({ queryKey: KEY, queryFn: listIdeas });

export async function createIdea(n: NewIdea): Promise<Idea> {
  const id = crypto.randomUUID();
  const attachments = n.files?.length ? await uploadFiles(`ideias/${id}`, n.files) : [];
  try {
    return toIdea(must(await supabase.from("ideas").insert({
      id, title: n.title.trim().slice(0, 200) || "Nova ideia", body: (n.body ?? "").slice(0, 8000), kind: n.kind ?? "ideia", area: n.area ?? "pessoal", status: n.status ?? "solta",
      tags: cleanTags(n.tags), links: cleanLinks(n.links), attachments, source: n.source ?? "texto",
    }).select(COLS).single()) as Row);
  } catch (e) { if (attachments.length) await supabase.storage.from(BUCKET).remove(attachments.map((a) => a.path)); throw e; }
}

export type IdeaPatch = Partial<Pick<Idea, "title" | "body" | "kind" | "area" | "status" | "tags" | "links">> & { plan?: IdeaPlan | null; budget?: BudgetItem[]; converted?: Conversion[]; touch?: boolean };
export async function updateIdea(id: string, p: IdeaPatch): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (p.title !== undefined) row["title"] = p.title.trim().slice(0, 200) || "Nova ideia";
  if (p.body !== undefined) row["body"] = p.body.slice(0, 8000);
  if (p.kind) row["kind"] = p.kind; if (p.area) row["area"] = p.area; if (p.status) row["status"] = p.status;
  if (p.tags) row["tags"] = cleanTags(p.tags); if (p.links) row["links"] = cleanLinks(p.links);
  if (p.plan !== undefined) row["plan"] = p.plan; if (p.budget) row["budget"] = cleanBudget(p.budget); if (p.converted) row["converted"] = p.converted;
  // mexer na ideia (editar, mudar de estado, desenvolver, "continuar") zera o relógio das "paradas"
  row["touched_at"] = new Date().toISOString();
  must(await supabase.from("ideas").update(row).eq("id", id).select("id"));
}
export const MAX_IDEA_FILES = 24, MAX_IDEA_FILE_BYTES = 15 * 1024 * 1024;
/** Anexa imagens/arquivos (referências) a uma ideia que já existe. Devolve quantos entraram e o que foi recusado. */
export async function addIdeaFiles(i: Idea, files: File[]): Promise<{ added: number; rejected: string[] }> {
  const rejected: string[] = [], ok: NewFile[] = [], room = Math.max(0, MAX_IDEA_FILES - i.attachments.length);
  for (const f of files) {
    if (f.size > MAX_IDEA_FILE_BYTES) rejected.push(`${f.name} (passa de 15 MB)`);
    else if (ok.length >= room) rejected.push(`${f.name} (limite de ${MAX_IDEA_FILES} arquivos)`);
    else ok.push({ name: f.name, mime: f.type || "application/octet-stream", blob: f });
  }
  if (!ok.length) return { added: 0, rejected };
  const sent = await uploadFiles(`ideias/${i.id}`, ok);
  try { must(await supabase.from("ideas").update({ attachments: [...i.attachments, ...sent], touched_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", i.id).select("id")); }
  catch (e) { await supabase.storage.from(BUCKET).remove(sent.map((a) => a.path)); throw e; }
  return { added: sent.length, rejected };
}
export async function removeIdeaFile(i: Idea, path: string): Promise<void> {
  must(await supabase.from("ideas").update({ attachments: i.attachments.filter((a) => a.path !== path), touched_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", i.id).select("id"));
  await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
}
export async function deleteIdea(i: Idea): Promise<void> {
  must(await supabase.from("ideas").delete().eq("id", i.id).select("id"));
  if (i.attachments.length) await supabase.storage.from(BUCKET).remove(i.attachments.map((a) => a.path)).catch(() => undefined);
}

export const ideaFileUrls = (files: IdeaFile[]) => signedUrls(files.map((f) => f.path));

/* ───────── transformar a ideia em outra coisa (e lembrar do que já virou) ───────── */
const note = (i: Idea) => [i.body, i.plan?.proximoPasso ? `Próximo passo: ${i.plan.proximoPasso}` : ""].filter(Boolean).join("\n\n");
const withConversion = async (i: Idea, c: Conversion, status: IdeaStatus) => updateIdea(i.id, { converted: [...i.converted, c], status });
const stamp = () => new Date().toISOString();

export async function ideaToTask(i: Idea): Promise<{ id: string }> {
  const t = await createTaskRow({ title: i.title, description: note(i) || null, priority: "media" });
  await withConversion(i, { tipo: "tarefa", id: t.id, label: t.title, em: stamp() }, i.status === "arquivada" ? "arquivada" : "fazendo");
  return { id: t.id };
}
export async function ideaToReminder(i: Idea, date: string, time: string | null): Promise<{ id: string }> {
  const t = await createTaskRow({ title: i.title, description: note(i) || null, priority: "media", due_date: date, due_time: time }, { kind: "lembrete" });
  await withConversion(i, { tipo: "lembrete", id: t.id, label: `${t.title} · ${date.split("-").reverse().join("/")}${time ? ` ${time}` : ""}`, em: stamp() }, i.status);
  return { id: t.id };
}
export async function ideaToDoc(i: Idea): Promise<{ id: string }> {
  const e = await addEntry({ title: i.title, text: ideaText(i).slice(0, 6000) });
  await withConversion(i, { tipo: "documentacao", id: e.id, label: i.title, em: stamp() }, "arquivada");
  return { id: e.id };
}
/** Cria o projeto (planejando), com os primeiros passos do plano como demandas. */
export async function ideaToProject(i: Idea): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await saveProjects([], [{ id, name: i.title.slice(0, 120), desc: (i.plan?.resumo || i.body).slice(0, 500), color: i.area === "negocios" ? "cyan" : "violet", progress: 0, demands: 0, done: 0, due: "", status: "Planejando" }]);
  const ds = demandsFromPlan(i, (n) => `#G0${40 + n}`); // projeto novo: os códigos começam do começo
  await saveDemands(id, [], ds);
  await withConversion(i, { tipo: "projeto", id, label: i.title, em: stamp() }, "fazendo");
  return { id };
}

export function useIdeaActions() {
  const qc = useQueryClient();
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: KEY }), [qc]);
  const after = { onSuccess: () => void refresh() };
  return {
    create: useMutation({ mutationFn: createIdea, ...after }),
    update: useMutation({ mutationFn: (v: { id: string } & IdeaPatch) => { const { id, ...p } = v; return updateIdea(id, p); }, ...after }),
    remove: useMutation({ mutationFn: deleteIdea, ...after }),
    addFiles: useMutation({ mutationFn: (v: { idea: Idea; files: File[] }) => addIdeaFiles(v.idea, v.files), ...after }),
    removeFile: useMutation({ mutationFn: (v: { idea: Idea; path: string }) => removeIdeaFile(v.idea, v.path), ...after }),
    toTask: useMutation({ mutationFn: ideaToTask, onSuccess: () => { void refresh(); void qc.invalidateQueries({ queryKey: ["tasks"] }); } }),
    toReminder: useMutation({ mutationFn: (v: { idea: Idea; date: string; time: string | null }) => ideaToReminder(v.idea, v.date, v.time), onSuccess: () => { void refresh(); void qc.invalidateQueries({ queryKey: ["tasks"] }); } }),
    toDoc: useMutation({ mutationFn: ideaToDoc, ...after }),
    toProject: useMutation({ mutationFn: ideaToProject, ...after }),
  };
}
