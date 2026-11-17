import { useMemo, useState } from "react";
import { CalendarClock, CreditCard, Pause, Pencil, Play, Plus, Repeat, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { brl, dateBR, isPaused, isSubscription, monthLabel, nextCharge, pauseRecurring, pausedSince, resumeRecurring, ymOf } from "@/lib/finance/calc";
import { catOf } from "@/lib/finance/categories";
import { useFinance } from "@/lib/finance/store";
import type { Recurring, Tone } from "@/lib/finance/types";
import { Donut, Money } from "./charts";
import { RecurringForm } from "./forms";
import { HeroPanel, SectionTitle, Tilt } from "./fx";
import { ConfirmDelete, Empty, Modal, Pill, Segmented, TONES, TONE_KEYS, btn } from "./ui";

/** Cor do selo de cada assinatura: marcas conhecidas têm a sua; as outras ganham uma cor fixa pelo nome. */
const BRAND: [RegExp, Tone][] = [[/netflix|youtube/i, "rosa"], [/spotify|xbox/i, "verde"], [/disney|prime|amazon|max|hbo/i, "azul"], [/fortnite|playstation|psn|twitch/i, "roxo"], [/ifood|globoplay|crunchyroll/i, "laranja"], [/icloud|google|apple/i, "ciano"], [/gympass|wellhub|academia/i, "dourado"]];
const toneOf = (name: string): Tone => BRAND.find(([re]) => re.test(name))?.[1] ?? TONE_KEYS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TONE_KEYS.length]!;
const initials = (name: string) => name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

function SubCard({ r, index, onToggle, onEdit, onDelete }: { r: Recurring; index: number; onToggle: (r: Recurring) => void; onEdit: (r: Recurring) => void; onDelete: (r: Recurring) => void }) {
  const { state, today } = useFinance(), paused = isPaused(r), t = TONES[toneOf(r.desc)];
  const card = state.cards.find((c) => c.id === r.cardId), acc = state.accounts.find((a) => a.id === r.accountId);
  const next = paused ? null : nextCharge(r, today), since = pausedSince(r), future = since && since > ymOf(today);
  return (
    <Tilt max={7} style={{ animation: `fin-pop .5s ${Math.min(index, 8) * 0.06}s both` }}>
      <article className={`glass group relative h-full overflow-hidden rounded-[1.6rem] p-5 transition duration-500 ${paused ? "opacity-80" : ""}`} style={{ boxShadow: paused ? undefined : `inset 0 1px 0 oklch(1 0 0 / 6%), 0 22px 50px -34px ${t.glow}` }} data-testid="fin-assinatura">
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full blur-3xl transition-opacity duration-500" style={{ background: t.glow, opacity: paused ? 0.06 : 0.25 }} />
        {!paused && <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${t.glow}, transparent)` }} />}
        <div className="relative flex items-start gap-4">
          <span className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-display text-lg font-bold text-white transition ${paused ? "grayscale" : ""}`} style={{ background: t.bg, boxShadow: paused ? undefined : `0 10px 28px -10px ${t.glow}` }}>
            {initials(r.desc)}
            {!paused && <span aria-hidden className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center"><span className="absolute h-3.5 w-3.5 rounded-full bg-emerald" style={{ animation: "fin-pulse 2s ease-out infinite" }} /><span className="h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald" /></span>}
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="truncate font-display text-lg font-semibold">{r.desc}</h4>
            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground [&>*]:shrink-0">{card ? <><CreditCard size={12} />{card.name} •••• {card.last4}</> : <><Wallet size={12} />{acc?.name ?? "sem conta"}</>} · dia {r.day}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {paused ? <Pill color="var(--amber)"><Pause size={10} /> {future ? `pausa a partir de ${monthLabel(since!)}` : `pausada desde ${monthLabel(since!)}`}</Pill> : <Pill color="var(--emerald)">ativa</Pill>}
              {catOf(r.category).id !== "assinaturas" && <Pill color="var(--violet)">{catOf(r.category).name}</Pill>}
            </div>
          </div>
        </div>
        <p className="relative mt-3 flex items-baseline gap-1.5"><span className={`font-display text-3xl font-semibold tabular-nums ${paused ? "text-muted-foreground line-through decoration-1" : ""}`}>{brl(r.amount)}</span><span className="text-xs text-muted-foreground">por mês</span></p>
        <p className="relative mt-4 flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground">
          <CalendarClock size={13} className="shrink-0" />
          <span>{paused ? "Não aparece nas faturas, despesas e movimentações enquanto estiver pausada." : next ? <>Próxima cobrança em <b className="text-foreground">{dateBR(next)}</b> · {brl(r.amount * 12)} por ano</> : "Sem cobrança prevista."}</span>
        </p>
        <div className="relative mt-3 flex items-center justify-between gap-2">
          {paused
            ? <button className={btn.primary} onClick={() => onToggle(r)} data-testid="fin-assinatura-reativar"><Play size={14} /> Reativar</button>
            : <button className={btn.ghost} onClick={() => onToggle(r)} data-testid="fin-assinatura-pausar"><Pause size={14} /> Pausar</button>}
          <span className="flex gap-1.5">
            <button className={btn.icon} aria-label={`Editar ${r.desc}`} onClick={() => onEdit(r)}><Pencil size={14} /></button>
            <button className={`${btn.icon} hover:!border-destructive/50 hover:!text-destructive`} aria-label={`Excluir ${r.desc}`} onClick={() => onDelete(r)}><Trash2 size={14} /></button>
          </span>
        </div>
      </article>
    </Tilt>
  );
}

/** Assinaturas (Netflix, Spotify, clubes…): ativas entram nas faturas e despesas; pausadas ficam de fora até reativar. */
export function SubscriptionsView() {
  const f = useFinance(), { state, today } = f;
  const [filter, setFilter] = useState<"ativas" | "pausadas">("ativas"), [edit, setEdit] = useState<Recurring | "new" | null>(null), [del, setDel] = useState<Recurring | null>(null), [active, setActive] = useState<string | null>(null);
  const subs = useMemo(() => state.recurring.filter(isSubscription), [state.recurring]);
  const ativas = subs.filter((r) => !isPaused(r)).sort((a, b) => b.amount - a.amount), pausadas = subs.filter(isPaused);
  const monthly = ativas.reduce((a, r) => a + r.amount, 0), saved = pausadas.reduce((a, r) => a + r.amount, 0);
  const list = filter === "ativas" ? ativas : pausadas;
  const slices = ativas.map((r) => ({ id: r.id, name: r.desc, color: TONES[toneOf(r.desc)].glow, value: r.amount })), on = slices.find((x) => x.id === active);
  const toggle = (r: Recurring) => {
    if (isPaused(r)) { f.upsertRecurring(resumeRecurring(r, today)); toast.success(`${r.desc} reativada`, { description: "Volta a aparecer nas faturas e movimentações a partir da próxima cobrança." }); }
    else { f.upsertRecurring(pauseRecurring(r, today)); toast(`${r.desc} pausada`, { description: "Não aparece mais nas faturas e despesas até você reativar." }); }
  };
  return (
    <div className="space-y-5" data-testid="fin-assinaturas">
      <SectionTitle kicker="Recorrências" title="Suas" accent="assinaturas" sub="Pause o que não está usando: some das faturas e despesas até você reativar."
        right={<button className={btn.primary} onClick={() => setEdit("new")} data-testid="fin-add-assinatura"><Plus size={16} /> Nova assinatura</button>} />
      <HeroPanel glow="var(--violet)" data-testid="fin-assinaturas-hero">
        <div className="grid items-center gap-6 md:grid-cols-[1.3fr_auto]">
          <div className="min-w-0">
            <p className="mono-caps flex items-center gap-2"><Repeat size={13} className="text-violet" />Assinaturas ativas por mês</p>
            <p className="mt-2 whitespace-nowrap font-display text-5xl font-semibold leading-none tracking-tight md:text-6xl"><span className="text-gradient"><Money value={monthly} /></span></p>
            <p className="mt-2 text-sm text-muted-foreground">São <b className="text-foreground">{brl(monthly * 12)}</b> por ano em {ativas.length} {ativas.length === 1 ? "assinatura" : "assinaturas"}.</p>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[{ l: "Ativas", v: String(ativas.length), c: "var(--emerald)" }, { l: "Pausadas", v: String(pausadas.length), c: "var(--amber)" }, { l: "Economia/mês", v: brl(saved), c: "var(--cyan)" }].map((k, i) => (
                <div key={k.l} className="rounded-2xl border bg-white/[0.03] px-3 py-2.5" style={{ borderColor: `color-mix(in oklab, ${k.c} 28%, transparent)`, animation: `fin-rise .6s ${0.15 + i * 0.07}s both` }}>
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.12em]" style={{ color: k.c }}>{k.l}</p>
                  <p className="mt-0.5 font-display text-base font-semibold tabular-nums sm:text-lg">{k.v}</p>
                </div>
              ))}
            </div>
          </div>
          {slices.length > 0 && <Donut data={slices} size={210} thickness={22} active={active} onActive={setActive}
            center={on ? <div><p className="text-xs text-muted-foreground">{on.name}</p><p className="font-display text-lg font-semibold tabular-nums">{brl(on.value)}</p><p className="text-[0.68rem]" style={{ color: on.color }}>{Math.round((on.value / monthly) * 100)}% do total</p></div> : <div><p className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">Por mês</p><p className="font-display text-lg font-semibold tabular-nums">{brl(monthly).replace(/,\d\d$/, "")}</p></div>} />}
        </div>
      </HeroPanel>
      <Segmented className="max-w-xs" value={filter} onChange={setFilter} options={[{ value: "ativas", label: `Ativas (${ativas.length})`, icon: Play }, { value: "pausadas", label: `Pausadas (${pausadas.length})`, icon: Pause }]} />
      {list.length === 0
        ? <Empty icon={Repeat} title={filter === "ativas" ? "Nenhuma assinatura ativa" : "Nenhuma assinatura pausada"} hint={filter === "ativas" ? "Cadastre Netflix, Spotify, clubes e o que mais for cobrado todo mês." : "Quando você pausar uma assinatura, ela aparece aqui para reativar com um clique."}
            action={filter === "ativas" ? <button className={btn.primary} onClick={() => setEdit("new")}><Plus size={16} /> Nova assinatura</button> : undefined} />
        : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((r, i) => <SubCard key={r.id} r={r} index={i} onToggle={toggle} onEdit={setEdit} onDelete={setDel} />)}</div>}
      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "Nova assinatura" : "Editar assinatura"} subtitle="Entra todo mês na fatura do cartão (ou na conta) no dia da cobrança." width="max-w-xl">
        {edit !== null && <RecurringForm subscription initial={edit === "new" ? undefined : edit} onCancel={() => setEdit(null)} onSave={(r) => { f.upsertRecurring(r); setEdit(null); setFilter(isPaused(r) ? "pausadas" : "ativas"); }} />}
      </Modal>
      <ConfirmDelete open={!!del} what={del ? `a assinatura “${del.desc}”` : ""} onCancel={() => setDel(null)} onConfirm={() => { if (del) f.removeRecurring(del.id); setDel(null); }} />
    </div>
  );
}
