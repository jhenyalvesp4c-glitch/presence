/**
 * Orion (segundo cérebro): pesquisa em tudo o que existe no Orion e responde com IA (OpenAI) citando as fontes.
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
export async function loadCorpus() {
  const { supabase } = await import("./data/db");
  const [entries, projects, demands, hist, notes, execs, tasks, pnotes, msgs, trains, scripts, dfiles, cls, cdocs, clog] = await Promise.all([
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
    supabase.from("training_library").select("project_id, scripts, examples, updated_at").limit(50),
    supabase.from("demand_files").select("project_id, code, name, mime_type, size_bytes, storage_path").limit(2000),
    supabase.from("clients").select("id, project_id, dossier_id, name, segment, contact_name, email, phone, doc_number, status, plan, monthly_value, contract_end, notes, updated_at").limit(1000),
    supabase.from("client_docs").select("id, client_id, title, kind, doc_date, attachments, ai_summary").limit(3000),
    supabase.from("client_log").select("id, client_id, log_date, text").limit(5000),
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

  // clientes: ficha + documentos (com o texto lido dos arquivos) + histórico, num documento por cliente
  {
    const { clientCorpusText } = await import("./clients");
    type CL = { id: string; project_id: string; name: string; segment: string; contact_name: string; email: string; phone: string; doc_number: string; status: import("./clients").ClientStatus; plan: string; monthly_value: number | string; contract_end: string | null; notes: string; updated_at: string; dossier_id: string | null };
    const cd = rows(cdocs as Rows<{ id: string; client_id: string; title: string; kind: string; doc_date: string | null; attachments: { path: string; name: string; mime: string; size: number }[] | null; ai_summary: string }>, "documentos dos clientes");
    const cg = rows(clog as Rows<{ id: string; client_id: string; log_date: string; text: string }>, "histórico dos clientes");
    for (const c of rows(cls as Rows<CL>, "clientes")) {
      const myDocs = cd.filter((d) => d.client_id === c.id);
      docs.push({
        id: `cliente:${c.id}`, kind: "documentacao", title: `Cliente: ${c.name}`, date: c.updated_at.slice(0, 10), where: projName.get(c.project_id), link: "/demandas",
        text: clientCorpusText({ id: c.id, projectId: c.project_id, dossierId: c.dossier_id, name: c.name, segment: c.segment, contactName: c.contact_name, email: c.email, phone: c.phone, docNumber: c.doc_number, status: c.status, plan: c.plan, monthlyValue: Number(c.monthly_value), contractEnd: c.contract_end, notes: c.notes },
          myDocs.map((d) => ({ id: d.id, clientId: c.id, title: d.title, kind: d.kind, docDate: d.doc_date, attachments: [], summary: d.ai_summary })), cg.filter((l) => l.client_id === c.id).map((l) => ({ id: l.id, clientId: c.id, date: l.log_date, text: l.text }))),
        files: myDocs.flatMap((d) => (d.attachments ?? []).map((a) => ({ bucket: "presence-app-brain-files", path: a.path, name: a.name, mime: a.mime, size: a.size }))),
      });
    }
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
    docs.push({ id: `conversa:${m.id}`, kind: "conversa", title: m.role === "user" ? "Você disse ao assistente" : "O assistente respondeu", text: m.content, date: day(m.created_at), link: "/assistente" });
  }

  for (const s of rows(trains as Rows<{ id: string; group_name: string; people: number; script_title: string; notes: string; created_at: string }>, "treinamentos")) {
    docs.push({ id: `treinamento:${s.id}`, kind: "treinamento", title: `Turma ${s.group_name}`, text: [`${s.people} pessoas.`, s.script_title ? `Roteiro: ${s.script_title}.` : "", s.notes].filter(Boolean).join("\n"), date: day(s.created_at), link: "/demandas" });
  }
  type LibScript = { id: string; title?: string; audience?: string; goal?: string; folder?: string; blocks?: { title?: string; minutes?: number; say?: string; tip?: string; show?: string[]; why?: string[]; faq?: { q: string; a: string }[]; scenario?: { situation?: string; before?: string; after?: string }; visuals?: { title?: string; caption?: string }[] }[] };
  type LibExample = { id: string; title?: string; situation?: string; text?: string; cat?: string };
  for (const lib of rows(scripts as Rows<{ project_id: string; scripts: unknown; examples: unknown; updated_at: string }>, "roteiros")) {
    const proj = projName.get(lib.project_id);
    for (const sc of (Array.isArray(lib.scripts) ? lib.scripts : []) as LibScript[]) {
      const text = [
        sc.goal ? `Objetivo: ${sc.goal}` : "", sc.audience ? `Para: ${sc.audience}` : "", sc.folder ? `Pasta: ${sc.folder}` : "",
        ...(sc.blocks ?? []).map((b, i) => [
          `Bloco ${i + 1}: ${b.title ?? ""} (${b.minutes ?? 0} min)`,
          b.say ? `O que falar: ${b.say}` : "", b.show?.length ? `Passos: ${b.show.join("; ")}` : "", b.tip ? `Lembrete: ${b.tip}` : "",
          b.why?.length ? `Por que ajuda: ${b.why.join("; ")}` : "", b.scenario?.situation ? `Situação: ${b.scenario.situation} Antes: ${b.scenario.before ?? ""} Depois: ${b.scenario.after ?? ""}` : "",
          ...(b.faq ?? []).map((f) => `Pergunta: ${f.q} Resposta: ${f.a}`), ...(b.visuals ?? []).map((v) => `Imagem: ${v.title ?? ""} ${v.caption ?? ""}`),
        ].filter(Boolean).join("\n")),
      ].filter(Boolean).join("\n");
      docs.push({ id: `treinamento:roteiro:${lib.project_id}:${sc.id}`, kind: "treinamento", title: `Roteiro: ${sc.title ?? sc.id}`, text: text.slice(0, 12000), date: day(lib.updated_at), where: [sc.folder, proj].filter(Boolean).join(" · ") || undefined, link: "/demandas" });
    }
    for (const ex of (Array.isArray(lib.examples) ? lib.examples : []) as LibExample[]) {
      docs.push({ id: `treinamento:exemplo:${lib.project_id}:${ex.id}`, kind: "treinamento", title: `Exemplo: ${ex.title ?? ex.id}`, text: [ex.cat ? `Categoria: ${ex.cat}` : "", ex.situation ? `Situação: ${ex.situation}` : "", ex.text ?? ""].filter(Boolean).join("\n"), date: day(lib.updated_at), where: proj, link: "/demandas" });
    }
  }
  // o resto do sistema (memórias, hábitos, saúde, listas, plano, financeiro, acertos): cada parte falha sozinha, sem derrubar a busca
  try {
    const { extraDocs } = await import("./orion-extra");
    const { cloudFinanceRepo } = await import("./finance/cloud-repo");
    const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()), from = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const ok = <T>(r: { data: T[] | null; error: unknown }): T[] => (r.error ? [] : (r.data ?? []));
    const [memories, habits, completions, measurements, diet, meals, workoutSplit, lists, listItems, schedule, settlements, settleItems, ideas, finance] = await Promise.all([
      supabase.from("user_memories").select("id, text, kind, created_at").order("created_at", { ascending: false }).limit(60),
      supabase.from("habits").select("id, name, active"), supabase.from("habit_completions").select("habit_id, completed_on").gte("completed_on", new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10)).limit(3000),
      supabase.from("body_measurements").select("id, name, measured_on, height_m, weight_kg, values, notes").order("measured_on", { ascending: false }).limit(60),
      supabase.from("diet_sheets").select("id, name, goal, calories, protein, carbs, fat, notes, active"), supabase.from("diet_meals").select("sheet_id, name, meal_time, foods").order("position").limit(100),
      supabase.from("workout_split").select("weekday, title"),
      supabase.from("checklists").select("id, title, updated_at").limit(40), supabase.from("checklist_items").select("list_id, section, label, done").limit(1500),
      supabase.from("schedule_items").select("plan_date, time, title, done, kind").gte("plan_date", from).lte("plan_date", new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)).limit(600),
      supabase.from("fin_settlements").select("id, person, closed, default_share"), supabase.from("fin_settlement_items").select("settlement_id, kind, item_date, description, amount, payer, other_share, installment").limit(2000),
      supabase.from("ideas").select("id, title, body, kind, area, status, tags, links, plan, budget, touched_at").limit(500),
      cloudFinanceRepo.readCloud().catch(() => null),
    ]);
    docs.push(...extraDocs({
      memories: ok(memories as never), habits: ok(habits as never), completions: ok(completions as never), measurements: ok(measurements as never), diet: ok(diet as never), meals: ok(meals as never),
      workoutSplit: ok(workoutSplit as never), lists: ok(lists as never), listItems: ok(listItems as never), schedule: ok(schedule as never), settlements: ok(settlements as never), settleItems: ok(settleItems as never), ideas: ok(ideas as never),
    }, finance, new Date(`${todayIso}T12:00:00`)));
  } catch { /* o resto continua funcionando */ }
  // Documentação (Biblioteca de documentos), plano de dieta, fichas de treino e programa: cada parte falha sozinha
  try {
    const [ld, lf, dp, wk, wex, tp] = await Promise.all([
      supabase.from("library_docs").select("id, folder_id, title, description, kind, rules, steps, attachments, ai_summary, deleted, updated_label").limit(1500),
      supabase.from("library_folders").select("id, name").limit(300),
      supabase.from("diet_plans").select("id, name, data, updated_at").eq("active", true).limit(1),
      supabase.from("workouts").select("id, name, duration_min, muscles").limit(100),
      supabase.from("workout_exercises").select("workout_id, name, muscle, sets_reps, rest_seconds, position").order("position").limit(1500),
      supabase.from("training_programs").select("id, name, data, updated_at").eq("active", true).limit(1),
    ]);
    const folderName = new Map<string, string>([["tut", "Tutoriais e Processos"], ["log", "Logins dos Dossiês"], ["reg", "Registros e Execuções"], ["tpl", "Templates"], ["tre", "Materiais de Treinamento"], ["ger", "Documentos Gerais"]]);
    if (!lf.error) for (const f of (lf.data ?? []) as { id: string; name: string }[]) folderName.set(f.id, f.name);
    if (!ld.error) for (const d of (ld.data ?? []) as { id: string; folder_id: string; title: string; description: string; kind: string; rules: string[] | null; steps: string[] | null; attachments: { name: string; path: string; mime: string; size: number }[] | null; ai_summary: string; deleted: boolean; updated_label: string }[]) {
      if (d.deleted) continue;
      docs.push({
        id: `doc:${d.id}`, kind: "documentacao", title: d.title, where: `Documentação · ${folderName.get(d.folder_id) ?? "pasta"}`, link: "/demandas?aba=docs",
        text: [`${d.kind}.`, d.description, ...(d.rules?.length ? [`Regras: ${d.rules.join(" | ")}`] : []), ...(d.steps?.length ? [`Passo a passo: ${d.steps.map((x, i) => `${i + 1}. ${x}`).join(" ")}`] : []), ...(d.ai_summary ? [`Conteúdo lido dos arquivos:\n${d.ai_summary}`] : []), ...(d.attachments?.length ? [`Arquivos: ${d.attachments.map((a) => a.name).join(", ")}.`] : [])].filter(Boolean).join("\n"),
        files: (d.attachments ?? []).map((a) => ({ bucket: "presence-app-brain-files", path: a.path, name: a.name, mime: a.mime, size: a.size })),
      });
    }
    const flat = (v: unknown, max = 4000): string => { try { return JSON.stringify(v).replace(/[{}\[\]"]/g, " ").replace(/\s+/g, " ").slice(0, max); } catch { return ""; } };
    const plan = (dp.data ?? [])[0] as { id: string; name: string; data: unknown; updated_at: string } | undefined;
    if (plan) docs.push({ id: `dieta:${plan.id}`, kind: "saude", title: `Plano alimentar: ${plan.name}`, text: flat(plan.data, 9000), date: day(plan.updated_at), link: "/saude/dieta" });
    const prog = (tp.data ?? [])[0] as { id: string; name: string; data: unknown; updated_at: string } | undefined;
    if (prog) docs.push({ id: `programa:${prog.id}`, kind: "saude", title: `Programa de treino: ${prog.name}`, text: flat(prog.data, 9000), date: day(prog.updated_at), link: "/programa" });
    const exs = (wex.data ?? []) as { workout_id: string; name: string; muscle: string; sets_reps: string; rest_seconds: number }[];
    for (const w of (wk.data ?? []) as { id: string; name: string; duration_min: number; muscles: string[] | null }[]) {
      docs.push({ id: `ficha:${w.id}`, kind: "saude", title: `Ficha de treino: ${w.name}`, text: [`${w.duration_min} min. Músculos: ${(w.muscles ?? []).join(", ")}.`, ...exs.filter((e) => e.workout_id === w.id).map((e) => `${e.name} (${e.muscle}) ${e.sets_reps}, descanso ${e.rest_seconds}s`)].join("\n"), link: "/saude/treino" });
    }
  } catch { /* o resto continua funcionando */ }
  // reuniões: ata, decisões, quem faz o quê e pendências (também a conversa original, cortada)
  try {
    const { cleanAnalysis, analysisToMarkdown } = await import("./meetings");
    const m = await supabase.from("meetings").select("id, title, raw, analysis, happened_on").order("created_at", { ascending: false }).limit(200);
    if (!m.error) for (const r of (m.data ?? []) as { id: string; title: string; raw: string; analysis: unknown; happened_on: string }[]) {
      const a = cleanAnalysis(r.analysis); if (!a) continue;
      docs.push({ id: `reuniao:${r.id}`, kind: "reuniao", title: `Reunião: ${r.title}`, text: `${analysisToMarkdown(a, r.happened_on)}\n\nConversa original:\n${r.raw.slice(0, 6000)}`, date: r.happened_on, link: "/reunioes" });
    }
  } catch { /* reuniões não derrubam a busca */ }
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
        return { ok: true, mode: "busca", answer: "Não encontrei nada sobre isso no que o Orion tem guardado. Se foi algo que aconteceu, use “Documentar” para registrar e eu passo a achar.", sources: [], period: periodLabel, keywords: kws };
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
