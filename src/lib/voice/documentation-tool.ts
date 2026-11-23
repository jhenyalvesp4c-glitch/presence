/** Ferramenta de voz "documentacao": a Biblioteca (Documentação) — criar, ler, editar, mover, excluir documentos e criar pastas. Nunca guarda senhas. */
import { loadLibraryRows, removeDocRow, removeFolderRow, saveDocRow, saveFolderRow, type DocRow } from "../data/library";
import { matchByName } from "./match";

const s = (v: unknown) => String(v ?? "").trim();
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(s).filter(Boolean) : s(v) ? [s(v)] : []);
/** Pastas que já vêm no app (ficam no código, não no banco). "Logins dos Dossiês" não é oferecida: senhas não vão para o banco. */
const SEED_FOLDERS = [{ id: "tut", name: "Tutoriais e Processos" }, { id: "reg", name: "Registros e Execuções" }, { id: "tpl", name: "Templates" }, { id: "tre", name: "Materiais de Treinamento" }, { id: "ger", name: "Documentos Gerais" }];
const COLOR: Record<string, string> = { Tutorial: "violet", Processo: "emerald", Guia: "cyan", Checklist: "emerald", Manual: "amber", Documento: "cyan" };
const KINDS = Object.keys(COLOR);
const kindOf = (v: unknown) => KINDS.find((k) => k.toLowerCase() === s(v).toLowerCase()) ?? "Documento";
const todayLabel = () => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date());
const newId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const SECRET = /\b(senha|password|passwd|token|api[ _-]?key|chave secreta|secret)\b\s*[:=]/i;

export async function runDocumentationTool(args: Record<string, unknown>): Promise<{ result: Record<string, unknown>; navegar?: string }> {
  const acao = s(args["acao"]) || "listar";
  const { docs: allDocs, folders: dbFolders } = await loadLibraryRows();
  const docs = allDocs.filter((d) => !d.deleted);
  const folders = [...SEED_FOLDERS, ...dbFolders.filter((f) => !SEED_FOLDERS.some((x) => x.id === f.id)).map((f) => ({ id: f.id, name: f.name }))];
  const folderName = (id: string) => folders.find((f) => f.id === id)?.name ?? id;
  const pickFolder = (q: string): { id: string; name: string } | { erro: string; opcoes: string[] } => {
    if (!q) return SEED_FOLDERS.find((f) => f.id === "ger")!;
    const m = matchByName(folders, q, (f) => f.name);
    if (m.item) return m.item;
    return { erro: m.ambiguo ? "Mais de uma pasta parecida. Pergunte qual." : `Não achei a pasta "${q}".`, opcoes: (m.ambiguo ?? folders).map((f) => f.name) };
  };
  const nav = { navegar: "/demandas?aba=docs" };

  if (acao === "listar") {
    const f = s(args["pasta"]);
    if (f) { const p = pickFolder(f); if ("erro" in p) return { result: { ok: false, ...p } }; return { result: { ok: true, pasta: p.name, documentos: docs.filter((d) => d.folder_id === p.id).map((d) => ({ titulo: d.title, tipo: d.kind })) }, ...nav }; }
    return { result: { ok: true, pastas: folders.map((x) => ({ pasta: x.name, documentos: docs.filter((d) => d.folder_id === x.id).length })) }, ...nav };
  }

  if (acao === "criar_pasta") {
    const nome = s(args["nome"]);
    if (!nome) return { result: { ok: false, erro: "Qual o nome da pasta?" } };
    if (folders.some((f) => f.name.toLowerCase() === nome.toLowerCase())) return { result: { ok: false, erro: `Já existe a pasta "${nome}".` } };
    await saveFolderRow({ id: `f${Date.now().toString(36)}`, name: nome.slice(0, 80), color: "cyan", position: dbFolders.length, dossier_id: null });
    return { result: { ok: true, acao: "pasta criada", pasta: nome }, ...nav };
  }
  if (acao === "excluir_pasta") {
    const p = pickFolder(s(args["pasta"] ?? args["alvo"]));
    if ("erro" in p) return { result: { ok: false, ...p } };
    if (SEED_FOLDERS.some((f) => f.id === p.id)) return { result: { ok: false, erro: "Essa pasta já vem com o Orion e não pode ser excluída." } };
    if (docs.some((d) => d.folder_id === p.id)) return { result: { ok: false, erro: "A pasta ainda tem documentos. Mova ou exclua os documentos antes." } };
    if (args["confirmado"] !== true) return { result: { ok: true, precisa_confirmar: true, pergunta: `Quer mesmo excluir a pasta ${p.name}?` } };
    await removeFolderRow(p.id);
    return { result: { ok: true, acao: "pasta excluída", pasta: p.name } };
  }

  if (acao === "criar") {
    const titulo = s(args["titulo"]);
    if (!titulo) return { result: { ok: false, erro: "Qual o título do documento?" } };
    const corpo = [s(args["descricao"] ?? args["texto"]), ...list(args["regras"]), ...list(args["passos"])].join("\n");
    if (SECRET.test(corpo) || SECRET.test(titulo)) return { result: { ok: false, erro: "Parece haver uma senha ou chave no texto. Senhas não são guardadas no Orion: tire e tente de novo." } };
    const p = pickFolder(s(args["pasta"]));
    if ("erro" in p) return { result: { ok: false, ...p } };
    if (p.id === "log") return { result: { ok: false, erro: "Logins e senhas não são guardados aqui." } };
    const kind = kindOf(args["tipo"]);
    const row: DocRow = { id: newId(), folder_id: p.id, title: titulo.slice(0, 200), description: s(args["descricao"] ?? args["texto"]).slice(0, 6000), kind, color: COLOR[kind]!, fav: false, rules: list(args["regras"]), steps: list(args["passos"]), attachments: [], ai_summary: "", deleted: false, updated_label: todayLabel() };
    await saveDocRow(row);
    return { result: { ok: true, acao: "documento criado", titulo: row.title, pasta: p.name, tipo: kind }, ...nav };
  }

  const m = matchByName(docs, s(args["alvo"] ?? args["titulo"]), (d) => d.title);
  if (m.ambiguo) return { result: { ok: false, erro: "Mais de um documento parecido. Pergunte qual.", opcoes: m.ambiguo.map((d) => `${d.title} (${folderName(d.folder_id)})`) } };
  if (!m.item) return { result: { ok: false, erro: "Não achei esse documento na Documentação.", dica: "Tente buscar_no_orion; documentos de exemplo do app só dá para abrir pela tela.", opcoes: docs.map((d) => d.title).slice(0, 8) } };
  const d = m.item;

  if (acao === "ler") return { result: { ok: true, titulo: d.title, pasta: folderName(d.folder_id), tipo: d.kind, descricao: d.description.slice(0, 5000), regras: d.rules, passos: d.steps, resumo_dos_arquivos: d.ai_summary.slice(0, 2500), arquivos: d.attachments.map((a) => a.name) } };

  if (acao === "editar") {
    const next: DocRow = { ...d, updated_label: todayLabel() };
    if (s(args["novo_titulo"])) next.title = s(args["novo_titulo"]).slice(0, 200);
    if (args["descricao"] !== undefined) next.description = s(args["descricao"]).slice(0, 6000);
    if (s(args["acrescentar"])) next.description = `${d.description}\n\n${s(args["acrescentar"])}`.trim().slice(0, 6000);
    if (args["regras"] !== undefined) next.rules = list(args["regras"]);
    if (args["passos"] !== undefined) next.steps = list(args["passos"]);
    if (list(args["adicionar_passos"]).length) next.steps = [...d.steps, ...list(args["adicionar_passos"])];
    if (args["tipo"] !== undefined) { next.kind = kindOf(args["tipo"]); next.color = COLOR[next.kind]!; }
    if (SECRET.test([next.title, next.description, ...next.rules, ...next.steps].join("\n"))) return { result: { ok: false, erro: "Parece haver uma senha ou chave no texto. Senhas não são guardadas no Orion." } };
    await saveDocRow(next);
    return { result: { ok: true, acao: "documento atualizado", titulo: next.title }, ...nav };
  }
  if (acao === "mover") {
    const p = pickFolder(s(args["pasta"]));
    if ("erro" in p) return { result: { ok: false, ...p } };
    if (p.id === "log") return { result: { ok: false, erro: "Logins e senhas não são guardados aqui." } };
    await saveDocRow({ ...d, folder_id: p.id, updated_label: todayLabel() });
    return { result: { ok: true, acao: "documento movido", titulo: d.title, para: p.name }, ...nav };
  }
  if (acao === "excluir") {
    if (args["confirmado"] !== true) return { result: { ok: true, precisa_confirmar: true, pergunta: `Quer mesmo excluir o documento ${d.title}?` } };
    await removeDocRow(d, false);
    return { result: { ok: true, acao: "documento excluído", titulo: d.title } };
  }
  return { result: { ok: false, erro: "Ação desconhecida (listar, ler, criar, editar, mover, excluir, criar_pasta, excluir_pasta)." } };
}
