/**
 * Central de entrada (tela inicial): funções de servidor. Interpretar (IA) → validar → distribuir (gravar) → desfazer.
 * Reutilizam a camada do MCP (mcp/*), que por sua vez reutiliza os serviços de cada módulo.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { MAX_FILES, MAX_TOTAL_CHARS, buildRecords, messagesByIndex, type Draft, type InboxFile, type InboxItem } from "./inbox";

const file = z.object({ name: z.string().min(1).max(200), mime: z.string().min(1).max(100), size: z.number().int().min(0), data: z.string().max(MAX_TOTAL_CHARS) });
const files = z.array(file).max(MAX_FILES).refine((l) => l.reduce((n, f) => n + f.data.length, 0) <= MAX_TOTAL_CHARS, "Arquivos grandes demais (máx. ~3 MB no total).");
const item = z.object({ key: z.string().max(40), registro: z.object({ tipo: z.string() }).passthrough(), anexos: z.array(z.string()).max(6).optional(), motivo: z.string().max(300).optional(), duplicadoOk: z.boolean().optional() });

export type CheckResult = { problems: string[]; warnings: string[]; perItem: { problems: string[]; warnings: string[]; duplicado?: string }[]; general: string[] };
export type InterpretResult =
  | { ok: true; source: "ia" | "manual"; resumo: string; itens: InboxItem[]; duvidas: string[]; pendencias: string[]; check: CheckResult }
  | { ok: false; error: string };
export type Created = { tipo: string; modulo: string; id: string; rotulo: string; projeto_id?: string; link: string };
export type DistributeResult =
  | { ok: true; operacaoId: string; status: "ok" | "parcial"; criados: Created[]; falhas: string[]; ignorados: number }
  | { ok: false; error: string; check?: CheckResult };
export type InboxContext = {
  today: string; weekday: string;
  projects: { id: string; nome: string; rotulo: { singular: string; plural: string }; dossies: { id: string; nome: string }[] }[];
  categories: { slug: string; nome: string }[];
};

const CLIENT = "Presence · Central de entrada";

async function loadContext() {
  const { listProjects, listDossiers, listCategories } = await import("./mcp/lookup");
  const { isoDay, weekdayPt } = await import("./mcp/records");
  const projects = await listProjects();
  const full = await Promise.all(projects.map(async (p) => ({ ...p, dossiers: await listDossiers(p.id) })));
  const now = new Date();
  return { today: isoDay(now), weekday: weekdayPt(now), projects: full, categories: await listCategories() };
}

const LABEL: Record<string, string> = { projeto_id: "projeto", dossie: "polo/dossiê", dossies: "polos/dossiês", titulo: "título", texto: "texto", data: "data", hora: "hora", inicio: "início", fim: "fim", escopo: "escopo", demanda: "demanda", nome: "nome", hora_: "hora" };
const issueText = (i: { path: PropertyKey[]; message: string }) => {
  const field = String(i.path[0] ?? "");
  const what = /received undefined/.test(i.message) ? "obrigatório" : i.message;
  return `${LABEL[field] ?? (field || "registro")}: ${what}`;
};

/** Valida os registros (formato completo + destino real + duplicidade). Nada é gravado. */
export async function checkRecords(records: unknown[], owner: number[], nItems: number) {
  const { registroSchema, TIPO_LABEL } = await import("./mcp/records");
  const { prepare } = await import("./mcp/plan");
  type Prepared = Awaited<ReturnType<typeof prepare>>;
  const lines: string[] = [];
  const valid: import("./mcp/records").Registro[] = [];
  records.forEach((r, i) => {
    const p = registroSchema.safeParse(r);
    if (p.success) valid.push(p.data);
    else lines.push(`#${i + 1} ${TIPO_LABEL[(r as Draft).tipo as keyof typeof TIPO_LABEL] ?? "Registro"}: ${p.error.issues.map(issueText).join("; ")}`);
  });
  let prep: Prepared | undefined;
  if (!lines.length) {
    prep = await prepare(valid);
    lines.push(...prep.problems);
  }
  const warn = prep?.warnings ?? [];
  const toItems = (ls: string[]) => {
    const { byIndex, general } = messagesByIndex(ls);
    const out: string[][] = Array.from({ length: nItems }, () => []);
    for (const [ri, msgs] of byIndex) { const it = owner[ri]; if (it !== undefined) out[it]!.push(...msgs); else general.push(...msgs); }
    return { out, general };
  };
  const p = toItems(lines), w = toItems(warn);
  const perItem = Array.from({ length: nItems }, (_, i) => ({ problems: p.out[i]!, warnings: w.out[i]! }));
  prep?.resolved.forEach((r, ri) => { const it = owner[ri]; if (it !== undefined && r._duplicado) (perItem[it] as { duplicado?: string }).duplicado = r._duplicado; });
  return { prep, check: { problems: lines, warnings: warn, perItem, general: [...p.general, ...w.general] } satisfies CheckResult };
}

const toItems = (list: InboxItem[]) => list.map((i) => ({ ...i }));

export const inboxContext = createServerFn({ method: "GET" }).handler(async (): Promise<InboxContext> => {
  const c = await loadContext();
  return {
    today: c.today, weekday: c.weekday,
    projects: c.projects.map((p) => ({ id: p.id, nome: p.nome, rotulo: p.rotulo_dossie, dossies: p.dossiers.map((d) => ({ id: d.id, nome: d.nome })) })),
    categories: c.categories.map((x) => ({ slug: x.slug, nome: x.nome })),
  };
});

export const interpretInbox = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ text: z.string().max(30000), files }).parse(d))
  .handler(async ({ data }): Promise<InterpretResult> => {
    if (!data.text.trim() && !data.files.length) return { ok: false, error: "Escreva, cole ou anexe algo para interpretar." };
    const empty: CheckResult = { problems: [], warnings: [], perItem: [], general: [] };

    if (!process.env["OPENAI_API_KEY"]) {
      return {
        ok: true, source: "manual", resumo: "", itens: [], pendencias: [], check: empty,
        duvidas: ["A interpretação por IA ainda não está ligada (falta OPENAI_API_KEY no servidor). Você pode criar os registros à mão com “Adicionar registro”."],
      };
    }

    const ctx = await loadContext();
    const { interpret, DEFAULT_MODEL } = await import("./mcp/interpret");
    const { makeCreate, OpenAIError, explain } = await import("./mcp/openai");
    const model = process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
    try {
      const res = await interpret(makeCreate(), { text: data.text, files: data.files, model }, ctx);
      if (!res.ok) return { ok: false, error: res.error };
      const { newKey } = await import("./inbox");
      const itens: InboxItem[] = res.output.itens.map((i) => ({
        key: newKey(), registro: i.registro as Draft, ...(i.anexos?.length ? { anexos: i.anexos.filter((n) => data.files.some((f) => f.name === n)) } : {}), ...(i.motivo ? { motivo: i.motivo } : {}),
      }));
      const { records, owner } = buildRecords(itens, data.files as InboxFile[], { placeholder: true });
      const { check } = await checkRecords(records, owner, itens.length);
      return { ok: true, source: "ia", resumo: res.output.resumo, itens, duvidas: res.output.duvidas, pendencias: res.output.pendencias, check };
    } catch (error) {
      if (error instanceof OpenAIError) { console.error("OpenAI error", error.status, error.code, error.message); return { ok: false, error: explain(error, model) }; }
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, error: "A IA demorou demais. Envie menos arquivos ou um texto menor." };
      throw error;
    }
  });

const itemsInput = z.array(item).max(30);

export const validateInbox = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ itens: itemsInput }).parse(d))
  .handler(async ({ data }): Promise<CheckResult> => {
    const itens = toItems(data.itens as InboxItem[]);
    const { records, owner } = buildRecords(itens, [], { placeholder: true });
    return (await checkRecords(records, owner, itens.length)).check;
  });

const LINK = (tipo: string, pid?: string) =>
  tipo === "demanda" || tipo === "anotacao" || tipo === "documentacao" || tipo === "evidencia" ? `/demandas${pid ? `?projeto=${encodeURIComponent(pid)}` : ""}`
  : tipo === "compromisso" ? "/planejamento" : tipo === "rotina" ? "/organizar" : "/tarefas";

export const distributeInbox = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ itens: itemsInput.min(1), files }).parse(d))
  .handler(async ({ data }): Promise<DistributeResult> => {
    const itens = toItems(data.itens as InboxItem[]);
    const { records, owner } = buildRecords(itens, data.files as InboxFile[]);
    const { prep, check } = await checkRecords(records, owner, itens.length);
    if (!prep || check.problems.length) return { ok: false, error: "Há registros com pendências. Corrija os cartões marcados.", check };
    if (!prep.resolved.some((r) => !r._ignorar)) return { ok: false, error: "Tudo que você enviou já existe (duplicado). Marque “criar mesmo assim” se quiser duplicar.", check };
    const { commitRecords } = await import("./mcp/commit");
    const r = await commitRecords(prep.resolved, { client: CLIENT, summary: prep.summary });
    if (r.status === "erro") return { ok: false, error: `Nada foi criado: ${r.failed.join(" | ")}`, check };
    return {
      ok: true, operacaoId: r.op.id, status: r.status, falhas: r.failed, ignorados: r.skipped,
      criados: r.created.map((c) => ({ tipo: c.tipo, modulo: c.modulo, id: c.id, rotulo: c.rotulo, ...(c.projeto_id ? { projeto_id: c.projeto_id } : {}), link: LINK(c.tipo, c.projeto_id) })),
    };
  });

export const undoInbox = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ operacaoId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; message: string }> => {
    const { getOperation, markUndone, logOperation } = await import("./mcp/ops");
    const { undoCreated } = await import("./mcp/execute");
    const op = await getOperation(data.operacaoId);
    if (!op || op.kind !== "criacao" || op.client !== CLIENT) return { ok: false, message: "Operação não encontrada." };
    if (op.status === "desfeita") return { ok: false, message: "Esta operação já foi desfeita." };
    const notes: string[] = [];
    for (const c of [...op.created].reverse()) {
      try { notes.push(await undoCreated(c)); } catch (e) { notes.push(`${c.rotulo}: falhou (${e instanceof Error ? e.message : "erro"})`); }
    }
    await markUndone(op.id);
    await logOperation({ kind: "desfazer", status: "desfeita", client: CLIENT, summary: `Desfez a operação ${op.id}`, created: [] });
    return { ok: true, message: `Desfeito: ${notes.join("; ")}` };
  });
