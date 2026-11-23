/** Ferramenta de voz "cadastros": projetos, dossiês e clientes (criar, editar, excluir, listar, registrar contato, aplicar roteiro). Tudo que a tela de Clientes/Projetos faz. */
import { defaultProjectId, type Dossier } from "../dossiers";
import type { Project } from "../projects";
import { STATUS_LABEL, type ClientStatus } from "../clients";
import { seedSetup, replaceSetup } from "../data/client-setup";
import { must, supabase } from "../data/db";
import { loadProjects, loadProjectState, saveDossiers, saveProjects } from "../data/project-data";
import { matchByName } from "./match";

type R = { result: Record<string, unknown> };
const s = (v: unknown) => String(v ?? "").trim();
const STATUS: Record<string, ClientStatus> = { ativo: "ativo", ativa: "ativo", negociacao: "neg", "em negociacao": "neg", neg: "neg", pausado: "pausa", pausa: "pausa", pausada: "pausa", encerrado: "encerrado", encerrada: "encerrado" };
const statusOf = (v: unknown): ClientStatus | undefined => STATUS[s(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()];
const COLORS = ["cyan", "violet", "emerald", "amber", "rose"] as const;

type CRow = { id: string; dossier_id: string | null; name: string; status: ClientStatus; segment: string; contact_name: string; email: string; phone: string; plan: string; monthly_value: number | string };
const CCOLS = "id, dossier_id, name, status, segment, contact_name, email, phone, plan, monthly_value";

async function pickProject(q: string): Promise<{ id: string; name: string } | { erro: string; opcoes?: string[] }> {
  if (!q) return { id: defaultProjectId(), name: "Demandas gerais" };
  const all = await loadProjects();
  const m = matchByName(all, q, (p) => p.name);
  if (m.item) return { id: m.item.id, name: m.item.name };
  if (m.ambiguo) return { erro: "Mais de um projeto parecido. Pergunte qual.", opcoes: m.ambiguo.map((p) => p.name) };
  return { erro: `Não achei o projeto "${q}".`, opcoes: all.map((p) => p.name).slice(0, 8) };
}

export async function runRegistryTool(args: Record<string, unknown>): Promise<R> {
  const entidade = s(args["entidade"]), acao = s(args["acao"]) || "listar", confirmado = args["confirmado"] === true;

  /* ───── projetos ───── */
  if (entidade === "projeto") {
    const prev = await loadProjects();
    if (acao === "listar") return { result: { ok: true, projetos: prev.map((p) => ({ nome: p.name, status: p.status, prazo: p.due, demandas: p.demands, concluidas: p.done })) } };
    if (acao === "criar") {
      const nome = s(args["nome"]);
      if (!nome) return { result: { ok: false, erro: "Qual o nome do projeto?" } };
      if (prev.some((p) => p.name.toLowerCase() === nome.toLowerCase())) return { result: { ok: false, erro: `Já existe o projeto "${nome}".` } };
      const p: Project = { id: crypto.randomUUID(), name: nome, desc: s(args["descricao"]), color: COLORS[prev.length % COLORS.length]!, status: "Ativo" as Project["status"], due: s(args["prazo"]), demands: 0, done: 0, progress: 0 };
      await saveProjects(prev, [...prev, p]);
      return { result: { ok: true, acao: "projeto criado", projeto: nome } };
    }
    const m = matchByName(prev, s(args["alvo"] ?? args["nome"]), (p) => p.name);
    if (m.ambiguo) return { result: { ok: false, erro: "Mais de um projeto parecido. Pergunte qual.", opcoes: m.ambiguo.map((p) => p.name) } };
    if (!m.item) return { result: { ok: false, erro: "Não achei esse projeto.", opcoes: prev.map((p) => p.name).slice(0, 8) } };
    const alvo = m.item;
    if (acao === "excluir") {
      if (!confirmado) return { result: { ok: true, precisa_confirmar: true, pergunta: `Quer mesmo excluir o projeto ${alvo.name}? Isso apaga as demandas, dossiês e anotações dele.` } };
      await saveProjects(prev, prev.filter((p) => p.id !== alvo.id));
      return { result: { ok: true, acao: "projeto excluído", projeto: alvo.name } };
    }
    if (acao === "editar") {
      const next = prev.map((p) => (p.id !== alvo.id ? p : { ...p, name: s(args["novo_nome"]) || p.name, desc: args["descricao"] !== undefined ? s(args["descricao"]) : p.desc, due: args["prazo"] !== undefined ? s(args["prazo"]) : p.due, status: (s(args["status"]) || p.status) as Project["status"] }));
      await saveProjects(prev, next);
      return { result: { ok: true, acao: "projeto atualizado", projeto: s(args["novo_nome"]) || alvo.name } };
    }
    return { result: { ok: false, erro: "Ação desconhecida para projeto (criar, editar, excluir, listar)." } };
  }

  /* ───── dossiês ───── */
  if (entidade === "dossie") {
    const proj = await pickProject(s(args["projeto"]));
    if ("erro" in proj) return { result: { ok: false, ...proj } };
    const st = await loadProjectState(proj.id);
    const label = st.ds.label.singular;
    if (acao === "listar") return { result: { ok: true, projeto: proj.name, dossies: st.ds.dossiers.map((d) => ({ nome: d.name, descricao: d.desc })) } };
    if (acao === "criar") {
      const nome = s(args["nome"]);
      if (!nome) return { result: { ok: false, erro: `Qual o nome do ${label.toLowerCase()}?` } };
      if (st.ds.dossiers.some((d) => d.name.toLowerCase() === nome.toLowerCase())) return { result: { ok: false, erro: `Já existe ${label.toLowerCase()} "${nome}" em ${proj.name}.` } };
      const d: Dossier = { id: `d${Date.now()}`, name: nome, desc: s(args["descricao"]) };
      await saveDossiers(proj.id, st.ds, { ...st.ds, dossiers: [...st.ds.dossiers, d] });
      return { result: { ok: true, acao: `${label.toLowerCase()} criado`, nome, projeto: proj.name } };
    }
    const m = matchByName(st.ds.dossiers, s(args["alvo"] ?? args["nome"]), (d) => d.name);
    if (m.ambiguo) return { result: { ok: false, erro: "Mais de um parecido. Pergunte qual.", opcoes: m.ambiguo.map((d) => d.name) } };
    if (!m.item) return { result: { ok: false, erro: `Não achei esse ${label.toLowerCase()} em ${proj.name}.`, opcoes: st.ds.dossiers.map((d) => d.name).slice(0, 8) } };
    const alvo = m.item;
    if (acao === "editar") {
      const nome = s(args["novo_nome"]) || alvo.name, desc = args["descricao"] !== undefined ? s(args["descricao"]) : alvo.desc;
      await saveDossiers(proj.id, st.ds, { ...st.ds, dossiers: st.ds.dossiers.map((d) => (d.id === alvo.id ? { ...d, name: nome, desc } : d)) });
      return { result: { ok: true, acao: `${label.toLowerCase()} atualizado`, nome } };
    }
    if (acao === "excluir") {
      if (!confirmado) return { result: { ok: true, precisa_confirmar: true, pergunta: `Quer mesmo excluir ${alvo.name}? As demandas ligadas só a ele perdem o vínculo.` } };
      await saveDossiers(proj.id, st.ds, { ...st.ds, dossiers: st.ds.dossiers.filter((d) => d.id !== alvo.id) });
      return { result: { ok: true, acao: `${label.toLowerCase()} excluído`, nome: alvo.name } };
    }
    return { result: { ok: false, erro: "Ação desconhecida para dossiê (criar, editar, excluir, listar)." } };
  }

  /* ───── clientes ───── */
  if (entidade === "cliente") {
    const proj = await pickProject(s(args["projeto"]));
    if ("erro" in proj) return { result: { ok: false, ...proj } };
    const rows = must(await supabase.from("clients").select(CCOLS).eq("project_id", proj.id).order("name")) as CRow[];
    if (acao === "listar") return { result: { ok: true, projeto: proj.name, clientes: rows.map((c) => ({ nome: c.name, status: STATUS_LABEL[c.status], segmento: c.segment, plano: c.plan, valor_mensal: Number(c.monthly_value) })) } };

    if (acao === "criar") {
      const nome = s(args["nome"]);
      if (!nome) return { result: { ok: false, erro: "Qual o nome do cliente?" } };
      if (rows.some((c) => c.name.toLowerCase() === nome.toLowerCase())) return { result: { ok: false, erro: `Já existe o cliente "${nome}".` } };
      // dossiê do cliente: usa o que já existe com o mesmo nome ou cria
      const st = await loadProjectState(proj.id);
      let d = st.ds.dossiers.find((x) => x.name.toLowerCase() === nome.toLowerCase());
      let criouDossie = false;
      if (!d) { d = { id: `d${Date.now()}`, name: nome, desc: "" }; await saveDossiers(proj.id, st.ds, { ...st.ds, dossiers: [...st.ds.dossiers, d] }); criouDossie = true; }
      const row = {
        project_id: proj.id, dossier_id: d.id, name: nome.slice(0, 160), status: statusOf(args["status"]) ?? "ativo", segment: s(args["segmento"]).slice(0, 80), contact_name: s(args["contato"]).slice(0, 120),
        email: s(args["email"]).slice(0, 160), phone: s(args["telefone"]).slice(0, 40), plan: s(args["plano"]).slice(0, 120), monthly_value: Math.max(0, Number(args["valor_mensal"]) || 0), notes: s(args["observacoes"]).slice(0, 2000),
      };
      const novo = (must(await supabase.from("clients").insert(row).select("id")) as { id: string }[])[0]!;
      let passos = 0;
      if (args["com_roteiro"] !== false) passos = await seedSetup(novo.id, proj.id).catch(() => 0);
      return { result: { ok: true, acao: "cliente criado", cliente: nome, dossie_criado: criouDossie, passos_do_roteiro: passos } };
    }

    const m = matchByName(rows, s(args["alvo"] ?? args["nome"]), (c) => c.name);
    if (m.ambiguo) return { result: { ok: false, erro: "Mais de um cliente parecido. Pergunte qual.", opcoes: m.ambiguo.map((c) => c.name) } };
    if (!m.item) return { result: { ok: false, erro: "Não achei esse cliente.", opcoes: rows.map((c) => c.name).slice(0, 8) } };
    const c = m.item;

    if (acao === "editar") {
      const patch: Record<string, unknown> = {};
      if (s(args["novo_nome"])) patch["name"] = s(args["novo_nome"]).slice(0, 160);
      const stt = statusOf(args["status"]); if (args["status"] !== undefined) { if (!stt) return { result: { ok: false, erro: "Status inválido: use ativo, em negociação, pausado ou encerrado." } }; patch["status"] = stt; }
      for (const [k, col, max] of [["segmento", "segment", 80], ["contato", "contact_name", 120], ["email", "email", 160], ["telefone", "phone", 40], ["plano", "plan", 120], ["observacoes", "notes", 2000]] as const) if (args[k] !== undefined) patch[col] = s(args[k]).slice(0, max);
      if (args["valor_mensal"] !== undefined) patch["monthly_value"] = Math.max(0, Number(args["valor_mensal"]) || 0);
      if (!Object.keys(patch).length) return { result: { ok: false, erro: "O que mudar no cliente?" } };
      must(await supabase.from("clients").update(patch).eq("id", c.id).select("id"));
      return { result: { ok: true, acao: "cliente atualizado", cliente: s(patch["name"]) || c.name, mudou: Object.keys(patch) } };
    }
    if (acao === "registrar_contato") {
      const texto = s(args["texto"]);
      if (!texto) return { result: { ok: false, erro: "O que aconteceu no contato?" } };
      must(await supabase.from("client_log").insert({ client_id: c.id, text: texto.slice(0, 2000), ...(s(args["data"]) ? { log_date: s(args["data"]) } : {}) }).select("id"));
      return { result: { ok: true, acao: "contato registrado", cliente: c.name } };
    }
    if (acao === "aplicar_roteiro") {
      const r = await replaceSetup(c.id, proj.id);
      return { result: { ok: true, acao: `roteiro ${r}`, cliente: c.name } };
    }
    if (acao === "excluir") {
      if (!confirmado) return { result: { ok: true, precisa_confirmar: true, pergunta: `Quer mesmo excluir o cliente ${c.name}? Os documentos, o histórico e os acessos dele serão apagados.` } };
      const docs = must(await supabase.from("client_docs").select("attachments").eq("client_id", c.id)) as { attachments: { path: string }[] | null }[];
      const paths = docs.flatMap((d) => (Array.isArray(d.attachments) ? d.attachments.map((a) => a.path) : []));
      must(await supabase.from("clients").delete().eq("id", c.id).select("id"));
      if (paths.length) await supabase.storage.from("presence-app-brain-files").remove(paths);
      return { result: { ok: true, acao: "cliente excluído", cliente: c.name } };
    }
    return { result: { ok: false, erro: "Ação desconhecida para cliente (criar, editar, excluir, listar, registrar_contato, aplicar_roteiro)." } };
  }

  return { result: { ok: false, erro: "Diga se é projeto, dossiê ou cliente." } };
}
