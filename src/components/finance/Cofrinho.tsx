import { PiggyBank } from "lucide-react";

import { accountBalance, brl, cofrinhoInfo, monthLabel, round2 } from "@/lib/finance/calc";
import { useFinance } from "@/lib/finance/store";
import type { Account } from "@/lib/finance/types";
import { Head, Panel, Pill } from "./ui";

/** Cofrinho: quanto tem, quanto já está reservado para as parcelas, o que sobra e até quando cobre. */
export function CofrinhoPanel({ account }: { account: Account }) {
  const { state, today } = useFinance(), info = cofrinhoInfo(state, account, today);
  if (info.plans.length === 0) return (
    <Panel glow="var(--emerald)" data-testid="fin-cofrinho">
      <Head icon={PiggyBank} title="Cofrinho" sub="Nenhuma compra parcelada usa este cofrinho ainda. Edite uma compra e escolha “Quem paga as parcelas”." />
    </Panel>
  );
  let run = info.balance;
  return (
    <Panel glow="var(--emerald)" data-testid="fin-cofrinho">
      <Head icon={PiggyBank} title="Cofrinho das parcelas" sub={info.shortYm ? `Falta dinheiro a partir de ${monthLabel(info.shortYm)}.` : info.lastYm ? `Cobre todas as parcelas até ${monthLabel(info.lastYm)}.` : "Todas as parcelas já foram pagas."} />
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["No cofrinho", brl(accountBalance(state, account, today)), ""], ["Ainda vai sair", brl(info.committed), "text-amber"], [info.sobra < 0 ? "Falta" : "Sobra", brl(Math.abs(info.sobra)), info.sobra < 0 ? "text-destructive" : "text-emerald"]].map(([l, v, c]) => (
          <div key={l} className="rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-2"><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">{l}</p><p className={`font-display text-lg font-semibold tabular-nums ${c}`}>{v}</p></div>
        ))}
      </div>
      <p className="mt-4 mb-1 text-xs text-muted-foreground">Compras que saem deste cofrinho</p>
      <ul className="space-y-1">{info.plans.map((p) => <li key={p.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-1.5 text-sm"><span>{p.desc} <Pill color="var(--amber)">{p.left} {p.left === 1 ? "parcela" : "parcelas"}</Pill></span><b className="tabular-nums">{brl(p.remaining)}</b></li>)}</ul>
      <p className="mt-4 mb-1 text-xs text-muted-foreground">Mês a mês (o que sai e quanto sobra)</p>
      <ul className="grid gap-1 sm:grid-cols-2">{info.byMonth.map((m) => { run = round2(run - m.amount); return <li key={m.ym} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-1 text-xs"><span>{monthLabel(m.ym)} · −{brl(m.amount)}</span><span className={`tabular-nums ${run < 0 ? "text-destructive" : "text-muted-foreground"}`}>sobra {brl(run)}</span></li>; })}</ul>
      <p className="mt-3 text-[0.7rem] text-muted-foreground">A cada fatura paga, as parcelas saem daqui sozinhas. Só a sua parte entra na conta (a de outra pessoa não).</p>
    </Panel>
  );
}
