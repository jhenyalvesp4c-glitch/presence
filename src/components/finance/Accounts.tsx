import { useMemo, useState } from "react";
import { ArrowLeft, CalendarClock, ChevronLeft, ChevronRight, CreditCard, Landmark, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { accountBalance, addMonths, brl, cardAvailable, closingDateOf, closingYmOf, dateBR, invoiceFor, invoiceLabel, invoiceMonthOf, isoOf, monthEntries, monthLabel, monthName, openInvoice, parseIso, total, upcomingInvoices, withDeclaredTotal, ymOf, expensesOf, incomeOf } from "@/lib/finance/calc";
import { catOf } from "@/lib/finance/categories";
import { useFinance } from "@/lib/finance/store";
import type { Account, Card, Entry, Transaction } from "@/lib/finance/types";
import { AccountTile, CardVisual, KIND_LABEL } from "./CardVisual";
import { Donut, Meter, Money, RadialRings } from "./charts";
import { HeroPanel, SectionTitle, Tilt } from "./fx";
import { AccountForm, CardForm, InvoiceItemForm, TxForm } from "./forms";
import { PlanCard } from "./Installments";
import { EntryRow } from "./rows";
import { CatBadge, ConfirmDelete, Empty, Field, Head, Modal, MoneyInput, Panel, Pill, Segmented, TONES, btn } from "./ui";

const ROSE = "oklch(0.72 0.18 10)";
const AddTile = ({ label, onClick, testId }: { label: string; onClick: () => void; testId?: string }) => (
  <button type="button" onClick={onClick} data-testid={testId} className="group grid min-h-[8rem] w-full place-items-center rounded-[1.4rem] border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm text-muted-foreground transition hover:border-cyan/45 hover:bg-cyan/[0.05] hover:text-cyan">
    <span className="flex flex-col items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-full border border-current/40 transition group-hover:scale-110"><Plus size={18} /></span>{label}</span>
  </button>
);

export type Sel = { type: "card" | "acc"; id: string } | null;

/** Visão geral de contas e cartões, com acesso à área individual de cada um. */
export function AccountsView({ sel, onSel }: { sel: Sel; onSel: (s: Sel) => void }) {
  const f = useFinance(), { state, today } = f;
  const [edit, setEdit] = useState<{ type: "card" | "acc"; item?: Card | Account } | null>(null);
  if (sel) return <Detail sel={sel} onBack={() => onSel(null)} />;
  return (
    <div className="space-y-8" data-testid="fin-contas">
      <WealthHero />
      <section className="space-y-4">
        <SectionTitle kicker="Crédito" title="Seus" accent="cartões" sub="Toque num cartão para ver fatura, limite e compras." />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {state.cards.map((c, i) => {
            const used = c.limit ? (1 - cardAvailable(state, c) / c.limit) * 100 : 0, inv = openInvoice(state, c, today);
            return (
              <div key={c.id} style={{ animation: `fin-pop .55s ${i * 0.08}s both` }}>
                <Tilt max={12}><CardVisual card={c} usedPct={used} onClick={() => onSel({ type: "card", id: c.id })} /></Tilt>
                <div className="mt-3 flex items-center justify-between px-1 text-xs"><span className="text-muted-foreground">Fatura atual · vence {dateBR(inv.due).slice(0, 5)}</span><b className="text-sm tabular-nums">{brl(inv.total)}</b></div>
                <div className="mt-1.5 px-1"><Meter pct={used} color={TONES[c.tone].glow} height={6} /><div className="mt-1 flex justify-between text-[0.7rem] text-muted-foreground"><span>Disponível {brl(cardAvailable(state, c))}</span><span>Limite {brl(c.limit)}</span></div></div>
              </div>
            );
          })}
          <AddTile label="Adicionar cartão" onClick={() => setEdit({ type: "card" })} testId="fin-add-cartao" />
        </div>
      </section>
      <section className="space-y-4">
        <SectionTitle kicker="Dinheiro em conta" title="Contas e" accent="carteiras" sub="Bancos, carteiras digitais e dinheiro." />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {state.accounts.map((a, i) => <div key={a.id} style={{ animation: `fin-pop .55s ${i * 0.07}s both` }}><AccountTile account={a} balance={accountBalance(state, a, today)} onClick={() => onSel({ type: "acc", id: a.id })} /></div>)}
          <AddTile label="Adicionar conta" onClick={() => setEdit({ type: "acc" })} testId="fin-add-conta" />
        </div>
      </section>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.type === "card" ? (edit.item ? "Editar cartão" : "Novo cartão") : edit?.item ? "Editar conta" : "Nova conta"} width="max-w-xl">
        {edit?.type === "card" && <CardForm initial={edit.item as Card | undefined} onCancel={() => setEdit(null)} onSave={(c) => { f.upsertCard(c); setEdit(null); }} />}
        {edit?.type === "acc" && <AccountForm initial={edit.item as Account | undefined} onCancel={() => setEdit(null)} onSave={(a) => { f.upsertAccount(a); setEdit(null); }} />}
      </Modal>
    </div>
  );
}

/** Topo da aba: quanto há nas contas, distribuição por conta e limite livre nos cartões. */
function WealthHero() {
  const { state, today } = useFinance(), [active, setActive] = useState<string | null>(null);
  const balances = state.accounts.map((a) => ({ id: a.id, name: a.name, color: TONES[a.tone].glow, value: accountBalance(state, a, today) }));
  const totalBal = balances.reduce((a, b) => a + b.value, 0), pos = balances.filter((b) => b.value > 0);
  const limit = state.cards.reduce((a, c) => a + c.limit, 0), free = state.cards.reduce((a, c) => a + Math.max(0, cardAvailable(state, c)), 0), inv = state.cards.reduce((a, c) => a + openInvoice(state, c, today).total, 0);
  const on = balances.find((b) => b.id === active);
  return (
    <HeroPanel glow="var(--violet)" data-testid="fin-patrimonio">
      <div className="grid items-center gap-6 md:grid-cols-[1.3fr_auto_auto]">
        <div className="min-w-0">
          <p className="mono-caps">Patrimônio em contas</p>
          <p className="mt-2 whitespace-nowrap font-display text-5xl font-semibold leading-none tracking-tight md:text-6xl"><span className="text-gradient"><Money value={totalBal} /></span></p>
          <p className="mt-2 text-sm text-muted-foreground">{state.accounts.length} contas e carteiras · {state.cards.length} cartões</p>
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {[{ l: "Limite total", v: limit, c: "var(--cyan)" }, { l: "Livre nos cartões", v: free, c: "var(--emerald)" }, { l: "Faturas abertas", v: inv, c: "var(--violet)" }].map((k, i) => (
              <div key={k.l} className="rounded-2xl border bg-white/[0.03] px-3 py-2.5" style={{ borderColor: `color-mix(in oklab, ${k.c} 28%, transparent)`, animation: `fin-rise .6s ${0.15 + i * 0.07}s both` }}>
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: k.c }}>{k.l}</p>
                <p className="mt-0.5 font-display text-base font-semibold tabular-nums sm:text-lg"><Money value={k.v} cents={false} /></p>
              </div>
            ))}
          </div>
        </div>
        {pos.length > 0 && (
          <div className="flex flex-col items-center gap-2">
            <Donut data={pos} size={200} thickness={22} active={active} onActive={setActive} center={on ? <div><p className="text-xs text-muted-foreground">{on.name}</p><p className="font-display text-lg font-semibold tabular-nums">{brl(on.value)}</p></div> : <div><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">Por conta</p><p className="font-display text-lg font-semibold">{pos.length}</p></div>} />
          </div>
        )}
        {state.cards.length > 0 && (
          <div className="hidden flex-col items-center gap-2 lg:flex">
            <RadialRings size={180} thickness={10} items={state.cards.map((c) => ({ id: c.id, label: c.name, color: TONES[c.tone].glow, pct: c.limit ? (1 - cardAvailable(state, c) / c.limit) * 100 : 0 }))} center={<div><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">Limite usado</p><p className="font-display text-lg font-semibold tabular-nums">{limit ? Math.round((1 - free / limit) * 100) : 0}%</p></div>} />
          </div>
        )}
      </div>
    </HeroPanel>
  );
}

function Stat({ label, children, color }: { label: string; children: React.ReactNode; color?: string | undefined }) {
  return <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 transition hover:-translate-y-0.5 hover:border-white/15" style={{ boxShadow: color ? `0 16px 40px -30px ${color}` : undefined }}>{color && <span aria-hidden className="absolute inset-x-3 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />}<p className="text-[0.66rem] font-semibold uppercase tracking-[0.13em] text-muted-foreground">{label}</p><div className="mt-1 font-display text-xl font-semibold tabular-nums" style={{ color }}>{children}</div></div>;
}

function Detail({ sel, onBack }: { sel: NonNullable<Sel>; onBack: () => void }) {
  const f = useFinance(), { state, today } = f, ym = ymOf(today);
  const card = sel.type === "card" ? state.cards.find((c) => c.id === sel.id) : undefined, acc = sel.type === "acc" ? state.accounts.find((a) => a.id === sel.id) : undefined;
  const [tab, setTab] = useState(sel.type === "card" ? "fatura" : "historico"), [edit, setEdit] = useState(false), [del, setDel] = useState(false), [editTx, setEditTx] = useState<Transaction | null>(null), [delTx, setDelTx] = useState<Entry | null>(null);
  const item = card ?? acc;
  if (!item) return <Empty title="Não encontrei este item" action={<button className={btn.ghost} onClick={onBack}>Voltar</button>} />;
  const tone = TONES[item.tone];
  const own = (e: Entry) => (card ? e.cardId === card.id : e.accountId === acc!.id && e.method !== "credito");
  const months = [0, 1, 2, 3, 4, 5].map((i) => addMonths(ym, -i)), history = months.flatMap((m) => monthEntries(state, m).filter((e) => own(e) && e.date <= isoOf(today)));
  const monthEs = monthEntries(state, ym).filter(own), monthExp = total(expensesOf(monthEs)), monthInc = total(incomeOf(monthEs));
  const onTx = (e: Entry) => { const t = state.transactions.find((x) => x.id === e.id); if (t) setEditTx(t); };
  const onDelTx = (e: Entry) => setDelTx(e);

  return (
    <div className="space-y-5" data-testid={card ? "fin-detalhe-cartao" : "fin-detalhe-conta"}>
      <button className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground" onClick={onBack} data-testid="fin-voltar"><ArrowLeft size={16} /> Contas e cartões</button>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="space-y-4">
          {card ? <Tilt max={12} style={{ animation: "fin-rise .6s both" }}><CardVisual card={card} usedPct={card.limit ? (1 - cardAvailable(state, card) / card.limit) * 100 : 0} /></Tilt> : <AccountTile account={acc!} balance={accountBalance(state, acc!, today)} selected />}
          <div className="flex gap-2"><button className={`${btn.ghost} flex-1`} onClick={() => setEdit(true)}><Pencil size={14} /> Editar</button><button className={`${btn.danger} flex-1`} onClick={() => setDel(true)}><Trash2 size={14} /> Excluir</button></div>
        </div>
        {card ? <CardStats card={card} /> : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Saldo atual" color={accountBalance(state, acc!, today) < 0 ? ROSE : undefined}><Money value={accountBalance(state, acc!, today)} /></Stat>
            <Stat label="Despesas do mês" color={ROSE}><Money value={monthExp} /></Stat>
            <Stat label="Entradas do mês" color="var(--emerald)"><Money value={monthInc} /></Stat>
            <Stat label="Tipo"><span className="font-sans text-base">{KIND_LABEL[acc!.kind]}</span></Stat>
            <Stat label="Movimentações"><span>{history.length}</span></Stat>
            <Stat label="Compras no débito"><span>{history.filter((e) => e.method === "debito" && e.kind === "despesa").length}</span></Stat>
          </div>
        )}
      </div>
      <Segmented value={tab} onChange={setTab} className="max-w-2xl"
        options={card ? [{ value: "fatura", label: "Faturas" }, { value: "proximas", label: "Próximas" }, { value: "parceladas", label: "Parceladas" }, { value: "historico", label: "Histórico" }] : [{ value: "historico", label: "Histórico" }, { value: "debito", label: "Compras no débito" }, { value: "mes", label: "Despesas do mês" }]} />
      {card && tab === "fatura" && <InvoiceView card={card} />}
      {card && tab === "proximas" && (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="fin-proximas">{upcomingInvoices(state, card, today, 6).slice(1).map((inv, i) => (
          <Panel key={inv.ym} glow={tone.glow} className="!p-4" style={{ animation: `fin-pop .5s ${i * 0.06}s both` }}>
            <div className="flex items-center justify-between"><div><p className="font-display text-lg font-semibold">Fatura de {monthName(closingYmOf(card, inv.ym)).replace(/ de \d{4}$/, "")}</p><p className="text-xs text-muted-foreground">{invoiceLabel(card, inv.ym)}</p></div><b className="font-display text-xl tabular-nums">{brl(inv.total)}</b></div>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{inv.lines.slice(0, 5).map((l) => <li key={l.id} className="flex justify-between gap-2"><span className="truncate">{l.desc}{l.parcel ? ` (${l.parcel})` : ""}</span><span className="tabular-nums">{brl(l.amount)}</span></li>)}{inv.lines.length === 0 && <li>Nada lançado ainda.</li>}{inv.lines.length > 5 && <li>+ {inv.lines.length - 5} itens</li>}</ul>
          </Panel>))}</div>
      )}
      {card && tab === "parceladas" && (
        <div className="grid gap-4 xl:grid-cols-2" data-testid="fin-parceladas-cartao">{state.plans.filter((p) => p.cardId === card.id).map((p, i) => <PlanCard key={p.id} plan={p} index={i} />)}{state.plans.filter((p) => p.cardId === card.id).length === 0 && <div className="xl:col-span-2"><Empty icon={CreditCard} title="Sem compras parceladas neste cartão" hint="Cadastre pela aba Parcelas." /></div>}</div>
      )}
      {tab === "historico" && <History entries={history} onEdit={onTx} onDelete={onDelTx} />}
      {!card && tab === "debito" && <History entries={history.filter((e) => e.method === "debito" && e.kind === "despesa")} onEdit={onTx} onDelete={onDelTx} empty="Nenhuma compra no débito nesta conta." />}
      {!card && tab === "mes" && <MonthByCategory entries={monthEs} />}

      <Modal open={edit} onClose={() => setEdit(false)} title={card ? "Editar cartão" : "Editar conta"}>
        {card ? <CardForm initial={card} onCancel={() => setEdit(false)} onSave={(c) => { f.upsertCard(c); setEdit(false); }} /> : <AccountForm initial={acc} onCancel={() => setEdit(false)} onSave={(a) => { f.upsertAccount(a); setEdit(false); }} />}
      </Modal>
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Editar movimentação">{editTx && <TxForm initial={editTx} saveLabel="Salvar" onCancel={() => setEditTx(null)} onSave={(r) => { if (r.tx) f.upsertTx(r.tx); setEditTx(null); }} />}</Modal>
      <ConfirmDelete open={del} what={`${card ? "o cartão" : "a conta"} “${item.name}”`} onCancel={() => setDel(false)} onConfirm={() => { if (card) f.removeCard(card.id); else f.removeAccount(acc!.id); setDel(false); onBack(); }} />
      <ConfirmDelete open={!!delTx} what={delTx ? `“${delTx.desc}”` : ""} onCancel={() => setDelTx(null)} onConfirm={() => { if (delTx) f.removeTx(delTx.id); setDelTx(null); }} />
    </div>
  );
}

function CardStats({ card }: { card: Card }) {
  const { state, today } = useFinance(), inv = openInvoice(state, card, today), avail = cardAvailable(state, card), used = card.limit - avail, usedPct = card.limit ? (used / card.limit) * 100 : 0;
  const days = Math.ceil((parseIso(inv.due).getTime() - parseIso(isoOf(today)).getTime()) / 86400000), monthSpend = total(monthEntries(state, ymOf(today)).filter((e) => e.cardId === card.id && e.kind === "despesa"));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Fatura atual" color="var(--violet)"><Money value={inv.total} /></Stat>
        <Stat label="Vencimento"><span className="text-lg">{dateBR(inv.due).slice(0, 5)}</span> <span className="font-sans text-xs font-normal text-muted-foreground">{days < 0 ? "vencida" : days === 0 ? "hoje" : `em ${days}d`}</span></Stat>
        <Stat label="Gasto no mês"><Money value={monthSpend} /></Stat>
        <Stat label="Limite total"><Money value={card.limit} /></Stat>
        <Stat label="Disponível" color="var(--emerald)"><Money value={avail} /></Stat>
        <Stat label="Usado" color={usedPct >= 80 ? ROSE : undefined}><Money value={used} /></Stat>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"><div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Uso do limite</span><b className="text-foreground">{usedPct.toFixed(0)}%</b></div><Meter pct={usedPct} color={TONES[card.tone].glow} height={10} />
        <p className="mt-2 text-xs text-muted-foreground">Fecha dia {card.closingDay} e vence dia {card.dueDay}. Compras feitas até o dia {card.closingDay} entram na fatura que vence {invoiceLabel(card, invoiceMonthOf(card, `${ymOf(today)}-${String(card.closingDay).padStart(2, "0")}`)).replace(/^fecha \d\d\/\d\d · vence /, "")}.</p></div>
    </div>
  );
}

/** Faturas mês a mês: navegue pelos meses, veja o que entra em cada uma e informe o total que o banco mostra. */
function InvoiceView({ card }: { card: Card }) {
  const f = useFinance(), { state, today } = f, open = invoiceMonthOf(card, isoOf(today)), [ym, setYm] = useState(open), [detail, setDetail] = useState(false);
  const inv = invoiceFor(state, card, ym), months = Array.from({ length: 9 }, (_, i) => addMonths(open, i - 2));
  const typed = card.declared?.[ym], isOpen = ym === open;
  const itemized = inv.lines.filter((l) => l.source !== "ajuste");
  return (
    <div className="space-y-4" data-testid="fin-fatura">
      <div className="flex gap-2 overflow-x-auto pb-1 scroll-neon" data-testid="fin-fatura-meses">
        {months.map((m) => { const i = invoiceFor(state, card, m), on = m === ym; return (
          <button key={m} onClick={() => setYm(m)} aria-pressed={on} data-testid={`fin-fatura-mes-${m}`}
            className={`shrink-0 rounded-2xl border px-3.5 py-2 text-left transition ${on ? "border-cyan/50 bg-cyan/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">fatura {monthLabel(closingYmOf(card, m))}{m === open ? " · atual" : ""}</p>
            <p className="font-display text-base font-semibold tabular-nums">{i.total > 0 ? brl(i.total) : "—"}</p>
          </button>); })}
      </div>
      <Panel glow={TONES[card.tone].glow}>
        <Head icon={Receipt} title={`Fatura de ${monthName(closingYmOf(card, inv.ym))}`} sub={`Fecha em ${dateBR(closingDateOf(card, inv.ym))} · vence em ${dateBR(inv.due)}${isOpen ? " · fatura aberta" : ""}`}
          right={<div className="flex items-center gap-1"><button className={btn.icon} aria-label="Mês anterior" onClick={() => setYm(addMonths(ym, -1))}><ChevronLeft size={16} /></button><b className="min-w-[7.5rem] text-center font-display text-2xl tabular-nums" data-testid="fin-fatura-total">{brl(inv.total)}</b><button className={btn.icon} aria-label="Próximo mês" onClick={() => setYm(addMonths(ym, 1))}><ChevronRight size={16} /></button></div>} />
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Total desta fatura (como aparece no app do banco)" hint={typed !== undefined ? (inv.over > 0 ? `Atenção: os itens cadastrados passam ${brl(inv.over)} do total informado. Confira o total ou os itens.` : inv.adjustment > 0 ? `Já detalhado: ${brl(inv.total - inv.adjustment)}. Faltam ${brl(inv.adjustment)} para detalhar; conforme você cadastra as compras e parcelas, esse valor diminui e o total não muda.` : "Tudo detalhado: os itens fecham com o total.") : "Opcional. Informe o total do banco e vá cadastrando as compras e parcelas: elas abatem desse valor, sem duplicar."}>
            <MoneyInput value={typed} onChange={(v) => f.upsertCard(withDeclaredTotal(card, ym, v))} data-testid="fin-fatura-total-informado" />
          </Field>
          <div className="flex flex-col items-end gap-1.5 pb-1"><button className={btn.primary} onClick={() => setDetail(true)} data-testid="fin-detalhar-abrir"><Plus size={15} /> Detalhar uma compra</button><p className="text-xs text-muted-foreground">{itemized.length} {itemized.length === 1 ? "item" : "itens"}{inv.adjustment > 0 ? ` · ${brl(inv.adjustment)} sem detalhar` : ""}</p></div>
        </div>
        {inv.lines.length === 0 ? <Empty icon={Receipt} title="Fatura vazia" hint="As compras no crédito deste cartão aparecem aqui." /> : (
          <ul className="space-y-0.5">{inv.lines.map((l, i) => (
            <li key={l.id} className="flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-white/[0.04]" style={{ animation: `fin-pop .4s ${Math.min(i, 12) * 0.03}s both` }}>
              <CatBadge id={l.category} size={34} />
              <div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 text-sm font-medium"><span className="truncate">{l.desc}</span>{l.parcel && <Pill color="var(--amber)">parcela {l.parcel}</Pill>}{l.source === "recorrente" && <Pill color="var(--violet)">fixa</Pill>}{l.source === "ajuste" && <Pill color="var(--cyan)">a detalhar</Pill>}</p><p className="text-xs text-muted-foreground">{l.source === "ajuste" ? "total do banco menos o que já foi cadastrado" : dateBR(l.date)}</p></div>
              {l.source === "ajuste" && <button className={`${btn.ghost} !px-3 !py-1.5 text-xs`} onClick={() => setDetail(true)} data-testid="fin-detalhar-linha">Detalhar</button>}
              <b className="text-sm tabular-nums">{brl(l.amount)}</b>
            </li>))}</ul>
        )}
      </Panel>
      <Modal open={detail} onClose={() => setDetail(false)} title="Detalhar uma compra desta fatura">
        <InvoiceItemForm card={card} ym={ym} onCancel={() => setDetail(false)} onSave={(r) => { if (r.plan) f.upsertPlan(r.plan); if (r.tx) f.upsertTx(r.tx); setDetail(false); }} />
      </Modal>
    </div>
  );
}

function History({ entries, onEdit, onDelete, empty = "Nada por aqui ainda." }: { entries: Entry[]; onEdit: (e: Entry) => void; onDelete: (e: Entry) => void; empty?: string }) {
  const { state } = useFinance();
  return <Panel glow="var(--cyan)" data-testid="fin-historico">{entries.length === 0 ? <Empty icon={CalendarClock} title={empty} /> : <ul className="space-y-0.5">{entries.slice(0, 60).map((e, i) => <EntryRow key={e.id} e={e} s={state} index={i} onEdit={onEdit} onDelete={onDelete} />)}</ul>}</Panel>;
}

function MonthByCategory({ entries }: { entries: Entry[] }) {
  const by = new Map<string, number>(); for (const e of expensesOf(entries)) by.set(e.category, (by.get(e.category) ?? 0) + e.amount);
  const rows = [...by.entries()].sort((a, b) => b[1] - a[1]), max = rows[0]?.[1] ?? 1;
  return (
    <Panel glow="var(--violet)" data-testid="fin-mes-categorias">
      <Head icon={Landmark} title="Despesas do mês por categoria" />
      {rows.length === 0 ? <Empty title="Sem despesas neste mês" /> : <ul className="space-y-3">{rows.map(([id, v], i) => <li key={id} className="flex items-center gap-3"><CatBadge id={id} size={32} /><div className="min-w-0 flex-1"><div className="flex justify-between text-sm"><span>{catOf(id).name}</span><b className="tabular-nums">{brl(v)}</b></div><Meter pct={(v / max) * 100} color="var(--violet)" height={6} warn={false} /></div></li>)}</ul>}
    </Panel>
  );
}
