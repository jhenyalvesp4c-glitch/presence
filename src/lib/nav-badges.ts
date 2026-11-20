/**
 * Indicadores dos botões de acesso rápido (barra lateral e menu do topo): o que está pedindo atenção em cada página.
 * Funções puras (sem rede) para testar; o hook `useNavBadges` junta os dados reais.
 */
import { addMonths, brl, closingDateOf, dayIn, dueYmOfClosing, invoiceFor, isoOf, parseIso, payDateOf, ymOf } from "./finance/calc";
import type { FinanceState } from "./finance/types";
import { staleIdeas, type Idea } from "./ideas";

export type Badge = { n: number; text: string; tone: "cyan" | "amber" | "rose" };
export type Badges = Partial<Record<"/tarefas" | "/financeiro" | "/ideias" | "/habitos", Badge>>;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const dias = (n: number) => (n <= 0 ? "hoje" : n === 1 ? "amanhã" : `em ${n} dias`);
const daysBetween = (a: string, b: string) => Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86_400_000);

/** Tarefas que precisam de você: as de hoje e as atrasadas (não concluídas). */
export function taskBadge(tasks: { done: boolean; due_date: string | null }[], todayIso: string): Badge | null {
  const open = tasks.filter((t) => !t.done && t.due_date), late = open.filter((t) => t.due_date! < todayIso).length, hoje = open.filter((t) => t.due_date === todayIso).length;
  if (!late && !hoje) return null;
  const parts = [hoje ? `${plural(hoje, "tarefa", "tarefas")} para hoje` : "", late ? `${plural(late, "atrasada", "atrasadas")}` : ""].filter(Boolean);
  return { n: late + hoje, text: parts.join(" · "), tone: late ? "amber" : "cyan" };
}

/** Faturas fechando nos próximos dias (ou o dia de pagar, para quem paga no fechamento). */
export function financeBadge(s: FinanceState | null, today: Date, within = 3): Badge | null {
  if (!s || !s.cards.length) return null;
  const todayIso = isoOf(today), items: { text: string; days: number }[] = [];
  for (const c of s.cards) {
    // quem paga no fechamento: o dia de pagar é logo depois do último fechamento
    if (c.payAfterClose !== undefined) {
      const last = [ymOf(today), addMonths(ymOf(today), -1)].map((ym) => dayIn(ym, c.closingDay)).find((d) => d <= todayIso)!, dueYmLast = dueYmOfClosing(c, ymOf(last)), totalLast = invoiceFor(s, c, dueYmLast).total;
      if (payDateOf(c, dueYmLast) === todayIso && totalLast > 0) { items.push({ text: `Pagar a fatura do ${c.name} hoje (${brl(totalLast)})`, days: 0 }); continue; }
    }
    // próximo fechamento: neste mês ou no seguinte
    const close = [ymOf(today), addMonths(ymOf(today), 1)].map((ym) => dayIn(ym, c.closingDay)).find((d) => d >= todayIso)!;
    const dueYm = dueYmOfClosing(c, ymOf(close)), total = invoiceFor(s, c, dueYm).total, dClose = daysBetween(todayIso, close);
    if (dClose >= 0 && dClose <= within && closingDateOf(c, dueYm) === close) items.push({ text: `${c.name} fecha ${dias(dClose)}${total > 0 ? ` · ${brl(total)}` : ""}`, days: dClose });
  }
  if (!items.length) return null;
  items.sort((a, b) => a.days - b.days);
  return { n: items.length, text: items.map((i) => i.text).join(" · "), tone: items[0]!.days <= 1 ? "rose" : "amber" };
}

/** Ideias paradas há 30 dias ou mais. */
export function ideaBadge(ideas: Idea[], now: Date): Badge | null {
  const n = staleIdeas(ideas, now).length;
  return n ? { n, text: `${plural(n, "ideia parada", "ideias paradas")} há mais de 30 dias`, tone: "amber" } : null;
}

/** Hábitos ativos que ainda não foram feitos hoje. */
export function habitBadge(habits: { id: string }[], completions: { habit_id: string; completed_on: string }[], todayIso: string): Badge | null {
  const done = new Set(completions.filter((c) => c.completed_on === todayIso).map((c) => c.habit_id)), n = habits.filter((h) => !done.has(h.id)).length;
  return n ? { n, text: `Faltam ${plural(n, "hábito", "hábitos")} hoje`, tone: "cyan" } : null;
}
