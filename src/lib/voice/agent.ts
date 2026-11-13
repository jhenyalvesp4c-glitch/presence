/**
 * Assistente de voz (estilo Jarvis): conversa curta e rápida + ferramentas que mexem no Presence de verdade
 * (abrir páginas, criar demandas/tarefas/compromissos, resumo do dia, pesquisar no Orion, documentar).
 * Só roda no servidor. A rota /api/voz repassa os eventos ao navegador em streaming.
 */
import { z } from "zod/v4";

import { must, supabase, ownerId } from "../data/db";
import { mentionedDossiers, normalize, periodOf, rank, snippet } from "../orion";
import { commitRecords } from "../mcp/commit";
import { contextText, DEFAULT_MODEL, type Context } from "../mcp/interpret";
import { listCategories, listDossiers, listProjects, resolveProject } from "../mcp/lookup";
import { OpenAIError, explain, streamChat } from "../mcp/openai";
import { prepare } from "../mcp/plan";
import { GREET_MARK, MEMORY_KINDS, briefingPrompt, greetingDirective, type MemoryKind } from "../briefing";
import { addMemory, forgetMemories, loadBriefingState, saveBriefing } from "../data/briefing";
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
  organizar: "/organizar", analise: "/analise", resumo: "/resumo",
};

/* ───────────── contexto (com cache curto, para responder rápido) ───────────── */
type Cached = { at: number; ctx: Context; name: string | null };
/** Um cache por pessoa (nunca misturar dados de contas diferentes). */
const cacheByOwner = new Map<string, Cached>();
async function voiceContext(): Promise<Cached> {
  const me = ownerId();
  const cache = cacheByOwner.get(me);
  if (cache && Date.now() - cache.at < 60_000) { const now = new Date(); return { ...cache, ctx: { ...cache.ctx, today: isoDay(now), weekday: weekdayPt(now) } }; }
  const [projects, categories, profile] = await Promise.all([
    listProjects(), listCategories(), supabase.from("profiles").select("display_name").eq("id", ownerId()).maybeSingle(),
  ]);
  const full = await Promise.all(projects.map(async (p) => ({ ...p, dossiers: await listDossiers(p.id) })));
  const now = new Date();
  const fresh: Cached = { at: Date.now(), ctx: { today: isoDay(now), weekday: weekdayPt(now), projects: full, categories }, name: (profile.data as { display_name: string | null } | null)?.display_name ?? null };
  if (cacheByOwner.size > 50) cacheByOwner.clear();
  cacheByOwner.set(me, fresh);
  return fresh;
}

const PERSONA = (name: string | null) => `Você é o Presence, o assistente pessoal${name ? ` de ${name}` : ""}, no estilo do Jarvis: elegante, calmo, muito eficiente e com um leve toque de humor sofisticado. Está conversando POR VOZ.
Regras de fala:
- Responda em português do Brasil, em UMA ou DUAS frases curtas. Nada de listas, markdown, emojis, URLs ou códigos; diga datas e horas do jeito que se fala ("amanhã às três da tarde").
- Faça o pedido na hora usando as ferramentas e depois confirme em uma frase ("Pronto, criei a demanda…"). Não peça permissão para o que foi pedido com clareza.
- Se faltar um dado essencial, faça UMA pergunta curta. Se algo for ambíguo (projeto, polo), pergunte qual, citando as opções.
- Para "o que tenho hoje", "me mostra tudo", "minha agenda/pendências" (ou amanhã) use SOMENTE resumo_do_dia, sem abrir nenhuma página (a tela de Saúde "Hoje" é outra coisa: só abra saude se ela pedir saúde). O painel mostra tudo: compromissos, lembretes, tarefas, atrasadas e demandas. Fale só os destaques em até três frases, citando as quantidades.
- Perguntas sobre o que ela FEZ, CRIOU, CONCLUIU ou DOCUMENTOU (ontem, esta semana, mês passado, quantas demandas, quais tarefas, o que anotei) → use consultar_registros: ele traz as listas e contagens reais. Pergunte-se sempre se precisa dele antes de dizer que não sabe.
- Perguntas sobre o CONTEÚDO de algo (o que disse um documento, detalhes de uma demanda, o que foi combinado, arquivos) → use buscar_no_orion. Se uma ferramenta não bastar, tente a outra antes de responder que não encontrou.
- Você tem acesso a tudo: demandas (criadas e concluídas), tarefas, compromissos, lembretes, anotações do segundo cérebro (Orion), documentação e conversas. Nunca diga que não tem acesso. Para guardar algo que a pessoa contou, use documentar.
- Você pode fazer por voz tudo o que ela faz na tela. Criar: use registrar (demanda, tarefa, lembrete, compromisso, anotação). Mudar o que já existe: atualizar_demanda (em andamento, concluída, a fazer, editar título/prazo/prioridade/descrição, observação, excluir) e gerenciar_tarefa (concluir, reabrir, editar ou excluir tarefa, lembrete ou compromisso). Faça na hora, sem pedir permissão, e confirme em uma frase curta. Se achar mais de um item parecido, pergunte qual citando as opções. Ela pode falar "conclui" ou "terminei": isso é concluir, nunca excluir.
- EXCLUIR sempre pede confirmação: chame a ferramenta com excluir/acao=excluir, ela devolve precisa_confirmar; pergunte "Quer mesmo excluir …?" e só repita com confirmado=true se ela disser sim.
- Nunca diga que não consegue concluir, editar ou excluir algo: use as ferramentas. Se falhar, diga o motivo real.
- Se ela disser como quer ser chamada, como prefere que você fale ou como começar a conversa, use ajustar_perfil. Quando ela contar algo duradouro sobre si ou pedir "lembra que…", use lembrar; "esquece que…", use esquecer.
- Para abrir telas use abrir_pagina. Quando a pessoa se despedir ou pedir para parar, use encerrar_conversa.
- Nunca invente dados: se a ferramenta não trouxer, diga que não encontrou.
${name ? `Trate a pessoa pelo nome de vez em quando, sem exagero.` : ""}`;

/* ───────────── ferramentas ───────────── */
const fn = (name: string, description: string, parameters: Record<string, unknown>) => ({ type: "function", function: { name, description, parameters } });
const schemaOf = (z_: z.ZodType) => { const { $schema: _s, ...rest } = z.toJSONSchema(z_, { target: "draft-2020-12" }) as Record<string, unknown>; return rest; };

export const TOOLS = [
  fn("abrir_pagina", "Abre uma tela do Presence para a pessoa.", { type: "object", properties: {
    pagina: { type: "string", enum: Object.keys(PAGES), description: "inicio, demandas, projetos, tarefas, calendario, planejamento, saude, treino, dieta, habitos, progresso, cerebro (segundo cérebro/Orion), organizar, analise, resumo" },
    projeto: { type: "string", description: "Só para demandas: nome do projeto, se ela pedir um específico." },
  }, required: ["pagina"] }),
  fn("registrar", "Cria registros reais no Presence (demanda, tarefa, compromisso, lembrete, rotina, anotação). Use os nomes EXATOS de projetos e polos do contexto. Datas em AAAA-MM-DD, horas em HH:MM.", schemaOf(z.object({
    itens: z.array(rascunhoSchema).min(1).max(8),
    permitir_duplicado: z.boolean().optional().describe("true só se a pessoa pediu para criar mesmo já existindo algo igual."),
  }))),
  fn("resumo_do_dia", "Traz o que a pessoa tem para um dia (compromissos, tarefas, atrasadas) e as demandas em andamento. A tela mostra o painel completo.", { type: "object", properties: { quando: { type: "string", description: "hoje, amanha ou AAAA-MM-DD. Padrão: hoje." } } }),
  fn("atualizar_demanda", "Muda, edita ou exclui uma demanda que já existe: coloca em andamento, conclui, reabre, troca título, descrição, prazo ou prioridade, adiciona observação, conclui só um dossiê (demanda para vários) ou exclui. Identifique pelo código (ex.: P049, G042) ou por palavras do título.", { type: "object", properties: {
    demanda: { type: "string", description: "Código (P049, #G042) ou palavras do título." },
    status: { type: "string", enum: ["todo", "doing", "done"], description: "todo = a fazer/reabrir, doing = em andamento, done = concluída." },
    dossie: { type: "string", description: "Só para demanda de vários dossiês: muda o status apenas desse dossiê." },
    titulo: { type: "string" }, descricao: { type: "string" }, prioridade: { type: "string", enum: ["alta", "media", "baixa"] },
    prazo: { type: "string", description: "AAAA-MM-DD ou dd/mm." }, nota: { type: "string", description: "Observação a acrescentar." },
    excluir: { type: "boolean", description: "true para excluir a demanda (pede confirmação)." },
    confirmado: { type: "boolean", description: "true só depois de ela confirmar a exclusão." },
  }, required: ["demanda"] }),
  fn("gerenciar_tarefa", "Conclui, reabre, edita ou exclui uma tarefa, lembrete ou compromisso que já existe (para criar um novo use registrar). Identifique pelo título aproximado.", { type: "object", properties: {
    item: { type: "string", description: "Título (aproximado) do item." },
    tipo: { type: "string", enum: ["tarefa", "lembrete", "compromisso", "qualquer"], description: "Padrão: qualquer." },
    acao: { type: "string", enum: ["concluir", "reabrir", "editar", "excluir"] },
    novo_titulo: { type: "string" }, nova_data: { type: "string", description: "AAAA-MM-DD" }, nova_hora: { type: "string", description: "HH:MM" },
    prioridade: { type: "string", enum: ["alta", "media", "baixa"] }, local: { type: "string" },
    confirmado: { type: "boolean", description: "true só depois de ela confirmar a exclusão." },
  }, required: ["item", "acao"] }),
  fn("buscar_no_orion", "Pesquisa no segundo cérebro (anotações, demandas, tarefas, documentos, arquivos, roteiros, conversas) e devolve os trechos mais relevantes.", { type: "object", properties: { pergunta: { type: "string" } }, required: ["pergunta"] }),
  fn("consultar_registros", "Lista e conta, com datas, o que a pessoa criou, concluiu ou documentou: demandas, tarefas/compromissos/lembretes e anotações do segundo cérebro. Use para 'o que fiz ontem', 'quais demandas concluí esta semana', 'quantas tarefas criei', 'o que documentei'. A tela mostra o painel completo.", { type: "object", properties: {
    assunto: { type: "string", enum: ["tudo", "demandas", "tarefas", "anotacoes"], description: "Padrão: tudo." },
    situacao: { type: "string", enum: ["concluidas", "criadas", "abertas", "todas"], description: "concluidas = finalizadas; criadas = registradas no período; abertas = ainda pendentes. Padrão: todas." },
    periodo: { type: "string", description: "hoje, ontem, anteontem, esta semana, semana passada, este mes, mes passado. Vazio = sem limite de data." },
    de: { type: "string", description: "AAAA-MM-DD (opcional, no lugar de periodo)." }, ate: { type: "string", description: "AAAA-MM-DD (opcional)." },
    texto: { type: "string", description: "Filtra por palavra no título/projeto/polo (opcional)." },
  } }),
  fn("documentar", "Guarda uma anotação no segundo cérebro (Orion) com a data do acontecimento.", { type: "object", properties: { texto: { type: "string" }, data: { type: "string", description: "AAAA-MM-DD; padrão hoje." } }, required: ["texto"] }),
  fn("lembrar", "Guarda na memória algo DURADOURO sobre a pessoa (preferência, rotina, regra, fato do trabalho, pessoa importante) para lembrar nas próximas conversas. Não use para pedidos do momento.", { type: "object", properties: {
    texto: { type: "string", description: "A informação, em uma frase clara, na 3ª pessoa. Ex.: Prefere resumos curtos pela manhã." },
    tipo: { type: "string", enum: MEMORY_KINDS, description: "aprendizado, preferencia, rotina, pessoa ou regra." },
  }, required: ["texto"] }),
  fn("esquecer", "Apaga da memória o que combina com um trecho, quando a pessoa pedir para você esquecer algo.", { type: "object", properties: { sobre: { type: "string", description: "Palavra ou trecho do que deve ser esquecido." } }, required: ["sobre"] }),
  fn("ajustar_perfil", "Muda como a pessoa quer ser chamada, o jeito de você conversar ou como começar a conversa (quando ela pedir).", { type: "object", properties: {
    nome: { type: "string", description: "Como chamá-la." }, jeito: { type: "string", description: "Tom e jeito de conversar, em uma frase." },
    saudacao: { type: "string", enum: ["esperar", "saudacao", "saudacao_hoje", "saudacao_pergunta"], description: "Como iniciar a conversa." },
  } }),
  fn("encerrar_conversa", "Encerra a conversa por voz quando a pessoa se despedir ou pedir para parar.", { type: "object", properties: {} }),
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

export async function runTool(name: string, args: Record<string, unknown>, emit: Emit, ctx: Context): Promise<unknown> {
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
      if (problems.length || !valid.length) return { ok: false, faltando: problems.length ? problems : ["nada para registrar"], dica: "Pergunte à pessoa o que falta, em uma frase." };
      const prep = await prepare(valid);
      if (prep.problems.length) return { ok: false, faltando: prep.problems.slice(0, 5), dica: "Pergunte à pessoa o que falta ou qual opção, em uma frase." };
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
      const todo = d.filter((x) => x.status !== "doing" && x.priority !== "alta");
      const item = (x: (typeof t)[number]): PanelItem => ({ rotulo: x.title, detalhe: [hhmm(x.due_time) ? `${hhmm(x.due_time)}${x.end_time ? `–${hhmm(x.end_time)}` : ""}` : "", x.place ?? ""].filter(Boolean).join(" · ") || undefined, feita: x.done, link: x.kind === "evento" ? "/calendario" : "/tarefas" } as PanelItem);
      const dem_ = (x: (typeof d)[number]): PanelItem => ({ rotulo: `${x.code} ${x.title}`, detalhe: x.dossier_name ?? undefined, link: `/demandas?projeto=${encodeURIComponent(x.project_id)}` });
      const compromissos = hoje.filter((x) => x.kind === "evento"), lembretes = hoje.filter((x) => x.kind === "lembrete"), tarefas = hoje.filter((x) => x.kind !== "evento" && x.kind !== "lembrete");
      const secoes: Panel["secoes"] = [
        { titulo: "Compromissos", itens: compromissos.map(item) },
        { titulo: "Lembretes", itens: lembretes.map(item) },
        { titulo: "Tarefas", itens: tarefas.map(item) },
        ...(atrasadas.length ? [{ titulo: "Atrasadas", itens: atrasadas.slice(0, 20).map((x) => ({ ...item(x), detalhe: `era para ${x.due_date.split("-").reverse().join("/")}` })) }] : []),
        { titulo: "Demandas em andamento", itens: doing.slice(0, 20).map(dem_) },
        { titulo: "Demandas de prioridade alta", itens: high.slice(0, 20).map(dem_) },
        { titulo: "Demandas a fazer", itens: todo.slice(0, 15).map(dem_) },
      ].filter((s) => s.itens.length);
      emit({ t: "painel", p: { titulo: ptDate(day), secoes: secoes.length ? secoes : [{ titulo: "Agenda", itens: [{ rotulo: "Nada marcado para este dia." }] }] } });
      return {
        data: day, compromissos: compromissos.map((x) => ({ titulo: x.title, hora: hhmm(x.due_time) })), lembretes: lembretes.map((x) => ({ titulo: x.title, hora: hhmm(x.due_time) })), tarefas: tarefas.map((x) => ({ titulo: x.title, hora: hhmm(x.due_time), feita: x.done })), atrasadas: atrasadas.length, demandas_a_fazer: todo.length,
        demandas_em_andamento: doing.slice(0, 5).map((x) => `${x.code} ${x.title}`), demandas_alta_prioridade: high.slice(0, 5).map((x) => `${x.code} ${x.title}`), demandas_abertas_total: d.length,
      };
    }

    case "atualizar_demanda": {
      const { changeDemand } = await import("./manage");
      const r = await changeDemand({
        demanda: String(args["demanda"] ?? ""), status: ["todo", "doing", "done"].includes(String(args["status"])) ? (args["status"] as "todo" | "doing" | "done") : undefined,
        titulo: args["titulo"] as string | undefined, descricao: args["descricao"] as string | undefined, prioridade: args["prioridade"] as "alta" | "media" | "baixa" | undefined,
        prazo: args["prazo"] as string | undefined, nota: args["nota"] as string | undefined, dossie: args["dossie"] as string | undefined,
        excluir: args["excluir"] === true, confirmado: args["confirmado"] === true,
      }).catch((e): Record<string, unknown> => ({ ok: false, erro: e instanceof Error ? e.message : "Não consegui alterar a demanda." }));
      if (r["ok"]) emit({ t: "painel", p: { titulo: r["acao"] === "excluida" ? "Demanda excluída" : "Demanda atualizada", secoes: [{ titulo: String(r["acao"] === "excluida" ? "Excluída" : (r["status_agora"] ?? "Atualizada")), itens: [{ rotulo: String(r["demanda"]), detalhe: Array.isArray(r["mudou"]) ? (r["mudou"] as string[]).join(" · ") : undefined, link: r["acao"] === "excluida" ? undefined : "/demandas" }] }] } });
      return r;
    }

    case "gerenciar_tarefa": {
      const { changeTask } = await import("./manage");
      const r = await changeTask({
        item: String(args["item"] ?? ""), tipo: (args["tipo"] as "tarefa" | "lembrete" | "compromisso" | "qualquer" | undefined), acao: String(args["acao"]) as "concluir" | "reabrir" | "editar" | "excluir",
        novo_titulo: args["novo_titulo"] as string | undefined, nova_data: args["nova_data"] as string | undefined, nova_hora: args["nova_hora"] as string | undefined,
        prioridade: args["prioridade"] as "alta" | "media" | "baixa" | undefined, local: args["local"] as string | undefined, confirmado: args["confirmado"] === true,
      }).catch((e): Record<string, unknown> => ({ ok: false, erro: e instanceof Error ? e.message : "Não consegui alterar o item." }));
      return r;
    }

    case "buscar_no_orion": {
      const { loadCorpus } = await import("../orion.functions");
      const q = String(args["pergunta"] ?? "");
      const { docs, kws } = rank(await loadCorpus(), q, ctx.today, 8);
      if (!docs.length) return { ok: true, encontrados: 0, dica: "Diga que não encontrou nada sobre isso." };
      return { ok: true, encontrados: docs.length, trechos: docs.map((d) => ({ tipo: d.kind, data: d.date, onde: d.where, titulo: d.title, texto: snippet(d.text, kws, 360), arquivos: d.files?.map((f) => f.name) })) };
    }

    case "consultar_registros": {
      const assunto = String(args["assunto"] ?? "tudo"), sit = String(args["situacao"] ?? "todas");
      const per = args["de"] || args["ate"]
        ? { from: String(args["de"] ?? "0000-01-01"), to: String(args["ate"] ?? args["de"] ?? "9999-12-31"), label: `${args["de"] ?? ""} a ${args["ate"] ?? ""}` }
        : periodOf(String(args["periodo"] ?? ""), ctx.today);
      const inP = (d?: string | null) => !per || (!!d && d >= per.from && d <= per.to);
      const dayBR = (ts?: string | null) => (ts ? new Date(ts).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }) : undefined);
      const f = normalize(String(args["texto"] ?? ""));
      const match = (...parts: (string | null | undefined)[]) => !f || normalize(parts.filter(Boolean).join(" ")).includes(f);
      const br = (iso?: string) => (iso ? iso.split("-").reverse().join("/") : "");
      const out: Record<string, unknown> = { periodo: per ? per.label : "todo o histórico" };
      const secoes: Panel["secoes"] = [];

      if (assunto === "tudo" || assunto === "demandas") {
        const [dem, projs] = await Promise.all([
          supabase.from("project_demands").select("code, title, status, priority, dossier_name, project_id, created_at, updated_at").order("updated_at", { ascending: false }).limit(1000),
          supabase.from("projects").select("id, name"),
        ]);
        const pn = new Map((must(projs) as { id: string; name: string }[]).map((x) => [x.id, x.name]));
        const all = must(dem) as { code: string; title: string; status: string; priority: string; dossier_name: string | null; project_id: string; created_at: string; updated_at: string }[];
        const pick = (r: (typeof all)[number]) => {
          const ok = sit === "concluidas" ? r.status === "done" && inP(dayBR(r.updated_at))
            : sit === "criadas" ? inP(dayBR(r.created_at))
            : sit === "abertas" ? r.status !== "done" && (!per || inP(dayBR(r.created_at)) || inP(dayBR(r.updated_at)))
            : inP(dayBR(r.created_at)) || inP(dayBR(r.updated_at));
          return ok && match(r.title, r.code, r.dossier_name, pn.get(r.project_id));
        };
        const hit = all.filter(pick);
        const ST: Record<string, string> = { todo: "a fazer", doing: "em andamento", done: "concluída" };
        out["demandas"] = { total: hit.length, concluidas: hit.filter((r) => r.status === "done").length, em_andamento: hit.filter((r) => r.status === "doing").length, a_fazer: hit.filter((r) => r.status === "todo").length,
          itens: hit.slice(0, 25).map((r) => ({ codigo: r.code, titulo: r.title, projeto: pn.get(r.project_id), polo: r.dossier_name ?? undefined, situacao: ST[r.status], criada_em: dayBR(r.created_at), atualizada_em: dayBR(r.updated_at) })) };
        if (hit.length) secoes.push({ titulo: `Demandas (${hit.length})`, itens: hit.slice(0, 25).map((r) => ({ rotulo: `${r.code} ${r.title}`, detalhe: [ST[r.status], br(dayBR(r.status === "done" ? r.updated_at : r.created_at)), r.dossier_name].filter(Boolean).join(" · "), feita: r.status === "done", link: `/demandas?projeto=${encodeURIComponent(r.project_id)}` })) });
      }

      if (assunto === "tudo" || assunto === "tarefas") {
        const tk = must(await supabase.from("tasks").select("title, due_date, due_time, done, done_at, kind, created_at").order("created_at", { ascending: false }).limit(1500)) as { title: string; due_date: string | null; due_time: string | null; done: boolean; done_at: string | null; kind: string; created_at: string }[];
        const pick = (r: (typeof tk)[number]) => {
          const ok = sit === "concluidas" ? r.done && inP(dayBR(r.done_at) ?? r.due_date)
            : sit === "criadas" ? inP(dayBR(r.created_at))
            : sit === "abertas" ? !r.done && (!per || inP(r.due_date) || inP(dayBR(r.created_at)))
            : inP(dayBR(r.created_at)) || inP(r.due_date) || inP(dayBR(r.done_at));
          return ok && match(r.title);
        };
        const hit = tk.filter(pick);
        const K = (k: string) => (k === "evento" ? "compromisso" : k === "lembrete" ? "lembrete" : "tarefa");
        out["tarefas"] = { total: hit.length, concluidas: hit.filter((r) => r.done).length, pendentes: hit.filter((r) => !r.done).length,
          itens: hit.slice(0, 30).map((r) => ({ titulo: r.title, tipo: K(r.kind), feita: r.done, para: r.due_date ?? undefined, concluida_em: dayBR(r.done_at), criada_em: dayBR(r.created_at) })) };
        if (hit.length) secoes.push({ titulo: `Tarefas, compromissos e lembretes (${hit.length})`, itens: hit.slice(0, 30).map((r) => ({ rotulo: r.title, detalhe: [K(r.kind), r.done ? "feita" : "pendente", br(r.due_date ?? undefined), hhmm(r.due_time)].filter(Boolean).join(" · "), feita: r.done, link: r.kind === "evento" ? "/calendario" : "/tarefas" })) });
      }

      if (assunto === "tudo" || assunto === "anotacoes") {
        const en = must(await supabase.from("brain_entries").select("title, text, entry_date, source").order("entry_date", { ascending: false }).limit(800)) as { title: string | null; text: string; entry_date: string; source: string }[];
        const hit = en.filter((r) => inP(r.entry_date) && match(r.title, r.text));
        out["anotacoes_no_orion"] = { total: hit.length, itens: hit.slice(0, 20).map((r) => ({ data: r.entry_date, titulo: r.title || undefined, texto: r.text.replace(/\s+/g, " ").slice(0, 220), origem: r.source === "documentacao" ? "documentação" : "anotação" })) };
        if (hit.length) secoes.push({ titulo: `Anotações no Orion (${hit.length})`, itens: hit.slice(0, 20).map((r) => ({ rotulo: (r.title || r.text).replace(/\s+/g, " ").slice(0, 120), detalhe: br(r.entry_date), link: "/cerebro" })) });
      }

      emit({ t: "painel", p: { titulo: per ? `Registros · ${per.label}` : "Registros", secoes: secoes.length ? secoes : [{ titulo: "Resultado", itens: [{ rotulo: "Nada encontrado nesse período." }] }] } });
      return { ok: true, ...out, dica: "Responda com as contagens e os destaques; se houver muitos, cite os principais. Cheque o campo 'periodo'." };
    }

    case "lembrar": {
      const kind = MEMORY_KINDS.includes(String(args["tipo"]) as MemoryKind) ? (String(args["tipo"]) as MemoryKind) : "aprendizado";
      const r = await addMemory(String(args["texto"] ?? ""), kind, "conversa");
      return r.ok ? { ok: true, guardado: true } : { ok: true, guardado: false, motivo: r.motivo === "ja_sei" ? "Já sabia disso." : r.motivo === "indisponivel" ? "A memória ainda não está ativada." : "Não guardei." };
    }

    case "esquecer": {
      const n = await forgetMemories(String(args["sobre"] ?? ""));
      return n ? { ok: true, apagados: n } : { ok: false, erro: "Não encontrei nada na memória sobre isso." };
    }

    case "ajustar_perfil": {
      const st = await loadBriefingState();
      if (!st.available) return { ok: false, erro: "O briefing ainda não está ativado." };
      const cur = st.briefing ?? { call_name: "", tone: "", greeting: "esperar" as const, greeting_note: "", work: "", biggest_demand: "", routine: "", goals: "", preferences: "", completed_at: null };
      const g = String(args["saudacao"] ?? "");
      const next = { ...cur,
        ...(args["nome"] ? { call_name: String(args["nome"]) } : {}), ...(args["jeito"] ? { tone: String(args["jeito"]) } : {}),
        ...(["esperar", "saudacao", "saudacao_hoje", "saudacao_pergunta"].includes(g) ? { greeting: g as typeof cur.greeting } : {}) };
      await saveBriefing(next, false);
      cacheByOwner.delete(ownerId());
      return { ok: true };
    }

    case "documentar": {
      const texto = String(args["texto"] ?? "").trim().slice(0, 6000);
      if (!texto) return { ok: false, erro: "Sem texto para guardar." };
      const names = (must(await supabase.from("dossiers").select("name")) as { name: string }[]).map((x) => x.name);
      const date = resolveDay(args["data"], ctx.today);
      must(await supabase.from("brain_entries").insert({ user_id: ownerId(), text: texto, entry_date: date, dossier_names: mentionedDossiers(texto, names) }).select("id"));
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
  const st = await loadBriefingState().catch(() => ({ available: false, briefing: null, memories: [] }));
  const starting = history.at(-1)?.role === "user" && history.at(-1)?.content === GREET_MARK;
  const directive = starting ? greetingDirective(st.briefing) : "";
  if (starting && !directive) { emit({ t: "fim" }); return; } // quer esperar: não fala nada
  const known = briefingPrompt(st.briefing, st.memories);
  const messages: Record<string, unknown>[] = [
    { role: "system", content: `${PERSONA(st.briefing?.call_name || c.name)}${known ? `\n\n${known}` : ""}${directive ? `\n\nAGORA: ${directive}` : ""}\n\n${contextText(c.ctx)}` },
    ...history.slice(-12).map((m) => ({ role: m.role, content: m.content === GREET_MARK ? "(a conversa por voz acabou de começar)" : m.content.slice(0, 2000) })),
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
