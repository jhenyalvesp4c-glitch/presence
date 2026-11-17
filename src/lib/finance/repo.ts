/**
 * Onde os dados financeiros ficam guardados. Hoje: só neste navegador (localStorage).
 * Para ligar ao Supabase depois, basta criar um `SupabaseFinanceRepo` com a mesma interface (tabelas por user_id = owner_id(),
 * como no resto do Orion) e trocar o `financeRepo` abaixo: as telas não conhecem o armazenamento.
 */
import { EMPTY_STATE, type FinanceState } from "./types";

export interface FinanceRepo {
  load(): Promise<FinanceState>;
  save(state: FinanceState): Promise<void>;
  reset(): Promise<void>;
}

const KEY = "presence.financeiro.v1";
const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Garante o formato mesmo se o que estava guardado estiver incompleto ou for de uma versão antiga. */
export function normalizeState(raw: unknown): FinanceState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<FinanceState>;
  if (r.version !== 1) return structuredClone(EMPTY_STATE);
  return {
    version: 1, onboarded: !!r.onboarded, mock: !!r.mock,
    accounts: arr(r.accounts), cards: arr<FinanceState["cards"][number]>(r.cards).map((c) => ({ ...c, adjustments: c.adjustments ?? {} })),
    plans: arr(r.plans), recurring: arr(r.recurring), transactions: arr(r.transactions), goals: arr(r.goals),
  };
}

export class LocalFinanceRepo implements FinanceRepo {
  async load(): Promise<FinanceState> {
    try { const s = localStorage.getItem(KEY); return s ? normalizeState(JSON.parse(s)) : structuredClone(EMPTY_STATE); } catch { return structuredClone(EMPTY_STATE); }
  }
  async save(state: FinanceState): Promise<void> { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* sem armazenamento: continua só em memória */ } }
  async reset(): Promise<void> { try { localStorage.removeItem(KEY); } catch { /* sem armazenamento */ } }
}

export const financeRepo: FinanceRepo = new LocalFinanceRepo();
