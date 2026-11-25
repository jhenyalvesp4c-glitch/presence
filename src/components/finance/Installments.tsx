import { useMemo, useState } from "react";
import { CalendarCheck, ChevronDown, CreditCard, Layers, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { addMonths, brl, commitments, dateBR, monthLabel, planInfo, planShare, sum, totalFutureParcels, ymOf } from "@/lib/finance/calc";
import { useFinance } from "@/lib/finance/store";
import type { Plan } from "@/lib/finance/types";
import { AreaChart, Money, Ring, StackedBars } from "./charts";
import { HeroPanel, SectionTitle } from "./fx";
import { PlanForm } from "./forms";
import { CatBadge, ConfirmDelete, Empty, Head, Modal, Panel, Pill, Segmented, TONES, btn } from "./ui";

/** Uma compra parcelada: anel de progresso, linha do tempo das parcelas e o que ainda falta. */
export function PlanCard({ plan, onEdit, onDelete, index = 0 }: { plan: Plan; onEdit?: (p: Plan) => void; onDelete?: (p: Plan) => void; index?: number }) {
  const { state, today } = useFinance(), [open, setOpen] = useState(false);
  const card = state.cards.find((c) => c.id === plan.cardId), info = useMemo(() => planInfo(plan, card, today), [plan, card, today]);
  const color = card ? TONES[card.tone].glow : "var(--cyan)";
  return (
    <article className="glass group relative overflow-hidden rounded-[1.5rem] p-4 transition duration-500 hover:-translate-y-1 hover:border-white/15" style={{ animation: `fin-pop .5s ${Math.min(index, 8) * 0.06}s both`, boxShadow: `inset 0 1px 0 oklch(1 0 0 / 6%), 0 18px 46px -34px ${color}` }} data-testid="fin-plano">
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-45" style={{ background: color }} />
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div className="relative flex items-center gap-4">
        <Ring pct={info.pct} color={color} size={72}><span className="text-center leading-tight"><b className="block text-[0.95rem] tabular-nums" data-testid="fin-plano-progresso">{info.paid}/{plan.count}</b><span className="text-[0.58rem] uppercase tracking-wider text-muted-foreground">pagas</span></span></Ring>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><CatBadge id={plan.category} size={26} /><h4 className="truncate font-medium">{plan.desc}</h4></div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><CreditCard size={12} />{card ? `${card.name} •••• ${card.last4}` : "cartão removido"}</span><span>· comprado em {monthLabel(plan.purchaseYm)}</span></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plan.fundedBy ? <Pill color="var(--cyan)">paga pelo cofrinho{(() => { const a = state.accounts.find((x) => x.id === plan.fundedBy); return a ? ` · ${a.name}` : ""; })()}{plan.fundedFrom && plan.fundedFrom > 1 ? ` · a partir da ${plan.fundedFrom}ª` : ""}</Pill> : null}
            {info.done ? <Pill color="var(--emerald)">quitada</Pill> : <><Pill color="var(--amber)">{info.remaining} restantes</Pill><Pill color="var(--violet)">termina em {monthLabel(info.lastYm)}</Pill></>}
          </div>
        </div>
        <div className="hidden text-right sm:block"><p className="font-display text-lg font-semibold tabular-nums">{brl(plan.per)}</p><p className="text-[0.7rem] text-muted-foreground">por parcela</p></div>
      </div>
      <div className="relative mt-3 flex items-center gap-[3px]" aria-hidden>
        {info.schedule.slice(0, 36).map((p, k) => <span key={p.n} className="h-2 flex-1 rounded-full" style={{ background: p.paid ? `linear-gradient(90deg, ${color}, color-mix(in oklab, ${color} 60%, var(--violet)))` : "color-mix(in oklab, white 10%, transparent)", boxShadow: p.paid ? `0 0 8px -1px ${color}` : undefined, animation: `fin-pop .35s ${0.2 + k * 0.025}s both` }} />)}
      </div>
      <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{plan.shared?.fixed ? <>Ajuda de {plan.shared.person}: <b className="text-emerald tabular-nums">{brl(plan.shared.fixed)}</b> · </> : null}Falta pagar <b className="text-foreground tabular-nums">{brl(info.remainingAmount)}</b>{info.nextDue ? <> · próxima em <b className="text-foreground">{dateBR(info.nextDue)}</b></> : null}</span>
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
              <span className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full text-[0.6rem] font-semibold" style={{ background: p.paid ? `color-mix(in oklab, ${color} 30%, transparent)` : "color-mix(in oklab, white 10%, transparent)" }}>{p.n}</span>{monthLabel(p.closeYm)} · fecha {dateBR(p.close).slice(0, 5)} · vence {dateBR(p.due).slice(0, 5)}</span>
              <span className="tabular-nums">{(() => { const sh = plan.shared?.fixed ? planShare(plan, p.n) : undefined; const part = sh ? Math.round(p.amount * sh.percent) / 100 : 0; return sh ? (part >= p.amount - 0.005 ? <span className="mr-1.5 text-emerald">paga por {sh.person}</span> : <span className="mr-1.5 text-emerald">{brl(part)} de {sh.person} · você {brl(p.amount - part)}</span>) : plan.shared?.fixed ? <span className="mr-1.5 text-muted-foreground">você</span> : null; })()}{brl(p.amount)} {p.paid ? "✓" : ""}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function InstallmentsView({ defaultCardId }: { defaultCardId?: string }) {
  const f = useFinance(), { state, today } = f, ym = ymOf(today);
  const [filter, setFilter] = useState<"ativas" | "quitadas">("ativas"), [editing, setEditing] = useState<Plan | "new" | null>(null), [del, setDel] = useState<Plan | null>(null), [pay, setPay] = useState<"todas" | "cofrinho" | "bolso">("todas");
  const infos = useMemo(() => state.plans.map((p) => ({ p, i: planInfo(p, state.cards.find((c) => c.id === p.cardId), today) })), [state.plans, state.cards, today]);
  const anyFunded = state.plans.some((p) => p.fundedBy);
  const list = infos.filter((x) => (filter === "ativas" ? !x.i.done : x.i.done) && (!anyFunded || pay === "todas" || (pay === "cofrinho" ? !!x.p.fundedBy : !x.p.fundedBy))).sort((a, b) => a.i.lastYm.localeCompare(b.i.lastYm));
  const future = useMemo(() => commitments(state, ym, 12), [state, ym]);
  const restante = totalFutureParcels(state, today), esteMes = future[0]?.parcelas ?? 0, ativas = infos.filter((x) => !x.i.done);
  const last = ativas.map((x) => x.i.lastYm).sort().at(-1);
  const peak = future.reduce((m, x) => (x.parcelas > m.parcelas ? x : m), future[0]!);
  const paidAll = sum(infos.map((x) => x.i.paidAmount)), owedAll = sum(infos.map((x) => x.i.remainingAmount)), paidPct = paidAll + owedAll > 0 ? (paidAll / (paidAll + owedAll)) * 100 : 0;
  const unpaid = infos.flatMap((x) => x.i.schedule.filter((p) => !p.paid));
  const debtCurve = [{ label: "hoje", value: sum(unpaid.map((p) => p.amount)) }, ...Array.from({ length: 12 }, (_, k) => { const m = addMonths(ym, k); return { label: monthLabel(m).slice(0, 3), value: sum(unpaid.filter((p) => p.ym > m).map((p) => p.amount)) }; })];
  return (
    <div className="space-y-5" data-testid="fin-parcelas">
      <SectionTitle kicker="Crédito parcelado" title="Compras" accent="parceladas" sub="Tudo que ainda está pagando e o peso nos próximos meses."
        right={<button className={btn.primary} onClick={() => setEditing("new")} data-testid="fin-add-plano"><Plus size={16} /> Cadastrar compra parcelada</button>} />
      <HeroPanel glow="var(--amber)" data-testid="fin-parcelas-hero">
        <div className="grid items-center gap-6 lg:grid-cols-[auto_1fr_1.3fr]">
          <Ring pct={paidPct} color="var(--amber)" size={150} thickness={12}><span className="text-center leading-tight"><b className="block font-display text-3xl tabular-nums">{Math.round(paidPct)}%</b><span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">já pago</span></span></Ring>
          <div className="min-w-0">
            <p className="mono-caps">Ainda falta pagar</p>
            <p className="mt-1 whitespace-nowrap font-display text-4xl font-semibold tracking-tight md:text-5xl"><span className="text-gradient"><Money value={restante} /></span></p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[{ icon: CalendarCheck, label: "Este mês", v: <Money value={esteMes} cents={false} />, c: "var(--violet)" }, { icon: Layers, label: "Ativas", v: ativas.length, c: "var(--cyan)" }, { icon: Wallet, label: "Livre em", v: last ? monthLabel(last) : "—", c: "var(--emerald)" }].map((k, i) => (
                <div key={k.label} className="rounded-2xl border bg-white/[0.03] px-3 py-2" style={{ borderColor: `color-mix(in oklab, ${k.c} 28%, transparent)`, animation: `fin-rise .6s ${0.15 + i * 0.07}s both` }}>
                  <p className="flex items-center gap-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em]" style={{ color: k.c }}><k.icon size={11} />{k.label}</p>
                  <p className="font-display text-base font-semibold tabular-nums">{k.v}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-xs text-muted-foreground">Como a dívida vai diminuindo</p>
            {restante > 0 ? <AreaChart points={debtCurve} color="var(--amber)" height={170} /> : <p className="rounded-2xl border border-emerald/30 bg-emerald/[0.07] px-4 py-6 text-center text-sm">Nenhuma parcela pendente. 🎉</p>}
          </div>
        </div>
      </HeroPanel>
      <Panel glow="var(--amber)" data-testid="fin-projecao-parcelas">
        <Head icon={Layers} title="Quanto as parcelas pesam, mês a mês" sub={peak && peak.parcelas > 0 ? `O mês mais pesado é ${monthLabel(peak.ym)}, com ${brl(peak.parcelas)}.` : "Nenhuma parcela futura."} />
        <StackedBars highlight={0} points={future.map((m) => ({ label: m.label, segs: state.cards.filter((c) => m.porCartao[c.id]).map((c) => ({ name: c.name, color: TONES[c.tone].glow, value: m.porCartao[c.id]! })) }))} />
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] text-muted-foreground">{state.cards.map((c) => <span key={c.id} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: TONES[c.tone].glow }} />{c.name}</span>)}<span className="ml-auto">Soma dos próximos 12 meses: <b className="text-foreground tabular-nums">{brl(sum(future.map((m) => m.parcelas)))}</b></span></div>
      </Panel>
      {anyFunded && (() => { const act = infos.filter((x) => !x.i.done), fundedAmt = sum(act.filter((x) => x.p.fundedBy).map((x) => x.i.remainingAmount)), pocketAmt = sum(act.filter((x) => !x.p.fundedBy).map((x) => x.i.remainingAmount)); return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan/25 bg-cyan/[0.05] px-4 py-3" data-testid="fin-parcelas-cofrinho">
          <p className="text-sm">Falta pagar <b className="tabular-nums text-cyan">{brl(fundedAmt)}</b> com dinheiro do cofrinho e <b className="tabular-nums text-amber">{brl(pocketAmt)}</b> do seu bolso.</p>
          <Segmented className="max-w-sm" value={pay} onChange={setPay} options={[{ value: "todas", label: "Todas" }, { value: "cofrinho", label: "Do cofrinho" }, { value: "bolso", label: "Do meu bolso" }]} />
        </div>); })()}
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
