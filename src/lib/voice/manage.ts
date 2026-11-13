/** Ações da voz sobre o que já existe: demandas, tarefas, lembretes e compromissos. Usa as mesmas regras da tela. */
import { deleteMaterials, materialsKey } from "../demand-materials";
import { loadDemands, saveDemands } from "../data/project-data";
import { must, supabase } from "../data/db";
import type { Demand, Priority, Status } from "../demands";
import { keywords, normalize } from "../orion";
import { listProjects } from "../mcp/lookup";

export const STATUS_LABEL: Record<Status, string> = { todo: "A fazer", doing: "Em andamento", done: "Concluída" };
const today = () => new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

/** Mesma regra da tela: demanda para vários dossiês fica concluída quando todos concluem. */
export const multiStatus = (p: NonNullable<Demand["polos"]>): Status => (!p.length ? "todo" : p.every((x) => x.status === "done") ? "done" : p.some((x) => x.status !== "todo") ? "doing" : "todo");

/** "2026-11-20", "20/11" ou "20/11/2026" → "20/11" (formato do prazo na tela). */
export function deadlineText(v: string): string {
  const s = v.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}`;
  const br = /^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/.exec(s);
  return br ? `${br[1]!.padStart(2, "0")}/${br[2]!.padStart(2, "0")}` : s.slice(0, 20);
}

/** Aplica uma mudança de status como a tela faz (histórico, dossiês e demanda para vários). */
export function withStatus(d: Demand, s: Status, polo?: string): Demand {
  if (polo && d.polos) {
    const polos = d.polos.map((p) => (p.name === polo ? { ...p, status: s, date: s === "done" ? today() : undefined } : p));
    return { ...d, polos, status: multiStatus(polos), history: [...d.history, { d: today(), text: s === "done" ? `Concluído em ${polo}.` : s === "doing" ? `Iniciado em ${polo}.` : `${polo} reaberto.`, s }] };
  }
  return {
    ...d, status: s,
    polos: d.polos?.map((p) => (s === "done" ? { ...p, status: "done", date: p.date ?? today() } : s === "todo" ? { ...p, status: "todo", date: undefined } : p)),
    history: [...d.history, { d: today(), text: `Status alterado para ${STATUS_LABEL[s]}`, s }],
  };
}

export type Found<T> = { ok: true; item: T } | { ok: false; erro: string; opcoes?: string[] };

/** Acha um item por código (ex.: "P049", "#G042") ou por palavras do título. */
export function pick<T>(list: T[], query: string, code: (x: T) => string, title: (x: T) => string, label: (x: T) => string): Found<T> {
  const q = query.trim();
  if (!q) return { ok: false, erro: "Diga qual é." };
  const asCode = q.replace(/^#/, "").replace(/\s+/g, "").toUpperCase();
  if (/^[A-Z]\d{2,4}$/.test(asCode)) {
    const byCode = list.filter((x) => code(x).replace(/^#/, "").toUpperCase() === asCode);
    if (byCode.length === 1) return { ok: true, item: byCode[0]! };
  }
  const nq = normalize(q);
  const exact = list.filter((x) => normalize(title(x)) === nq);
  if (exact.length === 1) return { ok: true, item: exact[0]! };
  const kws = keywords(q);
  const words = kws.length ? kws : nq.split(" ").filter((w) => w.length >= 2);
  const scored = list
    .map((x) => { const t = normalize(`${code(x)} ${title(x)}`); const hit = words.filter((w) => t.includes(w)).length; return { x, hit, all: hit === words.length && words.length > 0 }; })
    .filter((r) => r.all)
    .sort((a, b) => a.hit - b.hit);
  if (scored.length === 1) return { ok: true, item: scored[0]!.x };
  if (!scored.length) return { ok: false, erro: "Não achei nenhum item com esse nome." };
  return { ok: false, erro: "Achei mais de um. Pergunte qual deles.", opcoes: scored.slice(0, 5).map((r) => label(r.x)) };
}

type Loaded = { pid: string; project: string; all: Demand[] };
async function loadAllDemands(): Promise<Loaded[]> {
  const projects = await listProjects();
  return Promise.all(projects.map(async (p) => ({ pid: p.id, project: p.nome ?? p.id, all: await loadDemands(p.id) })));
}

export type DemandChange = {
  demanda: string; status?: Status | undefined; titulo?: string | undefined; descricao?: string | undefined; prioridade?: Priority | undefined;
  prazo?: string | undefined; nota?: string | undefined; dossie?: string | undefined; excluir?: boolean | undefined; confirmado?: boolean | undefined;
};

/** Muda, edita ou exclui uma demanda existente. Exclusão pede confirmação (evita confundir "excluir" com "concluir" na fala). */
export async function changeDemand(c: DemandChange): Promise<Record<string, unknown>> {
  const loaded = await loadAllDemands();
  const flat = loaded.flatMap((l) => l.all.map((d) => ({ ...l, d })));
  const f = pick(flat, c.demanda, (x) => x.d.id, (x) => x.d.title, (x) => `${x.d.id} ${x.d.title}`);
  if (!f.ok) return { ok: false, erro: f.erro, ...(f.opcoes ? { opcoes: f.opcoes } : {}) };
  const { pid, project, all, d } = f.item;
  const label = `${d.id} ${d.title}`;

  if (c.excluir) {
    if (!c.confirmado) return { ok: false, precisa_confirmar: true, demanda: label, dica: `Pergunte em uma frase: "Quer mesmo excluir ${d.id}?". Só chame de novo com confirmado=true se ela disser sim.` };
    await saveDemands(pid, all, all.filter((x) => x.id !== d.id));
    await deleteMaterials(materialsKey(pid, d.id)).catch(() => undefined);
    return { ok: true, acao: "excluida", demanda: label };
  }

  let n: Demand = d;
  const feito: string[] = [];
  if (c.status) {
    if (c.dossie && !d.polos?.some((p) => normalize(p.name) === normalize(c.dossie!))) return { ok: false, erro: `Essa demanda não tem o dossiê "${c.dossie}".`, opcoes: d.polos?.map((p) => p.name) ?? [] };
    const polo = c.dossie ? d.polos!.find((p) => normalize(p.name) === normalize(c.dossie!))!.name : undefined;
    n = withStatus(n, c.status, polo); feito.push(`${polo ? `${polo}: ` : ""}${STATUS_LABEL[c.status]}`);
  }
  if (c.titulo?.trim()) { n = { ...n, title: c.titulo.trim().slice(0, 300) }; feito.push("título"); }
  if (c.descricao !== undefined) { n = { ...n, desc: c.descricao.trim().slice(0, 5000) }; feito.push("descrição"); }
  if (c.prioridade) { n = { ...n, priority: c.prioridade }; feito.push(`prioridade ${c.prioridade}`); }
  if (c.prazo !== undefined) { n = { ...n, deadline: deadlineText(c.prazo) }; feito.push("prazo"); }
  if (c.nota?.trim()) { n = { ...n, notes: [...n.notes, c.nota.trim()], history: [...n.history, { d: today(), text: "Observação adicionada", s: n.status }] }; feito.push("observação"); }
  if (!feito.length) return { ok: false, erro: "Nada para mudar. Diga o que alterar (status, título, prazo, prioridade, descrição ou observação)." };
  await saveDemands(pid, all, all.map((x) => (x.id === d.id ? n : x)));
  return { ok: true, acao: "atualizada", demanda: `${n.id} ${n.title}`, projeto: project, status_agora: STATUS_LABEL[n.status], mudou: feito };
}

/* ───────────── tarefas, lembretes e compromissos (tabela tasks) ───────────── */
export type TaskKind = "tarefa" | "lembrete" | "compromisso" | "qualquer";
export type TaskChange = {
  item: string; tipo?: TaskKind | undefined; acao: "concluir" | "reabrir" | "editar" | "excluir";
  novo_titulo?: string | undefined; nova_data?: string | undefined; nova_hora?: string | undefined; prioridade?: Priority | undefined; local?: string | undefined; confirmado?: boolean | undefined;
};
type Row = { id: string; title: string; due_date: string | null; due_time: string | null; done: boolean; kind: string };
const kindOf = (k: string): TaskKind => (k === "evento" ? "compromisso" : k === "lembrete" ? "lembrete" : "tarefa");

export async function changeTask(c: TaskChange): Promise<Record<string, unknown>> {
  const rows = must(await supabase.from("tasks").select("id, title, due_date, due_time, done, kind").order("created_at", { ascending: false }).limit(800)) as Row[];
  const tipo = c.tipo ?? "qualquer";
  const pool = rows.filter((r) => (tipo === "qualquer" || kindOf(r.kind) === tipo) && (c.acao === "concluir" ? !r.done : c.acao === "reabrir" ? r.done : true));
  const when = (r: Row) => [r.due_date?.split("-").reverse().join("/"), r.due_time?.slice(0, 5)].filter(Boolean).join(" ");
  const f = pick(pool, c.item, () => "", (r) => r.title, (r) => `${r.title}${when(r) ? ` (${when(r)})` : ""}`);
  if (!f.ok) return { ok: false, erro: f.erro, ...(f.opcoes ? { opcoes: f.opcoes } : {}) };
  const r = f.item, what = kindOf(r.kind), name = `${what}: ${r.title}`;

  if (c.acao === "excluir") {
    if (!c.confirmado) return { ok: false, precisa_confirmar: true, item: name, dica: `Pergunte em uma frase: "Quer mesmo excluir ${what === "lembrete" ? "o lembrete" : what === "compromisso" ? "o compromisso" : "a tarefa"} ${r.title}?". Só chame de novo com confirmado=true se ela disser sim.` };
    must(await supabase.from("tasks").delete().eq("id", r.id).select("id"));
    return { ok: true, acao: "excluido", item: name };
  }
  if (c.acao === "concluir" || c.acao === "reabrir") {
    const done = c.acao === "concluir";
    must(await supabase.from("tasks").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", r.id).select("id"));
    must(await supabase.from("schedule_items").update({ done }).eq("task_id", r.id).select("id"));
    return { ok: true, acao: done ? "concluido" : "reaberto", item: name };
  }
  const patch: Record<string, unknown> = {};
  if (c.novo_titulo?.trim()) patch["title"] = c.novo_titulo.trim().slice(0, 200);
  if (c.nova_data) patch["due_date"] = /^\d{4}-\d{2}-\d{2}$/.test(c.nova_data) ? c.nova_data : undefined;
  if (c.nova_hora) patch["due_time"] = /^\d{2}:\d{2}$/.test(c.nova_hora) ? c.nova_hora : undefined;
  if (c.prioridade) patch["priority"] = c.prioridade;
  if (c.local !== undefined) patch["place"] = c.local.trim().slice(0, 200) || null;
  for (const k of Object.keys(patch)) if (patch[k] === undefined) delete patch[k];
  if (!Object.keys(patch).length) return { ok: false, erro: "Nada para mudar. Diga o novo título, data (AAAA-MM-DD), hora (HH:MM), prioridade ou local." };
  must(await supabase.from("tasks").update(patch).eq("id", r.id).select("id"));
  return { ok: true, acao: "editado", item: name, mudou: Object.keys(patch).map((k) => ({ title: "título", due_date: "data", due_time: "hora", priority: "prioridade", place: "local" }[k] ?? k)) };
}
