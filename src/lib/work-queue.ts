/** A fila de trabalho: as tarefas dos polos e as de trabalho em geral, juntas, com filtros e ordem por urgência. */
export type QTask = { id: string; title: string; done: boolean; due_date?: string | null | undefined; due_time?: string | null | undefined; client_id?: string | null | undefined; category_id?: string | null | undefined };
export type Chip = "pendentes" | "atrasadas" | "hoje" | "semdata" | "feitas";
export type Bucket = "atrasadas" | "hoje" | "proximas" | "semdata" | "feitas";
export type PoloFilter = "todos" | "geral" | string;

/** É trabalho (não rotina pessoal): tem polo, ou está numa categoria de trabalho (Trabalho / Projetos, Demandas, Clientes). */
export const isWorkTask = (t: QTask, workCategoryIds: Set<string>): boolean => !!t.client_id || (!!t.category_id && workCategoryIds.has(t.category_id));

export function bucketOf(t: QTask, todayIso: string): Bucket {
  if (t.done) return "feitas";
  if (!t.due_date) return "semdata";
  return t.due_date < todayIso ? "atrasadas" : t.due_date === todayIso ? "hoje" : "proximas";
}

export function matchesChip(t: QTask, chip: Chip, todayIso: string): boolean {
  const b = bucketOf(t, todayIso);
  return chip === "pendentes" ? b !== "feitas" : chip === "feitas" ? b === "feitas" : chip === b;
}

export const matchesPolo = (t: QTask, f: PoloFilter): boolean => f === "todos" || (f === "geral" ? !t.client_id : t.client_id === f);

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const matchesSearch = (t: QTask, q: string, poloName?: string): boolean => { const n = norm(q.trim()); return !n || norm(`${t.title} ${poloName ?? ""}`).includes(n); };

const RANK: Record<Bucket, number> = { atrasadas: 0, hoje: 1, proximas: 2, semdata: 3, feitas: 4 };
/** Mais urgente primeiro: atrasadas, hoje, próximas (por data e hora), sem data, feitas. */
export function sortQueue<T extends QTask>(list: T[], todayIso: string): T[] {
  return [...list].sort((a, b) => RANK[bucketOf(a, todayIso)] - RANK[bucketOf(b, todayIso)] || `${a.due_date ?? "9"}${a.due_time ?? ""}`.localeCompare(`${b.due_date ?? "9"}${b.due_time ?? ""}`) || a.title.localeCompare(b.title, "pt-BR"));
}

export function chipCounts(list: QTask[], todayIso: string): Record<Chip, number> {
  const c: Record<Chip, number> = { pendentes: 0, atrasadas: 0, hoje: 0, semdata: 0, feitas: 0 };
  for (const t of list) { const b = bucketOf(t, todayIso); if (b === "feitas") c.feitas++; else { c.pendentes++; if (b === "atrasadas") c.atrasadas++; else if (b === "hoje") c.hoje++; else if (b === "semdata") c.semdata++; } }
  return c;
}

export const BUCKET_LABEL: Record<Bucket, string> = { atrasadas: "Atrasadas", hoje: "Para hoje", proximas: "Próximas", semdata: "Sem data", feitas: "Feitas" };
