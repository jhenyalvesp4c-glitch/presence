/**
 * Grava no Presence o que o usuário aprovou, reutilizando os serviços das próprias telas:
 * saveDemands (Kanban), saveAppointment (calendário), createTaskRow (tarefas), saveNotesDb (anotações),
 * loadLibrary/saveLibrary (documentação) e putMaterials (anexos). Também desfaz uma operação.
 */
import { Buffer } from "node:buffer";
import { nextCode, type Demand } from "../demands";
import { putMaterials, getMaterials, materialsKey, deleteMaterials, type MaterialFile } from "../demand-materials";
import { loadProjectState, saveDemands, saveNotesDb } from "../data/project-data";
import { loadLibrary, saveLibrary } from "../data/training-library";
import { createTaskRow } from "../data/tasks";
import { saveAppointment, syncSchedule } from "../data/appointments";
import { must, supabase } from "../data/db";
import { newId, removeExample, upsertExample } from "../training-library";
import { checklistItem, DEMAND_STATUS, ddmm, isCode, isRef, minusMinutes, deadlineLabel, TIPO_LABEL } from "./records";
import { demandsOf, listCategories } from "./lookup";
import type { Resolved } from "./plan";
import type { Created } from "./ops";

type Ctx = { now: Date; demandByRef: Map<string, { projectId: string; code: string }>; taskByRef: Map<string, string>; catId: (slug?: string) => string | null; compId: string | null };

export async function makeCtx(now = new Date()): Promise<Ctx> {
  const cats = await listCategories();
  return { now, demandByRef: new Map(), taskByRef: new Map(), catId: (slug) => cats.find((c) => c.slug === slug)?.id ?? null, compId: cats.find((c) => c.slug === "comp")?.id ?? null };
}

const demandOf = (ctx: Ctx, value: string | undefined, projectId: string | undefined): string | null => {
  if (!value) return null;
  if (isCode(value)) return value;
  if (isRef(value)) return ctx.demandByRef.get(value.slice(4))?.code ?? null;
  return null;
};

export async function executeRecord(r: Resolved, ctx: Ctx): Promise<Created[]> {
  const pid = r._projeto?.id;
  const modulo = TIPO_LABEL[r.tipo];
  switch (r.tipo) {
    case "demanda": {
      const items = await demandsOf(pid!);
      const type = r.escopo === "geral" ? "geral" : r.escopo === "polo" ? "polo" : "multi";
      const code = nextCode(items, type);
      const checklist = (r.checklist ?? []).map(checklistItem).filter((c) => c.text);
      const info = [r.categoria ? `Categoria: ${r.categoria}` : "", r.responsavel ? `Responsável: ${r.responsavel}` : ""].filter(Boolean).join("\n");
      const desc = [r.descricao?.trim(), info, checklist.length ? `Subtarefas:\n${checklist.map((c) => `- [${c.done ? "x" : " "}] ${c.text}`).join("\n")}` : ""].filter(Boolean).join("\n\n") || "Sem descrição.";
      const status = DEMAND_STATUS[r.status ?? "a_fazer"];
      const d: Demand = {
        id: code, type, title: r.titulo.trim(), desc, priority: r.prioridade ?? "media", status, deadline: deadlineLabel(r.prazo),
        history: [
          { d: ddmm(ctx.now), text: type === "multi" ? `Demanda criada pelo assistente (MCP) para ${r._dossies!.length} polo${r._dossies!.length === 1 ? "" : "s"}` : "Demanda criada pelo assistente (MCP)", s: status },
          ...checklist.filter((c) => c.done).map((c) => ({ d: ddmm(ctx.now), text: `Concluída: ${c.text}`, s: "done" as const })),
        ],
        notes: [],
        ...(type === "polo" ? { polo: r._dossie!.name } : {}),
        ...(type === "multi" ? { polos: r._dossies!.map((x) => ({ name: x.name, status: "todo" as const })) } : {}),
      };
      await saveDemands(pid!, items, [d, ...items]);
      if (r.ref) ctx.demandByRef.set(r.ref, { projectId: pid!, code });
      return [{ tipo: "demanda", modulo, id: code, rotulo: d.title, projeto_id: pid!, undo: { kind: "demanda", projectId: pid!, code } }];
    }
    case "compromisso": {
      const projectId = r.escopo === "profissional" ? pid! : null;
      const taskId = await saveAppointment({
        title: r.titulo, date: r.data, ...(r.inicio ? { time: r.inicio } : {}), ...(r.inicio && r.fim ? { end: r.fim } : {}),
        ...(r.local ? { place: r.local } : {}), ...(r.descricao ? { notes: r.descricao } : {}),
        color: r.cor ?? (r.escopo === "profissional" ? "violet" : "cyan"), ...(r._dossie ? { dossierId: r._dossie.id } : {}),
      }, ctx.compId ?? undefined, projectId);
      const demand = demandOf(ctx, r.demanda, pid);
      must(await supabase.from("tasks").update({ source: "mcp", ...(demand ? { demand_code: demand } : {}) }).eq("id", taskId).select("id"));
      if (r.ref) ctx.taskByRef.set(r.ref, taskId);
      const made: Created[] = [{ tipo: "compromisso", modulo, id: taskId, rotulo: `${r.titulo} (${r.data}${r.inicio ? ` ${r.inicio}` : ""})`, ...(projectId ? { projeto_id: projectId } : {}), undo: { kind: "task", id: taskId } }];
      if (r.lembrete_minutos_antes && r.inicio) {
        const when = minusMinutes(r.data, r.inicio, r.lembrete_minutos_antes);
        const rem = await createTaskRow({ title: `Lembrete: ${r.titulo}`, due_date: when.date, due_time: when.time, priority: "media" },
          { source: "mcp", kind: "lembrete", related_task_id: taskId, ...(projectId ? { project_id: projectId } : {}), ...(r._dossie ? { dossier_id: r._dossie.id } : {}), ...(demand ? { demand_code: demand } : {}) });
        made.push({ tipo: "lembrete", modulo: TIPO_LABEL.lembrete, id: rem.id, rotulo: `Lembrete ${r.lembrete_minutos_antes} min antes (${when.date} ${when.time})`, undo: { kind: "task", id: rem.id } });
      }
      return made;
    }
    case "lembrete":
    case "tarefa": {
      const isRem = r.tipo === "lembrete";
      const demand = isRem ? demandOf(ctx, r.demanda, pid) : null;
      const related = isRem && r.compromisso && isRef(r.compromisso) ? ctx.taskByRef.get(r.compromisso.slice(4)) : undefined;
      const title = isRem ? r.texto : r.titulo;
      const description = isRem ? r.detalhes : r.descricao;
      const row = await createTaskRow({
        title, description: description ?? null, category_id: ctx.catId(r.categoria), priority: r.prioridade ?? "media",
        due_date: r.data ?? null, due_time: r.data && r.hora ? r.hora : null,
      }, {
        source: "mcp", kind: isRem ? "lembrete" : "tarefa",
        ...(isRem && pid ? { project_id: pid } : {}), ...(isRem && r._dossie ? { dossier_id: r._dossie.id } : {}),
        ...(demand ? { demand_code: demand } : {}), ...(related ? { related_task_id: related } : {}),
      });
      return [{ tipo: r.tipo, modulo, id: row.id, rotulo: `${title}${r.data ? ` (${r.data}${r.hora ? ` ${r.hora}` : ""})` : ""}`, ...(isRem && pid ? { projeto_id: pid } : {}), undo: { kind: "task", id: row.id } }];
    }
    case "rotina": {
      const first = (must(await supabase.from("routine_items").select("position").order("position", { ascending: false }).limit(1)) as { position: number }[])[0];
      const row = must(await supabase.from("routine_items").insert({
        time: r.hora, title: r.titulo.trim().slice(0, 120), description: (r.descricao ?? "").slice(0, 300), tag: "Rotina", color: "cyan", icon: "star",
        kind: r.natureza ?? "habito", position: (first?.position ?? 0) + 1,
      }).select("id").single()) as { id: string };
      return [{ tipo: "rotina", modulo, id: row.id, rotulo: `${r.titulo} (todo dia ${r.hora})`, undo: { kind: "rotina", id: row.id } }];
    }
    case "anotacao": {
      const st = await loadProjectState(pid!);
      let id = Date.now();
      while (st.notes.some((n) => n.id === id)) id += 1;
      const note = { id, text: r.texto.trim(), date: ddmm(ctx.now), color: r.cor ?? "violet", ...(r._dossie ? { dossierId: r._dossie.id } : {}) };
      await saveNotesDb(pid!, st.notes, [note, ...st.notes]);
      return [{ tipo: "anotacao", modulo, id: String(id), rotulo: r.texto.slice(0, 60), projeto_id: pid!, undo: { kind: "nota", projectId: pid!, noteId: id } }];
    }
    case "documentacao": {
      const lib = await loadLibrary(pid!);
      const ex = { id: newId("e"), title: r.titulo.trim(), situation: (r.situacao ?? "").trim(), text: r.texto.trim(), cat: r.categoria?.trim() || "Documentação", color: "cyan" };
      await saveLibrary(pid!, lib, upsertExample(lib, ex));
      return [{ tipo: "documentacao", modulo, id: ex.id, rotulo: ex.title, projeto_id: pid!, undo: { kind: "exemplo", projectId: pid!, exampleId: ex.id } }];
    }
    case "evidencia": {
      const code = demandOf(ctx, r.demanda, pid);
      if (!code) throw new Error("demanda da evidência não encontrada");
      const key = materialsKey(pid!, code);
      const before = await getMaterials(key);
      let file: MaterialFile | undefined;
      if (r.conteudo_base64) {
        const bytes = Buffer.from(r.conteudo_base64, "base64");
        const type = r.mime || "application/octet-stream";
        file = { id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, name: r.nome!, type, size: bytes.length, addedAt: new Date().toISOString(), caption: r.legenda ?? "", blob: new Blob([new Uint8Array(bytes)], { type }) };
      }
      const body = r.texto?.trim() ? `${before.body}${before.body ? "\n\n" : ""}${r.texto.trim()}` : before.body;
      await putMaterials(key, { body, files: file ? [...before.files, file] : before.files }, { silent: true });
      return [{ tipo: "evidencia", modulo, id: file?.id ?? code, rotulo: `${file ? r.nome : "texto"} → ${code}`, projeto_id: pid!, undo: { kind: "evidencia", projectId: pid!, code, ...(file ? { fileId: file.id } : {}), bodyBefore: before.body } }];
    }
  }
}

/** Desfaz um item criado. Quem já foi apagado à mão é tratado como já desfeito. */
export async function undoCreated(c: Created): Promise<string> {
  const u = c.undo;
  switch (u.kind) {
    case "demanda": {
      const items = await demandsOf(u.projectId);
      if (!items.some((d) => d.id === u.code)) return `${u.code}: já não existia`;
      await saveDemands(u.projectId, items, items.filter((d) => d.id !== u.code));
      await deleteMaterials(materialsKey(u.projectId, u.code)).catch(() => undefined);
      return `demanda ${u.code} removida`;
    }
    case "task": {
      await syncSchedule(u.id, null).catch(() => undefined);
      must(await supabase.from("tasks").delete().eq("id", u.id).select("id"));
      return `registro ${u.id} removido`;
    }
    case "nota": {
      const st = await loadProjectState(u.projectId);
      await saveNotesDb(u.projectId, st.notes, st.notes.filter((n) => n.id !== u.noteId));
      return "anotação removida";
    }
    case "exemplo": {
      const lib = await loadLibrary(u.projectId);
      await saveLibrary(u.projectId, lib, removeExample(lib, u.exampleId));
      return "documentação removida";
    }
    case "rotina":
      must(await supabase.from("routine_items").delete().eq("id", u.id).select("id"));
      return "item de rotina removido";
    case "evidencia": {
      const key = materialsKey(u.projectId, u.code);
      const cur = await getMaterials(key);
      await putMaterials(key, { body: u.bodyBefore, files: u.fileId ? cur.files.filter((f) => f.id !== u.fileId) : cur.files }, { silent: true });
      return `evidência removida de ${u.code}`;
    }
  }
}
