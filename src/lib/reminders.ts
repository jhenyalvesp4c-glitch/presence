/** Lembretes: decide quais estão na hora de avisar. Puro, sem acesso ao banco nem ao navegador. */
export type ReminderRow = { id: string; title: string; due_date: string; due_time: string | null; done: boolean };
export type Due = { id: string; title: string; at: Date; key: string };

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

/** Frase para falar em voz alta. */
export function spokenReminder(list: Due[]): string {
  if (!list.length) return "";
  if (list.length === 1) return `Lembrete: ${list[0]!.title}.`;
  const t = list.slice(0, 4).map((d) => d.title);
  const last = t.pop()!;
  return `Você tem ${list.length} lembretes: ${t.length ? `${t.join(", ")} e ${last}` : last}.`;
}

export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
