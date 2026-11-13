/** Ferramenta de voz "lista": cria e ajusta checklists por conversa (adicionar, tirar, marcar, sugerir). */
import { bySection, findItems, findList, progress, type CList } from "../checklist";
import { addItems, createList, deleteList, loadLists, removeItems, renameList, setManyDone, type NewItem } from "../data/checklists";
import type { Panel, PanelItem } from "./agent";

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : typeof v === "string" && v.trim() ? [v.trim()] : []);
const itemsOf = (v: unknown): NewItem[] => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? { texto: x } : { texto: String((x as { texto?: unknown }).texto ?? ""), grupo: (x as { grupo?: string }).grupo })).filter((x) => x.texto.trim()) : []);

function panelOf(l: CList, sugestoes: string[]): Panel {
  const secoes: Panel["secoes"] = bySection(l.items).map((s) => ({
    titulo: s.secao || "Itens",
    itens: s.itens.map((i): PanelItem => ({ rotulo: i.label, feita: i.done, marcar: i.id })),
  }));
  const have = new Set(l.items.map((i) => i.label.toLowerCase()));
  const sug = sugestoes.filter((s) => !have.has(s.toLowerCase())).slice(0, 8);
  if (sug.length) secoes.push({ titulo: "Sugestões · toque para incluir", itens: sug.map((s): PanelItem => ({ rotulo: s, incluir: { lista: l.id } })) });
  const p = progress(l.items);
  return { titulo: `${l.title} · ${p.feitos}/${p.total}`, secoes: secoes.length ? secoes : [{ titulo: "Itens", itens: [{ rotulo: "A lista está vazia." }] }], abrir: { rotulo: "Abrir em Tarefas", para: "/tarefas?aba=listas" } };
}

export async function runListTool(args: Record<string, unknown>): Promise<{ result: Record<string, unknown>; panel?: Panel }> {
  const acao = String(args["acao"] ?? "mostrar");
  const sugestoes = strs(args["sugestoes"]);
  let lists = await loadLists();

  if (acao === "listar") {
    return { result: { ok: true, listas: lists.map((l) => ({ titulo: l.title, ...progress(l.items) })) }, panel: { titulo: "Suas listas", secoes: [{ titulo: "Listas", itens: lists.length ? lists.map((l): PanelItem => ({ rotulo: l.title, detalhe: `${progress(l.items).feitos} de ${l.items.length} feitos`, link: "/tarefas?aba=listas" })) : [{ rotulo: "Você ainda não tem listas." }] }] } };
  }

  if (acao === "criar") {
    const titulo = String(args["titulo"] ?? args["lista"] ?? "").trim();
    if (!titulo) return { result: { ok: false, erro: "Diga o nome da lista." } };
    const id = await createList(titulo, itemsOf(args["itens"]));
    lists = await loadLists();
    const l = lists.find((x) => x.id === id)!;
    return { result: { ok: true, acao: "criada", lista: l.title, itens: l.items.length, dica: "Confirme em uma frase e ofereça 2 ou 3 sugestões do que mais incluir." }, panel: panelOf(l, sugestoes) };
  }

  const q = String(args["lista"] ?? "").trim();
  const f = findList(lists, q);
  if (f.ambiguo) return { result: { ok: false, erro: "Mais de uma lista parecida. Pergunte qual.", opcoes: f.ambiguo.map((l) => l.title) } };
  if (!f.list) return { result: { ok: false, erro: q ? `Não achei a lista "${q}".` : "Você ainda não tem nenhuma lista. Ofereça criar uma." } };
  const l = f.list;
  const refresh = async () => (await loadLists()).find((x) => x.id === l.id) ?? l;

  if (acao === "mostrar") return { result: { ok: true, lista: l.title, ...progress(l.items), itens: l.items.map((i) => ({ item: i.label, grupo: i.section, feito: i.done })) }, panel: panelOf(l, sugestoes) };

  if (acao === "adicionar") {
    const novos = await addItems(l.id, itemsOf(args["itens"]));
    const nl = await refresh();
    return { result: { ok: true, acao: "adicionados", adicionados: novos, ja_existiam: itemsOf(args["itens"]).length - novos.length, lista: nl.title }, panel: panelOf(nl, sugestoes) };
  }

  if (acao === "remover" || acao === "marcar" || acao === "desmarcar") {
    const nomes = strs(args["itens_alvo"] ?? args["alvo"]);
    const todos = args["todos"] === true;
    const ids: string[] = [], ach: string[] = [], faltou: string[] = [], duvida: { alvo: string; opcoes: string[] }[] = [];
    if (todos) l.items.forEach((i) => { ids.push(i.id); ach.push(i.label); });
    else for (const n of nomes) {
      const r = findItems(l.items, n);
      if (r.item) { if (!ids.includes(r.item.id)) { ids.push(r.item.id); ach.push(r.item.label); } }
      else if (r.ambiguo) duvida.push({ alvo: n, opcoes: r.ambiguo.map((x) => x.label) });
      else faltou.push(n);
    }
    if (acao === "remover") { if (args["todos"] === true && args["confirmado"] !== true) return { result: { ok: false, precisa_confirmar: true, aviso: `Isso tira todos os ${l.items.length} itens da lista ${l.title}.` } }; await removeItems(ids, l.id); }
    else await setManyDone(ids, acao === "marcar", l.id);
    const nl = await refresh();
    return { result: { ok: ids.length > 0 || !(faltou.length || duvida.length), acao: acao === "remover" ? "removidos" : acao === "marcar" ? "marcados_como_feitos" : "desmarcados", itens: ach, nao_achei: faltou, duvida, lista: nl.title, ...progress(nl.items) }, panel: panelOf(nl, sugestoes) };
  }

  if (acao === "renomear") {
    const t = String(args["titulo"] ?? "").trim();
    if (!t) return { result: { ok: false, erro: "Diga o novo nome." } };
    await renameList(l.id, t);
    return { result: { ok: true, acao: "renomeada", lista: t } };
  }

  if (acao === "excluir") {
    if (args["confirmado"] !== true) return { result: { ok: false, precisa_confirmar: true, aviso: `Vai excluir a lista ${l.title} com ${l.items.length} itens.` } };
    await deleteList(l.id);
    return { result: { ok: true, acao: "excluida", lista: l.title } };
  }

  return { result: { ok: false, erro: "Ação desconhecida." } };
}
