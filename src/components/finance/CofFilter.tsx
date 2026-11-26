import { PiggyBank } from "lucide-react";

import type { CofView } from "@/lib/finance/calc";
import { brl as brlN, dateBR, nextCycle } from "@/lib/finance/calc";
import { useCofView, useReservesOn, useSobraCiclo } from "@/lib/finance/cof-view";
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

/** Liga/desliga geral das metas que descontam da sobra de caixa. */
export function ReservesSwitch({ possible, className = "" }: { possible: number; className?: string }) {
  const { state } = useFinance(), [on, setOn] = useReservesOn();
  const any = state.goals.some((g) => g.reserve);
  if (!any) return null;
  return (
    <label className={`flex cursor-pointer flex-wrap items-center gap-2 text-xs ${className}`} data-testid="fin-descontar-metas">
      <button type="button" role="switch" aria-checked={on} aria-label="Descontar minhas metas da sobra" onClick={() => setOn(!on)} className={`relative h-5 w-9 rounded-full border transition ${on ? "border-emerald bg-emerald/30" : "border-white/15 bg-white/10"}`}><span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${on ? "left-[1.1rem]" : "left-0.5"}`} /></button>
      <span className={on ? "text-foreground" : "text-muted-foreground"}>Descontar minhas metas da sobra</span>
      <span className="text-muted-foreground">· {possible > 0 ? `${brlN(possible)} reservado${on ? "" : " (desligado)"} neste mês` : "nada a reservar neste mês"}</span>
    </label>
  );
}

/** Sobra "até o fim do mês" ou "até o próximo salário" (conta também as assinaturas e contas fixas do mês seguinte que saem antes dele). */
export function CycleSwitch() {
  const { state, today } = useFinance(), [on, setOn] = useSobraCiclo(), c = nextCycle(state, today);
  if (!c || c.items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="fin-sobra-ciclo">
      <span className="text-muted-foreground">Sobra até</span>
      <div role="radiogroup" aria-label="Até quando a sobra vale" className="flex gap-1 rounded-full border border-white/10 bg-black/25 p-1">
        {([[false, "o fim do mês"], [true, `o próximo salário (${dateBR(c.until).slice(0, 5)})`]] as const).map(([v, t]) => <button key={t} type="button" role="radio" aria-checked={on === v} onClick={() => setOn(v)} data-testid={v ? "fin-ciclo-salario" : "fin-ciclo-mes"} className={`rounded-full px-3 py-1 transition ${on === v ? "bg-amber/20 text-amber" : "text-muted-foreground hover:text-foreground"}`}>{t}</button>)}
      </div>
      <span className="text-muted-foreground">{on ? `desconta também ${brlN(c.total)} de assinaturas e contas fixas de ${dateBR(c.from).slice(0, 5)} a ${dateBR(c.until).slice(0, 5)}` : `sem os ${brlN(c.total)} das assinaturas e contas fixas até ${dateBR(c.until).slice(0, 5)}`}</span>
    </div>
  );
}
