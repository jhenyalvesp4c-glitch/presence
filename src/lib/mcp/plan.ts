/**
 * Prepara uma proposta: valida cada registro contra o Presence (projeto, polo/dossiê, demanda, categoria),
 * procura registros equivalentes (duplicidade) e monta o resumo que o usuário vai aprovar.
 * Nada é gravado nos módulos aqui.
 */
import { must, supabase } from "../data/db";
import { similar, refProblems, structuralProblems, isCode, isRef, deadlineLabel, TIPO_LABEL, type Registro, type Tipo } from "./records";
import {
  NeedsChoice, allTasks, demandsOf, listCategories, listDossiers, notesOf, libraryOf, pickDossier, resolveProject,
  type CategoryInfo, type DossierInfo, type ProjectInfo, type TaskRow,
} from "./lookup";

export type Ref = { id: string; name: string };
/** O registro como será gravado: nomes já trocados por ids reais. */
export type Resolved = Registro & {
  _projeto?: { id: string; nome: string }; _dossie?: Ref; _dossies?: Ref[];
  _duplicado?: string; _ignorar?: boolean;
};
export type Prepared = { resolved: Resolved[]; problems: string[]; warnings: string[]; summary: string };

const choice = (e: NeedsChoice) => `${e.message} Opções: ${e.options.join("; ")}.`;

export async function prepare(registros: Registro[]): Promise<Prepared> {
  const problems: string[] = [];
  const warnings: string[] = [];
  registros.forEach((r, i) => structuralProblems(r).forEach((p) => problems.push(`#${i + 1} ${TIPO_LABEL[r.tipo]}: ${p}`)));
  refProblems(registros).forEach((p) => problems.push(p));
  if (problems.length) return { resolved: [], problems, warnings, summary: "" };

  const cats = await listCategories();
  const projects = new Map<string, ProjectInfo>();
  const dossiers = new Map<string, DossierInfo[]>();
  const getProject = async (id: string) => {
    if (!projects.has(id)) projects.set(id, await resolveProject(id));
    return projects.get(id)!;
  };
  const getDossiers = async (pid: string) => {
    if (!dossiers.has(pid)) dossiers.set(pid, await listDossiers(pid));
    return dossiers.get(pid)!;
  };
  const tasks = await allTasks();
  const compId = cats.find((c) => c.slug === "comp")?.id;
  const demandCache = new Map<string, Awaited<ReturnType<typeof demandsOf>>>();
  const demands = async (pid: string) => { if (!demandCache.has(pid)) demandCache.set(pid, await demandsOf(pid)); return demandCache.get(pid)!; };

  const resolved: Resolved[] = [];
  for (const [i, r] of registros.entries()) {
    const out: Resolved = { ...r };
    const where = `#${i + 1} ${TIPO_LABEL[r.tipo]}`;
    try {
      const pidInput = "projeto_id" in r ? r.projeto_id : undefined;
      if (pidInput) {
        const p = await getProject(pidInput);
        out._projeto = { id: p.id, nome: p.nome };
        (out as { projeto_id?: string }).projeto_id = p.id;
        const list = await getDossiers(p.id);
        const label = p.rotulo_dossie.singular.toLowerCase();
        if ("dossie" in r && r.dossie) out._dossie = pickRef(pickDossier(list, r.dossie, label));
        if (r.tipo === "demanda" && r.dossies?.length) {
          const refs = r.dossies.map((n) => pickRef(pickDossier(list, n, label)));
          if (new Set(refs.map((x) => x.id)).size !== refs.length) throw new Error("há polos repetidos na lista");
          out._dossies = refs;
        }
        // Demanda existente (código) precisa existir neste projeto.
        if ("demanda" in r && r.demanda && isCode(r.demanda)) {
          if (!(await demands(p.id)).some((d) => d.id === r.demanda)) throw new Error(`a demanda ${r.demanda} não existe no projeto ${p.nome}`);
        }
        if ("demanda" in r && r.demanda && isRef(r.demanda)) {
          const target = registros.find((x) => x.tipo === "demanda" && x.ref === r.demanda!.slice(4)) as Extract<Registro, { tipo: "demanda" }> | undefined;
          if (target && target.projeto_id !== r.projeto_id && (await getProject(target.projeto_id)).id !== p.id) throw new Error("a demanda referenciada é de outro projeto");
        }
      }
      const dup = await findDuplicate(out, { tasks, compId, demands, cats });
      if (dup) out._duplicado = dup;
      if (out._duplicado && !("permitir_duplicado" in r && r.permitir_duplicado)) {
        out._ignorar = true;
        warnings.push(`${where}: já existe algo equivalente (${out._duplicado}) — será ignorado, a menos que o usuário peça para criar mesmo assim (permitir_duplicado).`);
      } else if (out._duplicado) warnings.push(`${where}: equivalente já existe (${out._duplicado}); será criado porque você autorizou duplicidade.`);
    } catch (e) {
      problems.push(`${where}: ${e instanceof NeedsChoice ? choice(e) : e instanceof Error ? e.message : "erro ao validar"}`);
    }
    resolved.push(out);
  }
  if (problems.length) return { resolved: [], problems, warnings, summary: "" };
  return { resolved, problems, warnings, summary: summarize(resolved) };
}

const pickRef = (d: DossierInfo): Ref => ({ id: d.id, name: d.nome });

/* ───────────── duplicidade ───────────── */
async function findDuplicate(
  r: Resolved, ctx: { tasks: TaskRow[]; compId: string | undefined; demands: (pid: string) => Promise<Awaited<ReturnType<typeof demandsOf>>>; cats: CategoryInfo[] },
): Promise<string | undefined> {
  switch (r.tipo) {
    case "demanda": {
      const hit = (await ctx.demands(r._projeto!.id)).find((d) => d.status !== "done" && similar(d.title, r.titulo));
      return hit ? `demanda ${hit.id} "${hit.title}" (${hit.status})` : undefined;
    }
    case "compromisso": {
      const hit = ctx.tasks.find((t) => t.category_id === ctx.compId && t.due_date === r.data && similar(t.title, r.titulo) && (!r.inicio || !t.due_time || t.due_time.slice(0, 5) === r.inicio));
      return hit ? `compromisso "${hit.title}" em ${hit.due_date}${hit.due_time ? ` ${hit.due_time.slice(0, 5)}` : ""}` : undefined;
    }
    case "lembrete":
    case "tarefa": {
      const title = r.tipo === "lembrete" ? r.texto : r.titulo;
      const hit = ctx.tasks.find((t) => !t.done && t.category_id !== ctx.compId && t.kind === (r.tipo === "lembrete" ? "lembrete" : "tarefa") && (t.due_date ?? "") === (r.data ?? "") && similar(t.title, title));
      return hit ? `${hit.kind} "${hit.title}"${hit.due_date ? ` em ${hit.due_date}` : ""}` : undefined;
    }
    case "anotacao": {
      const hit = (await notesOf(r._projeto!.id)).find((n) => similar(n.text, r.texto));
      return hit ? `anotação "${hit.text.slice(0, 60)}"` : undefined;
    }
    case "documentacao": {
      const lib = await libraryOf(r._projeto!.id);
      const hit = (Array.isArray(lib?.examples) ? (lib!.examples as { title: string }[]) : []).find((e) => similar(e.title, r.titulo));
      return hit ? `documentação "${hit.title}"` : undefined;
    }
    case "rotina": {
      const rows = must(await supabase.from("routine_items").select("title, time")) as { title: string; time: string }[];
      const hit = rows.find((x) => x.time.slice(0, 5) === r.hora && similar(x.title, r.titulo));
      return hit ? `rotina "${hit.title}" às ${hit.time.slice(0, 5)}` : undefined;
    }
    case "evidencia": {
      if (!r.nome) return undefined;
      const code = isCode(r.demanda) ? r.demanda : undefined;
      if (!code) return undefined;
      const rows = must(await supabase.from("demand_files").select("name").eq("project_id", r._projeto!.id).eq("code", code)) as { name: string }[];
      return rows.some((f) => f.name === r.nome) ? `arquivo "${r.nome}" já anexado a ${code}` : undefined;
    }
  }
}

/* ───────────── resumo para aprovação ───────────── */
export function lineOf(r: Resolved, n: number, nums: Map<string, number> = new Map()): string {
  const show = (v: string) => (v.startsWith("ref:") ? `item ${nums.get(v.slice(4)) ?? "?"} desta proposta` : v);
  const flag = r._ignorar ? " ⚠️ DUPLICADO (será ignorado)" : "";
  const dest = TIPO_LABEL[r.tipo as Tipo];
  const proj = r._projeto ? ` · projeto ${r._projeto.nome}` : "";
  switch (r.tipo) {
    case "demanda": {
      const quem = r.escopo === "geral" ? "geral" : r.escopo === "polo" ? `polo ${r._dossie?.name}` : `multipolo (${r._dossies?.length}): ${r._dossies?.map((d) => d.name).join(", ")}`;
      return `${n}. [${dest}${proj}] "${r.titulo}" — ${quem} · prioridade ${r.prioridade ?? "media"} · prazo ${deadlineLabel(r.prazo)}${r.checklist?.length ? ` · checklist ${r.checklist.length} itens` : ""}${r.responsavel ? ` · responsável ${r.responsavel}` : ""}${flag}`;
    }
    case "compromisso":
      return `${n}. [${dest} · ${r.escopo}${proj}] "${r.titulo}" — ${r.data}${r.inicio ? ` ${r.inicio}${r.fim ? `–${r.fim}` : ""}` : " (dia todo)"}${r.local ? ` · ${r.local}` : ""}${r._dossie ? ` · ${r._dossie.name}` : ""}${r.demanda ? ` · demanda ${show(r.demanda)}` : ""}${r.lembrete_minutos_antes ? ` · lembrete ${r.lembrete_minutos_antes} min antes` : ""}${flag}`;
    case "lembrete":
      return `${n}. [${dest}${proj}] "${r.texto}" — ${r.data ? `${r.data}${r.hora ? ` ${r.hora}` : " (sem horário)"}` : "sem data"}${r.compromisso ? ` · ligado ao compromisso ${show(r.compromisso)}` : ""}${r.demanda ? ` · demanda ${show(r.demanda)}` : ""}${flag}`;
    case "tarefa":
      return `${n}. [${dest}] "${r.titulo}" — ${r.categoria ?? "sem categoria"} · prioridade ${r.prioridade ?? "media"}${r.data ? ` · ${r.data}${r.hora ? ` ${r.hora}` : ""}` : ""}${flag}`;
    case "rotina":
      return `${n}. [${dest}] "${r.titulo}" — todo dia às ${r.hora}${flag}`;
    case "anotacao":
      return `${n}. [${dest}${proj}] "${r.texto.slice(0, 80)}${r.texto.length > 80 ? "…" : ""}"${r._dossie ? ` · ${r._dossie.name}` : " · geral"}${flag}`;
    case "documentacao":
      return `${n}. [${dest}${proj}] "${r.titulo}" — categoria ${r.categoria ?? "Documentação"}${flag}`;
    case "evidencia":
      return `${n}. [${dest}${proj}] ${r.nome ? `arquivo "${r.nome}"` : "texto"} → demanda ${show(r.demanda)}${flag}`;
  }
}

export function summarize(list: Resolved[]): string {
  const nums = new Map<string, number>();
  list.forEach((r, i) => { if (r.ref) nums.set(r.ref, i + 1); });
  return list.map((r, i) => lineOf(r, i + 1, nums)).join("\n");
}
