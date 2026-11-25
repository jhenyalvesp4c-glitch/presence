/** Cálculos do módulo financeiro: faturas, parcelas, projeções, categorias e alertas. Puro (recebe `today`), fácil de testar. */
import { catOf } from "./categories";
import type { Account, Card, Entry, FinanceState, Plan, Recurring, Shared, Transaction } from "./types";

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
/** Parte da outra pessoa num gasto dividido (0 se não for dividido) e a sua. */
export const sharedPart = (amount: number, sh?: { percent: number } | undefined): number => (sh ? round2((amount * Math.min(100, Math.max(0, sh.percent))) / 100) : 0);
export const myPart = (amount: number, sh?: { percent: number } | undefined): number => round2(amount - sharedPart(amount, sh));
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
  schedule: { n: number; ym: string; due: string; /** Data e mês de fechamento da fatura em que a parcela cai (é por ele que os meses contam). */ close: string; closeYm: string; amount: number; paid: boolean }[];
};
/** Valor da parcela `n` (1..count) de um plano; a última absorve a diferença de centavos. */
export const parcelAmount = (plan: Plan, n: number) => {
  if (n !== plan.count) return plan.per;
  const last = round2(plan.total - plan.per * (plan.count - 1));
  return last > 0 ? last : plan.per;
};
/** Divisão da parcela `n` de um plano: com ajuda de valor fixo, a pessoa cobre as primeiras parcelas até o valor acabar. */
export const planShare = (p: Plan, n: number): Shared | undefined => {
  const sh = p.shared;
  if (!sh?.fixed || sh.fixed <= 0) return sh;
  let used = 0;
  for (let k = 1; k < n; k++) used += parcelAmount(p, k);
  const amount = parcelAmount(p, n), part = round2(Math.min(amount, Math.max(0, sh.fixed - used)));
  return part > 0 ? { person: sh.person, percent: (part / amount) * 100, fixed: sh.fixed } : undefined;
};
/** Prévia da ajuda fixa: parcelas inteiras cobertas, parcela parcial e quanto sobra para quem compra. */
export const fixedCoverage = (total: number, per: number, count: number, fixed: number) => {
  const plan = { total, per, count } as Plan;
  let left = fixed, full = 0, partial = 0, partialN = 0;
  for (let n = 1; n <= count && left > 0.004; n++) {
    const a = parcelAmount(plan, n);
    if (left >= a - 0.004) { full = n; left = round2(left - a); } else { partial = round2(left); partialN = n; left = 0; }
  }
  const covered = Math.min(fixed, total);
  return { full, partial, partialN, covered, mine: round2(total - covered) };
};
/** Mês de vencimento da primeira fatura ainda não paga (vence depois de hoje). */
export function nextUnpaidYm(card: Pick<Card, "dueDay"> | undefined, today: Date): string {
  const todayIso = isoOf(today), dueDay = card?.dueDay ?? 10;
  for (let ym = ymOf(today), i = 0; i < 3; i++, ym = addMonths(ym, 1)) if (dayIn(ym, dueDay) > todayIso) return ym;
  return addMonths(ymOf(today), 1);
}
/** Mês da 1ª parcela para que a próxima a pagar seja a de número `paid + 1`, caindo na próxima fatura a vencer. */
export const firstFromPaid = (card: Pick<Card, "dueDay"> | undefined, today: Date, paid: number): string => addMonths(nextUnpaidYm(card, today), -Math.max(0, paid));
/**
 * "Já paguei N parcelas" valia só no contador, e as faturas seguiam o calendário (podia cair a parcela errada nesta fatura).
 * Passa a valer nos dois: ajusta o mês da 1ª parcela e tira o contador manual, e dali em diante tudo segue o calendário.
 */
export function migratePaidManual(st: FinanceState, today: Date): FinanceState {
  if (!st.plans.some((p) => p.paidManual !== undefined)) return st;
  return { ...st, plans: st.plans.map((p) => { if (p.paidManual === undefined) return p; const { paidManual, ...rest } = p; return { ...rest, first: firstFromPaid(st.cards.find((c) => c.id === p.cardId), today, Math.min(p.count, paidManual)) }; }) };
}

export function planInfo(plan: Plan, card: (Pick<Card, "dueDay"> & Partial<Pick<Card, "closingDay">>) | undefined, today: Date): PlanInfo {
  const dueDay = card?.dueDay ?? 10;
  const todayIso = isoOf(today);
  const schedule = Array.from({ length: plan.count }, (_, i) => {
    const ym = addMonths(plan.first, i), due = dayIn(ym, dueDay);
    const close = card?.closingDay ? closingDateOf({ closingDay: card.closingDay, dueDay }, ym) : due;
    return { n: i + 1, ym, due, close, closeYm: close.slice(0, 7), amount: parcelAmount(plan, i + 1), paid: due <= todayIso };
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
/** Aviso para mostrar ao pausar: o que acontece com a cobrança deste mês e com as próximas. `r` é a recorrente JÁ pausada (resultado de `pauseRecurring`). */
export function pauseNotice(r: Recurring, today: Date): { jaCobrada: boolean; titulo: string; texto: string } {
  const cur = ymOf(today), since = pausedSince(r) ?? cur, jaCobrada = since > cur, onde = r.cardId ? "fatura" : "despesas";
  return jaCobrada
    ? { jaCobrada, titulo: "Cobrança deste mês já aconteceu", texto: `Ela foi cobrada no dia ${r.day}: continua ${r.cardId ? "na fatura em que caiu" : "nas despesas deste mês"} e só some das próximas ${r.cardId ? "faturas" : "despesas"}, a partir de ${monthLabel(since)}.` }
    : { jaCobrada, titulo: "Cobrança deste mês ainda não aconteceu", texto: `Ela só seria cobrada no dia ${r.day}: já sai ${r.cardId ? "da fatura em que cairia" : "das despesas deste mês"} e de todas as próximas ${onde === "fatura" ? "faturas" : "despesas"}, porque ainda não foi cobrada.` };
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
/** A parte da outra pessoa de um gasto dividido vira uma receita a receber, no mesmo dia do gasto. */
const receivable = (e: Entry, sh: { person: string; percent: number } | undefined): Entry | null => {
  const part = e.kind === "despesa" ? sharedPart(e.amount, sh) : 0;
  return sh && part > 0 ? { id: `${e.id}:sh`, kind: "receita", desc: `A receber de ${sh.person}: ${e.desc}`, amount: part, date: e.date, category: "outros", method: "pix", source: "compartilhada", person: sh.person, ...(e.parcel ? { parcel: e.parcel } : {}) } : null;
};

export function monthEntries(s: FinanceState, ym: string, upTo?: string): Entry[] {
  const out: Entry[] = [];
  const add = (e: Entry, sh: { person: string; percent: number } | undefined) => { out.push(e); const r = receivable(e, sh); if (r) out.push(r); };
  for (const t of s.transactions) if (ymOf(t.date) === ym) add(txEntry(t), t.shared);
  for (const p of s.plans) {
    const card = s.cards.find((c) => c.id === p.cardId);
    // a parcela conta no mês em que a fatura FECHA (não no do vencimento), com a data do fechamento
    for (let n = 1; n <= p.count; n++) { const dueYm = addMonths(p.first, n - 1), date = card ? closingDateOf(card, dueYm) : dayIn(dueYm, 10); if (ymOf(date) === ym) add({ id: `${p.id}:${n}`, kind: "despesa", desc: p.desc, amount: parcelAmount(p, n), date, category: p.category, method: "credito", cardId: p.cardId, source: "parcela", planId: p.id, parcel: `${n}/${p.count}` }, planShare(p, n)); }
  }
  for (const r of s.recurring) { const e = recurringEntry(r, ym); if (e) add(e, r.shared); }
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
/* ───────────── detalhamento da sobra/falta do mês ───────────── */
export type BreakdownGroupId = "fixas" | "assinaturas" | "parcelas" | "cartao" | "avulsas" | "faturas";
export type BreakdownGroup = { id: BreakdownGroupId; label: string; hint: string; total: number; done: number; later: number; pct: number; items: Entry[] };
export type MonthBreakdown = {
  ym: string; income: { total: number; done: number; later: number; items: Entry[] };
  groups: BreakdownGroup[]; expenses: number; previsto: number;
  /** Quanto da renda do mês vai embora (pode passar de 100%). */
  spentPct: number; biggest: Entry[];
  /** Quanto as assinaturas ativas custam neste mês (o que pausar todas economizaria). */
  subscriptions: number;
  /** Gastos para ranking de categorias (na visão de caixa inclui o que há dentro das faturas). */
  catItems?: Entry[];
};
const GROUPS: { id: BreakdownGroupId; label: string; hint: string }[] = [
  { id: "fixas", label: "Contas fixas", hint: "aluguel, luz, internet e outras que se repetem todo mês" },
  { id: "assinaturas", label: "Assinaturas", hint: "streaming, clubes e serviços ativos" },
  { id: "parcelas", label: "Parcelas do cartão", hint: "parcelas de compras parceladas que vencem neste mês" },
  { id: "cartao", label: "Compras no cartão", hint: "compras à vista no crédito feitas neste mês" },
  { id: "avulsas", label: "Gastos do dia a dia", hint: "pix, débito e dinheiro" },
];
/** Em que grupo um gasto do mês entra (para explicar a sobra ou a falta). */
export function groupOf(s: FinanceState, e: Entry): BreakdownGroupId {
  if (e.source === "parcela") return "parcelas";
  if (e.source === "recorrente") { const r = s.recurring.find((x) => x.id === e.id.slice(0, e.id.lastIndexOf(":"))); return r && isSubscription(r) ? "assinaturas" : "fixas"; }
  return e.method === "credito" ? "cartao" : "avulsas";
}
/** Tudo que entra e sai no mês, separado em grupos, somando exatamente a "sobra prevista" (`monthSummary().previsto`). */
export function monthBreakdown(s: FinanceState, ym: string, todayIso: string): MonthBreakdown {
  const es = monthEntries(s, ym).sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  const inc = incomeOf(es), exp = expensesOf(es), income = total(inc), expenses = total(exp);
  const split = (xs: Entry[]) => ({ done: total(xs.filter((e) => e.date <= todayIso)), later: total(xs.filter((e) => e.date > todayIso)) });
  const groups = GROUPS.map((g) => {
    const items = exp.filter((e) => groupOf(s, e) === g.id), t = total(items);
    return { ...g, items, total: t, ...split(items), pct: income > 0 ? (t / income) * 100 : 0 };
  }).filter((g) => g.items.length > 0).sort((a, b) => b.total - a.total);
  return {
    ym, income: { total: income, items: inc, ...split(inc) }, groups, expenses, previsto: round2(income - expenses),
    spentPct: income > 0 ? (expenses / income) * 100 : expenses > 0 ? 100 : 0,
    biggest: [...exp].sort((a, b) => b.amount - a.amount).slice(0, 3),
    subscriptions: groups.find((g) => g.id === "assinaturas")?.total ?? 0,
  };
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

/* ───────────── cofrinho: dinheiro separado para pagar parcelas ───────────── */
export type FundedParcel = { planId: string; desc: string; n: number; count: number; ym: string; pay: string; amount: number; mine: number; /** O cofrinho paga esta parcela (a partir de `fundedFrom`). */ covered: boolean };
/** Parcelas de uma compra, com a data em que você paga a fatura e a sua parte (a do cofrinho; a de outra pessoa fica de fora). */
export function fundedParcels(s: FinanceState, p: Plan): FundedParcel[] {
  const card = s.cards.find((c) => c.id === p.cardId);
  if (!card) return [];
  return Array.from({ length: p.count }, (_, i) => {
    const n = i + 1, ym = addMonths(p.first, i), amount = parcelAmount(p, n);
    return { planId: p.id, desc: p.desc, n, count: p.count, ym, pay: payDateOf(card, ym), amount, mine: myPart(amount, planShare(p, n)), covered: n >= (p.fundedFrom ?? 1) };
  });
}
export type CofrinhoInfo = {
  balance: number; /** Parcelas que ainda vão sair do cofrinho (a partir de hoje). */ committed: number; /** Saldo depois de pagar todas. Negativo = falta. */ sobra: number;
  plans: { id: string; desc: string; remaining: number; left: number }[]; byMonth: { ym: string; amount: number }[]; /** Último mês com parcela do cofrinho. */ lastYm: string | null;
  /** Primeiro mês em que o cofrinho não cobre a parcela (null = cobre tudo). */ shortYm: string | null;
};
export function cofrinhoInfo(s: FinanceState, a: Account, today: Date = new Date()): CofrinhoInfo {
  const todayIso = isoOf(today), balance = accountBalance(s, a, today), byYm = new Map<string, number>(), plans: CofrinhoInfo["plans"] = [];
  for (const p of s.plans) {
    if (p.fundedBy !== a.id) continue;
    const left = fundedParcels(s, p).filter((x) => x.covered && x.pay > todayIso);
    plans.push({ id: p.id, desc: p.desc, remaining: sum(left.map((x) => x.mine)), left: left.length });
    for (const x of left) byYm.set(ymOf(x.pay), round2((byYm.get(ymOf(x.pay)) ?? 0) + x.mine));
  }
  const byMonth = [...byYm.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([ym, amount]) => ({ ym, amount }));
  const committed = sum(byMonth.map((m) => m.amount));
  let run = balance, shortYm: string | null = null;
  for (const m of byMonth) { run = round2(run - m.amount); if (run < 0 && !shortYm) shortYm = m.ym; }
  return { balance, committed, sobra: round2(balance - committed), plans: plans.sort((x, y) => y.remaining - x.remaining), byMonth, lastYm: byMonth.at(-1)?.ym ?? null, shortYm };
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
  // cofrinho que paga parcelas: cada parcela já paga (data de pagamento depois do saldo informado) sai do cofrinho sozinha
  for (const p of s.plans) if (p.fundedBy === a.id) for (const x of fundedParcels(s, p)) if (x.covered && x.pay > a.baseDate && x.pay <= todayIso) v -= x.mine;
  return round2(v);
}
/** Saldo LIVRE: o dinheiro das contas e carteiras, sem o que está guardado nos cofrinhos (esse já tem destino: pagar parcelas). */
export const totalBalance = (s: FinanceState, today: Date = new Date()) => sum(s.accounts.filter((a) => a.kind !== "cofrinho").map((a) => accountBalance(s, a, today)));
/** Dinheiro guardado nos cofrinhos. */
export const reservedBalance = (s: FinanceState, today: Date = new Date()) => sum(s.accounts.filter((a) => a.kind === "cofrinho").map((a) => accountBalance(s, a, today)));

/**
 * Quanto do limite está livre: o informado (o que o banco mostra) menos o que foi gasto no crédito depois dele.
 * Não consome limite o que já estava dentro do valor informado (`inLimit`, como o detalhamento de uma fatura).
 */
/** Quanto do limite foi usado depois da data-base (compras novas no crédito e parcelamentos novos). */
export function cardUsed(s: FinanceState, c: Card): number {
  let used = 0;
  for (const t of s.transactions) if (t.cardId === c.id && t.method === "credito" && t.kind === "despesa" && t.date >= c.baseDate && !t.inLimit) used += t.amount;
  for (const p of s.plans) if (p.cardId === c.id && p.createdAt >= c.baseDate && !p.inLimit) used += p.total;
  return round2(used);
}
export function cardAvailable(s: FinanceState, c: Card): number {
  return Math.max(0, round2(c.availableBase - cardUsed(s, c)));
}

export type InvoiceLine = { id: string; desc: string; amount: number; /** Parcela paga por um cofrinho (id da conta). */ funded?: string | undefined; date: string; category: string; parcel?: string | undefined; source: Entry["source"] | "ajuste"; /** Gasto dividido: quanto é da outra pessoa. */ shared?: { person: string; percent: number; part: number } | undefined };
/** `declared` = total informado (se houver); `adjustment` = parte ainda não detalhada; `over` = quanto os itens passam do total informado. */
export type Invoice = { cardId: string; ym: string; due: string; lines: InvoiceLine[]; total: number; adjustment: number; declared?: number | undefined; over: number; /** Quanto dos itens é da(s) outra(s) pessoa(s) (o total do banco não muda). */ othersOwe: number; /** Total do banco menos a parte das outras pessoas. */ mine: number; /** Da minha parte, quanto os cofrinhos pagam (dinheiro já separado). */ funded: number; /** Da minha parte, quanto sai do meu bolso (minha parte menos o cofrinho). */ own: number };
const shareOf = (amount: number, sh: { person: string; percent: number } | undefined): { shared?: { person: string; percent: number; part: number } } => { const part = sharedPart(amount, sh); return sh && part > 0 ? { shared: { person: sh.person, percent: sh.percent, part } } : {}; };
export function invoiceFor(s: FinanceState, card: Card, dueYm: string): Invoice {
  const lines: InvoiceLine[] = [];
  for (const t of s.transactions) if (t.cardId === card.id && t.method === "credito" && t.kind === "despesa" && invoiceMonthOf(card, t.date) === dueYm) lines.push({ id: t.id, desc: t.desc, amount: t.amount, date: t.date, category: t.category, source: "tx", ...shareOf(t.amount, t.shared) });
  for (const p of s.plans) if (p.cardId === card.id) for (let n = 1; n <= p.count; n++) if (addMonths(p.first, n - 1) === dueYm) lines.push({ id: `${p.id}:${n}`, desc: p.desc, amount: parcelAmount(p, n), date: dayIn(dueYm, card.dueDay), category: p.category, parcel: `${n}/${p.count}`, source: "parcela", ...(p.fundedBy && n >= (p.fundedFrom ?? 1) ? { funded: p.fundedBy } : {}), ...shareOf(parcelAmount(p, n), planShare(p, n)) });
  // cobrança fixa no cartão: cada cobrança (mês do calendário `m`) cai na fatura que contém a data dela. Assim, pausar depois do dia da renovação
  // mantém a cobrança já feita na fatura certa e só tira as próximas; pausar antes do dia tira também a que ainda não aconteceu.
  for (const r of s.recurring) if (r.cardId === card.id && r.kind === "despesa") for (let k = -3; k <= 1; k++) {
    const m = addMonths(dueYm, k), date = dayIn(m, r.day);
    if (recurringActiveIn(r, m) && invoiceMonthOf(card, date) === dueYm) lines.push({ id: `${r.id}:${m}`, desc: r.desc, amount: r.amount, date, category: r.category, source: "recorrente", ...shareOf(r.amount, r.shared) });
  }
  const items = sum(lines.map((l) => l.amount)), declared = card.declared?.[dueYm];
  // com total informado, o que ainda não foi detalhado é "total − itens" (nunca negativo): detalhar não muda o total
  const adjustment = declared !== undefined ? round2(Math.max(0, declared - items)) : (card.adjustments[dueYm] ?? 0);
  const over = declared !== undefined ? round2(Math.max(0, items - declared)) : 0;
  if (adjustment) lines.push({ id: `adj:${dueYm}`, desc: declared !== undefined ? "Outros valores (ainda não detalhados)" : "Outros valores pendentes", amount: adjustment, date: dueDateOf(card, dueYm), category: "outros", source: "ajuste" });
  const total = sum(lines.map((l) => l.amount)), othersOwe = sum(lines.map((l) => l.shared?.part ?? 0));
  const funded = sum(lines.filter((l) => l.funded).map((l) => l.amount - (l.shared?.part ?? 0))), mine = round2(total - othersOwe);
  return { cardId: card.id, ym: dueYm, due: dueDateOf(card, dueYm), lines: lines.sort((a, b) => b.date.localeCompare(a.date)), total, adjustment, declared, over, othersOwe, mine, funded, own: round2(mine - funded) };
}
/** Data de fechamento da fatura que vence em `dueYm`. */
/**
 * Versões antigas guardavam o total digitado como um valor fixo somado aos itens ("adjustments"), o que duplicava ao cadastrar
 * as compras. Converte para o total informado (`declared`) mantendo o total que já aparecia.
 */
export function migrateInvoiceTotals(st: FinanceState): FinanceState {
  if (!st.cards.some((c) => Object.values(c.adjustments ?? {}).some((v) => v))) return st;
  return { ...st, cards: st.cards.map((c) => {
    const adj = Object.entries(c.adjustments ?? {}).filter(([, v]) => v);
    if (!adj.length) return c;
    const declared = { ...(c.declared ?? {}) }, bare = { ...c, adjustments: {}, declared: {} };
    for (const [ym, v] of adj) if (declared[ym] === undefined) declared[ym] = round2(invoiceFor(st, bare, ym).total + v);
    return { ...c, adjustments: {}, declared };
  }) };
}

/** Informa (ou limpa, com valor vazio ou 0) o total da fatura de um mês, como o banco mostra. */
export function withDeclaredTotal(card: Card, ym: string, value: number | undefined): Card {
  const declared = { ...(card.declared ?? {}) }, adjustments = { ...card.adjustments };
  if (value && value > 0) declared[ym] = round2(value); else delete declared[ym];
  delete adjustments[ym];
  return { ...card, declared, adjustments };
}

/** Mês de fechamento da fatura que vence em `dueYm` (a fatura "de novembro" é a que fecha em novembro). */
export const closingYmOf = (card: Pick<Card, "closingDay" | "dueDay">, dueYm: string): string => (card.dueDay > card.closingDay ? dueYm : addMonths(dueYm, -1));
/** Mês de vencimento da fatura que fecha em `closeYm`. */
export const dueYmOfClosing = (card: Pick<Card, "closingDay" | "dueDay">, closeYm: string): string => (card.dueDay > card.closingDay ? closeYm : addMonths(closeYm, 1));

/**
 * Compra parcelada cadastrada de dentro de uma fatura: a parcela `x` (de `n`) cai exatamente na fatura que vence em `ym`;
 * as anteriores contam como pagas e as seguintes entram nas faturas dos meses seguintes.
 */
export function planForInvoice(card: Card, ym: string, o: { id: string; desc: string; per: number; n: number; x: number; category: string; todayIso: string }): Plan {
  const x = Math.max(1, Math.min(o.n, o.x));
  return { id: o.id, desc: o.desc, cardId: card.id, total: round2(o.per * o.n), count: o.n, per: o.per, purchaseYm: addMonths(closingYmOf(card, ym), -(x - 1)), first: addMonths(ym, -(x - 1)), category: o.category, createdAt: o.todayIso, inLimit: true };
}

/**
 * Assinatura cadastrada de dentro de uma fatura: cobrança fixa mensal no cartão, a partir desta fatura (vence em `ym`),
 * que se repete todo mês até ser pausada (aba Assinaturas).
 */
export function subscriptionForInvoice(card: Card, ym: string, o: { id: string; desc: string; amount: number; day: number }): Recurring {
  const day = Math.max(1, Math.min(31, Math.round(o.day) || 1));
  // 1ª cobrança = o mês do calendário cuja data cai nesta fatura
  const startYm = [-2, -1, 0, 1].map((k) => addMonths(ym, k)).find((m) => invoiceMonthOf(card, dayIn(m, day)) === ym) ?? ym;
  return { id: o.id, kind: "despesa", desc: o.desc, amount: o.amount, day, category: "assinaturas", method: "credito", cardId: card.id, startYm, subscription: true };
}

export const closingDateOf = (card: Pick<Card, "closingDay" | "dueDay">, dueYm: string): string => dayIn(card.dueDay > card.closingDay ? dueYm : addMonths(dueYm, -1), card.closingDay);
/** "fecha 28/11 · vence 05/12": sempre as duas datas, para não confundir mês de fechamento com mês de vencimento. */
export const invoiceLabel = (card: Pick<Card, "closingDay" | "dueDay">, dueYm: string): string => `fecha ${dateBR(closingDateOf(card, dueYm)).slice(0, 5)} · vence ${dateBR(dueDateOf(card, dueYm)).slice(0, 5)}`;
/**
 * Data em que o dinheiro da fatura (que vence em `dueYm`) SAI de verdade. Quem paga no fechamento (`payAfterClose`) paga N dias depois de fechar,
 * sempre dentro do mês do fechamento (nunca na virada do mês); os demais pagam no vencimento.
 */
export function payDateOf(card: Pick<Card, "closingDay" | "dueDay" | "payAfterClose">, dueYm: string): string {
  if (card.payAfterClose === undefined) return dueDateOf(card, dueYm);
  const closeYm = closingYmOf(card, dueYm);
  return dayIn(closeYm, Math.min(card.closingDay + Math.max(0, card.payAfterClose), daysIn(closeYm)));
}
/** Mês de vencimento da fatura cujo pagamento cai no mês de calendário `ym`. */
export const dueYmPaidIn = (card: Pick<Card, "closingDay" | "dueDay" | "payAfterClose">, ym: string): string => (card.payAfterClose === undefined ? ym : dueYmOfClosing(card, ym));
/** "fecha 28/11 · vence 05/12" e, se a pessoa paga antes, "você paga 29/11". */
export const invoiceLabelPay = (card: Pick<Card, "closingDay" | "dueDay" | "payAfterClose">, dueYm: string): string => `${invoiceLabel(card, dueYm)}${card.payAfterClose === undefined ? "" : ` · você paga ${dateBR(payDateOf(card, dueYm)).slice(0, 5)}`}`;
/** A fatura aberta agora (a do ciclo em que hoje está). */
export const openInvoice = (s: FinanceState, card: Card, today: Date): Invoice => invoiceFor(s, card, invoiceMonthOf(card, isoOf(today)));
export const upcomingInvoices = (s: FinanceState, card: Card, today: Date, n = 4): Invoice[] => { const m = invoiceMonthOf(card, isoOf(today)); return Array.from({ length: n }, (_, i) => invoiceFor(s, card, addMonths(m, i))); };
export const totalOpenInvoices = (s: FinanceState, today: Date) => sum(s.cards.map((c) => openInvoice(s, c, today).total));
/** Quanto de uma fatura sai do dinheiro livre: o valor do banco menos o que um cofrinho paga. */
export const cashOut = (inv: Pick<Invoice, "total" | "funded">): number => round2(inv.total - inv.funded);
/** Faturas abertas que saem do dinheiro livre (sem a parte dos cofrinhos). */
export const totalOpenCash = (s: FinanceState, today: Date) => sum(s.cards.map((c) => cashOut(openInvoice(s, c, today))));

/* ───────────── fluxo de caixa previsto ───────────── */
/**
 * Sobra (ou falta) de caixa depois de pagar tudo que já está comprometido:
 * saldo de hoje + o que ainda entra no mês − contas que saem da conta no mês − faturas abertas dos cartões.
 * Compras no crédito não entram à parte (já estão dentro das faturas), para não contar duas vezes.
 */
export type MonthClose = { saldo: number; aReceber: number; aPagarConta: number; faturas: number; sobra: number; /** Das faturas abertas, quanto os cofrinhos pagam (já separado; fora da conta acima). */ cofrinhosPagam: number };
export function monthClose(s: FinanceState, today: Date): MonthClose {
  const todayIso = isoOf(today), later = monthEntries(s, ymOf(today)).filter((e) => e.date > todayIso);
  const saldo = totalBalance(s, today), aReceber = total(incomeOf(later));
  const aPagarConta = total(expensesOf(later).filter((e) => !e.cardId && e.method !== "credito")), faturas = totalOpenCash(s, today);
  return { saldo, aReceber, aPagarConta, faturas, sobra: round2(saldo + aReceber - aPagarConta - faturas), cofrinhosPagam: sum(s.cards.map((c) => openInvoice(s, c, today).funded)) };
}

/**
 * Detalhamento da SOBRA DE CAIXA (a mesma conta de `monthClose`): o que já está nas contas + o que ainda entra no mês,
 * menos o que ainda sai das contas e as faturas dos cartões. Compras e parcelas no crédito aparecem dentro das faturas.
 */
export function cashBreakdown(s: FinanceState, today: Date): MonthBreakdown {
  const todayIso = isoOf(today), ym = ymOf(today), c = monthClose(s, today);
  const later = monthEntries(s, ym).filter((e) => e.date > todayIso).sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
  const incLater = incomeOf(later), outAcct = expensesOf(later).filter((e) => !e.cardId && e.method !== "credito");
  const mk = (id: string, desc: string, amount: number, kind: "receita" | "despesa", over: Partial<Entry> = {}): Entry => ({ id, kind, desc, amount, date: todayIso, category: "outros", method: "debito", source: "tx", ...over });
  const items: Entry[] = [...(c.saldo > 0 ? [mk("saldo", "Saldo nas contas hoje", c.saldo, "receita")] : []), ...incLater];
  const faturas: Entry[] = [], catItems: Entry[] = [...outAcct];
  for (const card of s.cards) {
    const inv = openInvoice(s, card, today);
    if (inv.total <= 0) continue;
    if (cashOut(inv) > 0) faturas.push(mk(`fat:${card.id}`, `Fatura ${card.name} · ${invoiceLabel(card, inv.ym)}${inv.funded > 0 ? ` (o cofrinho paga ${brl(inv.funded)})` : ""}`, cashOut(inv), "despesa", { date: inv.due, method: "credito", cardId: card.id }));
    for (const l of inv.lines) catItems.push(mk(l.id, l.desc, l.amount, "despesa", { date: l.date, category: l.category, method: "credito", cardId: card.id, source: l.source === "parcela" ? "parcela" : "tx", parcel: l.parcel }));
  }
  const buckets: Record<string, Entry[]> = { fixas: [], assinaturas: [], avulsas: [], faturas };
  for (const e of outAcct) buckets[groupOf(s, e)]!.push(e);
  if (c.saldo < 0) buckets["avulsas"]!.push(mk("saldo-neg", "Saldo negativo nas contas", -c.saldo, "despesa"));
  const incomeTotal = round2(Math.max(c.saldo, 0) + c.aReceber);
  const labels: Record<string, { label: string; hint: string }> = { ...Object.fromEntries(GROUPS.map((g) => [g.id, { label: g.label, hint: g.hint }])), avulsas: { label: "Outros gastos das contas", hint: "pix, débito e dinheiro que ainda vão sair" }, faturas: { label: "Faturas dos cartões", hint: "o que você paga pelos cartões; compras e parcelas já estão dentro delas" } };
  const groups = (Object.keys(buckets) as BreakdownGroupId[]).map((id) => { const xs = buckets[id]!, t = total(xs); return { id, label: labels[id]!.label, hint: labels[id]!.hint, items: xs, total: t, done: 0, later: t, pct: incomeTotal > 0 ? (t / incomeTotal) * 100 : 0 }; }).filter((g) => g.items.length > 0).sort((a, b) => b.total - a.total);
  const expenses = round2(sum(groups.map((g) => g.total)));
  const subscriptions = sum(s.recurring.filter((r) => isSubscription(r) && recurringActiveIn(r, ym)).map((r) => r.amount));
  return {
    ym, income: { total: incomeTotal, done: Math.max(c.saldo, 0), later: c.aReceber, items }, groups, expenses, previsto: round2(incomeTotal - expenses),
    spentPct: incomeTotal > 0 ? (expenses / incomeTotal) * 100 : expenses > 0 ? 100 : 0,
    biggest: groups.flatMap((g) => g.items).sort((a, b) => b.amount - a.amount).slice(0, 3), subscriptions, catItems,
  };
}


/* ───────────── projeção mês a mês ───────────── */
export type PlanItem = { id: string; group: "entradas" | "fixas" | "assinaturas" | "faturas" | "avulsas"; label: string; amount: number; date: string; detail?: string | undefined; cardId?: string | undefined; lines?: InvoiceLine[] | undefined; /** Fatura: quanto um cofrinho paga (fora do saldo). */ funded?: number | undefined };
export type MonthPlan = {
  ym: string; label: string; entradas: number; fixas: number; assinaturas: number; faturas: number; avulsas: number;
  /** Parte das faturas que são parcelas de compras parceladas (já dentro de `faturas`). */
  parcelas: number;
  /** Das faturas pagas no mês, quanto os cofrinhos pagam (não sai do saldo). */
  cofrinhos: number;
  /** Assinaturas cobradas no cartão (já dentro de `faturas`); somadas a `assinaturas` dão o custo total de assinaturas do mês. */
  assinaturasCartao: number;
  saidas: number; resultado: number; saldoFinal: number; items: PlanItem[];
};
/**
 * O que entra e sai do caixa em cada um dos próximos meses (saldo de hoje como ponto de partida): salário e outras entradas fixas,
 * contas fixas e assinaturas pagas em conta, avulsos futuros e as faturas dos cartões que vencem no mês (compras, parcelas,
 * assinaturas e fixas no cartão já estão dentro delas). No mês atual só entra o que ainda não aconteceu.
 */
export function monthPlan(s: FinanceState, today: Date, months = 12): MonthPlan[] {
  const todayIso = isoOf(today), cur = ymOf(today), out: MonthPlan[] = [];
  let bal = totalBalance(s, today);
  for (let i = 0; i < months; i++) {
    const ym = addMonths(cur, i), items: PlanItem[] = [], future = (d: string) => d > todayIso;
    for (const r of s.recurring) {
      if (r.cardId || r.method === "credito" || !recurringActiveIn(r, ym)) continue;
      const date = dayIn(ym, r.day);
      if (!future(date)) continue;
      items.push({ id: `${r.id}:${ym}`, group: r.kind === "receita" ? "entradas" : isSubscription(r) ? "assinaturas" : "fixas", label: r.desc, amount: r.amount, date });
    }
    for (const t of s.transactions) {
      if (ymOf(t.date) !== ym || !future(t.date) || t.method === "credito" || t.cardId) continue;
      items.push({ id: t.id, group: t.kind === "receita" ? "entradas" : "avulsas", label: t.desc, amount: t.amount, date: t.date });
    }
    let parcelas = 0, assinCartao = 0, cofre = 0;
    for (const c of s.cards) {
      const dueYm = dueYmPaidIn(c, ym), inv = invoiceFor(s, c, dueYm), pay = payDateOf(c, dueYm);
      if (inv.total <= 0 || !future(pay)) continue;
      parcelas += sum(inv.lines.filter((l) => l.source === "parcela").map((l) => l.amount)); cofre += inv.funded;
      for (const l of inv.lines) if (l.source === "recorrente") { const r = s.recurring.find((x) => x.id === l.id.slice(0, l.id.lastIndexOf(":"))); if (r && isSubscription(r)) assinCartao += l.amount; }
      items.push({ id: `fat:${c.id}:${dueYm}`, group: "faturas", label: `Fatura ${c.name}`, amount: cashOut(inv), date: pay, cardId: c.id, detail: `${invoiceLabelPay(c, dueYm)}${inv.funded > 0 ? ` · o cofrinho paga ${brl(inv.funded)}` : ""}`, lines: inv.lines, funded: inv.funded });
    }
    items.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount);
    const g = (id: PlanItem["group"]) => sum(items.filter((x) => x.group === id).map((x) => x.amount));
    const entradas = g("entradas"), fixas = g("fixas"), assinaturas = g("assinaturas"), faturas = g("faturas"), avulsas = g("avulsas");
    const saidas = round2(fixas + assinaturas + faturas + avulsas), resultado = round2(entradas - saidas);
    bal = round2(bal + resultado);
    out.push({ ym, label: monthLabel(ym), entradas, fixas, assinaturas, faturas, avulsas, parcelas: round2(parcelas), cofrinhos: round2(cofre), assinaturasCartao: round2(assinCartao), saidas, resultado, saldoFinal: bal, items });
  }
  return out;
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
  for (const c of s.cards) for (const inv of upcomingInvoices(s, c, today, 4)) { const pay = payDateOf(c, inv.ym); if (cashOut(inv) > 0 && pay > todayIso && pay <= end) raw.push({ id: `fat:${c.id}:${inv.ym}`, date: pay, label: `Fatura ${c.name}`, amount: -cashOut(inv), kind: "fatura", cardId: c.id }); }
  raw.sort((a, b) => a.date.localeCompare(b.date) || b.amount - a.amount); // no mesmo dia, o que entra vem antes do que sai
  const start = totalBalance(s, today);
  let bal = start, min = start;
  const events = raw.map((e) => { bal = round2(bal + e.amount); min = Math.min(min, bal); return { ...e, balance: bal }; });
  return { start, events, end: bal, min, firstNegative: events.find((e) => e.balance < 0) ?? null, until: end };
}

/* ───────────── comprometimento futuro ───────────── */
export type Commitment = { ym: string; label: string; parcelas: number; recorrentes: number; total: number; porCartao: Record<string, number> };
/** Mês (de fechamento da fatura) em que a parcela `k` do plano conta. */
const closeYmOfParcel = (s: FinanceState, p: Plan, k: number): string => { const card = s.cards.find((c) => c.id === p.cardId), dueYm = addMonths(p.first, k - 1); return card ? ymOf(closingDateOf(card, dueYm)) : dueYm; };
export function commitments(s: FinanceState, currentYm: string, n = 12): Commitment[] {
  return Array.from({ length: n }, (_, i) => addMonths(currentYm, i)).map((ym) => {
    const porCartao: Record<string, number> = {};
    let parcelas = 0;
    for (const p of s.plans) for (let k = 1; k <= p.count; k++) if (closeYmOfParcel(s, p, k) === ym) { const v = parcelAmount(p, k); parcelas += v; porCartao[p.cardId] = round2((porCartao[p.cardId] ?? 0) + v); }
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


/* ───────────── "e se eu comprar?" ───────────── */
export type SimRow = { ym: string; label: string; fatura: number; faturaDepois: number; sobra: number; sobraDepois: number; saldoFim: number; saldoFimDepois: number; pagaEm: string | null };
export type Simulation = { card: Card; closeYm: string; dueYm: string; parcelas: number; porParcela: number; total: number; rows: SimRow[]; pagaEm: string; faturaAntes: number; faturaDepois: number; primeiroNegativo: { ym: string; saldo: number } | null };
/**
 * Simula uma compra no crédito sem gravar nada. `closeYm` é o mês em que a fatura FECHA (a "fatura de janeiro" fecha em janeiro);
 * parcelada, cada parcela cai numa fatura seguinte. Compara os próximos meses antes e depois: fatura, sobra do mês e saldo no fim
 * (as faturas saem do caixa na data em que a pessoa paga, no vencimento ou logo após o fechamento).
 */
export function simulatePurchase(s: FinanceState, today: Date, o: { cardId: string; amount: number; closeYm: string; parcelas?: number; desc?: string }, months = 8): Simulation | null {
  const card = s.cards.find((c) => c.id === o.cardId);
  if (!card || !(o.amount > 0)) return null;
  const n = Math.max(1, Math.min(48, Math.round(o.parcelas ?? 1))), per = round2(o.amount / n), dueYm = dueYmOfClosing(card, o.closeYm);
  const plan = planForInvoice(card, dueYm, { id: "sim", desc: o.desc ?? "Compra simulada", per, n, x: 1, category: "outros", todayIso: isoOf(today) });
  const before = monthPlan(s, today, months), after = monthPlan({ ...s, plans: [...s.plans, { ...plan, total: round2(o.amount) }] }, today, months);
  const rows = before.map((m, i): SimRow => {
    const a = after[i]!;
    return { ym: m.ym, label: m.label, fatura: m.faturas, faturaDepois: a.faturas, sobra: m.resultado, sobraDepois: a.resultado, saldoFim: m.saldoFinal, saldoFimDepois: a.saldoFinal, pagaEm: a.items.find((x) => x.cardId === card.id)?.date ?? null };
  });
  const neg = after.find((m) => m.saldoFinal < 0 && !(before.find((b) => b.ym === m.ym)!.saldoFinal < 0));
  return { card, closeYm: o.closeYm, dueYm, parcelas: n, porParcela: per, total: round2(o.amount), rows, pagaEm: payDateOf(card, dueYm), faturaAntes: invoiceFor(s, card, dueYm).total, faturaDepois: invoiceFor({ ...s, plans: [...s.plans, { ...plan, total: round2(o.amount) }] }, card, dueYm).total, primeiroNegativo: neg ? { ym: neg.ym, saldo: neg.saldoFinal } : null };
}
