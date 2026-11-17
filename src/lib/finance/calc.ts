/** Cálculos do módulo financeiro: faturas, parcelas, projeções, categorias e alertas. Puro (recebe `today`), fácil de testar. */
import { catOf } from "./categories";
import type { Account, Card, Entry, FinanceState, Plan, Recurring, Transaction } from "./types";

/* ───────────── datas ───────────── */
const pad = (n: number) => String(n).padStart(2, "0");
export const ymOf = (d: Date | string): string => (typeof d === "string" ? d.slice(0, 7) : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
export const isoOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = (s: string): Date => { const [y, m, d] = s.split("-").map(Number); return new Date(y!, (m ?? 1) - 1, d ?? 1); };
export const addMonths = (ym: string, n: number): string => { const [y, m] = ym.split("-").map(Number); const t = (y! * 12 + (m! - 1)) + n; return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`; };
export const monthsBetween = (a: string, b: string): number => { const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number); return (yb! * 12 + mb!) - (ya! * 12 + ma!); };
export const daysIn = (ym: string): number => { const [y, m] = ym.split("-").map(Number); return new Date(y!, m!, 0).getDate(); };
export const dayIn = (ym: string, day: number): string => `${ym}-${pad(Math.min(day, daysIn(ym)))}`;
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MES_FULL = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthShort = (ym: string) => MES[Number(ym.slice(5, 7)) - 1]!;
export const monthLabel = (ym: string) => `${monthShort(ym)}/${ym.slice(2, 4)}`;
export const monthName = (ym: string) => `${MES_FULL[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));

/* ───────────── fatura do cartão ───────────── */
/** Mês de VENCIMENTO da fatura em que uma compra feita em `dateIso` cai. */
export function invoiceMonthOf(card: Pick<Card, "closingDay" | "dueDay">, dateIso: string): string {
  const d = parseIso(dateIso), ym = ymOf(d);
  const closeYm = d.getDate() <= card.closingDay ? ym : addMonths(ym, 1);
  return card.dueDay > card.closingDay ? closeYm : addMonths(closeYm, 1);
}
/** Data de vencimento da fatura do mês `dueYm`. */
export const dueDateOf = (card: Pick<Card, "dueDay">, dueYm: string): string => dayIn(dueYm, card.dueDay);

/* ───────────── parcelas ───────────── */
export type PlanInfo = {
  paid: number; remaining: number; pct: number; currentIndex: number; nextDue: string | null;
  lastYm: string; remainingAmount: number; paidAmount: number; done: boolean;
  schedule: { n: number; ym: string; due: string; amount: number; paid: boolean }[];
};
/** Valor da parcela `n` (1..count) de um plano; a última absorve a diferença de centavos. */
export const parcelAmount = (plan: Plan, n: number) => {
  if (n !== plan.count) return plan.per;
  const last = round2(plan.total - plan.per * (plan.count - 1));
  return last > 0 ? last : plan.per;
};
export function planInfo(plan: Plan, card: Pick<Card, "dueDay"> | undefined, today: Date): PlanInfo {
  const dueDay = card?.dueDay ?? 10;
  const todayIso = isoOf(today);
  const schedule = Array.from({ length: plan.count }, (_, i) => {
    const ym = addMonths(plan.first, i), due = dayIn(ym, dueDay);
    return { n: i + 1, ym, due, amount: parcelAmount(plan, i + 1), paid: due <= todayIso };
  });
  if (plan.paidManual !== undefined) schedule.forEach((p, i) => { p.paid = i < Math.max(0, Math.min(plan.count, plan.paidManual!)); });
  const paid = schedule.filter((p) => p.paid).length, remaining = plan.count - paid;
  const next = schedule.find((p) => !p.paid);
  return {
    paid, remaining, pct: plan.count ? Math.round((paid / plan.count) * 100) : 0, currentIndex: Math.min(plan.count, paid + 1),
    nextDue: next?.due ?? null, lastYm: schedule[schedule.length - 1]!.ym,
    remainingAmount: sum(schedule.filter((p) => !p.paid).map((p) => p.amount)), paidAmount: sum(schedule.filter((p) => p.paid).map((p) => p.amount)), done: remaining === 0, schedule,
  };
}

/* ───────────── recorrentes: ativas, pausadas e assinaturas ───────────── */
/** A recorrente conta no mês `ym`? (já começou e não está dentro de uma pausa) */
export const recurringActiveIn = (r: Recurring, ym: string): boolean => ym >= r.startYm && !(r.pauses ?? []).some((p) => ym >= p.from && (!p.to || ym <= p.to));
/** Está pausada agora (tem uma pausa sem fim). */
export const isPaused = (r: Recurring): boolean => (r.pauses ?? []).some((p) => !p.to);
export const isSubscription = (r: Recurring): boolean => r.kind === "despesa" && (!!r.subscription || r.category === "assinaturas");
/**
 * Pausa a partir da próxima cobrança: se a deste mês já passou (ou é hoje), a pausa começa no mês seguinte,
 * para não apagar uma cobrança que já aconteceu.
 */
export function pauseRecurring(r: Recurring, today: Date): Recurring {
  if (isPaused(r)) return r;
  const cur = ymOf(today), from = dayIn(cur, r.day) > isoOf(today) ? cur : addMonths(cur, 1);
  return { ...r, pauses: [...(r.pauses ?? []), { from: from < r.startYm ? r.startYm : from }] };
}
/** Reativa a partir da próxima cobrança (a de hoje conta). Se nenhum mês chegou a ficar pausado, a pausa some. */
export function resumeRecurring(r: Recurring, today: Date): Recurring {
  if (!isPaused(r)) return r;
  const cur = ymOf(today), back = dayIn(cur, r.day) >= isoOf(today) ? cur : addMonths(cur, 1), to = addMonths(back, -1);
  const pauses = (r.pauses ?? []).flatMap((p) => (p.to ? [p] : to < p.from ? [] : [{ from: p.from, to }]));
  return { ...r, pauses };
}
/** Mês em que a pausa aberta começou (ou começa). */
export const pausedSince = (r: Recurring): string | null => (r.pauses ?? []).find((p) => !p.to)?.from ?? null;
/** Data da próxima cobrança de uma recorrente ativa (hoje conta). */
export function nextCharge(r: Recurring, today: Date): string | null {
  const todayIso = isoOf(today);
  for (let i = 0, ym = ymOf(today); i < 24; i++, ym = addMonths(ym, 1)) { if (!recurringActiveIn(r, ym)) continue; const d = dayIn(ym, r.day); if (d >= todayIso) return d; }
  return null;
}

/* ───────────── lançamentos de um mês ───────────── */
function recurringEntry(r: Recurring, ym: string): Entry | null {
  if (!recurringActiveIn(r, ym)) return null;
  return { id: `${r.id}:${ym}`, kind: r.kind, desc: r.desc, amount: r.amount, date: dayIn(ym, r.day), category: r.category, method: r.method, accountId: r.accountId, cardId: r.cardId, source: "recorrente" };
}
const txEntry = (t: Transaction): Entry => ({ id: t.id, kind: t.kind, desc: t.desc, amount: t.amount, date: t.date, category: t.category, method: t.method, accountId: t.accountId, cardId: t.cardId, source: "tx" });

/** Tudo que entra e sai no mês do calendário `ym` (compras na data da compra, parcelas no mês de vencimento, recorrentes). */
export function monthEntries(s: FinanceState, ym: string, upTo?: string): Entry[] {
  const out: Entry[] = [];
  for (const t of s.transactions) if (ymOf(t.date) === ym) out.push(txEntry(t));
  for (const p of s.plans) {
    const card = s.cards.find((c) => c.id === p.cardId), dueDay = card?.dueDay ?? 10;
    for (let n = 1; n <= p.count; n++) if (addMonths(p.first, n - 1) === ym) out.push({ id: `${p.id}:${n}`, kind: "despesa", desc: p.desc, amount: parcelAmount(p, n), date: dayIn(ym, dueDay), category: p.category, method: "credito", cardId: p.cardId, source: "parcela", planId: p.id, parcel: `${n}/${p.count}` });
  }
  for (const r of s.recurring) { const e = recurringEntry(r, ym); if (e) out.push(e); }
  return out.filter((e) => !upTo || e.date <= upTo).sort((a, b) => b.date.localeCompare(a.date));
}
/** Mesmo dia do mês anterior (para comparar "até hoje" com o mês passado até o mesmo dia). */
export const sameDayPrev = (ym: string, upTo: string): string => dayIn(addMonths(ym, -1), Number(upTo.slice(8, 10)));

export type MonthSummary = { receitas: number; despesas: number; aReceber: number; aPagar: number; resultado: number; previsto: number };
/** Realizado até hoje × ainda por acontecer neste mês (salário do dia 30 só conta quando chegar o dia 30). */
export function monthSummary(s: FinanceState, ym: string, todayIso: string): MonthSummary {
  const es = monthEntries(s, ym), done = es.filter((e) => e.date <= todayIso), later = es.filter((e) => e.date > todayIso);
  const receitas = total(incomeOf(done)), despesas = total(expensesOf(done)), aReceber = total(incomeOf(later)), aPagar = total(expensesOf(later));
  return { receitas, despesas, aReceber, aPagar, resultado: round2(receitas - despesas), previsto: round2(receitas + aReceber - despesas - aPagar) };
}
export const expensesOf = (es: Entry[]) => es.filter((e) => e.kind === "despesa");
export const incomeOf = (es: Entry[]) => es.filter((e) => e.kind === "receita");
export const total = (es: Entry[]) => sum(es.map((e) => e.amount));

export type CatTotal = { id: string; name: string; color: string; value: number; pct: number; prev: number; delta: number; deltaPct: number | null };
export function categoryTotals(s: FinanceState, ym: string, upTo?: string): CatTotal[] {
  const cur = expensesOf(monthEntries(s, ym, upTo)), prev = expensesOf(monthEntries(s, addMonths(ym, -1), upTo ? sameDayPrev(ym, upTo) : undefined));
  const all = total(cur), by = new Map<string, number>(), pv = new Map<string, number>();
  for (const e of cur) by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
  for (const e of prev) pv.set(e.category, (pv.get(e.category) ?? 0) + e.amount);
  return [...by.entries()].map(([id, value]) => {
    const c = catOf(id), p = pv.get(id) ?? 0;
    return { id, name: c.name, color: c.color, value: round2(value), pct: all ? (value / all) * 100 : 0, prev: round2(p), delta: round2(value - p), deltaPct: p > 0 ? ((value - p) / p) * 100 : null };
  }).sort((a, b) => b.value - a.value);
}

export type MonthPoint = { ym: string; label: string; receitas: number; despesas: number; saldo: number; acumulado: number };
/** Série dos últimos `n` meses (inclui o atual) com receitas, despesas e saldo acumulado. */
export function monthlySeries(s: FinanceState, currentYm: string, n = 6, upTo?: string): MonthPoint[] {
  let acc = 0;
  return Array.from({ length: n }, (_, i) => addMonths(currentYm, i - (n - 1))).map((ym) => {
    const es = monthEntries(s, ym, ym === currentYm ? upTo : undefined), receitas = total(incomeOf(es)), despesas = total(expensesOf(es)), saldo = round2(receitas - despesas);
    acc = round2(acc + saldo);
    return { ym, label: monthShort(ym), receitas, despesas, saldo, acumulado: acc };
  });
}

/* ───────────── saldos, limites e faturas ───────────── */
export function accountBalance(s: FinanceState, a: Account, today: Date = new Date()): number {
  let v = a.balanceBase;
  for (const t of s.transactions) {
    if (t.accountId !== a.id || t.date < a.baseDate || t.method === "credito") continue;
    v += t.kind === "receita" ? t.amount : -t.amount;
  }
  // salário e despesas fixas pagos na conta mexem no saldo quando o dia deles chega (depois do saldo informado)
  const todayIso = isoOf(today);
  for (let ym = ymOf(a.baseDate); ym <= ymOf(todayIso); ym = addMonths(ym, 1)) {
    for (const r of s.recurring) {
      if (r.accountId !== a.id || r.method === "credito" || !recurringActiveIn(r, ym)) continue;
      const d = dayIn(ym, r.day);
      if (d >= a.baseDate && d <= todayIso) v += r.kind === "receita" ? r.amount : -r.amount;
    }
  }
  return round2(v);
}
export const totalBalance = (s: FinanceState, today: Date = new Date()) => sum(s.accounts.map((a) => accountBalance(s, a, today)));

/** Quanto do limite está livre: o informado no briefing menos o que foi gasto no crédito depois dele. */
export function cardAvailable(s: FinanceState, c: Card): number {
  let used = 0;
  for (const t of s.transactions) if (t.cardId === c.id && t.method === "credito" && t.kind === "despesa" && t.date >= c.baseDate) used += t.amount;
  for (const p of s.plans) if (p.cardId === c.id && p.createdAt >= c.baseDate) used += p.total;
  return Math.max(0, round2(c.availableBase - used));
}

export type InvoiceLine = { id: string; desc: string; amount: number; date: string; category: string; parcel?: string | undefined; source: Entry["source"] | "ajuste" };
export type Invoice = { cardId: string; ym: string; due: string; lines: InvoiceLine[]; total: number; adjustment: number };
export function invoiceFor(s: FinanceState, card: Card, dueYm: string): Invoice {
  const lines: InvoiceLine[] = [];
  for (const t of s.transactions) if (t.cardId === card.id && t.method === "credito" && t.kind === "despesa" && invoiceMonthOf(card, t.date) === dueYm) lines.push({ id: t.id, desc: t.desc, amount: t.amount, date: t.date, category: t.category, source: "tx" });
  for (const p of s.plans) if (p.cardId === card.id) for (let n = 1; n <= p.count; n++) if (addMonths(p.first, n - 1) === dueYm) lines.push({ id: `${p.id}:${n}`, desc: p.desc, amount: parcelAmount(p, n), date: dayIn(dueYm, card.dueDay), category: p.category, parcel: `${n}/${p.count}`, source: "parcela" });
  for (const r of s.recurring) if (r.cardId === card.id && r.kind === "despesa" && recurringActiveIn(r, dueYm)) lines.push({ id: `${r.id}:${dueYm}`, desc: r.desc, amount: r.amount, date: dayIn(dueYm, r.day), category: r.category, source: "recorrente" });
  const adjustment = card.adjustments[dueYm] ?? 0;
  if (adjustment) lines.push({ id: `adj:${dueYm}`, desc: "Outros valores pendentes", amount: adjustment, date: dueDateOf(card, dueYm), category: "outros", source: "ajuste" });
  return { cardId: card.id, ym: dueYm, due: dueDateOf(card, dueYm), lines: lines.sort((a, b) => b.date.localeCompare(a.date)), total: sum(lines.map((l) => l.amount)), adjustment };
}
/** Data de fechamento da fatura que vence em `dueYm`. */
export const closingDateOf = (card: Pick<Card, "closingDay" | "dueDay">, dueYm: string): string => dayIn(card.dueDay > card.closingDay ? dueYm : addMonths(dueYm, -1), card.closingDay);
/** "fecha 28/11 · vence 05/12": sempre as duas datas, para não confundir mês de fechamento com mês de vencimento. */
export const invoiceLabel = (card: Pick<Card, "closingDay" | "dueDay">, dueYm: string): string => `fecha ${dateBR(closingDateOf(card, dueYm)).slice(0, 5)} · vence ${dateBR(dueDateOf(card, dueYm)).slice(0, 5)}`;
/** A fatura aberta agora (a do ciclo em que hoje está). */
export const openInvoice = (s: FinanceState, card: Card, today: Date): Invoice => invoiceFor(s, card, invoiceMonthOf(card, isoOf(today)));
export const upcomingInvoices = (s: FinanceState, card: Card, today: Date, n = 4): Invoice[] => { const m = invoiceMonthOf(card, isoOf(today)); return Array.from({ length: n }, (_, i) => invoiceFor(s, card, addMonths(m, i))); };
export const totalOpenInvoices = (s: FinanceState, today: Date) => sum(s.cards.map((c) => openInvoice(s, c, today).total));

/* ───────────── fluxo de caixa previsto ───────────── */
/**
 * Sobra (ou falta) de caixa depois de pagar tudo que já está comprometido:
 * saldo de hoje + o que ainda entra no mês − contas que saem da conta no mês − faturas abertas dos cartões.
 * Compras no crédito não entram à parte (já estão dentro das faturas), para não contar duas vezes.
 */
export type MonthClose = { saldo: number; aReceber: number; aPagarConta: number; faturas: number; sobra: number };
export function monthClose(s: FinanceState, today: Date): MonthClose {
  const todayIso = isoOf(today), later = monthEntries(s, ymOf(today)).filter((e) => e.date > todayIso);
  const saldo = totalBalance(s, today), aReceber = total(incomeOf(later));
  const aPagarConta = total(expensesOf(later).filter((e) => !e.cardId && e.method !== "credito")), faturas = totalOpenInvoices(s, today);
  return { saldo, aReceber, aPagarConta, faturas, sobra: round2(saldo + aReceber - aPagarConta - faturas) };
}

export type FlowEvent = { id: string; date: string; label: string; amount: number; kind: "receita" | "despesa" | "fatura"; cardId?: string | undefined; balance: number };
export type Cashflow = { start: number; events: FlowEvent[]; end: number; min: number; firstNegative: FlowEvent | null; until: string };
/**
 * O que ainda vai entrar e sair nos próximos dias, na ordem, com o saldo depois de cada item.
 * Entram: salário e fixas pagas em conta (ainda por vir) e as faturas dos cartões que vencem na janela.
 * Compras no crédito, parcelas e fixas no cartão NÃO entram à parte: já estão dentro da fatura.
 */
export function cashflow(s: FinanceState, today: Date, days = 60): Cashflow {
  const todayIso = isoOf(today), end = isoOf(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));
  const raw: Omit<FlowEvent, "balance">[] = [];
  for (let ym = ymOf(todayIso); ym <= ymOf(end); ym = addMonths(ym, 1)) {
    for (const r of s.recurring) {
      if (r.cardId || r.method === "credito" || !recurringActiveIn(r, ym)) continue;
      const d = dayIn(ym, r.day);
      if (d > todayIso && d <= end) raw.push({ id: `${r.id}:${ym}`, date: d, label: r.desc, amount: r.kind === "receita" ? r.amount : -r.amount, kind: r.kind });
    }
  }
  for (const c of s.cards) for (const inv of upcomingInvoices(s, c, today, 4)) if (inv.total > 0 && inv.due > todayIso && inv.due <= end) raw.push({ id: `fat:${c.id}:${inv.ym}`, date: inv.due, label: `Fatura ${c.name}`, amount: -inv.total, kind: "fatura", cardId: c.id });
  raw.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount); // no mesmo dia, o que entra vem antes do que sai
  const start = totalBalance(s, today);
  let bal = start, min = start;
  const events = raw.map((e) => { bal = round2(bal + e.amount); min = Math.min(min, bal); return { ...e, balance: bal }; });
  return { start, events, end: bal, min, firstNegative: events.find((e) => e.balance < 0) ?? null, until: end };
}

/* ───────────── comprometimento futuro ───────────── */
export type Commitment = { ym: string; label: string; parcelas: number; recorrentes: number; total: number; porCartao: Record<string, number> };
export function commitments(s: FinanceState, currentYm: string, n = 12): Commitment[] {
  return Array.from({ length: n }, (_, i) => addMonths(currentYm, i)).map((ym) => {
    const porCartao: Record<string, number> = {};
    let parcelas = 0;
    for (const p of s.plans) for (let k = 1; k <= p.count; k++) if (addMonths(p.first, k - 1) === ym) { const v = parcelAmount(p, k); parcelas += v; porCartao[p.cardId] = round2((porCartao[p.cardId] ?? 0) + v); }
    const recorrentes = sum(s.recurring.filter((r) => r.kind === "despesa" && recurringActiveIn(r, ym)).map((r) => r.amount));
    return { ym, label: monthShort(ym), parcelas: round2(parcelas), recorrentes, total: round2(parcelas + recorrentes), porCartao };
  });
}
export const totalFutureParcels = (s: FinanceState, today: Date) => sum(s.plans.map((p) => planInfo(p, s.cards.find((c) => c.id === p.cardId), today).remainingAmount));

/* ───────────── alertas e "por que aumentou" ───────────── */
export type Alert = { id: string; level: "danger" | "warning" | "info"; title: string; detail: string };
export function alertsFor(s: FinanceState, today: Date): Alert[] {
  const ym = ymOf(today), out: Alert[] = [];
  const todayIso = isoOf(today), cats = categoryTotals(s, ym, todayIso);
  for (const c of cats) {
    const base = [1, 2, 3].map((i) => total(expensesOf(monthEntries(s, addMonths(ym, -i))).filter((e) => e.category === c.id))), avg = sum(base) / 3;
    if (avg > 0 && c.value > avg * 1.3 && c.value - avg >= 80) out.push({ id: `cat:${c.id}`, level: c.value > avg * 1.6 ? "danger" : "warning", title: `${c.name} acima do normal`, detail: `R$ ${c.value.toFixed(0)} neste mês, ${Math.round(((c.value - avg) / avg) * 100)}% acima da sua média dos últimos 3 meses.` });
  }
  const es = monthEntries(s, ym, todayIso), rec = total(incomeOf(es)), exp = total(expensesOf(es));
  const flow = cashflow(s, today, 60);
  if (flow.firstNegative) out.push({ id: "fluxo", level: "danger", title: `Seu saldo previsto fica negativo em ${dateBR(flow.firstNegative.date).slice(0, 5)}`, detail: `Depois de ${flow.firstNegative.label}, faltam R$ ${Math.abs(flow.firstNegative.balance).toFixed(2).replace(".", ",")}. No pior ponto dos próximos 60 dias faltam R$ ${Math.abs(flow.min).toFixed(2).replace(".", ",")}.` });
  if (rec > 0 && exp > rec) out.push({ id: "saldo", level: "danger", title: "Despesas acima das receitas", detail: `Você já gastou R$ ${(exp - rec).toFixed(0)} a mais do que entrou neste mês.` });
  for (const c of s.cards) {
    const used = c.limit ? 1 - cardAvailable(s, c) / c.limit : 0;
    if (used >= 0.8) out.push({ id: `lim:${c.id}`, level: used >= 0.95 ? "danger" : "warning", title: `Limite do ${c.name} quase no fim`, detail: `${Math.round(used * 100)}% do limite já está usado.` });
    const inv = openInvoice(s, c, today), days = Math.ceil((parseIso(inv.due).getTime() - parseIso(isoOf(today)).getTime()) / 86400000);
    if (inv.total > 0 && days >= 0 && days <= 5) out.push({ id: `venc:${c.id}`, level: "info", title: `Fatura do ${c.name} vence ${days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`}`, detail: `Valor atual: R$ ${inv.total.toFixed(2).replace(".", ",")}.` });
  }
  const next = commitments(s, addMonths(ym, 1), 1)[0];
  if (next && rec > 0 && next.parcelas > rec * 0.4) out.push({ id: "parc", level: "warning", title: "Parcelas pesam no próximo mês", detail: `R$ ${next.parcelas.toFixed(0)} em parcelas, ${Math.round((next.parcelas / rec) * 100)}% da sua receita mensal.` });
  for (const g of s.goals) if (g.kind === "limite_categoria" && g.category) { const v = total(expensesOf(monthEntries(s, ym)).filter((e) => e.category === g.category)); if (v > g.target) out.push({ id: `meta:${g.id}`, level: "warning", title: `Limite de ${catOf(g.category).name} estourado`, detail: `R$ ${v.toFixed(0)} de um limite de R$ ${g.target.toFixed(0)}.` }); }
  const rank = { danger: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

export type WhyUp = { totalDelta: number; totalPct: number | null; top: { cat: CatTotal; items: Entry[] }[] };
/** Explica o aumento (ou queda) dos gastos em relação ao mês anterior: categorias que mais subiram e as compras que mais pesaram. */
export function whyChanged(s: FinanceState, ym: string, upTo?: string): WhyUp {
  const cur = total(expensesOf(monthEntries(s, ym, upTo))), prev = total(expensesOf(monthEntries(s, addMonths(ym, -1), upTo ? sameDayPrev(ym, upTo) : undefined)));
  const ups = prev > 0 ? categoryTotals(s, ym, upTo).filter((c) => c.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3) : [];
  const es = expensesOf(monthEntries(s, ym, upTo));
  return { totalDelta: round2(cur - prev), totalPct: prev > 0 ? ((cur - prev) / prev) * 100 : null, top: ups.map((cat) => ({ cat, items: es.filter((e) => e.category === cat.id).sort((a, b) => b.amount - a.amount).slice(0, 3) })) };
}

/* ───────────── formatação ───────────── */
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (n: number) => BRL.format(n);
export const brlShort = (n: number) => (Math.abs(n) >= 1000 ? `R$ ${(n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1).replace(".", ",")} mil` : `R$ ${Math.round(n)}`);
export const dateBR = (iso: string) => iso.split("-").reverse().join("/");
