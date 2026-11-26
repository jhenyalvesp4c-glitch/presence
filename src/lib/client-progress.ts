/** Quanto das tarefas criadas para um cliente já foi feito (o anel do cartão do cliente). */
export function clientTaskProgress(tasks: { client_id?: string | null | undefined; done: boolean }[], clientId: string): { total: number; done: number; pct: number } {
  const mine = tasks.filter((t) => t.client_id === clientId), done = mine.filter((t) => t.done).length;
  return { total: mine.length, done, pct: mine.length ? Math.round((done / mine.length) * 100) : 0 };
}
