/** Painel do topo de Clientes pensado para quem dá suporte: o que está atrasado, o que é para hoje e quem está sem próxima etapa. */
import { byAttention, clientSteps, clientTaskStats, type TaskStats } from "./client-progress";

export type PTask = { id: string; title: string; client_id?: string | null | undefined; done: boolean; due_date?: string | null | undefined; due_time?: string | null | undefined; created_at?: string | undefined; client_order?: number | null | undefined };
export type PClient = { id: string; name: string; status: string };
export type PanelRow = { id: string; name: string; overdue: number; today: number; pending: number; pct: number; next: string | null; level: "late" | "warn" | "ok" | "idle" };
export type Panel = { active: number; overdue: number; today: number; noNext: number; total: number; done: number; pct: number; clientsDone: number; rows: PanelRow[] };
export type WeekItem = { id: string; title: string; clientId: string; clientName: string; time: string | null };
export type WeekDay = { date: string; overdue: boolean; items: WeekItem[] };

const activeOf = (clients: PClient[]) => clients.filter((c) => c.status === "ativo");

export function workPanel(clients: PClient[], tasks: PTask[], today: string): Panel {
  const active = activeOf(clients);
  const rows = active.map((c): PanelRow & { s: TaskStats } => {
    const s = clientTaskStats(tasks, c.id, today), st = clientSteps(tasks, c.id);
    const level: PanelRow["level"] = s.overdue > 0 ? "late" : s.today > 0 ? "warn" : s.pending > 0 ? "ok" : "idle";
    return { id: c.id, name: c.name, overdue: s.overdue, today: s.today, pending: s.pending, pct: s.pct, next: st.next?.title ?? null, level, s };
  }).sort((a, b) => Number(a.pending === 0) - Number(b.pending === 0) || byAttention(a.s, b.s) || a.name.localeCompare(b.name, "pt-BR"));
  const total = rows.reduce((n, r) => n + r.s.total, 0), done = rows.reduce((n, r) => n + r.s.done, 0);
  return {
    active: active.length,
    overdue: rows.reduce((n, r) => n + r.overdue, 0), today: rows.reduce((n, r) => n + r.today, 0),
    noNext: rows.filter((r) => r.pending === 0).length,
    total, done, pct: total ? Math.round((done / total) * 100) : 0,
    clientsDone: rows.filter((r) => r.s.total > 0 && r.pending === 0).length,
    rows: rows.map(({ s: _s, ...r }) => r),
  };
}

const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** O que está atrasado e o que vence nos próximos 7 dias (hoje incluído), por dia, só dos clientes ativos. */
export function weekPlan(clients: PClient[], tasks: PTask[], today: string): WeekDay[] {
  const name = new Map(activeOf(clients).map((c) => [c.id, c.name] as const)), last = addDays(today, 6), by = new Map<string, WeekItem[]>();
  for (const t of tasks) {
    if (t.done || !t.due_date || !t.client_id || !name.has(t.client_id) || t.due_date > last) continue;
    const key = t.due_date < today ? "atrasadas" : t.due_date;
    (by.get(key) ?? by.set(key, []).get(key)!).push({ id: t.id, title: t.title, clientId: t.client_id, clientName: name.get(t.client_id)!, time: t.due_time ? t.due_time.slice(0, 5) : null });
  }
  const days: WeekDay[] = [];
  if (by.has("atrasadas")) days.push({ date: "atrasadas", overdue: true, items: by.get("atrasadas")!.sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR")) });
  for (let i = 0; i < 7; i++) { const d = addDays(today, i), items = by.get(d); if (items) days.push({ date: d, overdue: false, items: items.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.clientName.localeCompare(b.clientName, "pt-BR")) }); }
  return days;
}
