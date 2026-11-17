/**
 * Tradução entre o estado do app (FinanceState) e as linhas das tabelas `fin_*` do Supabase.
 * Sem acesso a rede: só funções puras, para testar à parte. A gravação envia apenas o que mudou (`diffRows`).
 */
import type { Account, Card, FinanceState, Goal, Plan, Recurring, RecurringPause, Transaction } from "./types";
import { EMPTY_STATE } from "./types";

export const TABLES = ["fin_accounts", "fin_cards", "fin_plans", "fin_recurring", "fin_transactions", "fin_goals"] as const;
export type TableName = (typeof TABLES)[number];
export type Row = Record<string, unknown> & { id: string };
export type Rows = Record<TableName, Row[]> & { settings: { onboarded: boolean; mock: boolean } };

const n = (v: unknown): number => { const x = typeof v === "number" ? v : Number(v); return Number.isFinite(x) ? x : 0; };
const nn = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : n(v));
const s = (v: unknown): string | undefined => (v === null || v === undefined || v === "" ? undefined : String(v));
const nul = <T,>(v: T | undefined): T | null => (v === undefined ? null : v);

const accountRow = (a: Account): Row => ({ id: a.id, name: a.name, kind: a.kind, tone: a.tone, balance_base: a.balanceBase, base_date: a.baseDate });
const cardRow = (c: Card): Row => ({ id: c.id, name: c.name, brand: c.brand, last4: c.last4, tone: c.tone, limit_amount: c.limit, available_base: c.availableBase, base_date: c.baseDate, closing_day: c.closingDay, due_day: c.dueDay, adjustments: c.adjustments ?? {} });
const planRow = (p: Plan): Row => ({ id: p.id, description: p.desc, card_id: p.cardId, total: p.total, installments: p.count, per_amount: p.per, purchase_ym: p.purchaseYm, first_ym: p.first, category: p.category, paid_manual: nul(p.paidManual), created_on: p.createdAt });
const recurringRow = (r: Recurring): Row => ({ id: r.id, kind: r.kind, description: r.desc, amount: r.amount, day: r.day, category: r.category, method: r.method, account_id: nul(r.accountId), card_id: nul(r.cardId), start_ym: r.startYm, subscription: !!r.subscription, pauses: (r.pauses ?? []).map((p) => ({ from: p.from, ...(p.to ? { to: p.to } : {}) })) });
const txRow = (t: Transaction): Row => ({ id: t.id, kind: t.kind, description: t.desc, amount: t.amount, date: t.date, method: t.method, account_id: nul(t.accountId), card_id: nul(t.cardId), category: t.category });
const goalRow = (g: Goal): Row => ({ id: g.id, kind: g.kind, title: g.title, target: g.target, current_amount: g.current, deadline: nul(g.deadline), category: nul(g.category), card_id: nul(g.cardId), monthly: nul(g.monthly) });

export function toRows(st: FinanceState): Rows {
  return {
    settings: { onboarded: st.onboarded, mock: st.mock },
    fin_accounts: st.accounts.map(accountRow), fin_cards: st.cards.map(cardRow), fin_plans: st.plans.map(planRow),
    fin_recurring: st.recurring.map(recurringRow), fin_transactions: st.transactions.map(txRow), fin_goals: st.goals.map(goalRow),
  };
}

export const emptyRows = (): Rows => toRows(EMPTY_STATE);

const pauses = (v: unknown): RecurringPause[] => (Array.isArray(v) ? v.flatMap((p): RecurringPause[] => { const o = p as { from?: unknown; to?: unknown }; return typeof o.from === "string" ? [{ from: o.from, to: s(o.to) }] : []; }) : []);
const adjustments = (v: unknown): Record<string, number> => { const out: Record<string, number> = {}; if (v && typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = n(x); return out; };

/** Linhas do banco → estado do app (tolerante a campos nulos e números que chegam como texto). */
export function fromRows(r: Rows): FinanceState {
  return {
    version: 1, onboarded: !!r.settings.onboarded, mock: !!r.settings.mock,
    accounts: r.fin_accounts.map((x): Account => ({ id: x.id, name: String(x["name"]), kind: x["kind"] as Account["kind"], tone: x["tone"] as Account["tone"], balanceBase: n(x["balance_base"]), baseDate: String(x["base_date"]) })),
    cards: r.fin_cards.map((x): Card => ({ id: x.id, name: String(x["name"]), brand: x["brand"] as Card["brand"], last4: String(x["last4"] ?? ""), tone: x["tone"] as Card["tone"], limit: n(x["limit_amount"]), availableBase: n(x["available_base"]), baseDate: String(x["base_date"]), closingDay: n(x["closing_day"]), dueDay: n(x["due_day"]), adjustments: adjustments(x["adjustments"]) })),
    plans: r.fin_plans.map((x): Plan => ({ id: x.id, desc: String(x["description"]), cardId: String(x["card_id"]), total: n(x["total"]), count: n(x["installments"]), per: n(x["per_amount"]), purchaseYm: String(x["purchase_ym"]), first: String(x["first_ym"]), category: String(x["category"]), paidManual: nn(x["paid_manual"]), createdAt: String(x["created_on"]) })),
    recurring: r.fin_recurring.map((x): Recurring => ({ id: x.id, kind: x["kind"] as Recurring["kind"], desc: String(x["description"]), amount: n(x["amount"]), day: n(x["day"]), category: String(x["category"]), method: x["method"] as Recurring["method"], accountId: s(x["account_id"]), cardId: s(x["card_id"]), startYm: String(x["start_ym"]), subscription: x["subscription"] ? true : undefined, pauses: pauses(x["pauses"]).length ? pauses(x["pauses"]) : undefined })),
    transactions: r.fin_transactions.map((x): Transaction => ({ id: x.id, kind: x["kind"] as Transaction["kind"], desc: String(x["description"]), amount: n(x["amount"]), date: String(x["date"]), method: x["method"] as Transaction["method"], accountId: s(x["account_id"]), cardId: s(x["card_id"]), category: String(x["category"]) })),
    goals: r.fin_goals.map((x): Goal => ({ id: x.id, kind: x["kind"] as Goal["kind"], title: String(x["title"]), target: n(x["target"]), current: n(x["current_amount"]), deadline: s(x["deadline"]), category: s(x["category"]), cardId: s(x["card_id"]), monthly: nn(x["monthly"]) })),
  };
}

export type RowDiff = { upserts: Record<TableName, Row[]>; deletes: Record<TableName, string[]>; settings: boolean; empty: boolean };

/** O que mudou entre duas fotos das linhas: o que gravar e o que apagar. Linhas iguais não vão para a rede. */
export function diffRows(prev: Rows, next: Rows): RowDiff {
  const upserts = {} as Record<TableName, Row[]>, deletes = {} as Record<TableName, string[]>;
  let empty = true;
  for (const t of TABLES) {
    const before = new Map(prev[t].map((r) => [r.id, JSON.stringify(r)] as const)), after = new Set<string>();
    upserts[t] = next[t].filter((r) => { after.add(r.id); return before.get(r.id) !== JSON.stringify(r); });
    deletes[t] = [...before.keys()].filter((id) => !after.has(id));
    if (upserts[t].length || deletes[t].length) empty = false;
  }
  const settings = prev.settings.onboarded !== next.settings.onboarded || prev.settings.mock !== next.settings.mock;
  return { upserts, deletes, settings, empty: empty && !settings };
}

/** O estado tem algo que valha guardar? (usado para decidir se os dados do navegador devem subir para a nuvem) */
export const hasData = (st: FinanceState): boolean => st.onboarded || st.mock || st.accounts.length + st.cards.length + st.plans.length + st.recurring.length + st.transactions.length + st.goals.length > 0;
