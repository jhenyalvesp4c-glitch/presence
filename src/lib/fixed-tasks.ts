/** Tarefas fixas: regra de quais dias valem e expansão em "tarefas do dia" (a marcação de feito é por data). */
import type { Priority } from "./types";

export type FixedTask = { id: string; title: string; category_id: string | null; priority: Priority; due_time: string | null; weekdays: number[]; active: boolean; position: number };
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** Ordem de exibição (segunda a domingo) com o número do dia (0 = domingo). */
export const WEEK_CHIPS: { d: number; label: string }[] = [{ d: 1, label: "Seg" }, { d: 2, label: "Ter" }, { d: 3, label: "Qua" }, { d: 4, label: "Qui" }, { d: 5, label: "Sex" }, { d: 6, label: "Sáb" }, { d: 0, label: "Dom" }];

const dowOf = (iso: string) => new Date(iso + "T12:00:00").getDay();
export const appliesOn = (f: Pick<FixedTask, "active" | "weekdays">, iso: string) => f.active && f.weekdays.includes(dowOf(iso));
export const weekdaysLabel = (w: number[]) => {
  if (w.length === 7) return "Todos os dias";
  const s = [...w].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEK_CHIPS.find((c) => c.d === d)?.label ?? "");
  const wk = [1, 2, 3, 4, 5], we = [6, 0];
  if (w.length === 5 && wk.every((d) => w.includes(d))) return "Dias úteis";
  if (w.length === 2 && we.every((d) => w.includes(d))) return "Fins de semana";
  return s.join(" · ") || "Nenhum dia";
};
export type FixedOccurrence = { key: string; fixed: FixedTask; date: string; done: boolean };
/** Ocorrências das tarefas fixas entre duas datas (inclusive). `done` vem do conjunto "fixedId|data". */
export function expandFixed(fixed: FixedTask[], done: Set<string>, from: string, to: string): FixedOccurrence[] {
  const out: FixedOccurrence[] = [];
  for (let d = new Date(from + "T12:00:00"); ; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (iso > to) break;
    for (const f of fixed) if (appliesOn(f, iso)) out.push({ key: `fx:${f.id}:${iso}`, fixed: f, date: iso, done: done.has(`${f.id}|${iso}`) });
    if (out.length > 4000) break;
  }
  return out;
}
export const parseFixedKey = (key: string) => { const m = key.match(/^fx:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/); return m ? { id: m[1]!, date: m[2]! } : null; };
