/**
 * Assistente de voz (estilo Jarvis): conversa curta e rápida + ferramentas que mexem no Presence de verdade
 * (abrir páginas, criar demandas/tarefas/compromissos, resumo do dia, pesquisar no Orion, documentar).
 * Só roda no servidor. A rota /api/voz repassa os eventos ao navegador em streaming.
 */
import { z } from "zod/v4";

import { must, supabase, SINGLE_USER_ID } from "../data/db";
import { mentionedDossiers, normalize, rank, snippet } from "../orion";
import { commitRecords } from "../mcp/commit";
import { contextText, DEFAULT_MODEL, type Context } from "../mcp/interpret";
import { listCategories, listDossiers, listProjects, resolveProject } from "../mcp/lookup";
import { OpenAIError, explain, streamChat } from "../mcp/openai";
import { prepare } from "../mcp/plan";
import { isoDay, rascunhoSchema, registroSchema, weekdayPt, TIPO_LABEL, type Registro } from "../mcp/records";

/* ───────────── eventos para o navegador ───────────── */
export type PanelItem = { rotulo: string; detalhe?: string | undefined; feita?: boolean | undefined; link?: string | undefined };
export type Panel = { titulo: string; secoes: { titulo: string; itens: PanelItem[] }[] };
export type VoiceEvent =
  | { t: "texto"; d: string }
  | { t: "acao"; a: { tipo: "navegar"; para: string } | { tipo: "encerrar" } }
  | { t: "painel"; p: Panel }
  | { t: "erro"; m: string }
  | { t: "fim" };
export type Turn = { role: "user" | "assistant"; content: string };

export const PAGES: Record<string, string> = {
  inicio: "/assistente", demandas: "/demandas", projetos: "/projetos", tarefas: "/tarefas", calendario: "/calendario", planejamento: "/planejamento",
  saude: "/saude", treino: "/saude/treino", dieta: "/saude/dieta", habitos: "/habitos", progresso: "/progresso", cerebro: "/cerebro",
  organizar: "/organizar", analise: "/analise", resumo: "/resumo", hoje: "/hoje",
};

/* ───────────── contexto (com cache curto, para responder rápido) ───────────── */
type Cached = { at: number; ctx: Context; name: string | null };
let cache: Cached | undefined;
async function voiceContext(): Promise<Cached> {
  if (cache && Date.now() - cache.at < 60_000) { const now = new Date(); return { ...cache, ctx: { ...cache.ctx, today: isoDay(now), weekday: weekdayPt(now) } }; }
  const [projects, categories, profile] = await Promise.all([
    listProjects(), listCategories(), supabase.from("profiles").select("display_name").eq("id", SINGLE_USER_ID).maybeSingle(),
  ]);
  const full = await Promise.all(projects.map(async (p) => ({ ...p, dossiers: await listDossiers(p.id) })));
  const now = new Date();
  cache = { at: Date.now(), ctx: { today: isoDay(now), weekday: weekdayPt(now), projects: full, categories }, name: (profile.data as { display_name: string | null } | null)?.display_name ?? null };
  return cache;
}

const PERSONA = (name: string | null) => `Você é a Presence, a assistente pessoal${name ? ` de ${name}` : ""}, no estilo do Jarvis: elegante, calma, muito eficiente e com um leve toque de humor sofisticado. Está conversando POR VOZ.
Regras de fala:
- Responda em português do Brasil, em UMA ou DUAS frases curtas. Nada de listas, markdown, emojis, URLs ou códigos; diga datas e horas do jeito que se fala ("amanhã às três da tarde").
- Faça o pedido na hora usando as ferramentas e depois confirme em uma frase ("Pronto, criei a demanda…"). Não peça permissão para o que foi pedido com clareza.
- Se faltar um dado essencial, faça UMA pergunta curta. Se algo for ambíguo (projeto, polo), pergunte qual, citando as opções.
- Para "o que tenho hoje" (ou amanhã) use resumo_do_dia e fale só os destaques em até três frases: a tela já mostra a lista completa.
- Para perguntas sobre o que aconteceu, documentos, anotações ou arquivos, use buscar_no_orion e responda com o que encontrou. Para guardar algo que a usuária contou, use documentar.
- Para abrir telas use abrir_pagina. Quando a usuária se despedir ou pedir para parar, use encerrar_conversa.
- Nunca invente dados: se a ferramenta não trouxer, diga que não encontrou.
${name ? `Trate a usuária pelo nome de vez em quando, sem exagero.` : ""}`;

/* ───────────── ferramentas ───────────── */
const fn = (name: string, description: string, parameters: Record<string, unknown>) => ({ type: "function", function: { name, description, parameters } });
const schemaOf = (z_: z.ZodType) => { const { $schema: _s, ...rest } = z.toJSONSchema(z_, { target: "draft-2020-12" }) as Record<string, unknown>; return rest; };

export const TOOLS = [
  fn("abrir_pagina", "Abre uma tela do Presence para a usuária.", { type: "object", properties: {
    pagina: { type: "string", enum: Object.keys(PAGES), description: "inicio, demandas, projetos, tarefas, calendario, planejamento, saude, treino, dieta, habitos, progresso, cerebro (segundo cérebro/Orion), organizar, analise, resumo, hoje" },
    projeto: { type: "string", description: "Só para demandas: nome do projeto, se ela pedir um específico." },
  }, required: ["pagina"] }),
  fn("registrar", "Cria registros reais no Presence (demanda, tarefa, compromisso, lembrete, rotina, anotação). Use os nomes EXATOS de projetos e polos do contexto. Datas em AAAA-MM-DD, horas em HH:MM.", schemaOf(z.object({
    itens: z.array(rascunhoSchema).min(1).max(8),
    permitir_duplicado: z.boolean().optional().describe("true só se a usuária pediu para criar mesmo já existindo algo igual."),
  }))),
  fn("resumo_do_dia", "Traz o que a usuária tem para um dia (compromissos, tarefas, atrasadas) e as demandas em andamento. A tela mostra o painel completo.", { type: "object", properties: { quando: { type: "string", description: "hoje, amanha ou AAAA-MM-DD. Padrão: hoje." } } }),
  fn("concluir_tarefa", "Marca uma tarefa pendente como feita, pelo título (aproximado).", { type: "object", properties: { titulo: { type: "string" } }, required: ["titulo"] }),
  fn("buscar_no_orion", "Pesquisa no segundo cérebro (anotações, demandas, tarefas, documentos, arquivos, roteiros, conversas) e devolve os trechos mais relevantes.", { type: "object", properties: { pergunta: { type: "string" } }, required: ["pergunta"] }),
  fn("documentar", "Guarda uma anotação no segundo cérebro (Orion) com a data do acontecimento.", { type: "object", properties: { texto: { type: "string" }, data: { type: "string", description: "AAAA-MM-DD; padrão hoje." } }, required: ["texto"] }),
  fn("encerrar_conversa", "Encerra a conversa por voz quando a usuária se despedir ou pedir para parar.", { type: "object", properties: {} }),
];

type Emit = (e: VoiceEvent) => void;
const parseArgs = (s: string): Record<string, unknown> => { try { const v = JSON.parse(s || "{}"); return v && typeof v === "object" ? (v as Record<string, unknown>) : {}; } catch { return {}; } };
const resolveDay = (q: unknown, today: string) => {
  const s = String(q ?? "hoje").toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(`${today}T12:00:00Z`);
  if (/amanh/.test(s)) d.setUTCDate(d.getUTCDate() + 1);
  else if (/ontem/.test(s)) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
const ptDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const hhmm = (t: string | null) => (t ? t.slice(0, 5) : undefined);

async function runTool(name: string, args: Record<string, unknown>, emit: Emit, ctx: Context): Promise<unknown> {
  switch (name) {
    case "abrir_pagina": {
      const base = PAGES[String(args["pagina"])];
      if (!base) return { ok: false, erro: "Página desconhecida." };
      let to = base;
      if (args["pagina"] === "demandas" && args["projeto"]) {
        try { to = `/demandas?projeto=${encodeURIComponent((await resolveProject(String(args["projeto"]))).id)}`; }
        catch (e) { return { ok: false, erro: e instanceof Error ? e.message : "Projeto não encontrado." }; }
      }
      emit({ t: "acao", a: { tipo: "navegar", para: to } });
      return { ok: true, aberta: String(args["pagina"]) };
    }

    case "encerrar_conversa": emit({ t: "acao", a: { tipo: "encerrar" } }); return { ok: true };

    case "registrar": {
      const raw = Array.isArray(args["itens"]) ? (args["itens"] as unknown[]) : [];
      const valid: Registro[] = [], problems: string[] = [];
      raw.forEach((r, i) => {
        const p = registroSchema.safeParse({ ...(r as object), ...(args["permitir_duplicado"] ? { permitir_duplicado: true } : {}) });
        if (p.success) valid.push(p.data); else problems.push(`item ${i + 1}: ${p.error.issues.map((x) => `${x.path.join(".") || "registro"}: ${x.message}`).join("; ")}`);
      });
      if (problems.length || !valid.length) return { ok: false, faltando: problems.length ? problems : ["nada para registrar"], dica: "Pergunte à usuária o que falta, em uma frase." };
      const prep = await prepare(valid);
      if (prep.problems.length) return { ok: false, faltando: prep.problems.slice(0, 5), dica: "Pergunte à usuária o que falta ou qual opção, em uma frase." };
      const active = prep.resolved.filter((r) => !r._ignorar);
      if (!active.length) return { ok: false, duplicado: prep.resolved.map((r) => r._duplicado).filter(Boolean), dica: "Já existe algo equivalente. Pergunte se ela quer criar mesmo assim (então chame registrar de novo com permitir_duplicado=true)." };
      const r = await commitRecords(prep.resolved, { client: "Presence · Voz", summary: prep.summary });
      if (r.status === "erro") return { ok: false, erro: r.failed.join(" | ") };
      const link = (tipo: string, pid?: string) => (tipo === "demanda" || tipo === "anotacao" ? `/demandas${pid ? `?projeto=${encodeURIComponent(pid)}` : ""}` : tipo === "compromisso" ? "/calendario" : "/tarefas");
      emit({ t: "painel", p: { titulo: "Registrado", secoes: [{ titulo: `${r.created.length} item(ns) criado(s)`, itens: r.created.map((c) => ({ rotulo: c.rotulo, detalhe: c.modulo, link: link(c.tipo, c.projeto_id) })) }] } });
      return { ok: true, criados: r.created.map((c) => ({ tipo: TIPO_LABEL[c.tipo as keyof typeof TIPO_LABEL] ?? c.tipo, titulo: c.rotulo })), ignorados_por_duplicidade: r.skipped, falhas: r.failed };
    }

    case "resumo_do_dia": {
      const day = resolveDay(args["quando"], ctx.today);
      const [tasks, dem, cats] = await Promise.all([
        supabase.from("tasks").select("id, title, due_date, due_time, end_time, place, done, kind, priority").or(`due_date.eq.${day}${day === ctx.today ? `,and(due_date.lt.${day},done.eq.false)` : ""}`).order("due_time", { nullsFirst: true }).limit(60),
        supabase.from("project_demands").select("code, title, status, priority, dossier_name, project_id").neq("status", "done").order("updated_at", { ascending: false }).limit(60),
        listCategories(),
      ]);
      void cats;
      const t = must(tasks) as { id: string; title: string; due_date: string; due_time: string | null; end_time: string | null; place: string | null; done: boolean; kind: string; priority: string }[];
      const d = must(dem) as { code: string; title: string; status: string; priority: string; dossier_name: string | null; project_id: string }[];
      const hoje = t.filter((x) => x.due_date === day), atrasadas = t.filter((x) => x.due_date < day && !x.done);
      const doing = d.filter((x) => x.status === "doing"), high = d.filter((x) => x.priority === "alta" && x.status !== "doing");
      const item = (x: (typeof t)[number]): PanelItem => ({ rotulo: x.title, detalhe: [hhmm(x.due_time) ? `${hhmm(x.due_time)}${x.end_time ? `–${hhmm(x.end_time)}` : ""}` : "", x.place ?? ""].filter(Boolean).join(" · ") || undefined, feita: x.done, link: x.kind === "evento" ? "/calendario" : "/tarefas" } as PanelItem);
      const secoes: Panel["secoes"] = [
        { titulo: "Agenda e tarefas", itens: hoje.map(item) },
        ...(atrasadas.length ? [{ titulo: "Atrasadas", itens: atrasadas.slice(0, 8).map((x) => ({ ...item(x), detalhe: `era para ${x.due_date.split("-").reverse().join("/")}` })) }] : []),
        ...(doing.length ? [{ titulo: "Demandas em andamento", itens: doing.slice(0, 8).map((x) => ({ rotulo: `${x.code} ${x.title}`, detalhe: x.dossier_name ?? undefined, link: `/demandas?projeto=${encodeURIComponent(x.project_id)}` })) }] : []),
        ...(high.length ? [{ titulo: "Prioridade alta (a fazer)", itens: high.slice(0, 6).map((x) => ({ rotulo: `${x.code} ${x.title}`, detalhe: x.dossier_name ?? undefined, link: `/demandas?projeto=${encodeURIComponent(x.project_id)}` })) }] : []),
      ].filter((s) => s.itens.length);
      emit({ t: "painel", p: { titulo: ptDate(day), secoes: secoes.length ? secoes : [{ titulo: "Agenda", itens: [{ rotulo: "Nada marcado para este dia." }] }] } });
      return {
        data: day, compromissos_e_tarefas: hoje.map((x) => ({ titulo: x.title, hora: hhmm(x.due_time), feita: x.done, tipo: x.kind })), atrasadas: atrasadas.length,
        demandas_em_andamento: doing.slice(0, 5).map((x) => `${x.code} ${x.title}`), demandas_alta_prioridade: high.slice(0, 5).map((x) => `${x.code} ${x.title}`), demandas_abertas_total: d.length,
      };
    }

    case "concluir_tarefa": {
      const want = normalize(String(args["titulo"] ?? ""));
      const rows = must(await supabase.from("tasks").select("id, title").eq("done", false).limit(300)) as { id: string; title: string }[];
      const hits = rows.filter((r) => { const n = normalize(r.title); return n.includes(want) || want.includes(n); });
      if (hits.length !== 1) return hits.length ? { ok: false, ambiguo: hits.slice(0, 4).map((h) => h.title), dica: "Pergunte qual delas." } : { ok: false, erro: "Não achei essa tarefa pendente." };
      must(await supabase.from("tasks").update({ done: true, done_at: new Date().toISOString() }).eq("id", hits[0]!.id).select("id"));
      return { ok: true, tarefa: hits[0]!.title };
    }

    case "buscar_no_orion": {
      const { loadCorpus } = await import("../orion.functions");
      const q = String(args["pergunta"] ?? "");
      const { docs, kws } = rank(await loadCorpus(), q, ctx.today, 8);
      if (!docs.length) return { ok: true, encontrados: 0, dica: "Diga que não encontrou nada sobre isso." };
      return { ok: true, encontrados: docs.length, trechos: docs.map((d) => ({ tipo: d.kind, data: d.date, onde: d.where, titulo: d.title, texto: snippet(d.text, kws, 360), arquivos: d.files?.map((f) => f.name) })) };
    }

    case "documentar": {
      const texto = String(args["texto"] ?? "").trim().slice(0, 6000);
      if (!texto) return { ok: false, erro: "Sem texto para guardar." };
      const names = (must(await supabase.from("dossiers").select("name")) as { name: string }[]).map((x) => x.name);
      const date = resolveDay(args["data"], ctx.today);
      must(await supabase.from("brain_entries").insert({ user_id: SINGLE_USER_ID, text: texto, entry_date: date, dossier_names: mentionedDossiers(texto, names) }).select("id"));
      emit({ t: "painel", p: { titulo: "Documentado no Orion", secoes: [{ titulo: date.split("-").reverse().join("/"), itens: [{ rotulo: texto.slice(0, 160), link: "/cerebro" }] }] } });
      return { ok: true };
    }
  }
  return { ok: false, erro: `Ferramenta desconhecida: ${name}` };
}

/* ───────────── conversa ───────────── */
export async function runAgent(history: Turn[], emit: Emit): Promise<void> {
  if (!process.env["OPENAI_API_KEY"]) { emit({ t: "erro", m: "A conversa por voz precisa da OPENAI_API_KEY no servidor." }); return; }
  const model = process.env["OPENAI_VOICE_MODEL"]?.trim() || process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
  const c = await voiceContext();
  const messages: Record<string, unknown>[] = [
    { role: "system", content: `${PERSONA(c.name)}\n\n${contextText(c.ctx)}` },
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
  ];
  try {
    for (let round = 0; round < 5; round++) {
      const { text, calls } = await streamChat({ model, messages, tools: TOOLS, tool_choice: "auto", max_completion_tokens: 700, reasoning_effort: "low" }, (d) => emit({ t: "texto", d }));
      if (!calls.length) break;
      messages.push({ role: "assistant", content: text || null, tool_calls: calls.map((k) => ({ id: k.id, type: "function", function: { name: k.name, arguments: k.args || "{}" } })) });
      for (const k of calls) {
        let out: unknown;
        try { out = await runTool(k.name, parseArgs(k.args), emit, c.ctx); } catch (e) { out = { ok: false, erro: e instanceof Error ? e.message : "erro" }; }
        messages.push({ role: "tool", tool_call_id: k.id, content: JSON.stringify(out).slice(0, 6000) });
      }
    }
    emit({ t: "fim" });
  } catch (e) {
    if (e instanceof OpenAIError) { console.error("[voz] OpenAI", e.status, e.code, e.message); emit({ t: "erro", m: explain(e, model) }); }
    else { console.error("[voz]", e); emit({ t: "erro", m: "Tive um problema para responder agora. Pode repetir?" }); }
  }
}
