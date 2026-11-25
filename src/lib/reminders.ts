/** Lembretes: decide quais estão na hora de avisar. Puro, sem acesso ao banco nem ao navegador. */
export type ReminderRow = { id: string; title: string; due_date: string; due_time: string | null; done: boolean };
export type Due = { id: string; title: string; at: Date; key: string; /** Aviso antecipado: minutos antes da hora da tarefa (a hora da tarefa é `at`). */ before?: number | undefined };

/** Avisa lembretes cujo horário já chegou, que não foram avisados nem estão adiados. Ignora os de mais de `maxAgeH` horas atrás. */
export function dueReminders(rows: ReminderRow[], now: Date, seen: Record<string, string>, snoozed: Record<string, number>, maxAgeH = 12): Due[] {
  const out: Due[] = [];
  for (const r of rows) {
    if (r.done || !r.due_time || !r.due_date) continue;
    const at = new Date(`${r.due_date}T${r.due_time.slice(0, 5)}:00`);
    if (Number.isNaN(at.getTime())) continue;
    const key = `${r.due_date} ${r.due_time.slice(0, 5)}`;
    const until = snoozed[r.id];
    if (until && now.getTime() < until) continue;
    if (seen[r.id] === key && !until) continue;
    if (at.getTime() > now.getTime()) continue;
    if (now.getTime() - at.getTime() > maxAgeH * 3_600_000) continue;
    out.push({ id: r.id, title: r.title, at, key });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Opções de "lembrar antes" (minutos). */
export const REMIND_OPTIONS: { min: number; label: string }[] = [
  { min: 15, label: "15 min" }, { min: 30, label: "30 min" }, { min: 60, label: "1 hora" }, { min: 120, label: "2 horas" },
  { min: 1440, label: "1 dia" }, { min: 2880, label: "2 dias" }, { min: 10080, label: "1 semana" },
];
/** "30 minutos", "1 hora", "2 dias"… para falar e escrever. */
export function beforeWords(min: number): string {
  if (min % 10080 === 0) { const n = min / 10080; return n === 1 ? "1 semana" : `${n} semanas`; }
  if (min % 1440 === 0) { const n = min / 1440; return n === 1 ? "1 dia" : `${n} dias`; }
  if (min % 60 === 0) { const n = min / 60; return n === 1 ? "1 hora" : `${n} horas`; }
  return `${min} minutos`;
}
export type BeforeRow = ReminderRow & { remind_before: number[] | null };

/**
 * Avisos antecipados: para cada tarefa com "lembrar antes", avisa quando chega (hora − antecedência) e a tarefa ainda não começou.
 * `seen` e `snoozed` usam a chave `${id}~${minutos}`. Se vários avisos da mesma tarefa já passaram (app fechado), vale só o mais próximo da hora.
 * Devolve também as chaves de todos os avisos vencidos (para marcar como vistos).
 */
export function dueBefore(rows: BeforeRow[], now: Date, seen: Record<string, string>, snoozed: Record<string, number>): { due: Due[]; keys: string[] } {
  const due: Due[] = [], keys: string[] = [];
  for (const r of rows) {
    if (r.done || !r.due_time || !r.due_date || !r.remind_before?.length) continue;
    const at = new Date(`${r.due_date}T${r.due_time.slice(0, 5)}:00`);
    if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) continue;
    const base = `${r.due_date} ${r.due_time.slice(0, 5)}`;
    const ready = [...new Set(r.remind_before)].filter((m) => m > 0).sort((a, b) => b - a).filter((m) => {
      const k = `${r.id}~${m}`, until = snoozed[k];
      if (until) return now.getTime() >= until;
      return now.getTime() >= at.getTime() - m * 60_000 && seen[k] !== base;
    });
    if (!ready.length) continue;
    for (const m of ready) keys.push(`${r.id}~${m}`);
    const m = ready[ready.length - 1]!; // o mais próximo da hora
    due.push({ id: r.id, title: r.title, at, key: `${base}-${m}`, before: m });
  }
  return { due: due.sort((a, b) => a.at.getTime() - b.at.getTime()), keys };
}

/** Frase para falar em voz alta. */
export function spokenReminder(list: Due[]): string {
  if (!list.length) return "";
  if (list.length === 1) { const d = list[0]!; return d.before ? `Daqui a ${beforeWords(d.before)}: ${d.title}.` : `Lembrete: ${d.title}.`; }
  const t = list.slice(0, 4).map((d) => (d.before ? `${d.title}, daqui a ${beforeWords(d.before)}` : d.title));
  const last = t.pop()!;
  return `Você tem ${list.length} lembretes: ${t.length ? `${t.join(", ")} e ${last}` : last}.`;
}

export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Chave única de cada aviso (o mesmo lembrete adiado e avisado de novo ganha outra chave). */
export const alertKey = (d: Due, prevSnooze?: number): string => `${d.key}${prevSnooze ? `@${prevSnooze}` : ""}`;
