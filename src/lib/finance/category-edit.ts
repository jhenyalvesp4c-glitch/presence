/** Edição das categorias do financeiro: uso em lançamentos e o que acontece com eles quando uma categoria nova é apagada. */
import { PROTECTED_CATS, catOf, type CatDef } from "./categories";
import type { FinanceState } from "./types";

/** Em quantos lançamentos, parcelas, fixas e metas a categoria aparece. */
export function categoryUsage(s: FinanceState, id: string): number {
  return s.transactions.filter((t) => t.category === id).length + s.plans.filter((p) => p.category === id).length + s.recurring.filter((r) => r.category === id).length + s.goals.filter((g) => g.category === id).length;
}

/** Grava os ajustes e, para as categorias apagadas, leva o que usava para "Outros" (despesa) ou "Renda extra" (receita). */
export function saveCategoryDefs(s: FinanceState, defs: CatDef[], removed: { id: string; income: boolean }[] = []): FinanceState {
  const to = new Map(removed.filter((r) => !PROTECTED_CATS.has(r.id)).map((r) => [r.id, r.income ? "extra" : "outros"]));
  const mv = (c: string): string => to.get(c) ?? c;
  const clean = defs.filter((d) => !to.has(d.id));
  if (!to.size) return { ...s, categories: clean };
  return {
    ...s, categories: clean,
    transactions: s.transactions.map((t) => (to.has(t.category) ? { ...t, category: mv(t.category) } : t)),
    plans: s.plans.map((p) => (to.has(p.category) ? { ...p, category: mv(p.category) } : p)),
    recurring: s.recurring.map((r) => (to.has(r.category) ? { ...r, category: mv(r.category) } : r)),
    goals: s.goals.map((g) => (g.category && to.has(g.category) ? { ...g, category: mv(g.category) } : g)),
  };
}

/** Id novo para categoria criada pela pessoa. */
export const newCategoryId = (): string => `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const incomeOfCategory = (id: string): boolean => !!catOf(id).income;
