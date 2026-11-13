/** Regras puras das listas (checklists): cores, busca aproximada de itens/listas e progresso. */
export const LIST_COLORS = ["cyan", "violet", "emerald", "amber", "rose", "sky"] as const;
export type ListColor = (typeof LIST_COLORS)[number];

export type CItem = { id: string; list_id: string; section: string; label: string; done: boolean; position: number };
export type CList = { id: string; title: string; color: string; updated_at: string; items: CItem[] };

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s: string) => norm(s).split(" ").filter((w) => w.length > 1);

/** Quão bem `query` descreve `text` (0 = nada). Exato > contém > todas as palavras > algumas. */
export function score(text: string, query: string): number {
  const t = norm(text), q = norm(query);
  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.includes(q) || q.includes(t)) return 80;
  const qw = words(q), tw = words(t);
  if (!qw.length) return 0;
  const hit = qw.filter((w) => tw.some((x) => x === w || x.startsWith(w) || w.startsWith(x))).length;
  return hit === qw.length ? 60 : 0; // meia-correspondência nunca vale: melhor perguntar do que mexer no item errado
}

/** Acha o melhor item. `ambiguo` traz os empatados quando não dá para decidir. */
export function findItems(items: CItem[], query: string): { item?: CItem; ambiguo?: CItem[] } {
  const ranked = items.map((i) => ({ i, s: score(i.label, query) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!ranked.length) return {};
  const top = ranked.filter((x) => x.s === ranked[0]!.s);
  return top.length === 1 || ranked[0]!.s >= 100 ? { item: ranked[0]!.i } : { ambiguo: top.map((x) => x.i) };
}

export function findList(lists: CList[], query?: string): { list?: CList; ambiguo?: CList[] } {
  if (!lists.length) return {};
  if (!query?.trim()) return { list: lists[0]! }; // a mais recente
  const ranked = lists.map((l) => ({ l, s: score(l.title, query) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!ranked.length) return {};
  const top = ranked.filter((x) => x.s === ranked[0]!.s);
  return top.length === 1 ? { list: ranked[0]!.l } : { ambiguo: top.map((x) => x.l) };
}

export const progress = (items: { done: boolean }[]) => ({ feitos: items.filter((i) => i.done).length, total: items.length });
export const colorFor = (n: number): ListColor => LIST_COLORS[n % LIST_COLORS.length]!;

/** Agrupa por seção mantendo a ordem de aparição. */
export function bySection(items: CItem[]): { secao: string; itens: CItem[] }[] {
  const out: { secao: string; itens: CItem[] }[] = [];
  for (const it of [...items].sort((a, b) => a.position - b.position)) {
    const s = it.section || "";
    (out.find((x) => x.secao === s) ?? (out[out.push({ secao: s, itens: [] }) - 1]!)).itens.push(it);
  }
  return out;
}

export const cleanLabel = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 120);
