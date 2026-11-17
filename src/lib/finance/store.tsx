import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { migrateInvoiceTotals, migratePaidManual } from "./calc";
import { makeMock } from "./mock";
import { cloudFinanceRepo as financeRepo, type SyncStatus } from "./cloud-repo";
import { EMPTY_STATE, type Account, type Card, type FinanceState, type Goal, type Plan, type Recurring, type Transaction } from "./types";

export const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export type Finance = {
  state: FinanceState; ready: boolean; today: Date;
  /** Situação da gravação na nuvem: salvando, salvo, só neste aparelho (sem login) ou com erro. */
  sync: SyncStatus;
  upsertAccount: (a: Account) => void; removeAccount: (id: string) => void;
  upsertCard: (c: Card) => void; removeCard: (id: string) => void;
  upsertPlan: (p: Plan) => void; removePlan: (id: string) => void;
  upsertRecurring: (r: Recurring) => void; removeRecurring: (id: string) => void;
  upsertTx: (t: Transaction) => void; removeTx: (id: string) => void;
  upsertGoal: (g: Goal) => void; removeGoal: (id: string) => void;
  finishOnboarding: () => void; startOnboarding: () => void; loadMock: () => void; resetAll: () => void;
};

const Ctx = createContext<Finance | null>(null);
export const useFinance = (): Finance => { const v = useContext(Ctx); if (!v) throw new Error("useFinance fora do FinanceProvider"); return v; };

const upsert = <T extends { id: string }>(list: T[], item: T): T[] => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);

/** Estado do módulo financeiro, com gravação automática. Os dados vêm do `financeRepo` (hoje local; depois Supabase). */
export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinanceState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const [sync, setSync] = useState<SyncStatus>(financeRepo.status());
  useEffect(() => financeRepo.subscribe(setSync), []);
  const [today] = useState(() => new Date());

  useEffect(() => { let alive = true; void financeRepo.load().then((s0) => { const s = migratePaidManual(migrateInvoiceTotals(s0), new Date()); if (alive) { setState(s); loaded.current = true; setReady(true); } }); return () => { alive = false; }; }, []);
  useEffect(() => { if (loaded.current) void financeRepo.save(state); }, [state]);
  // a voz alterou o financeiro no servidor: traz o que mudou (se não há gravação em andamento)
  useEffect(() => {
    const refresh = () => { if (!loaded.current || financeRepo.status() === "saving") return; void financeRepo.load().then((s) => setState((cur) => (JSON.stringify(cur) === JSON.stringify(s) || financeRepo.status() === "error" ? cur : s))); };
    window.addEventListener("orion:financeiro-atualizado", refresh);
    return () => window.removeEventListener("orion:financeiro-atualizado", refresh);
  }, []);
  // ao voltar para a aba/app, traz o que foi lançado em outro aparelho (só se não houver gravação em andamento)
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState !== "visible" || !loaded.current || financeRepo.status() === "saving" || financeRepo.status() === "local") return;
      void financeRepo.load().then((s) => setState((cur) => (JSON.stringify(cur) === JSON.stringify(s) || financeRepo.status() === "error" ? cur : s)));
    };
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

  const m = useCallback((fn: (s: FinanceState) => FinanceState) => setState((s) => fn(s)), []);
  const value = useMemo<Finance>(() => ({
    state, ready, today, sync,
    upsertAccount: (a) => m((s) => ({ ...s, accounts: upsert(s.accounts, a) })),
    // ao apagar uma conta ou cartão, as movimentações continuam, só perdem o vínculo; parcelas do cartão apagado saem junto
    removeAccount: (id) => m((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id), transactions: s.transactions.map((t) => (t.accountId === id ? { ...t, accountId: undefined } : t)), recurring: s.recurring.map((r) => (r.accountId === id ? { ...r, accountId: undefined } : r)) })),
    upsertCard: (c) => m((s) => ({ ...s, cards: upsert(s.cards, c) })),
    removeCard: (id) => m((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id), plans: s.plans.filter((p) => p.cardId !== id), transactions: s.transactions.map((t) => (t.cardId === id ? { ...t, cardId: undefined } : t)), recurring: s.recurring.map((r) => (r.cardId === id ? { ...r, cardId: undefined } : r)) })),
    upsertPlan: (p) => m((s) => ({ ...s, plans: upsert(s.plans, p) })),
    removePlan: (id) => m((s) => ({ ...s, plans: s.plans.filter((p) => p.id !== id) })),
    upsertRecurring: (r) => m((s) => ({ ...s, recurring: upsert(s.recurring, r) })),
    removeRecurring: (id) => m((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== id) })),
    upsertTx: (t) => m((s) => ({ ...s, transactions: upsert(s.transactions, t) })),
    removeTx: (id) => m((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) })),
    upsertGoal: (g) => m((s) => ({ ...s, goals: upsert(s.goals, g) })),
    removeGoal: (id) => m((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })),
    finishOnboarding: () => m((s) => ({ ...s, onboarded: true })),
    startOnboarding: () => m((s) => ({ ...s, onboarded: false })),
    loadMock: () => setState(makeMock(new Date())),
    resetAll: () => { void financeRepo.reset(); setState(structuredClone(EMPTY_STATE)); },
  }), [state, ready, today, sync, m]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
