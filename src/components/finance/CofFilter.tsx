import { PiggyBank } from "lucide-react";

import type { CofView } from "@/lib/finance/calc";
import { useCofView } from "@/lib/finance/cof-view";
import { useFinance } from "@/lib/finance/store";

const OPTIONS: { v: CofView; label: string }[] = [{ v: "tudo", label: "Tudo" }, { v: "bolso", label: "Sem cofrinho" }, { v: "cofrinho", label: "Só cofrinho" }];
export const COF_HINT: Record<CofView, string> = {
  tudo: "Tudo junto: o seu saldo, o dinheiro dos cofrinhos e o valor inteiro das faturas.",
  bolso: "Só o que sai do seu saldo: as faturas sem a parte que os cofrinhos pagam.",
  cofrinho: "Só o que os cofrinhos guardam e pagam.",
};

/** Filtro de cofrinho: aparece em todas as telas do financeiro e vale para todas (fica guardado). Some se não houver cofrinho. */
export function CofFilter({ className = "" }: { className?: string }) {
  const { state } = useFinance(), [view, setView] = useCofView();
  if (!state.accounts.some((a) => a.kind === "cofrinho")) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} data-testid="fin-filtro-cofrinho">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><PiggyBank size={13} className="text-cyan" /> Ver</span>
      <div role="radiogroup" aria-label="Filtro de cofrinho" className="flex gap-1 rounded-full border border-white/10 bg-black/25 p-1 text-xs">
        {OPTIONS.map((o) => <button key={o.v} type="button" role="radio" aria-checked={view === o.v} onClick={() => setView(o.v)} data-testid={`fin-cof-${o.v}`} className={`rounded-full px-3 py-1 transition ${view === o.v ? "bg-cyan/20 text-cyan" : "text-muted-foreground hover:text-foreground"}`}>{o.label}</button>)}
      </div>
      <span className="hidden text-[0.7rem] text-muted-foreground md:inline">{COF_HINT[view]}</span>
    </div>
  );
}
