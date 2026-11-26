/** Agrupa tarefas por polo (cliente): um bloco por polo, em ordem alfabética, com as tarefas sem polo no fim; dentro de cada bloco, por data e hora. */
export type PoloRow = { client?: string | undefined; date: string; time: string; done: boolean };
export type PoloGroup<T extends PoloRow> = { name: string; rows: T[]; pend: number };

export const NO_POLO = "Sem polo";

export function groupByPolo<T extends PoloRow>(rows: T[]): PoloGroup<T>[] {
  const by = new Map<string, T[]>();
  for (const r of rows) { const k = r.client?.trim() || NO_POLO; (by.get(k) ?? by.set(k, []).get(k)!).push(r); }
  return [...by.entries()]
    .sort(([a], [b]) => (a === NO_POLO ? 1 : b === NO_POLO ? -1 : a.localeCompare(b, "pt-BR")))
    .map(([name, list]) => {
      const sorted = [...list].sort((x, y) => Number(x.done) - Number(y.done) || `${x.date || "9"}${x.time}`.localeCompare(`${y.date || "9"}${y.time}`));
      return { name, rows: sorted, pend: sorted.filter((t) => !t.done).length };
    });
}
