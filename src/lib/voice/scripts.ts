/** Ferramenta de voz "roteiro": cria e edita roteiros de treinamento (Documentação → Treinamentos) do projeto. */
import { loadLibrary, saveLibrary } from "../data/training-library";
import { libraryOf, listProjects } from "../mcp/lookup";
import { describeScript, editScript, findScript, type ScriptArgs } from "../script-edit";
import { normalizeLibrary, type Script } from "../training-library";
import { normalize } from "../orion";
import type { Panel } from "./agent";

function panelOf(s: Script, projectId: string): Panel {
  return {
    titulo: s.title,
    secoes: s.blocks.length
      ? s.blocks.map((b, i) => ({ titulo: `${i + 1}. ${b.title} · ${b.minutes} min`, itens: [...b.show.map((t) => ({ rotulo: t })), ...(b.tip ? [{ rotulo: "Dica", detalhe: b.tip }] : [])] }))
      : [{ titulo: "Blocos", itens: [{ rotulo: "O roteiro ainda não tem blocos." }] }],
    abrir: { rotulo: "Abrir roteiros", para: `/demandas?projeto=${encodeURIComponent(projectId)}` },
  };
}

export async function runScriptTool(raw: Record<string, unknown>): Promise<{ result: Record<string, unknown>; panel?: Panel }> {
  const a = raw as unknown as ScriptArgs & { projeto?: string };
  const projects = await listProjects();
  if (!projects.length) return { result: { ok: false, erro: "Não há nenhum projeto ainda." } };

  // 1) qual projeto: o citado; senão, onde o roteiro existe; senão (criar) o único projeto.
  let pid: string | undefined;
  if (a.projeto?.trim()) {
    const n = normalize(a.projeto);
    const hit = projects.filter((p) => normalize(p.nome) === n || normalize(p.nome).includes(n) || n.includes(normalize(p.nome)));
    if (hit.length !== 1) return { result: { ok: false, erro: hit.length ? "Mais de um projeto parecido." : `Não achei o projeto "${a.projeto}".`, opcoes: (hit.length ? hit : projects).map((p) => p.nome) } };
    pid = hit[0]!.id;
  } else if (a.acao !== "criar" && a.acao !== "listar") {
    const found: { pid: string; nome: string; titulo: string }[] = [];
    for (const p of projects) {
      const row = await libraryOf(p.id);
      const f = findScript(normalizeLibrary(row), String(a.roteiro ?? ""));
      for (const s of f.item ? [f.item] : f.ambiguo ?? []) found.push({ pid: p.id, nome: p.nome, titulo: s.title });
    }
    if (found.length === 1) pid = found[0]!.pid;
    else if (found.length > 1) return { result: { ok: false, erro: "Achei roteiros parecidos em mais de um lugar. Pergunte qual.", opcoes: found.map((f) => `${f.titulo} (projeto ${f.nome})`) } };
  }
  if (!pid) {
    if (projects.length === 1) pid = projects[0]!.id;
    else return { result: { ok: false, erro: a.acao === "criar" || a.acao === "listar" ? "Em qual projeto? Pergunte." : `Não achei o roteiro "${a.roteiro ?? ""}" em nenhum projeto.`, opcoes: projects.map((p) => p.nome) } };
  }

  const lib = await loadLibrary(pid);
  const e = editScript(lib, a);
  if (e.lib) await saveLibrary(pid, lib, e.lib);
  const projeto = projects.find((p) => p.id === pid)!.nome;
  const script = e.script ?? (a.acao === "listar" ? undefined : undefined);
  const result = { ...e.result, projeto };
  if (a.acao === "listar") return { result, panel: { titulo: `Roteiros · ${projeto}`, secoes: [{ titulo: "Roteiros", itens: lib.scripts.map((s) => ({ rotulo: s.title, detalhe: `${s.blocks.length} blocos${s.audience ? ` · ${s.audience}` : ""}` })) }], abrir: { rotulo: "Abrir roteiros", para: `/demandas?projeto=${encodeURIComponent(pid)}` } } };
  return script ? { result, panel: panelOf(script, pid) } : { result };
}
export { describeScript };
