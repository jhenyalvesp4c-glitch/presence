import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, CreditCard, Info, Layers, PiggyBank, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { addMonths, alertsFor, brl, categoryTotals, commitments, dateBR, isoOf, monthName, monthlySeries, openInvoice, parseIso, totalBalance, totalFutureParcels, totalOpenInvoices, whyChanged, ymOf, monthEntries, incomeOf, expensesOf, total, cardAvailable } from "@/lib/finance/calc";
import { useFinance } from "@/lib/finance/store";
import { AreaChart, BarsChart, Donut, Money, Sparkline, StackedBars } from "./charts";
import { NaturalComposer } from "./QuickAdd";
import { CatBadge, Empty, Head, Panel, Pill, TONES, btn } from "./ui";
import type { Draft } from "@/lib/finance/parse";

const ROSE = "oklch(0.72 0.18 10)";

function Kpi({ icon: I, label, value, color, spark, foot, delay = 0, testId }: { icon: typeof Wallet; label: string; value: number; color: string; spark?: number[]; foot?: React.ReactNode; delay?: number; testId?: string }) {
  return (
    <div className="glass group relative overflow-hidden rounded-[1.5rem] p-4 transition duration-500 hover:-translate-y-1" style={{ animation: `fin-pop .6s ${delay}s both`, boxShadow: `inset 0 1px 0 oklch(1 0 0 / 6%), 0 18px 50px -34px ${color}` }} data-testid={testId}>
      <span aria-hidden className="absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl transition group-hover:opacity-40" style={{ background: color }} />
      <div className="relative flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ color, background: `color-mix(in oklab, ${color} 15%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 30%, transparent)` }}><I size={17} /></span>
        {spark && <Sparkline values={spark} color={color} width={86} height={30} />}
      </div>
      <p className="relative mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="relative mt-0.5 whitespace-nowrap font-display text-[1.5rem] font-semibold leading-tight"><Money value={value} cents={false} /></p>
      {foot && <div className="relative mt-1 text-xs text-muted-foreground">{foot}</div>}
    </div>
  );
}
const Delta = ({ now, prev, goodWhenUp = true }: { now: number; prev: number; goodWhenUp?: boolean }) => {
  if (!prev) return <span>sem mês anterior</span>;
  const d = ((now - prev) / prev) * 100, up = d >= 0, good = up === goodWhenUp;
  return <span className="inline-flex items-center gap-1" style={{ color: good ? "var(--emerald)" : ROSE }}>{up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(d).toFixed(0)}% <span className="text-muted-foreground">vs mês anterior</span></span>;
};

export function Dashboard({ onOpenCard, onOpenAccount, onAdd, onTab, onDraft }: { onOpenCard: (id: string) => void; onOpenAccount: (id: string) => void; onAdd: () => void; onTab: (t: string) => void; onDraft: (d: Draft) => void }) {
  const { state, today } = useFinance();
  const ym = ymOf(today), [active, setActive] = useState<string | null>(null);
  const model = useMemo(() => {
    const es = monthEntries(state, ym), prevEs = monthEntries(state, addMonths(ym, -1));
    const series = monthlySeries(state, ym, 6), cats = categoryTotals(state, ym), future = commitments(state, ym, 12);
    return {
      receitas: total(incomeOf(es)), despesas: total(expensesOf(es)), prevR: total(incomeOf(prevEs)), prevD: total(expensesOf(prevEs)),
      series, cats, future, saldo: totalBalance(state), faturas: totalOpenInvoices(state, today), parcelas: totalFutureParcels(state, today),
      alerts: alertsFor(state, today), why: whyChanged(state, ym),
    };
  }, [state, ym, today]);
  const nowCard = model.cats.find((c) => c.id === active);
  const upcoming = useMemo(() => state.cards.map((c) => ({ card: c, inv: openInvoice(state, c, today) })).filter((x) => x.inv.total > 0).sort((a, b) => a.inv.due.localeCompare(b.inv.due)), [state, today]);
  const net = model.receitas - model.despesas;
  const levelColor = { danger: ROSE, warning: "var(--amber)", info: "var(--cyan)" } as const;

  return (
    <div className="space-y-5" data-testid="fin-dashboard">
      <Panel glow="var(--violet)" className="!p-4 sm:!p-5"><NaturalComposer onOpenForm={onDraft} /></Panel>

      {model.alerts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2" data-testid="fin-alertas">
          {model.alerts.slice(0, 4).map((a, i) => (
            <div key={a.id} className="flex items-start gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: `color-mix(in oklab, ${levelColor[a.level]} 35%, transparent)`, background: `color-mix(in oklab, ${levelColor[a.level]} 8%, transparent)`, animation: `fin-pop .5s ${i * 0.07}s both` }}>
              <span style={{ color: levelColor[a.level] }} className="mt-0.5">{a.level === "info" ? <Info size={18} /> : <AlertTriangle size={18} />}</span>
              <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.detail}</p></div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi testId="kpi-saldo" icon={Wallet} label="Saldo disponível" value={model.saldo} color="var(--cyan)" spark={model.series.map((p) => p.acumulado)} foot={<span>{state.accounts.length} contas e carteiras</span>} delay={0} />
        <Kpi testId="kpi-receitas" icon={TrendingUp} label="Receitas do mês" value={model.receitas} color="var(--emerald)" foot={<Delta now={model.receitas} prev={model.prevR} />} delay={0.05} />
        <Kpi testId="kpi-despesas" icon={TrendingDown} label="Despesas do mês" value={model.despesas} color={ROSE} foot={<Delta now={model.despesas} prev={model.prevD} goodWhenUp={false} />} delay={0.1} />
        <Kpi testId="kpi-faturas" icon={CreditCard} label="Faturas abertas" value={model.faturas} color="var(--violet)" foot={<span>{state.cards.length} cartões</span>} delay={0.15} />
        <Kpi testId="kpi-parcelas" icon={Layers} label="Parcelas futuras" value={model.parcelas} color="var(--amber)" foot={<span>{state.plans.length} compras parceladas</span>} delay={0.2} />
        <Kpi testId="kpi-saldo-mes" icon={Scale} label="Resultado do mês" value={net} color={net >= 0 ? "var(--emerald)" : ROSE} foot={<span>{net >= 0 ? "sobrando até agora" : "gastando mais do que entrou"}</span>} delay={0.25} />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel glow="var(--violet)" className="lg:col-span-3" data-testid="fin-categorias">
          <Head icon={PiggyBank} title="Onde você mais gasta" sub={`Despesas de ${monthName(ym)} por categoria`} />
          {model.cats.length === 0 ? <Empty title="Sem despesas neste mês" hint="Adicione uma movimentação para ver o gráfico." /> : (
            <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
              <Donut data={model.cats} active={active} onActive={setActive} center={nowCard
                ? <div><p className="text-xs text-muted-foreground">{nowCard.name}</p><p className="font-display text-xl font-semibold tabular-nums">{brl(nowCard.value)}</p><p className="text-xs" style={{ color: nowCard.color }}>{nowCard.pct.toFixed(0)}% das despesas</p></div>
                : <div><p className="text-xs text-muted-foreground">Total no mês</p><p className="font-display text-2xl font-semibold tabular-nums">{brl(model.despesas)}</p><p className="text-xs text-muted-foreground">{model.cats.length} categorias</p></div>} />
              <ul className="space-y-1.5">
                {model.cats.slice(0, 7).map((c) => (
                  <li key={c.id}>
                    <button type="button" onMouseEnter={() => setActive(c.id)} onMouseLeave={() => setActive(null)} onClick={() => setActive(active === c.id ? null : c.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition ${active === c.id ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}>
                      <CatBadge id={c.id} size={30} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm">{c.name}</span><span className="block h-1 overflow-hidden rounded-full bg-white/8"><span className="block h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color, transition: "width .8s" }} /></span></span>
                      <span className="text-right"><span className="block text-sm font-medium tabular-nums">{brl(c.value)}</span>
                        {c.deltaPct !== null && Math.abs(c.deltaPct) >= 1 && <span className="block text-[0.68rem]" style={{ color: c.delta > 0 ? ROSE : "var(--emerald)" }}>{c.delta > 0 ? "▲" : "▼"} {Math.abs(c.deltaPct).toFixed(0)}%</span>}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel glow={ROSE} className="lg:col-span-2" data-testid="fin-porque">
          <Head icon={model.why.totalDelta > 0 ? TrendingUp : TrendingDown} title={model.why.totalDelta > 0 ? "Por que seus gastos subiram?" : "Como seus gastos mudaram"} sub="Comparado ao mês passado" />
          <p className="font-display text-3xl font-semibold tabular-nums" style={{ color: model.why.totalDelta > 0 ? ROSE : "var(--emerald)" }}>{model.why.totalDelta > 0 ? "+" : ""}{brl(model.why.totalDelta)}</p>
          <p className="mb-4 text-xs text-muted-foreground">{model.why.totalPct === null ? "sem mês anterior para comparar" : `${model.why.totalDelta >= 0 ? "a mais" : "a menos"} (${Math.abs(model.why.totalPct).toFixed(0)}%) que em ${monthName(addMonths(ym, -1))}`}. O mês ainda não terminou.</p>
          {model.why.top.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma categoria subiu em relação ao mês passado.</p> : (
            <ol className="space-y-3">
              {model.why.top.map(({ cat, items }, i) => (
                <li key={cat.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3" style={{ animation: `fin-pop .5s ${0.1 + i * 0.08}s both` }}>
                  <div className="flex items-center gap-2.5"><CatBadge id={cat.id} size={28} /><span className="text-sm font-medium">{cat.name}</span><span className="ml-auto text-sm font-semibold tabular-nums" style={{ color: ROSE }}>+{brl(cat.delta)}</span></div>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">{items.map((e) => <li key={e.id} className="flex justify-between gap-2"><span className="truncate">{e.desc}{e.parcel ? ` (${e.parcel})` : ""}</span><span className="tabular-nums">{brl(e.amount)}</span></li>)}</ul>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel glow="var(--cyan)" data-testid="fin-evolucao">
          <Head icon={TrendingUp} title="Evolução financeira" sub="Saldo acumulado (receitas − despesas) nos últimos 6 meses" />
          <AreaChart points={model.series.map((p) => ({ label: p.label, value: p.acumulado }))} />
        </Panel>
        <Panel glow="var(--emerald)" data-testid="fin-comparativo">
          <Head icon={Scale} title="Receitas × despesas" sub="Mês a mês" right={<div className="flex gap-3 text-[0.7rem] text-muted-foreground"><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald" />Receitas</span><span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: ROSE }} />Despesas</span></div>} />
          <BarsChart points={model.series.map((p) => ({ label: p.label, a: p.receitas, b: p.despesas }))} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel glow="var(--amber)" className="lg:col-span-3" data-testid="fin-projecao">
          <Head icon={Layers} title="Comprometimento dos próximos meses" sub="Parcelas já assumidas, por cartão" right={<button className={btn.ghost} onClick={() => onTab("parcelas")}>Ver parcelas</button>} />
          {state.plans.length === 0 ? <Empty title="Nenhuma compra parcelada" hint="Cadastre as parcelas que ainda está pagando para ver o peso nos próximos meses." /> : (
            <>
              <StackedBars highlight={0} points={model.future.map((m) => ({ label: m.label, segs: state.cards.filter((c) => m.porCartao[c.id]).map((c) => ({ name: c.name, color: TONES[c.tone].glow, value: m.porCartao[c.id]! })) }))} />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] text-muted-foreground">{state.cards.map((c) => <span key={c.id} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: TONES[c.tone].glow }} />{c.name}</span>)}</div>
            </>
          )}
        </Panel>
        <Panel glow="var(--violet)" className="lg:col-span-2" data-testid="fin-vencimentos">
          <Head icon={CalendarClock} title="Próximos vencimentos" sub="Faturas abertas dos cartões" />
          {upcoming.length === 0 ? <Empty icon={CreditCard} title="Nenhuma fatura aberta" hint="Cadastre um cartão para acompanhar os vencimentos." /> : (
            <ul className="space-y-2.5">
              {upcoming.map(({ card, inv }) => {
                const days = Math.ceil((parseIso(inv.due).getTime() - parseIso(isoOf(today)).getTime()) / 86400000), used = card.limit ? 1 - cardAvailable(state, card) / card.limit : 0;
                return (
                  <li key={card.id}><button type="button" onClick={() => onOpenCard(card.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.06]">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white" style={{ background: TONES[card.tone].bg, boxShadow: `0 8px 22px -10px ${TONES[card.tone].glow}` }}><CreditCard size={18} /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{card.name}</span><span className="block text-xs text-muted-foreground">vence {dateBR(inv.due)} · {days < 0 ? "vencida" : days === 0 ? "hoje" : `em ${days} dia${days === 1 ? "" : "s"}`} · {Math.round(used * 100)}% do limite</span></span>
                    <span className="text-right"><span className="block font-semibold tabular-nums">{brl(inv.total)}</span>{days >= 0 && days <= 5 && <Pill color="var(--amber)">em breve</Pill>}</span>
                  </button></li>
                );
              })}
            </ul>
          )}
          <button className={`${btn.ghost} mt-4 w-full`} onClick={onAdd}>Adicionar movimentação</button>
        </Panel>
      </div>
    </div>
  );
}
