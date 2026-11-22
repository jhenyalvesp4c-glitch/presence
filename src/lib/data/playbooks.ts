/** Executa um playbook: cria (ou reaproveita) dossiê, cliente, pasta com documentos, tarefas, demandas e checklist. Não duplica o que já existe. */
import type { Dossier } from "../dossiers";
import { nextCode, type Demand } from "../demands";
import { deadlineLabel, type Plan, type RunInput } from "../playbooks";
import { createList } from "./checklists";
import { seedSetup } from "./client-setup";
import { loadDemands, loadProjectState, saveDemands, saveDossiers } from "./project-data";
import { saveDocRow, saveFolderRow } from "./library";
import { createTaskRow } from "./tasks";
import { must, supabase } from "./db";

export type RunResult = { dossierId: string; dossierName: string; clientId: string; folderId: string; created: { dossie: boolean; cliente: boolean; pasta: boolean; docs: number; tarefas: number; demandas: number; checklist: boolean; implantacao: number }; reused: string[] };
export type Progress = (label: string) => void;
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const rid = () => Math.random().toString(36).slice(2, 7);

export async function runPlaybook(projectId: string, plan: Plan, input: RunInput, progress: Progress = () => undefined): Promise<RunResult> {
  const created = { dossie: false, cliente: false, pasta: false, docs: 0, tarefas: 0, demandas: 0, checklist: false, implantacao: 0 }, reused: string[] = [];

  // 1) dossiê
  progress("Dossiê");
  const state = await loadProjectState(projectId);
  let dossier: Dossier | undefined = state.ds.dossiers.find((d) => norm(d.name) === norm(plan.clientName));
  if (dossier) reused.push("dossiê");
  else {
    const taken = new Set(state.ds.dossiers.map((d) => d.id));
    let id = plan.slug; for (let i = 2; taken.has(id); i++) id = `${plan.slug}-${i}`;
    dossier = { id, name: plan.clientName, desc: `Cliente ${plan.clientName}` };
    await saveDossiers(projectId, state.ds, { ...state.ds, dossiers: [...state.ds.dossiers, dossier] });
    created.dossie = true;
  }

  // 2) cliente
  progress("Cliente");
  const existing = must(await supabase.from("clients").select("id").eq("project_id", projectId).eq("dossier_id", dossier.id).limit(1)) as { id: string }[];
  let clientId = existing[0]?.id;
  if (clientId) reused.push("cliente");
  else {
    clientId = (must(await supabase.from("clients").insert({ project_id: projectId, dossier_id: dossier.id, name: plan.clientName.slice(0, 160), contact_name: input.contactName.trim().slice(0, 120), email: input.email.trim().slice(0, 160), phone: input.phone.trim().slice(0, 40), status: "ativo", monthly_value: Math.max(0, input.monthlyValue || 0), contract_end: input.contractEnd || null, plan: "Onboarding" }).select("id")) as { id: string }[])[0]!.id;
    must(await supabase.from("client_log").insert({ client_id: clientId, text: "Onboarding iniciado pelo playbook.", log_date: input.start }).select("id"));
    created.cliente = true;
  }

  // 3) pasta + documentos
  progress("Pasta e documentos");
  const folders = must(await supabase.from("library_folders").select("id").eq("dossier_id", dossier.id).limit(1)) as { id: string }[];
  let folderId = folders[0]?.id;
  if (folderId) reused.push("pasta");
  else {
    const count = (must(await supabase.from("library_folders").select("id")) as unknown[]).length;
    folderId = `f${Date.now().toString(36)}${rid()}`;
    await saveFolderRow({ id: folderId, name: plan.clientName.slice(0, 80), color: "cyan", position: count, dossier_id: dossier.id });
    created.pasta = true;
  }
  const haveDocs = new Set((must(await supabase.from("library_docs").select("title").eq("folder_id", folderId)) as { title: string }[]).map((d) => norm(d.title)));
  for (const d of plan.docs) {
    if (haveDocs.has(norm(d.title))) continue;
    await saveDocRow({ id: `d${Date.now().toString(36)}${rid()}`, folder_id: folderId, title: d.title, description: d.desc, kind: d.kind, color: "cyan", fav: false, rules: d.rules ?? [], steps: d.steps ?? [], attachments: [], ai_summary: "", deleted: false, updated_label: dateBR(input.start) });
    created.docs++;
  }

  // 4) tarefas (sem repetir título no mesmo dossiê)
  progress("Tarefas");
  const haveTasks = new Set((must(await supabase.from("tasks").select("title").eq("project_id", projectId).eq("dossier_id", dossier.id)) as { title: string }[]).map((t) => norm(t.title)));
  for (const st of plan.steps.filter((x) => x.kind === "tarefa")) {
    if (haveTasks.has(norm(st.title))) continue;
    await createTaskRow({ title: st.title, description: st.desc ?? `Playbook de onboarding · ${plan.clientName}`, priority: st.priority, due_date: st.date, due_time: st.time ?? null }, { project_id: projectId, dossier_id: dossier.id });
    created.tarefas++;
  }

  // 5) demandas do dossiê
  progress("Demandas");
  const wanted = plan.steps.filter((x) => x.kind === "demanda");
  if (wanted.length) {
    const prev = await loadDemands(projectId), next: Demand[] = [...prev];
    for (const st of wanted) {
      if (prev.some((d) => d.polo && norm(d.polo) === norm(dossier.name) && norm(d.title) === norm(st.title))) continue;
      next.unshift({ id: nextCode(next, "polo"), type: "polo", title: st.title, desc: st.desc ?? `Playbook de onboarding · ${plan.clientName}`, priority: st.priority, status: "todo", deadline: deadlineLabel(st.date), polo: dossier.name, history: [], notes: [] });
      created.demandas++;
    }
    if (created.demandas) await saveDemands(projectId, prev, next);
  }

  // 6) checklist
  progress("Checklist");
  const lists = must(await supabase.from("checklists").select("id").eq("title", plan.checklistTitle).limit(1)) as { id: string }[];
  if (lists[0]) reused.push("checklist");
  else { await createList(plan.checklistTitle, plan.checklist.map((texto) => ({ texto, grupo: "Onboarding" }))); created.checklist = true; }

  // 7) roteiro de implantação (passo a passo guiado)
  progress("Implantação");
  // não derruba o playbook se o roteiro não puder ser criado (ex.: tabela ainda não migrada); dá para criar depois pela ficha
  try { created.implantacao = await seedSetup(clientId, projectId); } catch { reused.push("roteiro de implantação (não foi possível criar agora)"); }

  return { dossierId: dossier.id, dossierName: dossier.name, clientId, folderId, created, reused };
}
const dateBR = (iso: string) => iso.split("-").reverse().join("/").slice(0, 5);
