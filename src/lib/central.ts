/** Central do dia: regras puras (saudação, prazos de demandas, faturas que fecham, progresso do dia). Sem rede. */
export const greeting = (hour: number) => (hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");

const pad = (n: number) => String(n).padStart(2, "0");
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const daysBetween = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 864e5);

/** Prazo da demanda: aceita "dd/mm", "dd/mm/aaaa" ou "aaaa-mm-dd"; "—" ou vazio = sem prazo. `dd/mm` usa o ano de `today`. */
export function parseDeadline(text: string | null | undefined, today: string): string | null {
  const t = (text ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(t);
  if (!m) return null;
  const day = Number(m[1]), month = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : Number(today.slice(0, 4));
  return `${y}-${pad(month)}-${pad(day)}`;
}
export type Bucket = "late" | "today" | "soon" | "later" | "none";
export function deadlineBucket(deadline: string | null, today: string): Bucket {
  if (!deadline) return "none";
  const d = daysBetween(today, deadline);
  return d < 0 ? "late" : d === 0 ? "today" : d <= 3 ? "soon" : "later";
}

/** Próxima ocorrência (hoje ou depois) de um dia do mês, ajustando para meses curtos. */
export function nextDayOfMonth(day: number, today: string): string {
  const y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  const make = (yy: number, mm: number) => { const last = new Date(yy, mm, 0).getDate(); return `${yy}-${pad(mm)}-${pad(Math.min(day, last))}`; };
  const cur = make(y, m);
  return cur >= today ? cur : (m === 12 ? make(y + 1, 1) : make(y, m + 1));
}
export type InvoiceAlert = { card: string; kind: "fecha" | "vence"; date: string; inDays: number };
/** Faturas que fecham ou vencem nos próximos `within` dias (hoje conta). */
export function invoiceAlerts(cards: { name: string; closingDay: number; dueDay: number }[], today: string, within = 5): InvoiceAlert[] {
  const out: InvoiceAlert[] = [];
  for (const c of cards) for (const [kind, day] of [["fecha", c.closingDay], ["vence", c.dueDay]] as const) {
    const date = nextDayOfMonth(day, today), inDays = daysBetween(today, date);
    if (inDays <= within) out.push({ card: c.name, kind, date, inDays });
  }
  return out.sort((a, b) => a.inDays - b.inDays || a.card.localeCompare(b.card));
}

/** Progresso do dia: feitos / total (tarefas + fixas + hábitos). */
export function dayProgress(parts: { done: number; total: number }[]) {
  const done = parts.reduce((a, p) => a + p.done, 0), total = parts.reduce((a, p) => a + p.total, 0);
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}
export { addDays };
