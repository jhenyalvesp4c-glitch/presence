import { useMemo, useState } from "react";
import { useCofView } from "@/lib/finance/cof-view";
import { CofFilter } from "./CofFilter";
import { CalendarRange, ChevronDown, CreditCard, Layers, PiggyBank, Repeat, TrendingDown, TrendingUp } from "lucide-react";
import { brl, closingYmOf, dateBR, invoiceLabel, monthName, monthPlan, type MonthPlan, type PlanItem } from "@/lib/finance/calc";
import { useFinance } from "@/lib/finance/store";
import { AreaChart, BarsChart, Money } from "./charts";
import { Empty, Head, Panel, Pill, TONES } from "./ui";

const ROSE = "oklch(0.72 0.18 10)";
const GROUP: Record<PlanItem["group"], string> = { entradas: "Entradas", fixas: "Contas fixas", assinaturas: "Assinaturas", faturas: "Faturas dos cartões", avulsas: "Outros gastos" };

/** Um mês da projeção: as linhas do que entra e sai, e dentro de cada fatura o que ela traz (parcelas, assinaturas, compras). */
function MonthCard({ m, open, onToggle, first }: { m: MonthPlan; open: boolean; onToggle: () => void; first: boolean }) {
  const { state } = useFinance(), good = m.resultado >= 0;
  const assinTotal = m.assinaturas + m.assinaturasCartao;
  const rows: [string, number, string | undefined][] = [["Entradas", m.entradas, "var(--emerald)"], ["Contas fixas", m.fixas, undefined], ["Assinaturas em conta", m.assinaturas, undefined], ["Faturas dos cartões", m.faturas, undefined], ["Outros gastos", m.avulsas, undefined]];
  return (
    <section className="overflow-hidden rounded-[1.4rem] border bg-white/[0.02] transition" style={{ borderColor: open ? "color-mix(in oklab, var(--cyan) 35%, transparent)" : "oklch(1 0 0 / 8%)" }} data-testid={`fin-mes-${m.ym}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 text-left transition hover:bg-white/[0.03] sm:grid-cols-[1.1fr_repeat(4,minmax(0,1fr))_auto]">
        <span className="min-w-0"><span className="font-display text-base font-semibold capitalize">{monthName(m.ym).replace(/ de \d{4}$/, "")}<span className="ml-1.5 text-xs font-normal text-muted-foreground">{m.ym.slice(0, 4)}</span></span>{first && <span className="ml-2 align-middle"><Pill color="var(--cyan)">só o que falta</Pill></span>}</span>
        <span className="hidden text-xs sm:block"><span className="block text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">Entra</span><b className="tabular-nums text-emerald"><Money value={m.entradas} cents={false} /></b></span>
        <span className="hidden text-xs sm:block"><span className="block text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">Sai</span><b className="tabular-nums"><Money value={m.saidas} cents={false} /></b></span>
        <span className="text-right text-xs sm:text-left"><span className="block text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">{good ? "Sobra" : "Falta"}</span><b className="font-display text-base tabular-nums" style={{ color: good ? "var(--emerald)" : ROSE }}><Money value={Math.abs(m.resultado)} cents={false} /></b></span>
        <span className="hidden text-xs sm:block"><span className="block text-[0.62rem] uppercase tracking-[0.12em] text-muted-foreground">Saldo no fim</span><b className="tabular-nums" style={{ color: m.saldoFinal < 0 ? ROSE : undefined }}><Money value={m.saldoFinal} cents={false} /></b></span>
        <ChevronDown size={18} className={`text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-white/[0.06] px-4 pb-4 pt-3" style={{ animation: "fin-fade .3s both" }}>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {rows.map(([l, v, c]) => <div key={l} className="rounded-xl bg-white/[0.04] px-3 py-2"><dt className="text-muted-foreground">{l}</dt><dd className="font-semibold tabular-nums" style={c ? { color: c } : undefined}>{brl(v)}</dd></div>)}
            <div className="rounded-xl px-3 py-2" style={{ background: `color-mix(in oklab, ${good ? "var(--emerald)" : ROSE} 14%, transparent)` }}><dt className="text-muted-foreground">{good ? "Sobra do mês" : "Falta no mês"}</dt><dd className="font-semibold tabular-nums" style={{ color: good ? "var(--emerald)" : ROSE }}>{brl(Math.abs(m.resultado))}</dd></div>
          </dl>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Layers size={12} className="text-amber" />Parcelas nas faturas: <b className="text-foreground">{brl(m.parcelas)}</b></span>
            <span className="inline-flex items-center gap-1.5"><Repeat size={12} className="text-cyan" />Assinaturas no total: <b className="text-foreground">{brl(assinTotal)}</b>{m.assinaturasCartao > 0 && ` (${brl(m.assinaturasCartao)} no cartão)`}</span>
            {m.cofrinhos > 0 && <span className="inline-flex items-center gap-1.5" data-testid="fin-mes-cofrinhos"><PiggyBank size={12} className="text-cyan" />Cofrinhos pagam: <b className="text-foreground">{brl(m.cofrinhos)}</b> (não sai do saldo)</span>}
            <span>Saldo projetado no fim do mês: <b className="text-foreground">{brl(m.saldoFinal)}</b></span>
          </p>
          {m.items.length === 0 ? <p className="text-sm text-muted-foreground">Nada previsto para este mês.</p> : (
            <ul className="space-y-1.5">{m.items.map((it) => {
              const card = it.cardId ? state.cards.find((c) => c.id === it.cardId) : undefined, isIn = it.group === "entradas";
              return (
                <li key={it.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl" style={{ background: card ? TONES[card.tone].bg : "oklch(1 0 0 / 6%)", color: card ? "#fff" : isIn ? "var(--emerald)" : "var(--muted-foreground)" }}>{card ? <CreditCard size={14} /> : isIn ? <TrendingUp size={14} /> : <TrendingDown size={14} />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{it.label}</span><span className="block text-[0.7rem] text-muted-foreground">{GROUP[it.group]} · {dateBR(it.date).slice(0, 5)}{it.detail ? ` · ${it.detail}` : ""}</span></span>
                    <b className="text-sm tabular-nums" style={{ color: isIn ? "var(--emerald)" : undefined }}>{isIn ? "+" : "−"}{brl(it.amount)}</b>
                  </div>
                  {it.lines && it.lines.length > 0 && (
                    <ul className="mt-2 space-y-0.5 border-t border-white/[0.06] pt-2 text-[0.72rem] text-muted-foreground">
                      {it.lines.map((l) => <li key={l.id} className="flex justify-between gap-3"><span className="truncate">{l.desc}{l.parcel ? ` (parcela ${l.parcel})` : ""}{l.source === "recorrente" ? " · fixa" : ""}{l.source === "ajuste" ? " · a detalhar" : ""}{l.funded ? " · cofrinho" : ""}</span><span className="tabular-nums" style={l.funded ? { color: "var(--cyan)" } : undefined}>{brl(l.amount)}</span></li>)}
                    </ul>
                  )}
                </li>);
            })}</ul>
          )}
        </div>
      )}
    </section>
  );
}

/** Próximos meses: quanto entra, quanto sai (fixas, assinaturas, faturas, parcelas) e quanto sobra, mês a mês. */
export function MonthsView() {
  const { state, today } = useFinance(), [openYm, setOpenYm] = useState<string | null>(null), [n, setN] = useState(12);
  const [view] = useCofView(), plan = useMemo(() => monthPlan(state, today, n, view), [state, today, n, view]);
  const empty = state.accounts.length + state.cards.length + state.recurring.length + state.plans.length === 0;
  if (empty) return <Empty icon={CalendarRange} title="Ainda não há o que projetar" hint="Cadastre contas, cartões, salário e despesas fixas para ver os próximos meses." />;
  const worst = plan.reduce((a, b) => (b.saldoFinal < a.saldoFinal ? b : a), plan[0]!), firstNeg = plan.find((m) => m.saldoFinal < 0);
  return (
    <div className="space-y-5" data-testid="fin-meses">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="font-serif text-3xl">Próximos <span className="text-gradient italic">meses</span></h2><p className="text-sm text-muted-foreground">O que entra e o que sai em cada mês, com as faturas dos cartões, as parcelas e as assinaturas.</p></div>
        <div className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1 text-xs" role="group" aria-label="Quantos meses">
          {[6, 12, 18].map((k) => <button key={k} onClick={() => setN(k)} aria-pressed={n === k} className={`rounded-xl px-3 py-1.5 transition ${n === k ? "bg-cyan/12 text-cyan" : "text-muted-foreground hover:text-foreground"}`}>{k} meses</button>)}
        </div>
      </div>

      <CofFilter />
      {firstNeg ? <p className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: `color-mix(in oklab, ${ROSE} 40%, transparent)`, background: `color-mix(in oklab, ${ROSE} 8%, transparent)` }} data-testid="fin-meses-alerta">O saldo projetado fica <b>negativo em {monthName(firstNeg.ym)}</b> ({brl(firstNeg.saldoFinal)}). O pior ponto é em {monthName(worst.ym)}: {brl(worst.saldoFinal)}.</p>
        : <p className="rounded-2xl border border-emerald/30 bg-emerald/[0.06] px-4 py-3 text-sm text-muted-foreground" data-testid="fin-meses-alerta">O saldo projetado se mantém positivo nos próximos {n} meses. O ponto mais baixo é em <b className="text-foreground">{monthName(worst.ym)}</b>: {brl(worst.saldoFinal)}.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel glow="var(--emerald)"><Head icon={TrendingUp} title="Entra × sai por mês" sub="Entradas contra tudo que sai (contas, assinaturas e faturas)" /><BarsChart aName="Entra" bName="Sai" points={plan.map((m) => ({ label: m.label, a: m.entradas, b: m.saidas }))} /></Panel>
        <Panel glow="var(--cyan)"><Head icon={CalendarRange} title="Saldo projetado" sub="Seu saldo de hoje mais o resultado de cada mês" /><AreaChart points={plan.map((m) => ({ label: m.label, value: m.saldoFinal }))} /></Panel>
      </div>

      <div className="space-y-2.5">
        {plan.map((m, i) => <MonthCard key={m.ym} m={m} first={i === 0} open={openYm === m.ym} onToggle={() => setOpenYm((c) => (c === m.ym ? null : m.ym))} />)}
      </div>
      <p className="text-xs text-muted-foreground">As faturas entram no mês em que o dinheiro <b>sai da conta</b>: no vencimento ou, nos cartões que você marcou para pagar no fechamento, logo depois de fechar (dia 28/29, nunca na virada do mês). Compras, parcelas e assinaturas no cartão já estão dentro das faturas, por isso não são somadas de novo. Para ver a fatura de cada cartão por mês de fechamento, abra Contas e cartões.</p>
    </div>
  );
}
