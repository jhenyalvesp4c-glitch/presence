import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, CircleCheck, Clock3, CreditCard, Equal, Flame, Home, Layers, Lightbulb, Minus, Repeat, ShoppingBag, Sparkles, Wallet } from "lucide-react";
import { brl, cashBreakdown, dateBR, monthName, type BreakdownGroupId, type MonthBreakdown } from "@/lib/finance/calc";
import { catOf } from "@/lib/finance/categories";
import { useFinance } from "@/lib/finance/store";
import type { Entry } from "@/lib/finance/types";
import { Money } from "./charts";
import { CatBadge, Modal, btn } from "./ui";

/* Detalhamento da sobra (ou falta) de caixa: o que você tem e vai receber, o que ainda sai e as faturas, e o que mais pesa. */

const ROSE = "oklch(0.72 0.18 10)";
const LOOK: Record<BreakdownGroupId, { color: string; icon: typeof Home; short: string }> = {
  fixas: { color: "var(--violet)", icon: Home, short: "Fixas" },
  assinaturas: { color: "var(--cyan)", icon: Repeat, short: "Assinat." },
  parcelas: { color: "var(--amber)", icon: Layers, short: "Parcelas" },
  cartao: { color: "var(--pink)", icon: CreditCard, short: "Cartão" },
  avulsas: { color: "oklch(0.78 0.13 235)", icon: ShoppingBag, short: "Dia a dia" },
  faturas: { color: "oklch(0.7 0.19 300)", icon: CreditCard, short: "Faturas" },
};
const pctTxt = (n: number) => `${n >= 10 || n === 0 ? Math.round(n) : n.toFixed(1).replace(".", ",")}%`;

/** Cascata: começa nas entradas e cada grupo de gasto vai "descendo" até o resultado. */
function Waterfall({ b }: { b: MonthBreakdown }) {
  const W = 640, H = 270, top = 34, bottom = 46, left = 8, right = 8;
  const steps: { label: string; from: number; to: number; color: string; kind: "in" | "out" | "end" }[] = [];
  let lvl = b.income.total;
  steps.push({ label: "Entradas", from: 0, to: lvl, color: "var(--emerald)", kind: "in" });
  for (const g of b.groups) { steps.push({ label: LOOK[g.id].short, from: lvl, to: lvl - g.total, color: LOOK[g.id].color, kind: "out" }); lvl -= g.total; }
  const good = b.previsto >= 0;
  steps.push({ label: good ? "Sobra" : "Falta", from: 0, to: b.previsto, color: good ? "var(--emerald)" : ROSE, kind: "end" });
  const hi = Math.max(1, ...steps.map((s) => Math.max(s.from, s.to))), lo = Math.min(0, ...steps.map((s) => Math.min(s.from, s.to)));
  const y = (v: number) => top + ((hi - v) / (hi - lo)) * (H - top - bottom);
  const slot = (W - left - right) / steps.length, bw = Math.min(64, slot * 0.58);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-label="Cascata das entradas até o resultado do mês">
      <defs>
        {steps.map((s, i) => (
          <linearGradient key={i} id={`wf-${i}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity=".95" /><stop offset="100%" stopColor={s.color} stopOpacity=".35" /></linearGradient>
        ))}
      </defs>
      <line x1={left} x2={W - right} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity=".18" strokeDasharray="3 5" />
      {steps.map((s, i) => {
        const x = left + slot * i + (slot - bw) / 2, y1 = y(Math.max(s.from, s.to)), y2 = y(Math.min(s.from, s.to)), h = Math.max(2, y2 - y1);
        const value = s.kind === "out" ? -(s.from - s.to) : s.to, d = 0.15 + i * 0.12;
        const next = steps[i + 1];
        return (
          <g key={i}>
            {next && next.kind === "out" && <line x1={x + bw} x2={x + slot} y1={y(s.to)} y2={y(s.to)} stroke={s.color} strokeOpacity=".5" strokeDasharray="4 4" style={{ animation: `fin-fade .5s ${d + 0.3}s both` }} />}
            <rect x={x - 6} y={y1 - 6} width={bw + 12} height={h + 12} rx={14} fill={s.color} opacity=".12" style={{ filter: "blur(8px)", animation: `fin-fade .8s ${d}s both` }} />
            <rect x={x} y={y1} width={bw} height={h} rx={10} fill={`url(#wf-${i})`} stroke={s.color} strokeOpacity=".7"
              style={{ transformBox: "fill-box", transformOrigin: s.kind === "out" ? "top" : value < 0 ? "top" : "bottom", animation: `fin-bar .8s cubic-bezier(.2,.8,.2,1) ${d}s both` }} />
            <text x={x + bw / 2} y={y1 - 9} textAnchor="middle" className="fill-current text-[12px] font-semibold tabular-nums" style={{ animation: `fin-fade .5s ${d + 0.4}s both` }} fill={s.kind === "out" ? s.color : undefined}>
              {s.kind === "out" ? "−" : value < 0 ? "−" : s.kind === "in" ? "+" : ""}{brl(Math.abs(value)).replace(/,\d\d$/, "")}
            </text>
            <text x={x + bw / 2} y={H - 18} textAnchor="middle" className="fill-current text-[11.5px]" opacity=".65">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Já saiu × ainda vai sair, e as categorias que mais levam dinheiro no mês. */
function Pace({ b }: { b: MonthBreakdown }) {
  const done = b.groups.reduce((a, g) => a + g.done, 0), later = b.groups.reduce((a, g) => a + g.later, 0), all = Math.max(1, done + later);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of b.catItems ?? b.groups.flatMap((g) => g.items)) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
    return [...m.entries()].map(([id, v]) => ({ id, v, c: catOf(id) })).sort((x, y) => y.v - x.v).slice(0, 5);
  }, [b]);
  const max = cats[0]?.v ?? 1;
  return (
    <div className={`mt-4 grid gap-4 border-t border-white/[0.07] pt-4 ${done > 0 ? "sm:grid-cols-2" : ""}`}>
      {done > 0 && <div>
        <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Ritmo dos gastos</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
          <span className="h-full origin-left" style={{ width: `${(done / all) * 100}%`, background: `linear-gradient(90deg, ${ROSE}, color-mix(in oklab, ${ROSE} 50%, var(--violet)))`, boxShadow: `0 0 12px ${ROSE}`, animation: "bar-grow 1s .4s both" }} />
          <span className="h-full origin-left" style={{ width: `${(later / all) * 100}%`, background: "repeating-linear-gradient(135deg, oklch(1 0 0 / 16%) 0 6px, oklch(1 0 0 / 6%) 6px 12px)", animation: "bar-grow 1s .6s both" }} />
        </div>
        <div className="mt-2.5 space-y-1.5 text-[0.75rem]">
          <p className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-muted-foreground"><CircleCheck size={12} style={{ color: ROSE }} />Já saiu</span><b className="tabular-nums">{brl(done)}</b></p>
          <p className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-muted-foreground"><Clock3 size={12} />Ainda vai sair</span><b className="tabular-nums">{brl(later)}</b></p>
        </div>
      </div>}
      <div>
        <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Categorias que mais levam (inclui o que está nas faturas)</p>
        <ul className="space-y-1.5">
          {cats.map((x, i) => (
            <li key={x.id} className="text-[0.75rem]">
              <span className="flex items-center justify-between"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: x.c.color, boxShadow: `0 0 8px ${x.c.color}` }} />{x.c.name}</span><b className="tabular-nums">{brl(x.v).replace(/,\d\d$/, "")}</b></span>
              <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]"><span className="block h-full origin-left rounded-full" style={{ width: `${(x.v / max) * 100}%`, background: x.c.color, animation: `bar-grow .9s ${0.5 + i * 0.08}s both` }} /></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Barra da renda: quanto cada grupo come da renda e quanto sobra (ou passa). */
function IncomeBar({ b }: { b: MonthBreakdown }) {
  const base = Math.max(b.income.total, b.expenses, 1), good = b.previsto >= 0;
  return (
    <div>
      <div className="relative flex h-5 overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10" data-testid="fin-detalhe-barra">
        {b.groups.map((g, i) => (
          <span key={g.id} title={`${g.label}: ${brl(g.total)}`} className="relative h-full origin-left first:rounded-l-full" style={{ width: `${(g.total / base) * 100}%`, background: `linear-gradient(180deg, ${LOOK[g.id].color}, color-mix(in oklab, ${LOOK[g.id].color} 55%, transparent))`, boxShadow: `0 0 18px -4px ${LOOK[g.id].color}`, animation: `bar-grow .9s cubic-bezier(.2,.8,.2,1) ${0.1 + i * 0.1}s both` }} />
        ))}
        {good && b.previsto > 0 && <span className="relative h-full overflow-hidden rounded-r-full" style={{ width: `${(b.previsto / base) * 100}%`, background: "repeating-linear-gradient(135deg, color-mix(in oklab, var(--emerald) 55%, transparent) 0 8px, color-mix(in oklab, var(--emerald) 30%, transparent) 8px 16px)", animation: `bar-grow .9s ${0.1 + b.groups.length * 0.1}s both` }}>
          <span aria-hidden className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/30 to-transparent" style={{ animation: "fin-sheen 2.8s ease-in-out 1.2s infinite" }} />
        </span>}
        {!good && b.income.total > 0 && <span aria-hidden className="absolute inset-y-[-3px] w-0.5 bg-foreground shadow-[0_0_10px_var(--foreground)]" style={{ left: `${(b.income.total / base) * 100}%` }} />}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.72rem] text-muted-foreground">
        {b.groups.map((g) => <span key={g.id} className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: LOOK[g.id].color, boxShadow: `0 0 8px ${LOOK[g.id].color}` }} />{g.label} <b className="text-foreground tabular-nums">{pctTxt(g.pct)}</b></span>)}
        {good ? <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald" />Sobra <b className="text-emerald tabular-nums">{pctTxt(b.income.total ? (b.previsto / b.income.total) * 100 : 0)}</b></span>
          : <span className="inline-flex items-center gap-1.5"><i className="h-2 w-0.5 bg-foreground" />Linha = sua renda; o que passa dela é a falta</span>}
      </div>
    </div>
  );
}

function ItemRow({ e, today, income, color, i }: { e: Entry; today: string; income: number; color: string; i: number }) {
  const { state } = useFinance();
  const done = e.date <= today, where = e.cardId ? state.cards.find((c) => c.id === e.cardId)?.name : e.accountId ? state.accounts.find((a) => a.id === e.accountId)?.name : undefined;
  const method = { credito: "crédito", debito: "débito", pix: "pix", dinheiro: "dinheiro" }[e.method];
  const isIn = e.kind === "receita";
  return (
    <li className="group/item relative flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 transition hover:border-white/15 hover:bg-white/[0.05]" style={{ animation: `fin-slide .4s ${Math.min(i, 12) * 0.035}s both` }}>
      <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full opacity-0 transition group-hover/item:opacity-100" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
      <CatBadge id={e.category} size={34} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{e.desc}</span>{e.parcel && <span className="shrink-0 rounded-full bg-white/[0.07] px-1.5 text-[0.65rem] tabular-nums text-muted-foreground">{e.parcel}</span>}</span>
        <span className="block truncate text-[0.7rem] text-muted-foreground">{catOf(e.category).name} · {method}{where ? ` · ${where}` : ""}</span>
      </span>
      <span className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-medium sm:inline-flex ${done ? "bg-white/[0.06] text-muted-foreground" : ""}`} style={done ? undefined : { color, background: `color-mix(in oklab, ${color} 12%, transparent)` }}>
        {done ? <CircleCheck size={11} /> : <Clock3 size={11} />}{done ? (isIn ? "recebido" : "já saiu") : `${isIn ? "entra" : "sai"} ${dateBR(e.date).slice(0, 5)}`}
      </span>
      <span className="w-24 shrink-0 text-right">
        <span className={`block text-sm font-semibold tabular-nums ${isIn ? "text-emerald" : ""}`}>{isIn ? "+" : "−"}{brl(e.amount)}</span>
        {!isIn && income > 0 && <span className="block text-[0.66rem] tabular-nums text-muted-foreground">{pctTxt((e.amount / income) * 100)} da renda</span>}
        {(isIn || income <= 0) && <span className="block text-[0.66rem] tabular-nums text-muted-foreground">{dateBR(e.date).slice(0, 5)}</span>}
      </span>
    </li>
  );
}

function Section({ title, hint, icon: I, color, totalValue, sign, pct, done, later, items, today, income, open, onToggle, delay, testId }: {
  title: string; hint: string; icon: typeof Home; color: string; totalValue: number; sign: "+" | "−"; pct?: number | undefined; done: number; later: number; items: Entry[]; today: string; income: number; open: boolean; onToggle: () => void; delay: number; testId: string;
}) {
  return (
    <section className="overflow-hidden rounded-[1.4rem] border bg-white/[0.02] transition" style={{ borderColor: open ? `color-mix(in oklab, ${color} 35%, transparent)` : "oklch(1 0 0 / 8%)", boxShadow: open ? `0 20px 60px -40px ${color}` : undefined, animation: `fin-rise .55s ${delay}s both` }} data-testid={testId}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ color, background: `color-mix(in oklab, ${color} 15%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 35%, transparent)`, boxShadow: `0 0 24px -8px ${color}` }}><I size={19} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2"><span className="font-display text-[0.98rem] font-semibold">{title}</span><span className="text-[0.7rem] text-muted-foreground">{items.length} {items.length === 1 ? "item" : "itens"}</span></span>
          <span className="block truncate text-[0.72rem] text-muted-foreground">{hint}</span>
          {pct !== undefined && <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><span className="block h-full origin-left rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: `linear-gradient(90deg, ${color}, color-mix(in oklab, ${color} 40%, transparent))`, boxShadow: `0 0 10px ${color}`, animation: `bar-grow 1s ${delay + 0.2}s both` }} /></span>}
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-lg font-semibold tabular-nums" style={{ color: sign === "+" ? "var(--emerald)" : undefined }}>{sign}{brl(totalValue)}</span>
          <span className="block text-[0.68rem] tabular-nums text-muted-foreground">{pct !== undefined ? `${pctTxt(pct)} da renda` : sign === "+" ? `${brl(done)} recebido` : `${brl(done)} já saiu`}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-white/[0.06] px-3 pb-3 pt-2.5">
          <div className="mb-2.5 grid grid-cols-2 gap-2 text-[0.72rem]">
            <span className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-1.5"><span className="flex items-center gap-1.5 text-muted-foreground"><CircleCheck size={12} />{sign === "+" ? "Já recebido" : "Já saiu"}</span><b className="tabular-nums">{brl(done)}</b></span>
            <span className="flex items-center justify-between rounded-xl px-3 py-1.5" style={{ background: `color-mix(in oklab, ${color} 10%, transparent)` }}><span className="flex items-center gap-1.5" style={{ color }}><Clock3 size={12} />{sign === "+" ? "Ainda vai entrar" : "Ainda vai sair"}</span><b className="tabular-nums">{brl(later)}</b></span>
          </div>
          <ul className="space-y-1.5">{items.map((e, i) => <ItemRow key={e.id} e={e} today={today} income={income} color={color} i={i} />)}</ul>
        </div>
      )}
    </section>
  );
}

export function MonthBreakdownModal({ open, onClose, onTab }: { open: boolean; onClose: () => void; onTab: (t: string) => void }) {
  const { state, today } = useFinance();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`, ym = todayIso.slice(0, 7);
  const b = useMemo(() => cashBreakdown(state, today), [state, today]);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const firstId = b.groups[0]?.id;
  const isOpen = (id: string) => (openIds.has(id) ? !(id === firstId) : id === firstId); // o grupo que mais pesa já vem aberto
  const toggle = (id: string) => setOpenIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const good = b.previsto >= 0, resColor = good ? "var(--emerald)" : ROSE, inc = b.income.total;
  const top = b.groups[0];

  return (
    <Modal open={open} onClose={onClose} width="max-w-5xl" title={good ? "Por que sobra dinheiro depois de pagar tudo" : "Por que falta dinheiro depois de pagar tudo"} subtitle={`O que você tem hoje, o que ainda entra em ${monthName(ym)} e o que ainda sai, faturas incluídas`}>
      <div className="space-y-5 pb-2" data-testid="fin-detalhe-sobra">
        {/* equação: entra − sai = sobra */}
        <div className="fin-frame relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5" style={{ animation: "fin-rise .6s both" }}>
          <div aria-hidden className="fin-dots pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)]" />
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl" style={{ background: resColor, animation: "fin-breathe 5s ease-in-out infinite" }} />
          <div className="relative grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1.15fr]">
            <div className="rounded-2xl border border-emerald/25 bg-emerald/[0.06] px-4 py-3" style={{ animation: "fin-pop .5s .1s both" }}>
              <p className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-emerald"><ArrowUpRight size={13} />Tem e vai entrar</p>
              <p className="mt-1 font-display text-lg font-semibold sm:text-2xl"><Money value={inc} /></p>
              <p className="text-[0.7rem] text-muted-foreground">{brl(b.income.done)} na conta · {brl(b.income.later)} a receber</p>
            </div>
            <span className="mx-auto hidden h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground sm:grid"><Minus size={16} /></span>
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: `color-mix(in oklab, ${ROSE} 30%, transparent)`, background: `color-mix(in oklab, ${ROSE} 7%, transparent)`, animation: "fin-pop .5s .2s both" }}>
              <p className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em]" style={{ color: ROSE }}><ArrowDownRight size={13} />Ainda sai</p>
              <p className="mt-1 font-display text-lg font-semibold sm:text-2xl"><Money value={b.expenses} /></p>
              <p className="text-[0.7rem] text-muted-foreground">{inc > 0 ? `${pctTxt(b.spentPct)} do que você tem e vai receber` : "sem entradas"} · {b.groups.reduce((a, g) => a + g.items.length, 0)} itens</p>
            </div>
            <span className="mx-auto hidden h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground sm:grid"><Equal size={16} /></span>
            <div className="relative col-span-2 overflow-hidden rounded-2xl border px-4 py-3 sm:col-span-1" style={{ borderColor: `color-mix(in oklab, ${resColor} 45%, transparent)`, background: `color-mix(in oklab, ${resColor} 12%, transparent)`, boxShadow: `0 0 50px -18px ${resColor}`, animation: "fin-pop .55s .3s both" }}>
              <span aria-hidden className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/15 to-transparent" style={{ animation: "fin-sheen 3.2s ease-in-out 1s infinite" }} />
              <p className="relative flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.14em]" style={{ color: resColor }}><Sparkles size={13} />{good ? "Sobra de caixa" : "Falta no caixa"}</p>
              <p className="relative mt-1 font-display text-3xl font-semibold" style={{ color: resColor, textShadow: `0 0 26px ${resColor}` }}><Money value={Math.abs(b.previsto)} /></p>
              <p className="relative text-[0.7rem] text-muted-foreground">depois de pagar as faturas</p>
            </div>
          </div>
          <div className="relative mt-4"><IncomeBar b={b} /></div>
        </div>

        {/* cascata + o que mais pesa */}
        <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
          <div className="min-w-0 rounded-[1.6rem] border border-white/10 bg-white/[0.025] p-4" style={{ animation: "fin-rise .6s .1s both" }}>
            <p className="font-display text-sm font-semibold">Do que entra até o que sobra</p>
            <p className="mb-2 text-[0.72rem] text-muted-foreground">Cada barra mostra quanto cada tipo de gasto tira das suas entradas</p>
            {b.income.total === 0 && b.expenses === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nada lançado neste mês ainda.</p> : <div className="-mx-1 overflow-x-auto px-1"><div className="min-w-[500px]"><Waterfall b={b} /></div></div>}
            {b.expenses > 0 && <Pace b={b} />}
          </div>
          <div className="min-w-0 space-y-3" style={{ animation: "fin-rise .6s .18s both" }}>
            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.025] p-4">
              <p className="mb-2.5 flex items-center gap-2 font-display text-sm font-semibold"><Flame size={15} className="text-amber" />Os gastos que mais pesam</p>
              {b.biggest.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum gasto no mês.</p> : (
                <ol className="space-y-2">
                  {b.biggest.map((e, i) => (
                    <li key={e.id} className="flex items-center gap-3" style={{ animation: `fin-slide .45s ${0.25 + i * 0.08}s both` }}>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full font-display text-xs font-bold" style={{ color: ["var(--amber)", "var(--cyan)", "var(--violet)"][i], background: `color-mix(in oklab, ${["var(--amber)", "var(--cyan)", "var(--violet)"][i]} 15%, transparent)`, boxShadow: `0 0 14px -4px ${["var(--amber)", "var(--cyan)", "var(--violet)"][i]}` }}>{i + 1}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm">{e.desc}</span><span className="block text-[0.68rem] text-muted-foreground">{catOf(e.category).name}{e.parcel ? ` · parcela ${e.parcel}` : ""}</span></span>
                      <span className="text-right"><b className="block text-sm tabular-nums">{brl(e.amount)}</b>{inc > 0 && <span className="text-[0.66rem] text-muted-foreground">{pctTxt((e.amount / inc) * 100)} da renda</span>}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="relative overflow-hidden rounded-[1.6rem] border p-4" style={{ borderColor: `color-mix(in oklab, ${resColor} 30%, transparent)`, background: `linear-gradient(135deg, color-mix(in oklab, ${resColor} 10%, transparent), transparent 70%)` }}>
              <p className="mb-2 flex items-center gap-2 font-display text-sm font-semibold"><Lightbulb size={15} style={{ color: resColor }} />Em resumo</p>
              <ul className="space-y-1.5 text-[0.8rem] leading-snug text-muted-foreground">
                {good
                  ? <li>Depois de pagar tudo, ficam <b className="text-emerald">{brl(b.previsto)}</b> com você.</li>
                  : <li>Para fechar sem ficar no negativo faltam <b style={{ color: ROSE }}>{brl(Math.abs(b.previsto))}</b>: é preciso cortar ou adiar esse valor, ou entrar mais dinheiro.</li>}
                {top && <li>O que mais pesa são <b className="text-foreground">{top.label.toLowerCase()}</b>: {brl(top.total)}{inc > 0 ? ` (${pctTxt(top.pct)} do que você tem e vai receber)` : ""}.</li>}
                {b.groups.some((g) => g.id === "faturas") && <li>As faturas somam <b className="text-foreground">{brl(b.groups.find((g) => g.id === "faturas")!.total)}</b>; compras e parcelas do cartão já estão dentro delas, por isso não aparecem em separado.</li>}
                {b.income.later > 0 && <li>Ainda faltam entrar <b className="text-foreground">{brl(b.income.later)}</b> neste mês; a conta já considera esse valor.</li>}
                {b.subscriptions > 0 && <li>Pausar as assinaturas liberaria <b className="text-foreground">{brl(b.subscriptions)}</b> por mês.</li>}
              </ul>
              {b.groups.some((g) => g.id === "faturas") && <button className={`${btn.ghost} mt-3 mr-2 !px-3 !py-1.5 text-xs`} onClick={() => { onClose(); onTab("contas"); }}><CreditCard size={13} />Ver o que tem em cada fatura</button>}
              {b.subscriptions > 0 && <button className={`${btn.ghost} mt-3 !px-3 !py-1.5 text-xs`} onClick={() => { onClose(); onTab("assinaturas"); }}><Repeat size={13} />Ver assinaturas</button>}
            </div>
          </div>
        </div>

        {/* tudo, item por item */}
        <div>
          <div className="mb-2.5 flex items-end justify-between gap-3">
            <div><p className="mono-caps">Item por item</p><p className="font-display text-base font-semibold">Tudo que está sendo descontado</p></div>
            <span className="text-[0.72rem] text-muted-foreground">toque em um grupo para abrir</span>
          </div>
          <div className="space-y-2.5">
            {b.income.items.length > 0 && (
              <Section testId="fin-detalhe-entradas" title="Entradas" hint="o que já está nas contas e o que ainda entra neste mês" icon={Wallet} color="var(--emerald)" totalValue={inc} sign="+" done={b.income.done} later={b.income.later}
                items={b.income.items} today={todayIso} income={inc} open={openIds.has("entradas")} onToggle={() => toggle("entradas")} delay={0.2} />
            )}
            {b.groups.map((g, i) => (
              <Section key={g.id} testId={`fin-detalhe-${g.id}`} title={g.label} hint={g.hint} icon={LOOK[g.id].icon} color={LOOK[g.id].color} totalValue={g.total} sign="−" pct={inc > 0 ? g.pct : undefined} done={g.done} later={g.later}
                items={g.items} today={todayIso} income={inc} open={isOpen(g.id)} onToggle={() => toggle(g.id)} delay={0.26 + i * 0.06} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
