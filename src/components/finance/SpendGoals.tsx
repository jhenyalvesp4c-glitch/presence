import { Gauge, Plus } from "lucide-react";

import { brl, spendGoals, ymOf } from "@/lib/finance/calc";
import { catOf } from "@/lib/finance/categories";
import { useFinance } from "@/lib/finance/store";
import { CatBadge, Head, Panel } from "./ui";

const GREEN = "var(--emerald)", AMBER = "var(--amber)", ROSE = "oklch(0.72 0.18 10)";
const toneOf = (pct: number) => (pct > 100 ? ROSE : pct >= 80 ? AMBER : GREEN);

/** Quanto já foi gasto de cada meta de gasto (iFood, compras…) neste mês. Aparece na Visão geral. */
export function SpendGoalsPanel({ onOpen }: { onOpen: () => void }) {
  const { state, today } = useFinance(), rows = spendGoals(state, ymOf(today));
  if (rows.length === 0) return (
    <Panel glow="var(--emerald)" className="!p-4" data-testid="fin-metas-gasto">
      <Head icon={Gauge} title="Metas de gasto" sub="Crie uma meta para uma categoria (iFood, compras…) e acompanhe aqui quanto já gastou no mês." />
      <button type="button" onClick={onOpen} className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-emerald/40 px-3 py-1.5 text-xs text-emerald transition hover:bg-emerald/10"><Plus size={13} /> Criar uma meta de gasto</button>
    </Panel>
  );
  return (
    <Panel glow="var(--emerald)" className="!p-4 sm:!p-5" data-testid="fin-metas-gasto">
      <Head icon={Gauge} title="Metas de gasto do mês" sub="Quanto você já gastou de cada limite. Crédito conta no mês em que a fatura fecha." />
      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map(({ goal, spent, left, pct, over }) => {
          const c = toneOf(pct);
          return (
            <li key={goal.id} data-testid="fin-meta-gasto-linha">
              <button type="button" onClick={onOpen} className="group w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:bg-white/[0.06]">
                <div className="flex items-center gap-3"><CatBadge id={goal.category!} size={32} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{goal.title || catOf(goal.category!).name}</p>
                    <p className="text-xs text-muted-foreground"><b className="tabular-nums text-foreground">{brl(spent)}</b> de <span className="tabular-nums">{brl(goal.target)}</span></p></div>
                  <span className="text-right text-xs tabular-nums" style={{ color: c }}>{over ? `passou ${brl(spent - goal.target)}` : `faltam ${brl(left)}`}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(Math.min(100, pct))} aria-valuemin={0} aria-valuemax={100} aria-label={`${goal.title}: ${Math.round(pct)}% do limite`}>
                  <span className="block h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%`, background: c, boxShadow: `0 0 10px ${c}` }} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
