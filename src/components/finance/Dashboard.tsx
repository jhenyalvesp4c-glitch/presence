import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, CalendarDays, CreditCard, Gauge as GaugeIcon, Info, Layers, PiggyBank, Scale, Sparkles, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { addMonths, alertsFor, brl, cashflow, categoryTotals, commitments, dateBR, isoOf, monthName, monthSummary, monthClose, monthlySeries, openInvoice, parseIso, sameDayPrev, totalBalance, totalFutureParcels, totalOpenInvoices, whyChanged, ymOf, monthEntries, incomeOf, expensesOf, total, cardAvailable } from "@/lib/finance/calc";
import { useFinance } from "@/lib/finance/store";
import { AreaChart, BarsChart, Donut, Gauge, Heatmap, Money, RadialRings, Sparkline, StackedBars } from "./charts";
import { HeroPanel, OrbitArt, Tilt } from "./fx";
import { NaturalComposer } from "./QuickAdd";
import { MonthBreakdownModal } from "./MonthBreakdown";
import { CatBadge, Empty, Head, Panel, Pill, TONES, btn } from "./ui";
import type { Draft } from "@/lib/finance/parse";

const ROSE = "oklch(0.72 0.18 10)";

function Kpi({ icon: I, label, value, color, spark, foot, delay = 0, testId }: { icon: typeof Wallet; label: string; value: number; color: string; spark?: number[]; foot?: React.ReactNode; delay?: number; testId?: string }) {
  return (
    <Tilt max={8} style={{ animation: `fin-pop .6s ${delay}s both` }}>
    <div className="glass group relative h-full overflow-hidden rounded-[1.5rem] p-4" style={{ boxShadow: `inset 0 1px 0 oklch(1 0 0 / 6%), 0 18px 50px -30px ${color}` }} data-testid={testId}>
      <span aria-hidden className="absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50" style={{ background: color }} />
      <span aria-hidden className="absolute inset-x-4 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <span aria-hidden className="absolute -bottom-px left-0 h-[3px] w-full origin-left" style={{ background: `linear-gradient(90deg, ${color}, transparent)`, animation: `bar-grow 1.4s cubic-bezier(.2,.7,.2,1) ${delay + 0.2}s both` }} />
      <div className="relative flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ color, background: `color-mix(in oklab, ${color} 15%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 30%, transparent)` }}><I size={17} /></span>
        {spark && <Sparkline values={spark} color={color} width={86} height={30} />}
      </div>
      <p className="relative mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="relative mt-0.5 whitespace-nowrap font-display text-[1.5rem] font-semibold leading-tight"><Money value={value} cents={false} /></p>
      {foot && <div className="relative mt-1 text-xs text-muted-foreground">{foot}</div>}
    </div>
    </Tilt>
  );
}
const Delta = ({ now, prev, goodWhenUp = true }: { now: number; prev: number; goodWhenUp?: boolean }) => {
  if (!prev) return <span>sem mês anterior</span>;
  const d = ((now - prev) / prev) * 100, up = d >= 0, good = up === goodWhenUp;
  return <span className="inline-flex items-center gap-1" style={{ color: good ? "var(--emerald)" : ROSE }}>{up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(d).toFixed(0)}% <span className="text-muted-foreground">vs mês anterior</span></span>;
};

/** O que ainda vai entrar e sair, na ordem, com o saldo depois de cada item. Mostra com clareza quando o saldo fica negativo. */
function FlowPanel({ flow, today, onAddMov }: { flow: ReturnType<typeof cashflow>; today: Date; onAddMov: () => void }) {
  const neg = flow.min < 0, color = neg ? ROSE : "var(--cyan)";
  // um ponto por dia (o saldo no fim do dia), para o gráfico não repetir datas
  const byDay = new Map<string, number>(); for (const e of flow.events) byDay.set(e.date, e.balance);
  const points = [{ label: "hoje", value: flow.start }, ...[...byDay.entries()].map(([d, v]) => ({ label: dateBR(d).slice(0, 5), value: v }))];
  return (
    <Panel glow={color} data-testid="fin-fluxo">
      <Head icon={CalendarClock} title="Para onde vai o seu saldo" sub={`Próximos 60 dias: o que entra, o que sai e como o saldo fica (até ${dateBR(flow.until).slice(0, 5)})`}
        right={<span className="text-right"><span className="block text-[0.66rem] uppercase tracking-wider text-muted-foreground">Saldo hoje</span><b className="font-display text-xl tabular-nums">{brl(flow.start)}</b></span>} />
      {flow.events.length === 0 ? <Empty icon={CalendarClock} title="Nada previsto nos próximos 60 dias" hint="Cadastre salário, despesas fixas e cartões para ver a projeção do saldo." action={<button className={btn.ghost} onClick={onAddMov}>Adicionar movimentação</button>} /> : (
        <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div>
            {flow.firstNegative ? (
              <p className="mb-3 rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: `color-mix(in oklab, ${ROSE} 40%, transparent)`, background: `color-mix(in oklab, ${ROSE} 9%, transparent)` }} data-testid="fin-fluxo-negativo">
                <b style={{ color: ROSE }}>O saldo fica negativo em {dateBR(flow.firstNegative.date).slice(0, 5)}</b> ({brl(flow.firstNegative.balance)}), depois de {flow.firstNegative.label}. No pior momento faltam <b>{brl(Math.abs(flow.min))}</b>.
              </p>
            ) : <p className="mb-3 rounded-2xl border border-emerald/30 bg-emerald/[0.07] px-4 py-3 text-sm">O saldo se mantém positivo nos próximos 60 dias e termina em <b>{brl(flow.end)}</b>.</p>}
            <AreaChart points={points} color={color} height={190} />
          </div>
          <ol className="space-y-1.5" data-testid="fin-fluxo-lista">
            {flow.events.slice(0, 9).map((e, i) => (
              <li key={e.id} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2" style={{ animation: `fin-pop .4s ${i * 0.04}s both` }}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[0.7rem] font-semibold tabular-nums" style={{ color: e.amount >= 0 ? "var(--emerald)" : e.kind === "fatura" ? "var(--violet)" : ROSE, background: "color-mix(in oklab, currentColor 13%, transparent)" }}>{dateBR(e.date).slice(0, 5)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{e.label}</span><span className="block text-[0.7rem] text-muted-foreground">{e.kind === "fatura" ? "vencimento da fatura" : e.amount >= 0 ? "entrada prevista" : "saída prevista"}</span></span>
                <span className="text-right"><span className={`block text-sm font-semibold tabular-nums ${e.amount >= 0 ? "text-emerald" : ""}`}>{e.amount >= 0 ? "+" : "−"}{brl(Math.abs(e.amount))}</span><span className="block text-[0.7rem] tabular-nums" style={{ color: e.balance < 0 ? ROSE : undefined }}>saldo {brl(e.balance)}</span></span>
              </li>
            ))}
            {flow.events.length > 9 && <li className="px-2 text-xs text-muted-foreground">+ {flow.events.length - 9} lançamentos depois</li>}
          </ol>
        </div>
      )}
    </Panel>
  );
}

type Model = { close: ReturnType<typeof monthClose>; sum: ReturnType<typeof monthSummary>; series: ReturnType<typeof monthlySeries>; saldo: number; faturas: number; parcelas: number; flow: ReturnType<typeof cashflow> };
/** Topo da visão geral: saldo gigante, ritmo do mês e a órbita com o que sobra no fim do mês. */
function Hero({ model, cards, accounts, today, onDetail }: { model: Model; cards: number; accounts: number; today: Date; onDetail: () => void }) {
  const c = model.close, good = c.sobra >= 0;
  const stats = [
    { l: "A receber no mês", v: model.sum.aReceber, c: "var(--emerald)", i: ArrowUpRight },
    { l: "A pagar no mês", v: model.sum.aPagar, c: ROSE, i: ArrowDownRight },
    { l: "Saldo em 60 dias", v: model.flow.end, c: "var(--cyan)", i: CalendarClock },
    { l: "Menor saldo previsto", v: model.flow.min, c: model.flow.min < 0 ? ROSE : "var(--violet)", i: Activity },
  ];
  return (
    <HeroPanel data-testid="fin-hero">
      <div className="grid items-center gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0">
          <p className="mono-caps flex items-center gap-2"><Sparkles size={13} className="text-cyan" />Saldo disponível hoje</p>
          <p className="mt-2 whitespace-nowrap font-display text-5xl font-semibold leading-none tracking-tight sm:text-6xl md:text-7xl" style={{ animation: "fin-rise .8s .1s both" }}>
            <span className="text-gradient drop-shadow-[0_0_40px_color-mix(in_oklab,var(--cyan)_35%,transparent)]"><Money value={model.saldo} /></span>
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Em {accounts} {accounts === 1 ? "conta" : "contas e carteiras"} · {cards} {cards === 1 ? "cartão" : "cartões"} · {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
          <div className="mt-4 overflow-hidden"><Sparkline values={model.series.map((p) => p.acumulado)} color="var(--cyan)" width={420} height={56} /></div>
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map((k, i) => (
              <div key={k.l} className="rounded-2xl border bg-white/[0.03] px-3 py-2.5 backdrop-blur" style={{ borderColor: `color-mix(in oklab, ${k.c} 28%, transparent)`, animation: `fin-rise .6s ${0.2 + i * 0.07}s both` }}>
                <p className="flex items-center gap-1 text-[0.64rem] font-semibold uppercase tracking-[0.12em]" style={{ color: k.c }}><k.i size={12} />{k.l}</p>
                <p className="mt-0.5 font-display text-lg font-semibold tabular-nums"><Money value={k.v} cents={false} /></p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative grid place-items-center">
          <OrbitArt size={290}>
            <button type="button" onClick={onDetail} data-testid="fin-sobra-detalhe" aria-label={`Ver o detalhamento da ${good ? "sobra" : "falta"} de caixa`}
              className="group/sobra relative grid h-[128px] w-[128px] cursor-pointer place-items-center rounded-full transition duration-300 hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60">
              <span aria-hidden className="absolute inset-0 rounded-full border opacity-0 transition duration-300 group-hover/sobra:opacity-100" style={{ borderColor: good ? "var(--emerald)" : ROSE, boxShadow: `0 0 30px -6px ${good ? "var(--emerald)" : ROSE}, inset 0 0 24px -10px ${good ? "var(--emerald)" : ROSE}` }} />
              <span aria-hidden className="absolute inset-0 rounded-full" style={{ border: `1px solid ${good ? "var(--emerald)" : ROSE}`, animation: "fin-pulse 2.6s ease-out infinite", opacity: 0.35 }} />
              <span>
                <span className="block text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{good ? "Sobra de caixa" : "Falta no caixa"}</span>
                <span className="block font-display text-2xl font-semibold tabular-nums" style={{ color: good ? "var(--emerald)" : ROSE, textShadow: `0 0 24px ${good ? "var(--emerald)" : ROSE}` }}><Money value={Math.abs(c.sobra)} cents={false} /></span>
                <span className="block text-[0.68rem] text-muted-foreground">depois de pagar as faturas</span>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.6rem] font-medium text-cyan transition group-hover/sobra:bg-cyan/15">ver detalhes<ArrowUpRight size={10} /></span>
              </span>
            </button>
          </OrbitArt>
          <dl className="mt-3 w-full max-w-[19rem] space-y-1 text-xs tabular-nums" data-testid="fin-sobra-conta" aria-label="Como chegamos nesse número">
            {[["Saldo hoje", c.saldo, ""], ["+ Ainda entra no mês", c.aReceber, "var(--emerald)"], ["− Contas a pagar no mês", -c.aPagarConta, ROSE], ["− Faturas dos cartões", -c.faturas, ROSE]].map(([l, v, col]) => (
              <div key={String(l)} className="flex items-baseline justify-between gap-3"><dt className="text-muted-foreground">{l}</dt><dd className="font-medium" style={col ? { color: String(col) } : undefined}><Money value={Number(v)} cents={false} /></dd></div>
            ))}
            <div className="flex items-baseline justify-between gap-3 border-t border-white/10 pt-1"><dt className="font-semibold">= Resultado</dt><dd className="font-semibold" style={{ color: good ? "var(--emerald)" : ROSE }}><Money value={c.sobra} cents={false} /></dd></div>
          </dl>
          {model.flow.firstNegative && <span className="absolute left-0 top-0 rounded-full border px-3 py-1 text-[0.7rem]" style={{ color: ROSE, borderColor: `color-mix(in oklab, ${ROSE} 40%, transparent)`, background: `color-mix(in oklab, ${ROSE} 10%, transparent)` }}>saldo negativo em {dateBR(model.flow.firstNegative.date).slice(0, 5)}</span>}
        </div>
      </div>
    </HeroPanel>
  );
}

export function Dashboard({ onOpenCard, onOpenAccount, onAdd, onTab, onDraft }: { onOpenCard: (id: string) => void; onOpenAccount: (id: string) => void; onAdd: () => void; onTab: (t: string) => void; onDraft: (d: Draft) => void }) {
  const { state, today } = useFinance();
  const ym = ymOf(today), [active, setActive] = useState<string | null>(null), [detail, setDetail] = useState(false);
  const model = useMemo(() => {
    const todayIso = isoOf(today), sum = monthSummary(state, ym, todayIso), prevEs = monthEntries(state, addMonths(ym, -1), sameDayPrev(ym, todayIso));
    const series = monthlySeries(state, ym, 6, todayIso), cats = categoryTotals(state, ym, todayIso), future = commitments(state, ym, 12);
    return {
      close: monthClose(state, today), sum, prevR: total(incomeOf(prevEs)), prevD: total(expensesOf(prevEs)),
      series, cats, future, saldo: totalBalance(state, today), faturas: totalOpenInvoices(state, today), parcelas: totalFutureParcels(state, today),
      alerts: alertsFor(state, today), why: whyChanged(state, ym, todayIso), flow: cashflow(state, today, 60),
      daily: expensesOf(monthEntries(state, ym, todayIso)).reduce<Record<number, number>>((m, e) => { const d = Number(e.date.slice(8, 10)); m[d] = (m[d] ?? 0) + e.amount; return m; }, {}),
    };
  }, [state, ym, today]);
  const nowCard = model.cats.find((c) => c.id === active);
  const upcoming = useMemo(() => state.cards.map((c) => ({ card: c, inv: openInvoice(state, c, today) })).filter((x) => x.inv.total > 0).sort((a, b) => a.inv.due.localeCompare(b.inv.due)), [state, today]);
  const net = model.sum.resultado;
  const levelColor = { danger: ROSE, warning: "var(--amber)", info: "var(--cyan)" } as const;
  const incomeMonth = model.sum.receitas + model.sum.aReceber, spendMonth = model.sum.despesas + model.sum.aPagar;
  const pctIncome = incomeMonth > 0 ? Math.min(100, (spendMonth / incomeMonth) * 100) : spendMonth > 0 ? 100 : 0;
  const limits = state.cards.map((c) => ({ id: c.id, label: c.name, color: TONES[c.tone].glow, pct: c.limit ? (1 - cardAvailable(state, c) / c.limit) * 100 : 0 }));
  const freeTotal = state.cards.reduce((a, c) => a + Math.max(0, cardAvailable(state, c)), 0);

  return (
    <div className="space-y-5" data-testid="fin-dashboard">
      <Hero model={model} cards={state.cards.length} accounts={state.accounts.length} today={today} onDetail={() => setDetail(true)} />
      <MonthBreakdownModal open={detail} onClose={() => setDetail(false)} onTab={onTab} />

      <Panel glow="var(--violet)" className="!p-4 sm:!p-5"><NaturalComposer onOpenForm={onDraft} /></Panel>

      {model.alerts.some((a) => a.id !== "fluxo") && (
        <div className="grid gap-3 md:grid-cols-2" data-testid="fin-alertas">
          {model.alerts.filter((a) => a.id !== "fluxo").slice(0, 4).map((a, i) => (
            <div key={a.id} className="flex items-start gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: `color-mix(in oklab, ${levelColor[a.level]} 35%, transparent)`, background: `color-mix(in oklab, ${levelColor[a.level]} 8%, transparent)`, animation: `fin-pop .5s ${i * 0.07}s both` }}>
              <span style={{ color: levelColor[a.level] }} className="mt-0.5">{a.level === "info" ? <Info size={18} /> : <AlertTriangle size={18} />}</span>
              <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground">{a.detail}</p></div>
            </div>
          ))}
        </div>
      )}

      <FlowPanel flow={model.flow} today={today} onAddMov={onAdd} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi testId="kpi-receitas" icon={TrendingUp} label="Receitas até hoje" value={model.sum.receitas} color="var(--emerald)" foot={model.sum.aReceber > 0 ? <span>+ {brl(model.sum.aReceber)} a receber no mês</span> : <Delta now={model.sum.receitas} prev={model.prevR} />} delay={0.05} />
        <Kpi testId="kpi-despesas" icon={TrendingDown} label="Despesas até hoje" value={model.sum.despesas} color={ROSE} foot={model.sum.aPagar > 0 ? <span>+ {brl(model.sum.aPagar)} a pagar no mês</span> : <Delta now={model.sum.despesas} prev={model.prevD} goodWhenUp={false} />} delay={0.1} />
        <Kpi testId="kpi-faturas" icon={CreditCard} label="Faturas abertas" value={model.faturas} color="var(--violet)" foot={<span>{state.cards.length} cartões</span>} delay={0.15} />
        <Kpi testId="kpi-parcelas" icon={Layers} label="Parcelas futuras" value={model.parcelas} color="var(--amber)" foot={<span>{state.plans.length} compras parceladas</span>} delay={0.2} />
        <Kpi testId="kpi-saldo-mes" icon={Scale} label="Resultado até hoje" value={net} color={net >= 0 ? "var(--emerald)" : ROSE} foot={<span>caixa depois das faturas: <b className={model.close.sobra >= 0 ? "text-emerald" : ""} style={model.close.sobra < 0 ? { color: ROSE } : undefined}>{brl(model.close.sobra)}</b></span>} delay={0.25} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel glow="var(--amber)" data-testid="fin-termometro">
          <Head icon={GaugeIcon} title="Termômetro do mês" sub="Quanto da renda do mês já está comprometida" />
          <div className="grid place-items-center pt-1">
            <Gauge pct={pctIncome} size={250} from="var(--emerald)" mid="var(--amber)" to={ROSE} label="da renda" value={`${Math.round(pctIncome)}%`} sub={pctIncome < 70 ? "folga saudável" : pctIncome < 95 ? "atenção ao ritmo" : "no limite"} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-2.5"><p className="text-muted-foreground">Entra no mês</p><b className="tabular-nums text-emerald">{brl(incomeMonth)}</b></div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-2.5"><p className="text-muted-foreground">Sai no mês</p><b className="tabular-nums" style={{ color: ROSE }}>{brl(spendMonth)}</b></div>
          </div>
        </Panel>
        <Panel glow="var(--violet)" data-testid="fin-calendario">
          <Head icon={CalendarDays} title="Calendário de gastos" sub={`Quanto saiu em cada dia de ${monthName(ym).split(" ")[0]}`} />
          <Heatmap ym={ym} values={model.daily} today={today.getDate()} />
        </Panel>
        <Panel glow="var(--cyan)" data-testid="fin-limites">
          <Head icon={Activity} title="Uso dos limites" sub="Quanto de cada cartão já está usado" />
          {state.cards.length === 0 ? <Empty icon={CreditCard} title="Nenhum cartão" hint="Cadastre um cartão para ver o uso do limite." /> : (
            <div className="flex flex-col items-center gap-4">
              <RadialRings items={limits} size={190} center={<div><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">Livre</p><p className="font-display text-lg font-semibold tabular-nums">{brl(freeTotal).replace(/,\d\d$/, "")}</p></div>} />
              <ul className="w-full space-y-1.5">{limits.map((l) => <li key={l.id} className="flex items-center gap-2 text-sm"><i className="h-2.5 w-2.5 rounded-full" style={{ background: l.color, boxShadow: `0 0 8px ${l.color}` }} /><span className="flex-1 truncate">{l.label}</span><b className="tabular-nums">{Math.round(l.pct)}%</b></li>)}</ul>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel glow="var(--violet)" className="lg:col-span-3" data-testid="fin-categorias">
          <Head icon={PiggyBank} title="Onde você mais gasta" sub={`Despesas feitas até hoje em ${monthName(ym)}`} />
          {model.cats.length === 0 ? <Empty title="Nenhuma despesa até hoje" hint="Adicione uma movimentação para ver o gráfico." /> : (
            <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
              <Donut data={model.cats} active={active} onActive={setActive} center={nowCard
                ? <div><p className="text-xs text-muted-foreground">{nowCard.name}</p><p className="font-display text-xl font-semibold tabular-nums">{brl(nowCard.value)}</p><p className="text-xs" style={{ color: nowCard.color }}>{nowCard.pct.toFixed(0)}% das despesas</p></div>
                : <div><p className="text-xs text-muted-foreground">Gasto até hoje</p><p className="font-display text-2xl font-semibold tabular-nums">{brl(model.sum.despesas)}</p><p className="text-xs text-muted-foreground">{model.cats.length} categorias</p></div>} />
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
          {model.why.totalPct === null ? (
            <>
              <Head icon={TrendingUp} title="Seus gastos neste mês" sub="Ainda não há mês anterior para comparar" />
              <p className="font-display text-3xl font-semibold tabular-nums">{brl(model.sum.despesas)}</p>
              <p className="mb-4 text-xs text-muted-foreground">gastos até hoje. Quando houver um mês anterior, o Orion mostra aqui por que os gastos subiram ou caíram.</p>
              <ol className="space-y-2">{model.cats.slice(0, 3).map((c) => <li key={c.id} className="flex items-center gap-2.5 rounded-2xl border border-white/8 bg-white/[0.03] p-3"><CatBadge id={c.id} size={28} /><span className="text-sm font-medium">{c.name}</span><span className="ml-auto text-sm font-semibold tabular-nums">{brl(c.value)}</span></li>)}</ol>
            </>
          ) : (
            <>
              <Head icon={model.why.totalDelta > 0 ? TrendingUp : TrendingDown} title={model.why.totalDelta > 0 ? "Por que seus gastos subiram?" : "Como seus gastos mudaram"} sub="Até hoje, comparado ao mesmo ponto do mês passado" />
              <p className="font-display text-3xl font-semibold tabular-nums" style={{ color: model.why.totalDelta > 0 ? ROSE : "var(--emerald)" }}>{model.why.totalDelta > 0 ? "+" : ""}{brl(model.why.totalDelta)}</p>
              <p className="mb-4 text-xs text-muted-foreground">{model.why.totalDelta >= 0 ? "a mais" : "a menos"} ({Math.abs(model.why.totalPct).toFixed(0)}%) que em {monthName(addMonths(ym, -1))} até o dia {today.getDate()}.</p>
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
            </>
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
