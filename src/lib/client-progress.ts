/** Quanto das tarefas criadas para um cliente já foi feito (o anel do cartão do cliente). */
export function clientTaskProgress(tasks: { client_id?: string | null | undefined; done: boolean }[], clientId: string): { total: number; done: number; pct: number } {
  const mine = tasks.filter((t) => t.client_id === clientId), done = mine.filter((t) => t.done).length;
  return { total: mine.length, done, pct: mine.length ? Math.round((done / mine.length) * 100) : 0 };
}

export type TaskStats = { total: number; done: number; pending: number; overdue: number; today: number; pct: number };
export type Attention = "todos" | "atrasadas" | "hoje" | "pendentes" | "sem" | "emdia";
type T = { client_id?: string | null | undefined; done: boolean; due_date?: string | null | undefined };

/** Situação das tarefas de um cliente: quantas pendentes, quantas atrasadas (data já passou) e quantas vencem hoje. */
export function clientTaskStats(tasks: T[], clientId: string, todayIso: string): TaskStats {
  const mine = tasks.filter((t) => t.client_id === clientId), open = mine.filter((t) => !t.done), done = mine.length - open.length;
  return { total: mine.length, done, pending: open.length, overdue: open.filter((t) => t.due_date && t.due_date < todayIso).length, today: open.filter((t) => t.due_date === todayIso).length, pct: mine.length ? Math.round((done / mine.length) * 100) : 0 };
}
/** O cliente entra neste filtro de atenção? */
export const matchesAttention = (s: TaskStats, a: Attention): boolean =>
  a === "todos" || (a === "atrasadas" ? s.overdue > 0 : a === "hoje" ? s.today > 0 : a === "pendentes" ? s.pending > 0 : a === "sem" ? s.total === 0 : s.total > 0 && s.pending === 0);
/** Quem precisa mais de você vem primeiro: mais atrasadas, depois vencendo hoje, depois mais pendentes. */
export const byAttention = (a: TaskStats, b: TaskStats): number => b.overdue - a.overdue || b.today - a.today || b.pending - a.pending;

export type Step = { id: string; title: string; done: boolean; due?: string | null | undefined };
export type ClientSteps = { steps: Step[]; total: number; done: number; /** posição (1…n) da etapa atual; 0 se não há etapas ou tudo foi feito. */ current: number; next: Step | null; missing: Step[] };
type StepTask = { id: string; title: string; client_id?: string | null | undefined; done: boolean; due_date?: string | null | undefined; created_at?: string | undefined; client_order?: number | null | undefined };

/** Ordem das tarefas de um cliente: a que a pessoa montou (client_order); sem ela, a ordem de criação. Tarefas novas (sem ordem) ficam no fim. */
export function orderClientTasks<T extends { title: string; created_at?: string | undefined; client_order?: number | null | undefined }>(list: T[]): T[] {
  return [...list].sort((a, b) => (a.client_order ?? Number.MAX_SAFE_INTEGER) - (b.client_order ?? Number.MAX_SAFE_INTEGER) || (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.title.localeCompare(b.title));
}
/** Move o item de `from` para `to` (índices da lista). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const n = [...list]; const [x] = n.splice(from, 1); n.splice(to, 0, x!); return n;
}
/** As etapas de um cliente são as tarefas dele, na ordem em que foram criadas: a atual é a primeira que ainda não foi feita. */
export function clientSteps(tasks: StepTask[], clientId: string): ClientSteps {
  const steps = orderClientTasks(tasks.filter((t) => t.client_id === clientId))
    .map((t): Step => ({ id: t.id, title: t.title, done: t.done, due: t.due_date ?? null }));
  const idx = steps.findIndex((s) => !s.done), missing = steps.filter((s) => !s.done);
  return { steps, total: steps.length, done: steps.length - missing.length, current: idx >= 0 ? idx + 1 : 0, next: idx >= 0 ? steps[idx]! : null, missing };
}
