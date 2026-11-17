import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CreditCard, Landmark, Layers, PartyPopper, Pencil, Plus, Receipt, Repeat, ShoppingBag, ShoppingCart, Sparkles, Target, Trash2 } from "lucide-react";
import { accountBalance, brl, cardAvailable, invoiceLabel, invoiceMonthOf, isoOf, openInvoice, totalFutureParcels, totalBalance, totalOpenInvoices, sum } from "@/lib/finance/calc";
import { catOf } from "@/lib/finance/categories";
import { useFinance } from "@/lib/finance/store";
import type { Account, Card, Goal, Plan, Recurring, Transaction } from "@/lib/finance/types";
import { AccountTile, CardVisual } from "./CardVisual";
import { AccountForm, CardForm, GoalForm, PlanForm, RecurringForm, TxForm } from "./forms";
import { Money, Ring } from "./charts";
import { GoalCard } from "./Goals";
import { PlanCard } from "./Installments";
import { CatBadge, Field, MoneyInput, Panel, Pill, TONES, btn } from "./ui";

type StepDef = { id: string; title: string; short: string; icon: typeof Landmark; text: string; color: string };
const STEPS: StepDef[] = [
  { id: "inicio", title: "Vamos organizar o seu dinheiro", short: "Início", icon: Sparkles, color: "var(--violet)", text: "Em poucos passos o Orion entende a sua vida financeira: contas, cartões, parcelas e metas. Dá para pular o que não quiser e voltar depois." },
  { id: "contas", title: "Bancos, carteiras e saldos", short: "Contas", icon: Landmark, color: "var(--cyan)", text: "Cadastre onde o seu dinheiro está e quanto tem em cada lugar hoje: Nubank, PicPay, Mercado Pago, dinheiro na carteira…" },
  { id: "cartoes", title: "Cartões de crédito", short: "Cartões", icon: CreditCard, color: "var(--violet)", text: "Informe o limite total, quanto ainda está disponível e os dias de fechamento e vencimento da fatura de cada cartão." },
  { id: "faturas", title: "Faturas atuais e valores pendentes", short: "Faturas", icon: Receipt, color: "var(--amber)", text: "Veja a fatura aberta de cada cartão e acrescente algum valor que ainda não esteja nas compras: fatura anterior em aberto, juros, anuidade." },
  { id: "recorrentes", title: "Despesas e receitas fixas", short: "Fixas", icon: Repeat, color: "var(--emerald)", text: "Aluguel, internet, assinaturas, salário… o que se repete todo mês entra automático no seu planejamento." },
  { id: "debito", title: "Compras no débito", short: "Débito", icon: ShoppingCart, color: "var(--cyan)", text: "Lance as últimas compras feitas no débito, no pix ou em dinheiro, para o painel já mostrar para onde o dinheiro foi." },
  { id: "credito", title: "Compras no crédito", short: "Crédito", icon: ShoppingBag, color: "var(--violet)", text: "Lance as compras recentes feitas no cartão. Elas entram na fatura certa conforme o fechamento." },
  { id: "parcelas", title: "Compras parceladas em andamento", short: "Parcelas", icon: Layers, color: "var(--amber)", text: "Aquela compra de março em 12x e você está na 3ª parcela? Cadastre: o Orion calcula as pagas, as restantes e quando termina." },
  { id: "metas", title: "Metas financeiras", short: "Metas", icon: Target, color: "var(--emerald)", text: "Guardar um valor, quitar um cartão, montar a reserva de emergência ou limitar gastos de uma categoria." },
  { id: "fim", title: "Tudo pronto", short: "Pronto", icon: PartyPopper, color: "var(--cyan)", text: "Veja o resumo do que foi cadastrado. O painel já vai estar com os seus números." },
];

/** Lista + formulário: mostra o que já foi cadastrado e abre o formulário para novo ou edição. */
function ListStep<T extends { id: string }>({ items, render, form, addLabel, hint, testId, grid = "" }: { items: T[]; render: (item: T, actions: ReactNode) => ReactNode; form: (initial: T | undefined, done: () => void) => ReactNode; addLabel: string; hint: string; testId: string; grid?: string }) {
  const [editing, setEditing] = useState<T | "new" | null>(items.length === 0 ? "new" : null);
  const open = editing !== null && !(items.length === 0 && editing === null);
  return (
    <div className="space-y-4" data-testid={testId}>
      {items.length > 0 && <ul className={grid || "space-y-2"}>{items.map((it) => <li key={it.id}>{render(it, <span className="flex gap-1.5"><button className={btn.icon} aria-label="Editar" onClick={() => setEditing(it)}><Pencil size={14} /></button></span>)}</li>)}</ul>}
      {open ? (
        <div className="rounded-3xl border border-cyan/25 bg-cyan/[0.04] p-4 sm:p-5" style={{ animation: "fin-pop .4s both" }}>
          <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan">{editing === "new" ? addLabel : "Editar"}</p>
          {form(editing === "new" ? undefined : (editing as T), () => setEditing(null))}
        </div>
      ) : (
        <button className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-3 text-sm text-muted-foreground transition hover:border-cyan/45 hover:text-cyan" onClick={() => setEditing("new")} data-testid={`${testId}-add`}><Plus size={16} /> {addLabel}</button>
      )}
      {items.length === 0 && !open && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
const Remove = ({ onClick, label }: { onClick: () => void; label: string }) => <button className={`${btn.icon} hover:!border-destructive/50 hover:!text-destructive`} aria-label={`Excluir ${label}`} onClick={onClick}><Trash2 size={14} /></button>;

/** Fatura atual de um cartão: mostra as datas de fechamento e vencimento e deixa a pessoa informar o total que vê no app do banco. */
function InvoiceStepRow({ card: c }: { card: Card }) {
  const f = useFinance(), { state, today } = f, ym = invoiceMonthOf(c, isoOf(today)), inv = openInvoice(state, c, today), extra = c.adjustments[ym] ?? 0, base = Math.round((inv.total - extra) * 100) / 100;
  const [typed, setTyped] = useState<number | undefined>(inv.total > 0 ? inv.total : undefined);
  const set = (v: number | undefined) => {
    setTyped(v);
    const adj = { ...c.adjustments }, rest = v === undefined ? 0 : Math.round(Math.max(0, v - base) * 100) / 100;
    if (rest > 0) adj[ym] = rest; else delete adj[ym];
    f.upsertCard({ ...c, adjustments: adj });
  };
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4" style={{ borderColor: `color-mix(in oklab, ${TONES[c.tone].glow} 28%, transparent)` }} data-testid="fin-fatura-linha">
      <div className="flex flex-wrap items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: TONES[c.tone].bg }}><CreditCard size={18} /></span><div className="min-w-0 flex-1"><p className="font-medium">{c.name} •••• {c.last4}</p><p className="text-xs text-muted-foreground">Fatura atual · {invoiceLabel(c, ym)}</p></div><div className="text-right"><p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Total da fatura</p><p className="font-display text-xl font-semibold tabular-nums" data-testid="fin-fatura-total"><Money value={inv.total} /></p></div></div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Total da fatura atual (como aparece no app do banco)" hint={base > 0 ? `Suas compras e parcelas já somam ${brl(base)}; o restante entra como “outros valores pendentes”.` : "Ainda não há compras lançadas neste ciclo: o valor informado entra como “outros valores pendentes”."}><MoneyInput value={typed} onChange={set} data-testid="fin-fatura-total-campo" /></Field>
        <p className="pb-2 text-xs text-muted-foreground">{inv.lines.filter((l) => l.source !== "ajuste").length} compras e parcelas nesta fatura</p>
      </div>
    </div>
  );
}

export function Briefing({ onDone }: { onDone: () => void }) {
  const f = useFinance(), { state, today } = f;
  const [i, setI] = useState(0), [dir, setDir] = useState<1 | -1>(1);
  const step = STEPS[i]!, Icon = step.icon;
  const go = (n: number) => { setDir(n > i ? 1 : -1); setI(Math.max(0, Math.min(STEPS.length - 1, n))); };
  const finish = () => { f.finishOnboarding(); onDone(); };
  const done = (id: string) => (id === "contas" ? state.accounts.length > 0 : id === "cartoes" ? state.cards.length > 0 : id === "recorrentes" ? state.recurring.length > 0 : id === "debito" ? state.transactions.some((t) => t.method !== "credito") : id === "credito" ? state.transactions.some((t) => t.method === "credito") : id === "parcelas" ? state.plans.length > 0 : id === "metas" ? state.goals.length > 0 : false);
  const debit = state.transactions.filter((t) => t.method !== "credito" && t.kind === "despesa"), credit = state.transactions.filter((t) => t.method === "credito");
  const summary = useMemo(() => ({ saldo: totalBalance(state), faturas: totalOpenInvoices(state, today), parcelas: totalFutureParcels(state, today), limite: sum(state.cards.map((c) => cardAvailable(state, c))) }), [state, today]);

  const body = (() => {
    switch (step.id) {
      case "inicio": return (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">{[{ i: Landmark, t: "Contas e cartões", d: "Saldos, limites e faturas num só lugar." }, { i: Layers, t: "Parcelas sob controle", d: "O que falta pagar e quando termina." }, { i: Sparkles, t: "Painel inteligente", d: "Mostra onde você gasta e por que subiu." }].map((x, k) => (
            <div key={x.t} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4" style={{ animation: `fin-pop .5s ${k * 0.08}s both` }}><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan/12 text-cyan"><x.i size={18} /></span><p className="mt-3 font-medium">{x.t}</p><p className="text-xs text-muted-foreground">{x.d}</p></div>))}</div>
          <div className="flex flex-wrap gap-3"><button className={btn.primary} onClick={() => go(1)} data-testid="fin-comecar"><ArrowRight size={16} /> Começar o briefing</button>
            <button className={btn.ghost} onClick={() => { f.loadMock(); onDone(); }} data-testid="fin-exemplo"><Sparkles size={15} /> Explorar com dados de exemplo</button></div>
          <p className="text-xs text-muted-foreground">Os dados de exemplo são fictícios e ficam só neste navegador. Você pode limpar tudo depois, em “Opções”.</p>
        </div>);
      case "contas": return <ListStep testId="fin-step-contas" items={state.accounts} addLabel="Adicionar banco ou carteira" hint="Cadastre pelo menos uma conta para os saldos aparecerem."
        grid="grid gap-3 sm:grid-cols-2" render={(a: Account, act) => <div className="relative"><AccountTile account={a} balance={accountBalance(state, a, today)} /><span className="absolute right-3 top-3 flex gap-1.5">{act}<Remove label={a.name} onClick={() => f.removeAccount(a.id)} /></span></div>}
        form={(init, d) => <AccountForm initial={init} onCancel={state.accounts.length ? d : undefined} onSave={(a) => { f.upsertAccount(a); d(); }} />} />;
      case "cartoes": return <ListStep testId="fin-step-cartoes" items={state.cards} addLabel="Adicionar cartão de crédito" hint="Sem cartões? Pode pular esta etapa."
        grid="grid gap-4 sm:grid-cols-2" render={(c: Card, act) => <div><CardVisual card={c} compact usedPct={c.limit ? (1 - cardAvailable(state, c) / c.limit) * 100 : 0} /><span className="mt-2 flex justify-end gap-1.5">{act}<Remove label={c.name} onClick={() => f.removeCard(c.id)} /></span></div>}
        form={(init, d) => <CardForm initial={init} onCancel={state.cards.length ? d : undefined} onSave={(c) => { f.upsertCard(c); d(); }} />} />;
      case "faturas": return state.cards.length === 0 ? <p className="rounded-2xl border border-dashed border-white/12 p-6 text-center text-sm text-muted-foreground">Cadastre um cartão na etapa anterior para ver as faturas.</p> : (
        <div className="space-y-3" data-testid="fin-step-faturas">{state.cards.map((c) => <InvoiceStepRow key={c.id} card={c} />)}</div>);
      case "recorrentes": return <ListStep testId="fin-step-recorrentes" items={state.recurring} addLabel="Adicionar despesa ou receita fixa" hint="Aluguel, assinaturas, salário…"
        render={(r: Recurring, act) => <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5"><CatBadge id={r.category} size={36} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{r.desc}</p><p className="text-xs text-muted-foreground">todo dia {r.day} · {catOf(r.category).name}</p></div><b className={`text-sm tabular-nums ${r.kind === "receita" ? "text-emerald" : ""}`}>{r.kind === "receita" ? "+" : "−"}{brl(r.amount)}</b>{act}<Remove label={r.desc} onClick={() => f.removeRecurring(r.id)} /></div>}
        form={(init, d) => <RecurringForm initial={init} onCancel={state.recurring.length ? d : undefined} onSave={(r) => { f.upsertRecurring(r); d(); }} />} />;
      case "debito": case "credito": {
        const list = step.id === "debito" ? debit : credit;
        return <ListStep testId={`fin-step-${step.id}`} items={list} addLabel={step.id === "debito" ? "Adicionar compra no débito" : "Adicionar compra no crédito"} hint={step.id === "debito" ? "Compras recentes no débito, pix ou dinheiro." : "Compras recentes no cartão de crédito."}
          render={(t: Transaction, act) => <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5"><CatBadge id={t.category} size={36} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t.desc}</p><p className="text-xs text-muted-foreground">{t.date.split("-").reverse().join("/")} · {catOf(t.category).name}</p></div><b className="text-sm tabular-nums">−{brl(t.amount)}</b>{act}<Remove label={t.desc} onClick={() => f.removeTx(t.id)} /></div>}
          form={(init, d) => <TxForm key={step.id} initial={init} lockMethod={init?.method ?? (step.id === "debito" ? "debito" : "credito")} initialMethod={step.id === "debito" ? "debito" : "credito"} saveLabel="Adicionar" onCancel={list.length ? d : undefined} onSave={(r) => { if (r.tx) f.upsertTx(r.tx); if (r.plan) f.upsertPlan(r.plan); d(); }} />} />;
      }
      case "parcelas": return <ListStep testId="fin-step-parcelas" items={state.plans} addLabel="Cadastrar compra parcelada" hint="Cadastre as compras antigas que ainda têm parcelas pendentes." grid="grid gap-4"
        render={(p: Plan, act) => <div><PlanCard plan={p} /><span className="mt-2 flex justify-end gap-1.5">{act}<Remove label={p.desc} onClick={() => f.removePlan(p.id)} /></span></div>}
        form={(init, d) => <PlanForm initial={init} onCancel={state.plans.length ? d : undefined} onSave={(p) => { f.upsertPlan(p); d(); }} />} />;
      case "metas": return <ListStep testId="fin-step-metas" items={state.goals} addLabel="Criar meta" hint="Reserva de emergência, viagem, limite de gastos…" grid="grid gap-4 sm:grid-cols-2"
        render={(g: Goal, act) => <div><GoalCard goal={g} /><span className="mt-2 flex justify-end gap-1.5">{act}<Remove label={g.title} onClick={() => f.removeGoal(g.id)} /></span></div>}
        form={(init, d) => <GoalForm initial={init} onCancel={state.goals.length ? d : undefined} onSave={(g) => { f.upsertGoal(g); d(); }} />} />;
      default: return (
        <div className="space-y-5" data-testid="fin-step-fim">
          <div className="grid gap-3 sm:grid-cols-2">{[{ l: "Saldo nas contas", v: summary.saldo, c: "var(--cyan)" }, { l: "Faturas abertas", v: summary.faturas, c: "var(--violet)" }, { l: "Parcelas ainda por pagar", v: summary.parcelas, c: "var(--amber)" }, { l: "Limite livre nos cartões", v: summary.limite, c: "var(--emerald)" }].map((k, n) => (
            <div key={k.l} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4" style={{ animation: `fin-pop .5s ${n * 0.08}s both`, boxShadow: `0 16px 40px -32px ${k.c}` }}><p className="text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{k.l}</p><p className="font-display text-2xl font-semibold" style={{ color: k.c }}><Money value={k.v} /></p></div>))}</div>
          <div className="flex flex-wrap gap-2">{[["contas", state.accounts.length, "contas"], ["cartões", state.cards.length, "cartões"], ["fixas", state.recurring.length, "fixas"], ["compras", state.transactions.length, "compras"], ["parcelas", state.plans.length, "parceladas"], ["metas", state.goals.length, "metas"]].map(([k, n, l]) => <Pill key={String(k)} color={n ? "var(--emerald)" : "var(--amber)"}>{n ? <Check size={11} /> : null}{String(n)} {String(l)}</Pill>)}</div>
          <button className={btn.primary} onClick={finish} data-testid="fin-concluir"><Check size={16} /> Ir para o meu painel financeiro</button>
        </div>);
    }
  })();

  const complete = STEPS.filter((s) => done(s.id)).length;
  return (
    <div className="grid gap-5 lg:grid-cols-[17rem_1fr]" data-testid="fin-briefing">
      <nav aria-label="Etapas do briefing" className="lg:sticky lg:top-6 lg:self-start">
        <Panel glow="var(--violet)" className="!p-4">
          <div className="mb-4 flex items-center gap-3"><Ring pct={(i / (STEPS.length - 1)) * 100} color="var(--cyan)" size={52} thickness={5}><span className="text-[0.7rem] font-semibold tabular-nums">{i + 1}/{STEPS.length}</span></Ring><div><p className="font-display font-semibold leading-tight">Briefing financeiro</p><p className="text-xs text-muted-foreground">{complete} etapas preenchidas</p></div></div>
          <ol className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {STEPS.map((s, n) => { const SI = s.icon, on = n === i, ok = done(s.id) && n !== i; return (
              <li key={s.id} className="shrink-0 lg:shrink"><button type="button" onClick={() => go(n)} aria-current={on ? "step" : undefined} data-testid={`fin-etapa-${s.id}`}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition ${on ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"}`}>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg transition" style={{ color: on || ok ? s.color : undefined, background: on || ok ? `color-mix(in oklab, ${s.color} 16%, transparent)` : "color-mix(in oklab, white 6%, transparent)", boxShadow: on ? `0 0 14px -2px ${s.color}` : undefined }}>{ok ? <Check size={14} /> : <SI size={14} />}</span>
                <span className={on ? "font-medium" : "text-muted-foreground"}>{s.short}</span></button></li>); })}
          </ol>
        </Panel>
      </nav>
      <Panel glow={step.color} className="min-h-[28rem]">
        <div key={step.id} style={{ animation: `${dir === 1 ? "fin-slide" : "fin-slide-back"} .45s cubic-bezier(.2,.8,.2,1) both` }}>
          <div className="mb-6 flex items-start gap-4">
            <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ color: step.color, background: `color-mix(in oklab, ${step.color} 16%, transparent)`, border: `1px solid color-mix(in oklab, ${step.color} 38%, transparent)`, animation: "fin-float 5s ease-in-out infinite", boxShadow: `0 14px 40px -16px ${step.color}` }}><Icon size={26} /></span>
            <div><p className="mono-caps !text-[0.62rem]">Etapa {i + 1} de {STEPS.length}</p><h2 className="mt-1 font-serif text-3xl leading-tight sm:text-4xl"><span className="text-gradient">{step.title}</span></h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{step.text}</p></div>
          </div>
          {body}
        </div>
        {step.id !== "inicio" && step.id !== "fim" && (
          <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-4">
            <button className={btn.ghost} onClick={() => go(i - 1)}><ArrowLeft size={15} /> Voltar</button>
            <div className="flex gap-2">{!done(step.id) && step.id !== "faturas" && <button className={btn.ghost} onClick={() => go(i + 1)} data-testid="fin-pular">Pular esta etapa</button>}<button className={btn.primary} onClick={() => go(i + 1)} data-testid="fin-continuar">Continuar <ArrowRight size={15} /></button></div>
          </div>
        )}
        {step.id === "fim" && <div className="mt-8 border-t border-white/10 pt-4"><button className={btn.ghost} onClick={() => go(i - 1)}><ArrowLeft size={15} /> Voltar</button></div>}
      </Panel>
    </div>
  );
}
