/** Ferramenta de voz "juntar_demandas": junta demandas do mesmo dossiê numa só, com checklist. */
import { applyMerges, findMergeGroups, mergeGroup } from "../demand-merge";
import { moveMaterials } from "../demand-materials";
import { loadDemands, saveDemands } from "../data/project-data";
import { listProjects } from "../mcp/lookup";
import { normalize } from "../orion";
import type { Panel } from "./agent";

const s = (v: unknown) => String(v ?? "").trim();

export async function runMergeTool(args: Record<string, unknown>): Promise<{ result: Record<string, unknown>; panel?: Panel; navegar?: string }> {
  const acao = s(args["acao"]) || "previa", dossie = s(args["dossie"]), confirmado = args["confirmado"] === true;
  let projects = await listProjects();
  const proj = s(args["projeto"]);
  if (proj) { const n = normalize(proj); const f = projects.filter((p) => normalize(p.nome) === n || p.id === proj); if (!f.length) return { result: { ok: false, erro: `Não achei o projeto "${proj}".`, opcoes: projects.map((p) => p.nome) } }; projects = f; }

  const found = await Promise.all(projects.map(async (p) => { const all = await loadDemands(p.id); return { pid: p.id, nome: p.nome, all, groups: findMergeGroups(all, dossie || undefined) }; }));
  const withGroups = found.filter((f) => f.groups.length);
  if (!withGroups.length) return { result: { ok: true, nada_para_juntar: true, dica: dossie ? `Não há duas ou mais demandas abertas de ${dossie}.` : "Não há dossiês com mais de uma demanda aberta." } };

  const sumario = withGroups.flatMap((f) => f.groups.map((g) => ({ projeto: f.nome, dossie: g.dossier, demandas: g.items.map((d) => `${d.id} ${d.title}`) })));
  if (acao === "previa") return { result: { ok: true, grupos: sumario, dica: "Diga os grupos em uma frase curta e pergunte se pode juntar." } };

  // juntar: um dossiê citado já é pedido claro; "todos" pede confirmação antes
  if (!dossie && !confirmado) return { result: { ok: true, precisa_confirmar: true, grupos: sumario, pergunta: `Posso juntar ${sumario.length} ${sumario.length === 1 ? "grupo" : "grupos"} de demandas do mesmo dossiê, cada um virando uma demanda com checklist?` } };

  const done: { projeto: string; dossie: string; demanda: string; de: string[]; passos: number }[] = [];
  const secoes: Panel["secoes"] = [];
  for (const f of withGroups) {
    for (const g of f.groups) await moveMaterials(f.pid, g.items[0]!.id, g.items.slice(1).map((x) => x.id));
    const titles: Record<string, string> = {};
    if (s(args["titulo"]) && f.groups.length === 1) titles[normalize(f.groups[0]!.dossier)] = s(args["titulo"]);
    await saveDemands(f.pid, f.all, applyMerges(f.all, f.groups, titles));
    for (const g of f.groups) {
      const m = mergeGroup(g, { title: titles[normalize(g.dossier)] }).merged;
      done.push({ projeto: f.nome, dossie: g.dossier, demanda: `${m.id} ${m.title}`, de: g.items.map((d) => d.id), passos: m.checklist!.length });
      secoes.push({ titulo: `${m.id} · ${g.dossier} (${m.checklist!.length})`, itens: m.checklist!.map((c) => ({ rotulo: c.text.trim(), feita: c.done, link: `/demandas?projeto=${encodeURIComponent(f.pid)}` })) });
    }
  }
  return { result: { ok: true, acao: "demandas juntadas", juntadas: done, dica: "Confirme em uma frase quantos grupos e que o checklist está dentro de cada demanda." }, panel: { titulo: "Demandas juntadas com checklist", secoes, abrir: { rotulo: "Abrir as demandas", para: `/demandas?projeto=${encodeURIComponent(withGroups[0]!.pid)}` } } };
}
