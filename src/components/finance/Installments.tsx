import { useMemo, useState } from "react";
import { CalendarCheck, ChevronDown, CreditCard, Layers, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { brl, commitments, dateBR, monthLabel, planInfo, sum, totalFutureParcels, ymOf } from "@/lib/finance/calc";
import { useFinance } from "@/lib/finance/store";
import type { Plan } from "@/lib/finance/types";
import { Money, Ring, StackedBars } from "./charts";
import { PlanForm } from "./forms";
import { CatBadge, ConfirmDelete, Empty, Head, Modal, Panel, Pill, Segmented, TONES, btn } from "./ui";

/** Uma compra parcelada: anel de progresso, linha do tempo das parcelas e o que ainda falta. */
export function PlanCard({ plan, onEdit, onDelete, index = 0 }: { plan: Plan; onEdit?: (p: Plan) => void; onDelete?: (p: Plan) => void; index?: number }) {
  const { state, today } = useFinance(), [open, setOpen] = useState(false);
  const card = state.cards.find((c) => c.id === plan.cardId), info = useMemo(() => planInfo(plan, card, today), [plan, card, today]);
  const color = card ? TONES[card.tone].glow : "var(--cyan)";
  return (
    <article className="glass relative overflow-hidden rounded-[1.5rem] p-4 transition duration-500 hover:-translate-y-0.5" style={{ animation: `fin-pop .5s ${Math.min(index, 8) * 0.06}s both`, boxShadow: `inset 0 1px 0 oklch(1 0 0 / 6%), 0 18px 46px -34px ${color}` }} data-testid="fin-plano">
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
      <div className="relative flex items-center gap-4">
        <Ring pct={info.pct} color={color} size={72}><span className="text-center leading-tight"><b className="block text-[0.95rem] tabular-nums" data-testid="fin-plano-progresso">{info.paid}/{plan.count}</b><span className="text-[0.58rem] uppercase tracking-wider text-muted-foreground">pagas</span></span></Ring>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><CatBadge id={plan.category} size={26} /><h4 className="truncate font-medium">{plan.desc}</h4></div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CreditCard size={12} />{card ? `${card.name} •••• ${card.last4}` : "cartão removido"}</span><span>· comprado em {monthLabel(plan.purchaseYm)}</span></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {info.done ? <Pill color="var(--emerald)">quitada</Pill> : <><Pill color="var(--amber)">{info.remaining} restantes</Pill><Pill color="var(--violet)">termina em {monthLabel(info.lastYm)}</Pill></>}
          </div>
        </div>
        <div className="hidden text-right sm:block"><p className="font-display text-lg font-semibold tabular-nums">{brl(plan.per)}</p><p className="text-[0.7rem] text-muted-foreground">por parcela</p></div>
      </div>
      <div className="relative mt-3 flex items-center gap-[3px]" aria-hidden>
        {info.schedule.slice(0, 36).map((p) => <span key={p.n} className="h-1.5 flex-1 rounded-full" style={{ background: p.paid ? color : "color-mix(in oklab, white 10%, transparent)", boxShadow: p.paid ? `0 0 6px -1px ${color}` : undefined }} />)}
      </div>
      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">Falta pagar <b className="text-foreground tabular-nums">{brl(info.remainingAmount)}</b>{info.nextDue ? <> · próxima em <b className="text-foreground">{dateBR(info.nextDue)}</b></> : null}</span>
        <span className="flex items-center gap-1.5">
          <button className="flex items-center gap-1 rounded-full px-2.5 py-1 text-muted-foreground transition hover:bg-white/8 hover:text-foreground" onClick={() => setOpen(!open)} aria-expanded={open}>Parcelas <ChevronDown size={13} className={`transition ${open ? "rotate-180" : ""}`} /></button>
          {onEdit && <button className={btn.icon} aria-label={`Editar ${plan.desc}`} onClick={() => onEdit(plan)}><Pencil size={14} /></button>}
          {onDelete && <button className={`${btn.icon} hover:!border-destructive/50 hover:!text-destructive`} aria-label={`Excluir ${plan.desc}`} onClick={() => onDelete(plan)}><Trash2 size={14} /></button>}
        </span>
      </div>
      {open && (
        <ol className="relative mt-3 grid gap-1.5 sm:grid-cols-2" style={{ animation: "fin-fade .3s both" }}>
          {info.schedule.map((p) => (
            <li key={p.n} className={`flex items-center justify-between rounded-xl px-3 py-1.5 text-xs ${p.paid ? "bg-white/[0.03] text-muted-foreground" : "bg-white/[0.07]"}`}>
              <span className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full text-[0.6rem] font-semibold" style={{ background: p.paid ? `color-mix(in oklab, ${color} 30%, transparent)` : "color-mix(in oklab, white 10%, transparent)" }}>{p.n}</span>{monthLabel(p.ym)} · vence {dateBR(p.due).slice(0, 5)}</span>
              <span className="tabular-nums">{brl(p.amount)} {p.paid ? "✓" : ""}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function InstallmentsView({ defaultCardId }: { defaultCardId?: string }) {
  const f = useFinance(), { state, today } = f, ym = ymOf(today);
  const [filter, setFilter] = useState<"ativas" | "quitadas">("ativas"), [editing, setEditing] = useState<Plan | "new" | null>(null), [del, setDel] = useState<Plan | null>(null);
  const infos = useMemo(() => state.plans.map((p) => ({ p, i: planInfo(p, state.cards.find((c) => c.id === p.cardId), today) })), [state.plans, state.cards, today]);
  const list = infos.filter((x) => (filter === "ativas" ? !x.i.done : x.i.done)).sort((a, b) => a.i.lastYm.localeCompare(b.i.lastYm));
  const future = useMemo(() => commitments(state, ym, 12), [state, ym]);
  const restante = totalFutureParcels(state, today), esteMes = future[0]?.parcelas ?? 0, ativas = infos.filter((x) => !x.i.done);
  const last = ativas.map((x) => x.i.lastYm).sort().at(-1);
  const peak = future.reduce((m, x) => (x.parcelas > m.parcelas ? x : m), future[0]!);
  return (
    <div className="space-y-5" data-testid="fin-parcelas">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-serif text-3xl">Compras <span className="text-gradient italic">parceladas</span></h2><p className="text-sm text-muted-foreground">Tudo que ainda está pagando e o peso nos próximos meses.</p></div>
        <button className={btn.primary} onClick={() => setEditing("new")} data-testid="fin-add-plano"><Plus size={16} /> Cadastrar compra parcelada</button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[{ icon: Wallet, label: "Ainda falta pagar", v: restante, c: "var(--amber)" }, { icon: CalendarCheck, label: "Parcelas deste mês", v: esteMes, c: "var(--violet)" }, { icon: Layers, label: "Compras ativas", v: ativas.length, c: "var(--cyan)", n: true }].map((k, i) => (
          <div key={k.label} className="glass relative overflow-hidden rounded-[1.5rem] p-4" style={{ animation: `fin-pop .5s ${i * 0.06}s both` }}>
            <span aria-hidden className="absolute -right-8 -top-10 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: k.c }} />
            <span className="relative grid h-9 w-9 place-items-center rounded-xl" style={{ color: k.c, background: `color-mix(in oklab, ${k.c} 15%, transparent)` }}><k.icon size={17} /></span>
            <p className="relative mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{k.label}</p>
            <p className="relative font-display text-[1.6rem] font-semibold">{k.n ? k.v : <Money value={k.v} />}</p>
          </div>
        ))}
        <div className="glass relative overflow-hidden rounded-[1.5rem] p-4" style={{ animation: "fin-pop .5s .18s both" }}>
          <span aria-hidden className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-emerald opacity-20 blur-2xl" />
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-emerald/15 text-emerald"><CalendarCheck size={17} /></span>
          <p className="relative mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Livre de parcelas em</p>
          <p className="relative font-display text-[1.6rem] font-semibold">{last ? monthLabel(last) : "—"}</p>
        </div>
      </div>
      <Panel glow="var(--amber)" data-testid="fin-projecao-parcelas">
        <Head icon={Layers} title="Quanto as parcelas pesam, mês a mês" sub={peak && peak.parcelas > 0 ? `O mês mais pesado é ${monthLabel(peak.ym)}, com ${brl(peak.parcelas)}.` : "Nenhuma parcela futura."} />
        <StackedBars highlight={0} points={future.map((m) => ({ label: m.label, segs: state.cards.filter((c) => m.porCartao[c.id]).map((c) => ({ name: c.name, color: TONES[c.tone].glow, value: m.porCartao[c.id]! })) }))} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] text-muted-foreground">{state.cards.map((c) => <span key={c.id} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: TONES[c.tone].glow }} />{c.name}</span>)}<span className="ml-auto">Soma dos próximos 12 meses: <b className="text-foreground tabular-nums">{brl(sum(future.map((m) => m.parcelas)))}</b></span></div>
      </Panel>
      <div className="flex items-center justify-between gap-3"><Segmented className="max-w-xs" value={filter} onChange={setFilter} options={[{ value: "ativas", label: `Ativas (${ativas.length})` }, { value: "quitadas", label: `Quitadas (${infos.length - ativas.length})` }]} /></div>
      {list.length === 0
        ? <Empty icon={Layers} title={filter === "ativas" ? "Nenhuma compra parcelada ativa" : "Nenhuma quitada ainda"} hint={filter === "ativas" ? "Cadastre compras antigas que ainda têm parcelas pendentes. Ex.: comprei em março em 12x e estou na 3ª." : undefined} action={filter === "ativas" ? <button className={btn.primary} onClick={() => setEditing("new")}><Plus size={16} /> Cadastrar compra parcelada</button> : undefined} />
        : <div className="grid gap-4 xl:grid-cols-2">{list.map(({ p }, i) => <PlanCard key={p.id} plan={p} index={i} onEdit={setEditing} onDelete={setDel} />)}</div>}
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nova compra parcelada" : "Editar compra parcelada"} subtitle="O Orion calcula quantas parcelas já foram pagas e quando terminam." width="max-w-2xl">
        {editing !== null && <PlanForm initial={editing === "new" ? undefined : editing} defaultCardId={defaultCardId} onCancel={() => setEditing(null)} onSave={(p) => { f.upsertPlan(p); setEditing(null); }} />}
      </Modal>
      <ConfirmDelete open={!!del} what={del ? `a compra “${del.desc}” e todas as suas parcelas` : ""} onCancel={() => setDel(null)} onConfirm={() => { if (del) f.removePlan(del.id); setDel(null); }} />
    </div>
  );
}
