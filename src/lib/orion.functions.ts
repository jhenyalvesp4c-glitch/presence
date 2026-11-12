/**
 * Orion (segundo cérebro): pesquisa em tudo o que existe no Presence e responde com IA (OpenAI) citando as fontes.
 * Sem OPENAI_API_KEY, devolve só as fontes encontradas (a busca continua funcionando).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { OrionSource } from "./orion";

export type AskResult =
  | { ok: true; mode: "ia" | "busca"; answer: string; sources: OrionSource[]; period: string | null; keywords: string[]; note?: string }
  | { ok: false; error: string };

const askInput = z.object({ question: z.string().trim().min(2, "Escreva a pergunta.").max(600) });

const day = (ts: string | null | undefined) => (ts ? ts.slice(0, 10) : undefined);

type Rows<T> = { data: T[] | null; error: { message: string } | null };
const rows = <T>(r: Rows<T>, what: string): T[] => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data ?? [];
};

/** Reúne o que há no sistema como documentos pesquisáveis. */
async function loadCorpus() {
  const { supabase } = await import("./data/db");
  const [entries, projects, demands, hist, notes, execs, tasks, pnotes, msgs, trains, scripts, dfiles] = await Promise.all([
    supabase.from("brain_entries").select("id, title, text, entry_date, project_id, dossier_names, source, ai_summary, attachments").order("entry_date", { ascending: false }).limit(1500),
    supabase.from("projects").select("id, name"),
    supabase.from("project_demands").select("project_id, code, type, title, description, priority, status, deadline, dossier_name, updated_at").limit(2000),
    supabase.from("demand_history").select("project_id, code, label, text, status").limit(5000),
    supabase.from("demand_notes").select("project_id, code, text").limit(3000),
    supabase.from("demand_executions").select("project_id, code, dossier_name, status, done_on, note").limit(5000),
    supabase.from("tasks").select("id, title, description, place, due_date, done, kind, project_id, created_at").limit(3000),
    supabase.from("project_notes").select("id, project_id, text, date_label, created_at").limit(2000),
    supabase.from("assistant_messages").select("id, role, content, created_at").order("created_at", { ascending: false }).limit(1500),
    supabase.from("training_sessions").select("id, group_name, people, script_title, notes, created_at").limit(500),
    supabase.from("training_scripts").select("project_id, id, data, updated_at").limit(200),
    supabase.from("demand_files").select("project_id, code, name, mime_type, size_bytes, storage_path").limit(2000),
  ]);

  const projName = new Map(rows(projects as Rows<{ id: string; name: string }>, "projetos").map((p) => [p.id, p.name]));
  const docs: import("./orion").OrionDoc[] = [];

  type Entry = { id: string; title: string; text: string; entry_date: string; project_id: string | null; dossier_names: string[]; source: string; ai_summary: string; attachments: { path: string; name: string; mime: string; size: number }[] | null };
  for (const e of rows(entries as Rows<Entry>, "anotações")) {
    const files = (e.attachments ?? []).map((a) => a.name);
    const body = [e.text, files.length ? `Arquivos anexados: ${files.join(", ")}.` : "", e.ai_summary ? `Conteúdo lido dos arquivos:\n${e.ai_summary}` : ""].filter(Boolean).join("\n");
    docs.push({
      id: `registro:${e.id}`, kind: e.source === "documentacao" ? "documentacao" : "registro", title: e.title || e.text.replace(/\s+/g, " ").slice(0, 80) || files[0] || "Anotação", text: body, date: e.entry_date,
      where: [...(e.dossier_names ?? []), e.project_id ? projName.get(e.project_id) : undefined].filter(Boolean).join(", ") || undefined,
      link: e.source === "documentacao" ? "/demandas" : "/cerebro",
      files: (e.attachments ?? []).map((a) => ({ bucket: "presence-app-brain-files", path: a.path, name: a.name, mime: a.mime, size: a.size })),
    });
  }

  const byCode = <T extends { project_id: string; code: string }>(l: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of l) { const k = `${r.project_id}|${r.code}`; (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
    return m;
  };
  const H = byCode(rows(hist as Rows<{ project_id: string; code: string; label: string; text: string; status: string }>, "histórico"));
  const N = byCode(rows(notes as Rows<{ project_id: string; code: string; text: string }>, "observações"));
  const X = byCode(rows(execs as Rows<{ project_id: string; code: string; dossier_name: string; status: string; done_on: string | null; note: string }>, "execuções"));
  const DF = new Map<string, import("./orion").FileRef[]>();
  for (const f of rows(dfiles as Rows<{ project_id: string; code: string; name: string; mime_type: string; size_bytes: number | string; storage_path: string }>, "arquivos das demandas")) {
    const k = `${f.project_id}|${f.code}`;
    (DF.get(k) ?? DF.set(k, []).get(k)!).push({ bucket: "presence-app-demand-files", path: f.storage_path, name: f.name, mime: f.mime_type, size: Number(f.size_bytes) });
  }
  const STATUS: Record<string, string> = { todo: "a fazer", doing: "em andamento", done: "concluída" };
  for (const d of rows(demands as Rows<{ project_id: string; code: string; type: string; title: string; description: string; priority: string; status: string; deadline: string; dossier_name: string | null; updated_at: string }>, "demandas")) {
    const k = `${d.project_id}|${d.code}`;
    const lines = [
      d.description,
      `Status: ${STATUS[d.status] ?? d.status}. Prioridade: ${d.priority}. Prazo: ${d.deadline || "sem prazo"}.`,
      ...(H.get(k) ?? []).map((h) => `Histórico ${h.label}: ${h.text} (${STATUS[h.status] ?? h.status})`),
      ...(N.get(k) ?? []).map((n) => `Observação: ${n.text}`),
      ...((DF.get(k) ?? []).length ? [`Arquivos anexados: ${DF.get(k)!.map((f) => f.name).join(", ")}.`] : []),
      ...(X.get(k) ?? []).map((x) => `${x.dossier_name}: ${STATUS[x.status] ?? x.status}${x.done_on ? ` em ${x.done_on}` : ""}${x.note ? ` — ${x.note}` : ""}`),
    ].filter(Boolean);
    docs.push({
      id: `demanda:${k}`, kind: "demanda", title: `${d.code} ${d.title}`, text: lines.join("\n"), date: day(d.updated_at),
      where: [d.dossier_name, projName.get(d.project_id)].filter(Boolean).join(" · ") || undefined, link: `/demandas?projeto=${encodeURIComponent(d.project_id)}`,
      files: DF.get(k),
    });
  }

  for (const t of rows(tasks as Rows<{ id: string; title: string; description: string | null; place: string | null; due_date: string | null; done: boolean; kind: string; project_id: string | null; created_at: string }>, "tarefas")) {
    docs.push({
      id: `tarefa:${t.id}`, kind: "tarefa", title: t.title,
      text: [t.description, t.place ? `Local: ${t.place}` : "", t.done ? "Concluída." : "Pendente."].filter(Boolean).join("\n"),
      date: t.due_date ?? day(t.created_at), where: t.project_id ? projName.get(t.project_id) : undefined, link: t.kind === "evento" || t.due_date ? "/calendario" : "/tarefas",
    });
  }

  for (const n of rows(pnotes as Rows<{ id: number; project_id: string; text: string; date_label: string; created_at: string }>, "notas")) {
    docs.push({ id: `nota:${n.id}`, kind: "nota", title: n.text.replace(/\s+/g, " ").slice(0, 80), text: n.text, date: day(n.created_at), where: projName.get(n.project_id), link: `/demandas?projeto=${encodeURIComponent(n.project_id)}` });
  }

  for (const m of rows(msgs as Rows<{ id: string; role: string; content: string; created_at: string }>, "conversa")) {
    docs.push({ id: `conversa:${m.id}`, kind: "conversa", title: m.role === "user" ? "Você disse à assistente" : "A assistente respondeu", text: m.content, date: day(m.created_at), link: "/assistente" });
  }

  for (const s of rows(trains as Rows<{ id: string; group_name: string; people: number; script_title: string; notes: string; created_at: string }>, "treinamentos")) {
    docs.push({ id: `treinamento:${s.id}`, kind: "treinamento", title: `Turma ${s.group_name}`, text: [`${s.people} pessoas.`, s.script_title ? `Roteiro: ${s.script_title}.` : "", s.notes].filter(Boolean).join("\n"), date: day(s.created_at), link: "/demandas" });
  }
  const flat = (v: unknown, out: string[] = []): string[] => {
    if (typeof v === "string") { if (v.length > 2 && !v.startsWith("data:")) out.push(v); }
    else if (Array.isArray(v)) v.forEach((x) => flat(x, out));
    else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach((x) => flat(x, out));
    return out;
  };
  for (const sc of rows(scripts as Rows<{ project_id: string; id: string; data: unknown; updated_at: string }>, "roteiros")) {
    const d = sc.data as { title?: string; name?: string };
    docs.push({ id: `treinamento:script:${sc.project_id}:${sc.id}`, kind: "treinamento", title: `Roteiro: ${d.title ?? d.name ?? sc.id}`, text: flat(sc.data).join(" ").slice(0, 3000), date: day(sc.updated_at), where: projName.get(sc.project_id), link: "/demandas" });
  }
  return docs;
}

const saoPauloDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function textOf(msg: { output: { type: string; [k: string]: unknown }[] }): string {
  const out: string[] = [];
  for (const b of msg.output) {
    if (b.type !== "message") continue;
    for (const c of (b["content"] as { type: string; text?: string }[] | undefined) ?? []) if (c.type === "output_text" && c.text) out.push(c.text);
  }
  return out.join("\n").trim();
}

export const orionAsk = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => askInput.parse(data))
  .handler(async ({ data }): Promise<AskResult> => {
    try {
      const { rank, toSources, sourcesForAi, SYSTEM } = await import("./orion");
      const today = saoPauloDay();
      const corpus = await loadCorpus();
      const { docs, period, kws } = rank(corpus, data.question, today);
      const sources = toSources(docs, kws);
      const periodLabel = period?.label ?? null;
      if (!docs.length) {
        return { ok: true, mode: "busca", answer: "Não encontrei nada sobre isso no que o Presence tem guardado. Se foi algo que aconteceu, use “Documentar” para registrar e eu passo a achar.", sources: [], period: periodLabel, keywords: kws };
      }
      if (!process.env["OPENAI_API_KEY"]) {
        return { ok: true, mode: "busca", answer: `Encontrei ${docs.length} registro${docs.length > 1 ? "s" : ""} relacionados. A resposta escrita pela IA ainda não está ligada (falta OPENAI_API_KEY no servidor), mas as fontes estão abaixo.`, sources, period: periodLabel, keywords: kws };
      }
      const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
      const { DEFAULT_MODEL } = await import("./mcp/interpret");
      const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
      try {
        const msg = await makeCreate()({
          model,
          instructions: `${SYSTEM}\n\nHoje é ${today} (America/Sao_Paulo).${period ? ` A pergunta fala de “${period.label}” (${period.from} a ${period.to}); as fontes já foram filtradas para esse período.` : ""}`,
          input: [{ role: "user", content: [{ type: "input_text", text: `FONTES:\n${sourcesForAi(docs)}\n\nPERGUNTA: ${data.question}` }] }],
          max_output_tokens: 2000,
          reasoning: { effort: "low" },
          store: false,
        });
        const answer = textOf(msg);
        if (!answer) return { ok: true, mode: "busca", answer: "A IA não devolveu texto desta vez, mas as fontes encontradas estão abaixo.", sources, period: periodLabel, keywords: kws };
        return { ok: true, mode: "ia", answer, sources, period: periodLabel, keywords: kws };
      } catch (e) {
        if (e instanceof OpenAIError) return { ok: true, mode: "busca", answer: `${explain(e, model)} Enquanto isso, estas são as fontes encontradas.`, sources, period: periodLabel, keywords: kws };
        throw e;
      }
    } catch (e) {
      return { ok: false, error: `Não consegui pesquisar agora: ${(e as Error).message}` };
    }
  });
