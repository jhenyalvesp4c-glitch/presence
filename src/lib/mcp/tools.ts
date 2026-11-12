/**
 * Ferramentas MCP do Presence. Leitura primeiro (para achar o destino certo), depois propor → confirmar.
 * Nada é gravado nos módulos sem `confirmar_registros`, com o código que o usuário aprovou.
 */
import { z } from "zod/v4";
import { demandBrief, allTasks, demandsOf, libraryOf, listCategories, listDossiers, listProjects, notesOf, pickDossier, resolveProject, taskBrief, NeedsChoice } from "./lookup";
import { prepare } from "./plan";
import { undoCreated } from "./execute";
import { commitRecords } from "./commit";
import { claimProposal, expireProposal, getOperation, getProposal, logOperation, markUndone, recentOperations, saveProposal } from "./ops";
import { TIPO_LABEL, hhmmNow, isoDay, normalize, registroSchema, weekdayPt, type Registro } from "./records";
import type { ToolDef, ToolResult, ToolSet } from "./protocol";

export const INSTRUCTIONS = `Você opera o Presence, o assistente pessoal e de projetos da usuária. Seu trabalho é ENCAMINHAR cada informação ao módulo certo, sem inventar destino.

FLUXO OBRIGATÓRIO
1. Interprete o conteúdo (texto, print, documento, transcrição) e identifique o(s) tipo(s) de informação.
2. CONSULTE antes de cadastrar: listar_projetos, listar_dossies, listar_demandas, listar_calendario, listar_tarefas, listar_lembretes, listar_anotacoes, consultar_documentacao ou buscar_registros. NUNCA escolha projeto, polo (dossiê) ou demanda por suposição: se houver dúvida, pergunte à usuária mostrando as opções reais.
3. Chame propor_registros com os registros estruturados. Ele valida tudo, procura duplicidades e devolve um resumo e um código de 4 dígitos. NADA é gravado ainda.
4. Mostre o resumo à usuária e peça: "Responda CONFIRMAR <código> para criar". Só depois da resposta dela, chame confirmar_registros com o código. Nunca confirme por conta própria.
5. Depois de confirmar, diga onde cada registro foi criado e o identificador. Para reverter, use desfazer_operacao (também só com autorização).

ONDE CADA INFORMAÇÃO VAI
- Pedido de trabalho a executar em projeto → "demanda" (escopo geral, polo ou multipolo; multipolo = uma demanda com andamento próprio por polo). Checklist, prazo e prioridade entram na própria demanda. Prints/arquivos/transcrições da demanda → "evidencia".
- Evento ou compromisso com data/hora (reunião, treinamento, consulta) → "compromisso" (pessoal ou profissional; profissional exige projeto). Pode apontar para uma demanda e criar lembrete vinculado.
- Algo para lembrar em certo momento → "lembrete" (com ou sem horário).
- Atividade pessoal ou recorrente que não é demanda de projeto → "tarefa" (categorias: rotina, comp, auto, saude, trab, casa, fin, pes) ou "rotina" (diária). Atividade pessoal NUNCA vira demanda de projeto.
- Registro, observação ou contexto a guardar → "anotacao" (por projeto, opcionalmente de um polo). Procedimento/orientação/conhecimento → "documentacao".
Uma mensagem pode gerar vários registros relacionados (ex.: demanda + compromisso + lembrete): use 'ref' e 'ref:<ref>' para ligá-los na mesma proposta.

REGRAS
- Datas: use AAAA-MM-DD e horas HH:MM, no fuso de São Paulo. Resolva "amanhã", "sexta" etc. a partir de presence_guia.
- Se já existir algo equivalente, o servidor avisa e ignora; só repita com permitir_duplicado se a usuária mandar.
- Os módulos Lembretes e Documentação têm limites (veja presence_guia). Seja honesto sobre o que foi ou não possível.`;

const text = (t: string, structured?: Record<string, unknown>): ToolResult => ({ content: [{ type: "text", text: t }], ...(structured ? { structuredContent: structured } : {}) });
const fail = (t: string): ToolResult => ({ content: [{ type: "text", text: t }], isError: true });
const json = (o: unknown) => JSON.stringify(o, null, 2);
const schemaOf = (s: z.ZodType) => { const { $schema: _s, ...rest } = z.toJSONSchema(s, { target: "draft-2020-12" }) as Record<string, unknown>; return rest; };
const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

function def<S extends z.ZodType>(d: { name: string; title: string; description: string; input: S; annotations: ToolDef["annotations"]; run: (a: z.infer<S>, ctx: { client: string }) => Promise<ToolResult> }): ToolDef {
  return {
    name: d.name, title: d.title, description: d.description, inputSchema: schemaOf(d.input), annotations: { title: d.title, ...d.annotations },
    run: async (raw, ctx) => {
      const parsed = d.input.safeParse(raw);
      if (!parsed.success) return fail(`Parâmetros inválidos: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ")}`);
      try { return await d.run(parsed.data, ctx); } catch (e) {
        if (e instanceof NeedsChoice) return fail(`${e.message} Opções: ${e.options.join("; ")}. Pergunte à usuária qual usar.`);
        throw e;
      }
    },
  };
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD");
const lim = z.number().int().min(1).max(200).optional().describe("Máximo de itens (padrão 50).");
const NONE = z.object({});

const guia = def({
  name: "presence_guia", title: "Guia do Presence", description: "Mostra a data/hora atual (São Paulo), os módulos do Presence, as regras de encaminhamento e os limites atuais. Chame no início para resolver datas relativas.",
  input: NONE, annotations: READ,
  run: async () => {
    const now = new Date();
    const info = { agora: { data: isoDay(now), hora: hhmmNow(now), dia_da_semana: weekdayPt(now), fuso: "America/Sao_Paulo" } };
    return text(`Agora: ${weekdayPt(now)}, ${isoDay(now)} ${hhmmNow(now)} (São Paulo).\n\n${INSTRUCTIONS}\n\nLIMITES ATUAIS\n- Lembretes: não há envio de notificação/push no Presence; o lembrete é um registro com data e hora em Minhas Tarefas (e no Planeje meu dia).\n- Documentação: a biblioteca de pastas ainda não é salva no banco; documentação vai para o banco de exemplos de Treinamentos do projeto.\n- Rotina: só existe rotina diária.\n- Prazo de demanda é guardado como dia/mês.`, info);
  },
});

const projetos = def({
  name: "listar_projetos", title: "Listar projetos", description: "Lista os projetos (id, nome, status, como cada projeto chama seus dossiês — ex.: Polos — e contagens). Use o id retornado nas demais ferramentas.",
  input: NONE, annotations: READ,
  run: async () => { const p = await listProjects(); return text(json(p), { projetos: p }); },
});

const dossies = def({
  name: "listar_dossies", title: "Listar dossiês/polos de um projeto", description: "Lista os dossiês (no P4C são os polos) de um projeto, com nome exato e descrição.",
  input: z.object({ projeto_id: z.string().min(1).describe("ID ou nome exato do projeto.") }), annotations: READ,
  run: async (a) => { const p = await resolveProject(a.projeto_id); const d = await listDossiers(p.id); return text(json({ projeto: p.nome, rotulo: p.rotulo_dossie, dossies: d }), { projeto: p, dossies: d }); },
});

const demandas = def({
  name: "listar_demandas", title: "Listar demandas", description: "Lista as demandas de um projeto (código, tipo geral/polo/multipolo, status, prioridade, prazo, polos e andamento de cada polo).",
  input: z.object({
    projeto_id: z.string().min(1), situacao: z.enum(["abertas", "todas", "todo", "doing", "done"]).optional().describe("abertas = a fazer + em andamento (padrão)."),
    dossie: z.string().optional().describe("Só demandas desse polo/dossiê (nome exato)."), busca: z.string().optional(), limite: lim,
  }), annotations: READ,
  run: async (a) => {
    const p = await resolveProject(a.projeto_id);
    let list = await demandsOf(p.id);
    const sit = a.situacao ?? "abertas";
    list = list.filter((d) => (sit === "todas" ? true : sit === "abertas" ? d.status !== "done" : d.status === sit));
    if (a.dossie) { const name = pickDossier(await listDossiers(p.id), a.dossie, p.rotulo_dossie.singular).nome; list = list.filter((d) => d.polo === name || d.polos?.some((x) => x.name === name)); }
    if (a.busca) list = list.filter((d) => normalize(`${d.id} ${d.title} ${d.desc}`).includes(normalize(a.busca!)));
    const out = list.slice(0, a.limite ?? 50).map(demandBrief);
    return text(json({ projeto: p.nome, total: list.length, demandas: out }), { projeto_id: p.id, total: list.length, demandas: out });
  },
});

const categorias = def({
  name: "listar_categorias_e_status", title: "Categorias e status", description: "Lista as categorias de tarefas, os status e prioridades válidos e os tipos de demanda.",
  input: NONE, annotations: READ,
  run: async () => {
    const o = {
      categorias_de_tarefa: await listCategories(), status_de_demanda: ["todo (a fazer)", "doing (em andamento)", "done (concluída)"], prioridades: ["alta", "media", "baixa"],
      tipos_de_demanda: ["geral", "polo (um dossiê)", "multipolo (vários, cada um com andamento próprio)"], tipos_de_registro_mcp: Object.values(TIPO_LABEL),
    };
    return text(json(o), o);
  },
});

const calendario = def({
  name: "listar_calendario", title: "Listar calendário", description: "Compromissos (e, se pedido, tarefas com data) entre duas datas. Sem datas, mostra de hoje em diante (30 dias).",
  input: z.object({ de: date.optional(), ate: date.optional(), projeto_id: z.string().optional(), incluir_tarefas: z.boolean().optional(), limite: lim }), annotations: READ,
  run: async (a) => {
    const cats = await listCategories(); const comp = cats.find((c) => c.slug === "comp")?.id;
    const de = a.de ?? isoDay(new Date()); const ate = a.ate ?? isoDay(new Date(Date.now() + 30 * 86400000));
    const pid = a.projeto_id ? (await resolveProject(a.projeto_id)).id : undefined;
    const rows = (await allTasks()).filter((t) => t.due_date && t.due_date >= de && t.due_date <= ate && t.kind === "tarefa" && (a.incluir_tarefas ? true : t.category_id === comp) && (!pid || t.project_id === pid));
    const out = rows.slice(0, a.limite ?? 50).map((t) => taskBrief(t, cats));
    return text(json({ de, ate, total: rows.length, itens: out }), { de, ate, total: rows.length, itens: out });
  },
});

const tarefas = def({
  name: "listar_tarefas", title: "Listar tarefas", description: "Minhas Tarefas (não inclui compromissos nem lembretes). Filtros por situação, categoria, datas e texto.",
  input: z.object({ situacao: z.enum(["pendentes", "concluidas", "todas"]).optional(), categoria: z.string().optional(), de: date.optional(), ate: date.optional(), busca: z.string().optional(), limite: lim }), annotations: READ,
  run: async (a) => {
    const cats = await listCategories(); const comp = cats.find((c) => c.slug === "comp")?.id;
    const cat = a.categoria ? cats.find((c) => c.slug === a.categoria) : undefined;
    if (a.categoria && !cat) return fail(`Categoria desconhecida: ${a.categoria}. Válidas: ${cats.map((c) => c.slug).join(", ")}`);
    const sit = a.situacao ?? "pendentes";
    const rows = (await allTasks()).filter((t) => t.kind === "tarefa" && t.category_id !== comp && (sit === "todas" || (sit === "pendentes" ? !t.done : t.done))
      && (!cat || t.category_id === cat.id) && (!a.de || (t.due_date ?? "") >= a.de) && (!a.ate || (t.due_date ?? "9999") <= a.ate) && (!a.busca || normalize(t.title).includes(normalize(a.busca))));
    const out = rows.slice(0, a.limite ?? 50).map((t) => taskBrief(t, cats));
    return text(json({ total: rows.length, tarefas: out }), { total: rows.length, tarefas: out });
  },
});

const lembretes = def({
  name: "listar_lembretes", title: "Listar lembretes", description: "Lembretes (registros com data/hora para recordar). Mostra vínculo com projeto, polo, demanda ou compromisso.",
  input: z.object({ situacao: z.enum(["pendentes", "todos"]).optional(), de: date.optional(), ate: date.optional(), projeto_id: z.string().optional(), limite: lim }), annotations: READ,
  run: async (a) => {
    const cats = await listCategories();
    const pid = a.projeto_id ? (await resolveProject(a.projeto_id)).id : undefined;
    const rows = (await allTasks()).filter((t) => t.kind === "lembrete" && (a.situacao === "todos" || !t.done) && (!a.de || (t.due_date ?? "") >= a.de) && (!a.ate || (t.due_date ?? "9999") <= a.ate) && (!pid || t.project_id === pid));
    const out = rows.slice(0, a.limite ?? 50).map((t) => taskBrief(t, cats));
    return text(json({ total: rows.length, lembretes: out }), { total: rows.length, lembretes: out });
  },
});

const anotacoes = def({
  name: "listar_anotacoes", title: "Listar anotações", description: "Anotações de um projeto, gerais ou de um polo/dossiê.",
  input: z.object({ projeto_id: z.string().min(1), dossie: z.string().optional(), busca: z.string().optional(), limite: lim }), annotations: READ,
  run: async (a) => {
    const p = await resolveProject(a.projeto_id); const ds = await listDossiers(p.id);
    const dos = a.dossie ? pickDossier(ds, a.dossie, p.rotulo_dossie.singular) : undefined;
    const rows = (await notesOf(p.id)).filter((n) => (!dos || n.dossier_id === dos.id) && (!a.busca || normalize(n.text).includes(normalize(a.busca))));
    const out = rows.slice(0, a.limite ?? 50).map((n) => ({ id: String(n.id), texto: n.text, data: n.date_label, dossie: ds.find((d) => d.id === n.dossier_id)?.nome }));
    return text(json({ projeto: p.nome, total: rows.length, anotacoes: out }), { projeto_id: p.id, total: rows.length, anotacoes: out });
  },
});

const documentacao = def({
  name: "consultar_documentacao", title: "Consultar documentação", description: "Roteiros e exemplos/procedimentos de Treinamentos (Documentação) de um projeto. A biblioteca de pastas ainda não é salva no banco.",
  input: z.object({ projeto_id: z.string().min(1), busca: z.string().optional(), limite: lim }), annotations: READ,
  run: async (a) => {
    const p = await resolveProject(a.projeto_id);
    const lib = await libraryOf(p.id);
    const scripts = (Array.isArray(lib?.scripts) ? lib!.scripts : []) as { id: string; title: string; audience: string; goal: string; blocks?: unknown[] }[];
    const examples = (Array.isArray(lib?.examples) ? lib!.examples : []) as { id: string; title: string; situation: string; text: string; cat: string }[];
    const q = a.busca ? normalize(a.busca) : "";
    const ex = examples.filter((e) => !q || normalize(`${e.title} ${e.situation} ${e.text} ${e.cat}`).includes(q)).slice(0, a.limite ?? 50);
    const sc = scripts.filter((s) => !q || normalize(`${s.title} ${s.audience} ${s.goal}`).includes(q)).map((s) => ({ id: s.id, titulo: s.title, publico: s.audience, objetivo: s.goal, blocos: s.blocks?.length ?? 0 }));
    return text(json({ projeto: p.nome, roteiros: sc, exemplos: ex.map((e) => ({ id: e.id, titulo: e.title, categoria: e.cat, situacao: e.situation, texto: e.text })) }), { projeto_id: p.id, roteiros: sc, exemplos: ex });
  },
});

const buscar = def({
  name: "buscar_registros", title: "Buscar em todos os módulos", description: "Procura um texto em demandas, tarefas, compromissos, lembretes, anotações e documentação. Use para achar registros relacionados e evitar duplicidade.",
  input: z.object({ texto: z.string().min(2).max(200), projeto_id: z.string().optional() }), annotations: READ,
  run: async (a) => {
    const q = normalize(a.texto);
    const projs = a.projeto_id ? [await resolveProject(a.projeto_id)] : await listProjects();
    const cats = await listCategories();
    const out: Record<string, unknown[]> = { demandas: [], calendario: [], lembretes: [], tarefas: [], anotacoes: [], documentacao: [] };
    for (const p of projs) {
      (await demandsOf(p.id)).filter((d) => normalize(`${d.id} ${d.title} ${d.desc}`).includes(q)).forEach((d) => out["demandas"]!.push({ projeto: p.nome, ...demandBrief(d) }));
      (await notesOf(p.id)).filter((n) => normalize(n.text).includes(q)).forEach((n) => out["anotacoes"]!.push({ projeto: p.nome, id: String(n.id), texto: n.text.slice(0, 200) }));
      const lib = await libraryOf(p.id);
      ((Array.isArray(lib?.examples) ? lib!.examples : []) as { id: string; title: string; text: string }[]).filter((e) => normalize(`${e.title} ${e.text}`).includes(q)).forEach((e) => out["documentacao"]!.push({ projeto: p.nome, id: e.id, titulo: e.title }));
    }
    const comp = cats.find((c) => c.slug === "comp")?.id;
    for (const t of (await allTasks()).filter((x) => normalize(`${x.title} ${x.description ?? ""}`).includes(q) && (!a.projeto_id || x.project_id === projs[0]!.id))) {
      (t.kind === "lembrete" ? out["lembretes"]! : t.category_id === comp ? out["calendario"]! : out["tarefas"]!).push(taskBrief(t, cats));
    }
    const total = Object.values(out).reduce((n, l) => n + l.length, 0);
    return text(json({ total, ...out }), { total, ...out });
  },
});

const propor = def({
  name: "propor_registros", title: "Propor registros (aguarda confirmação)",
  description: "Valida e prepara um ou mais registros para o Presence, procura duplicidades e devolve um RESUMO + código de confirmação. NÃO grava nos módulos. Mostre o resumo à usuária e só chame confirmar_registros depois que ela responder CONFIRMAR <código>. Se houver ambiguidade de projeto/polo/dossiê, a ferramenta devolve as opções reais: pergunte à usuária.",
  input: z.object({ registros: z.array(registroSchema).min(1).max(12).describe("Registros relacionados da mesma mensagem.") }), annotations: WRITE,
  run: async (a, ctx) => {
    const prep = await prepare(a.registros as Registro[]);
    if (prep.problems.length) return fail(`Não foi possível preparar a proposta. Corrija ou pergunte à usuária:\n- ${prep.problems.join("\n- ")}`);
    const live = prep.resolved.filter((r) => !r._ignorar).length;
    if (!live) return fail(`Tudo que você enviou já existe (duplicado):\n${prep.summary}\nSe a usuária quiser criar mesmo assim, reenvie com permitir_duplicado.`);
    const p = await saveProposal({ records: prep.resolved, summary: prep.summary, warnings: prep.warnings, client: ctx.client });
    const body = `PROPOSTA ${p.id}\n${prep.summary}\n${prep.warnings.length ? `\nAvisos:\n- ${prep.warnings.join("\n- ")}\n` : ""}\nNada foi gravado ainda. Peça à usuária para responder: CONFIRMAR ${p.code}\n(a proposta vale por 30 minutos)`;
    return text(body, { proposta_id: p.id, codigo_confirmacao: p.code, expira_em: p.expires_at, resumo: prep.summary, avisos: prep.warnings, registros: prep.resolved.length, a_criar: live });
  },
});

const confirmar = def({
  name: "confirmar_registros", title: "Confirmar e criar os registros",
  description: "Cria no Presence os registros de uma proposta aprovada. Exige o código de 4 dígitos que a usuária digitou ao responder CONFIRMAR e confirmacao_do_usuario=true. Nunca chame sem a resposta dela.",
  input: z.object({ proposta_id: z.string().uuid(), codigo_confirmacao: z.string().regex(/^[0-9]{4}$/), confirmacao_do_usuario: z.literal(true).describe("Só true se a usuária respondeu CONFIRMAR neste turno.") }), annotations: WRITE,
  run: async (a, ctx) => {
    const p = await getProposal(a.proposta_id);
    if (!p) return fail("Proposta não encontrada.");
    if (p.status !== "pendente") return fail(`Esta proposta já está ${p.status}. Crie uma nova com propor_registros.`);
    if (new Date(p.expires_at).getTime() < Date.now()) { await expireProposal(p.id); return fail("A proposta expirou (30 minutos). Crie uma nova com propor_registros."); }
    if (p.code !== a.codigo_confirmacao) return fail("Código de confirmação incorreto. Peça à usuária para repetir o código do resumo.");
    // Reconfere tudo contra o estado atual (algo pode ter mudado desde a proposta).
    const parsed = (p.records as unknown[]).map((r) => registroSchema.safeParse(r));
    if (parsed.some((x) => !x.success)) return fail("A proposta guardada está inválida. Crie uma nova.");
    const prep = await prepare(parsed.map((x) => (x as { data: Registro }).data));
    if (prep.problems.length) return fail(`O Presence mudou desde a proposta:\n- ${prep.problems.join("\n- ")}\nCrie uma nova proposta.`);
    if (!(await claimProposal(p.id))) return fail("Esta proposta acabou de ser confirmada por outra chamada.");

    const { op, created, failed, skipped: nSkipped, status } = await commitRecords(prep.resolved, { client: ctx.client, proposalId: p.id, summary: p.summary });
    const skipped = { length: nSkipped };
    const lines = created.map((c) => `✅ ${c.modulo}: ${c.rotulo} — id ${c.id}${c.projeto_id ? ` (projeto ${c.projeto_id})` : ""}`);
    const msg = `${status === "ok" ? "Registros criados" : status === "parcial" ? "Criação parcial" : "Nada foi criado"} (operação ${op.id}):\n${lines.join("\n")}${failed.length ? `\n\nFalhas:\n- ${failed.join("\n- ")}` : ""}${skipped.length ? `\n\nIgnorados por duplicidade: ${skipped.length}` : ""}\n\nPara desfazer: desfazer_operacao com operacao_id ${op.id}.`;
    const out = { operacao_id: op.id, status, criados: created.map(({ undo: _u, ...c }) => c), falhas: failed };
    return status === "erro" ? { ...fail(msg), structuredContent: out } : text(msg, out);
  },
});

const operacoes = def({
  name: "listar_operacoes", title: "Histórico de operações", description: "Histórico do que o MCP criou ou desfez (operação, data, itens e ids).",
  input: z.object({ limite: z.number().int().min(1).max(50).optional() }), annotations: READ,
  run: async (a) => {
    const ops = await recentOperations(a.limite ?? 15);
    const out = ops.map((o) => ({ id: o.id, quando: o.created_at, tipo: o.kind, status: o.status, cliente: o.client, itens: o.created.map((c) => `${c.modulo}: ${c.rotulo} (${c.id})`), erro: o.error ?? undefined }));
    return text(json(out), { operacoes: out });
  },
});

const desfazer = def({
  name: "desfazer_operacao", title: "Desfazer uma operação", description: "Remove os registros que uma operação criou (demandas, compromissos, lembretes, anotações…). Só chame se a usuária pedir e autorizar.",
  input: z.object({ operacao_id: z.string().uuid(), confirmacao_do_usuario: z.literal(true).describe("Só true se a usuária pediu para desfazer neste turno.") }),
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  run: async (a, ctx) => {
    const op = await getOperation(a.operacao_id);
    if (!op || op.kind !== "criacao") return fail("Operação de criação não encontrada.");
    if (op.status === "desfeita") return fail("Esta operação já foi desfeita.");
    const notes: string[] = [];
    for (const c of [...op.created].reverse()) {
      try { notes.push(await undoCreated(c)); } catch (e) { notes.push(`${c.rotulo}: falhou (${e instanceof Error ? e.message : "erro"})`); }
    }
    await markUndone(op.id);
    await logOperation({ kind: "desfazer", status: "desfeita", client: ctx.client, summary: `Desfez a operação ${op.id}`, created: [] });
    return text(`Operação ${op.id} desfeita:\n- ${notes.join("\n- ")}`, { operacao_id: op.id, desfeito: notes });
  },
});

export const toolSet: ToolSet = {
  instructions: INSTRUCTIONS,
  tools: [guia, projetos, dossies, demandas, categorias, calendario, tarefas, lembretes, anotacoes, documentacao, buscar, propor, confirmar, operacoes, desfazer],
};
