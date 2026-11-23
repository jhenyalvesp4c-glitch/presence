import { norm } from "../checklist";

/** Acha UM item pelo nome aproximado: exato > começa com > contém (todas as palavras). `ambiguo` traz as opções quando houver mais de um. */
export function matchByName<T>(list: T[], query: string, nameOf: (t: T) => string): { item?: T; ambiguo?: T[] } {
  const q = norm(query);
  if (!q) return {};
  const exact = list.filter((t) => norm(nameOf(t)) === q);
  if (exact.length === 1) return { item: exact[0]! };
  const starts = list.filter((t) => norm(nameOf(t)).startsWith(q));
  if (starts.length === 1) return { item: starts[0]! };
  const words = q.split(" ");
  const has = list.filter((t) => { const n = norm(nameOf(t)); return words.every((w) => n.includes(w)); });
  if (has.length === 1) return { item: has[0]! };
  const pool = exact.length ? exact : starts.length ? starts : has;
  return pool.length > 1 ? { ambiguo: pool.slice(0, 6) } : {};
}
