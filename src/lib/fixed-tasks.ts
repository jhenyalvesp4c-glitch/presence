/** Tarefas fixas: regra de quais dias valem (dias da semana, a cada N semanas ou N vezes por semana) e expansão em "tarefas do dia". A marcação de feito é por data. */
import type { Priority } from "./types";

export type FixedTask = { id: string; title: string; category_id: string | null; priority: Priority; due_time: string | null; weekdays: number[]; active: boolean; position: number; every_weeks: number; start_date: string; times_per_week: number | null };
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** Ordem de exibição (segunda a domingo) com o número do dia (0 = domingo). */
export const WEEK_CHIPS: { d: number; label: string }[] = [{ d: 1, label: "Seg" }, { d: 2, label: "Ter" }, { d: 3, label: "Qua" }, { d: 4, label: "Qui" }, { d: 5, label: "Sex" }, { d: 6, label: "Sáb" }, { d: 0, label: "Dom" }];

const dowOf = (iso: string) => new Date(iso + "T12:00:00").getDay();
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Segunda-feira da semana de uma data. */
export const mondayOf = (iso: string) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoOf(d); };
const weeksBetween = (a: string, b: string) => Math.round((new Date(mondayOf(b) + "T12:00:00").getTime() - new Date(mondayOf(a) + "T12:00:00").getTime()) / (7 * 86_400_000));

type Rule = Pick<FixedTask, "active" | "weekdays" | "every_weeks" | "start_date" | "times_per_week">;
/** A tarefa cai neste dia? (não considera a cota "N vezes por semana": veja `expandFixed`) */
export function appliesOn(f: Rule, iso: string) {
  if (!f.active || iso < f.start_date) return false;
  if (f.times_per_week) return true;
  if (!f.weekdays.includes(dowOf(iso))) return false;
  return weeksBetween(f.start_date, iso) % Math.max(1, f.every_weeks) === 0;
}
export function ruleLabel(f: Pick<FixedTask, "weekdays" | "every_weeks" | "times_per_week">): string {
  if (f.times_per_week) return `${f.times_per_week}× por semana`;
  const w = f.weekdays, wk = [1, 2, 3, 4, 5], we = [6, 0];
  const days = w.length === 7 ? "Todos os dias" : w.length === 5 && wk.every((d) => w.includes(d)) ? "Dias úteis" : w.length === 2 && we.every((d) => w.includes(d)) ? "Fins de semana"
    : [...w].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEK_CHIPS.find((c) => c.d === d)?.label ?? "").join(" · ") || "Nenhum dia";
  return f.every_weeks > 1 ? `${days} · a cada ${f.every_weeks} semanas` : w.length === 1 ? `${days} · toda semana` : days;
}
export type FixedOccurrence = { key: string; fixed: FixedTask; date: string; done: boolean };
/** Ocorrências entre duas datas (inclusive). `done` é o conjunto "fixedId|data". Na cota "N vezes por semana" a tarefa aparece nos dias da semana até bater N; depois some (os dias feitos ficam). */
export function expandFixed(fixed: FixedTask[], done: Set<string>, from: string, to: string): FixedOccurrence[] {
  const out: FixedOccurrence[] = [];
  for (let d = new Date(from + "T12:00:00"); ; d.setDate(d.getDate() + 1)) {
    const iso = isoOf(d);
    if (iso > to) break;
    for (const f of fixed) {
      if (!appliesOn(f, iso)) continue;
      const isDone = done.has(`${f.id}|${iso}`);
      if (f.times_per_week && !isDone) {
        const monday = mondayOf(iso); let n = 0;
        for (let k = 0; k < 7; k++) { const x = new Date(monday + "T12:00:00"); x.setDate(x.getDate() + k); if (done.has(`${f.id}|${isoOf(x)}`)) n++; }
        if (n >= f.times_per_week) continue;
      }
      out.push({ key: `fx:${f.id}:${iso}`, fixed: f, date: iso, done: isDone });
    }
    if (out.length > 4000) break;
  }
  return out;
}
export const parseFixedKey = (key: string) => { const m = key.match(/^fx:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/); return m ? { id: m[1]!, date: m[2]! } : null; };
