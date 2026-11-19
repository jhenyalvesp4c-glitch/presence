import { useMemo, useState, type ReactNode } from "react";
import { Banknote, Landmark, PiggyBank, Wallet } from "lucide-react";
import { addMonths, brl, closingDateOf, closingYmOf, invoiceFor, invoiceLabel, invoiceMonthOf, isoOf, monthLabel, firstFromPaid, planForInvoice, planInfo, subscriptionForInvoice, withDeclaredTotal, ymOf } from "@/lib/finance/calc";
import { CATS, EXPENSE_CATS, INCOME_CATS, catOf, guessCategory } from "@/lib/finance/categories";
import { uid, useFinance } from "@/lib/finance/store";
import type { Account, AccountKind, Card, CardBrand, Goal, GoalKind, Method, Plan, Recurring, Shared, Tone, Transaction, TxKind } from "@/lib/finance/types";
import { useSettlements } from "@/lib/finance/settle-data";
import { CatIcon, Field, MoneyInput, Pill, Segmented, Select, TextInput, TONE_KEYS, TONES, btn } from "./ui";

const Grid = ({ children }: { children: ReactNode }) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
export function Actions({ onCancel, onSave, saveLabel = "Salvar", disabled, extra }: { onCancel?: (() => void) | undefined; onSave: () => void; saveLabel?: string | undefined; disabled?: boolean | undefined; extra?: ReactNode }) {
  return <div className="mt-5 flex flex-wrap items-center justify-end gap-2">{extra}{onCancel && <button type="button" className={btn.ghost} onClick={onCancel}>Cancelar</button>}<button type="button" className={btn.primary} onClick={onSave} disabled={disabled} data-testid="fin-salvar">{saveLabel}</button></div>;
}

/** Seletor de cor (as paletas de cartão/conta). */
export function TonePicker({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cor">
      {TONE_KEYS.map((k) => <button key={k} type="button" role="radio" aria-checked={value === k} aria-label={TONES[k].label} onClick={() => onChange(k)}
        className={`h-8 w-8 rounded-full transition ${value === k ? "scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-[oklch(0.15_0.03_265)]" : "opacity-80 hover:opacity-100"}`} style={{ background: TONES[k].bg, boxShadow: value === k ? `0 0 16px ${TONES[k].glow}` : undefined }} />)}
    </div>
  );
}

/** Seletor de categoria com ícones. */
export function CategoryPicker({ value, onChange, income = false }: { value: string; onChange: (id: string) => void; income?: boolean }) {
  const list = income ? INCOME_CATS : EXPENSE_CATS;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Categoria">
      {list.map((c) => { const on = c.id === value; return (
        <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.id)}
          className="flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-[0.72rem] transition"
          style={{ borderColor: `color-mix(in oklab, ${c.color} ${on ? 70 : 14}%, transparent)`, background: on ? `color-mix(in oklab, ${c.color} 18%, transparent)` : "transparent", color: on ? c.color : undefined, boxShadow: on ? `0 8px 24px -14px ${c.color}` : undefined }}>
          <span style={{ color: c.color }}><CatIcon id={c.id} size={18} /></span>{c.name}
        </button>); })}
    </div>
  );
}

/* ───────────── conta ───────────── */
export function AccountForm({ initial, onSave, onCancel }: { initial?: Account | undefined; onSave: (a: Account) => void; onCancel?: (() => void) | undefined }) {
  const { today } = useFinance();
  const [name, setName] = useState(initial?.name ?? ""), [kind, setKind] = useState<AccountKind>(initial?.kind ?? "banco"), [tone, setTone] = useState<Tone>(initial?.tone ?? "roxo"), [bal, setBal] = useState<number | undefined>(initial?.balanceBase);
  const save = () => onSave({ id: initial?.id ?? uid("acc-"), name: name.trim(), kind, tone, balanceBase: bal ?? 0, baseDate: initial && bal === initial.balanceBase ? initial.baseDate : isoOf(today) });
  return (
    <div className="space-y-4">
      <Field label="Nome do banco ou carteira"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, PicPay, Mercado Pago" autoFocus data-testid="fin-conta-nome" /></Field>
      <Field group label="Tipo"><Segmented value={kind} onChange={setKind} options={[{ value: "banco", label: "Banco", icon: Landmark }, { value: "carteira", label: "Carteira", icon: Wallet }, { value: "dinheiro", label: "Dinheiro", icon: Banknote }, { value: "investimento", label: "Invest.", icon: PiggyBank }]} /></Field>
      <Field label="Saldo disponível hoje"><MoneyInput value={bal} onChange={setBal} data-testid="fin-conta-saldo" /></Field>
      <Field group label="Cor"><TonePicker value={tone} onChange={setTone} /></Field>
      <Actions onCancel={onCancel} onSave={save} disabled={!name.trim()} />
    </div>
  );
}

/* ───────────── cartão ───────────── */
export function CardForm({ initial, onSave, onCancel }: { initial?: Card | undefined; onSave: (c: Card) => void; onCancel?: (() => void) | undefined }) {
  const { today } = useFinance();
  const [name, setName] = useState(initial?.name ?? ""), [brand, setBrand] = useState<CardBrand>(initial?.brand ?? "mastercard"), [last4, setLast4] = useState(initial?.last4 ?? ""), [tone, setTone] = useState<Tone>(initial?.tone ?? "roxo");
  const [limit, setLimit] = useState<number | undefined>(initial?.limit), [avail, setAvail] = useState<number | undefined>(initial?.availableBase);
  const [closing, setClosing] = useState(String(initial?.closingDay ?? 25)), [due, setDue] = useState(String(initial?.dueDay ?? 5));
  const openYm = invoiceMonthOf({ closingDay: Number(closing) || 25, dueDay: Number(due) || 5 }, isoOf(today));
  const [extra, setExtra] = useState<number | undefined>(initial?.declared?.[openYm]);
  const day = (v: string) => Math.max(1, Math.min(31, Math.round(Number(v) || 1)));
  const ok = name.trim() && limit && limit > 0 && avail !== undefined && avail <= (limit ?? 0);
  const save = () => {
    const base: Card = { id: initial?.id ?? uid("card-"), name: name.trim(), brand, last4: last4.replace(/\D/g, "").padStart(4, "0").slice(-4), tone, limit: limit ?? 0, availableBase: avail ?? 0, baseDate: initial && avail === initial.availableBase ? initial.baseDate : isoOf(today), closingDay: day(closing), dueDay: day(due), adjustments: initial?.adjustments ?? {}, declared: initial?.declared };
    onSave(withDeclaredTotal(base, openYm, extra));
  };
  return (
    <div className="space-y-4">
      <Grid>
        <Field label="Nome do cartão"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank" autoFocus data-testid="fin-cartao-nome" /></Field>
        <Field label="Final do cartão (4 dígitos)"><TextInput value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="0000" inputMode="numeric" /></Field>
      </Grid>
      <Field group label="Bandeira"><Segmented value={brand} onChange={setBrand} options={[{ value: "mastercard", label: "Master" }, { value: "visa", label: "Visa" }, { value: "elo", label: "Elo" }, { value: "amex", label: "Amex" }, { value: "outro", label: "Outra" }]} /></Field>
      <Grid>
        <Field label="Limite total"><MoneyInput value={limit} onChange={setLimit} data-testid="fin-cartao-limite" /></Field>
        <Field label="Limite disponível hoje" hint={avail !== undefined && limit && avail > limit ? "Não pode ser maior que o limite total." : undefined}><MoneyInput value={avail} onChange={setAvail} data-testid="fin-cartao-disponivel" /></Field>
        <Field label="Dia de fechamento da fatura"><TextInput type="number" min={1} max={31} value={closing} onChange={(e) => setClosing(e.target.value)} /></Field>
        <Field label="Dia de vencimento da fatura"><TextInput type="number" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
      </Grid>
      <Field label={`Valor atual da fatura (${invoiceLabel({ closingDay: day(closing), dueDay: day(due) }, openYm)})`} hint="Opcional. O total como aparece no app do banco. As compras e parcelas que você cadastrar abatem desse valor, sem duplicar."><MoneyInput value={extra} onChange={setExtra} /></Field>
      <Field group label="Cor"><TonePicker value={tone} onChange={setTone} /></Field>
      <Actions onCancel={onCancel} onSave={save} disabled={!ok} />
    </div>
  );
}

/* ───────────── compra parcelada ───────────── */
/**
 * "Dividir com alguém": quem paga junto (marido, amiga, sócio…) e que fatia é dela. O total do banco não muda; a parte dela entra como
 * receita a receber e dá para ver a fatura só com a sua parte. Nomes sugeridos: das pessoas dos acertos e de divisões anteriores.
 */
export function SharePicker({ value, onChange, amount, label = "Dividir com alguém" }: { value: Shared | undefined; onChange: (v: Shared | undefined) => void; amount?: number | undefined; label?: string }) {
  const { state } = useFinance(), acertos = useSettlements().data ?? [];
  const names = [...new Set([...acertos.map((a) => a.person), ...state.plans.flatMap((p) => (p.shared ? [p.shared.person] : [])), ...state.transactions.flatMap((t) => (t.shared ? [t.shared.person] : [])), ...state.recurring.flatMap((r) => (r.shared ? [r.shared.person] : []))])];
  const on = !!value, pct = value?.percent ?? 50, part = amount && value ? Math.round((amount * pct)) / 100 : null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5" data-testid="fin-dividir">
      <label className="flex cursor-pointer items-center justify-between gap-3"><span className="text-sm font-medium">{label}</span>
        <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(on ? undefined : { person: acertos[0]?.person ?? "", percent: 50 })} data-testid="fin-dividir-chave" className={`relative h-6 w-11 rounded-full transition ${on ? "bg-emerald/70" : "bg-white/15"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[1.35rem]" : "left-0.5"}`} /></button></label>
      {on && value && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Com quem?"><TextInput list="fin-dividir-nomes" value={value.person} onChange={(e) => onChange({ ...value, person: e.target.value.slice(0, 80) })} placeholder="Nome da pessoa" data-testid="fin-dividir-pessoa" /><datalist id="fin-dividir-nomes">{names.map((n) => <option key={n} value={n} />)}</datalist></Field>
            <Field label={`Fatia ${value.person ? `de ${value.person}` : "dela(e)"}`} group>
              <div className="flex items-center gap-1.5">{[50, 30, 70].map((n) => <button key={n} type="button" onClick={() => onChange({ ...value, percent: n })} className={`rounded-xl border px-2.5 py-2 text-xs transition ${pct === n ? "border-emerald/60 bg-emerald/10 text-emerald" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{n}%</button>)}
                <input type="number" min={1} max={100} value={pct} onChange={(e) => onChange({ ...value, percent: Math.min(100, Math.max(1, Math.round(Number(e.target.value) || 1))) })} aria-label="Porcentagem" data-testid="fin-dividir-pct" className="w-16 rounded-xl border border-white/10 bg-black/25 px-2 py-2 text-right text-sm" /><span className="text-xs text-muted-foreground">%</span></div>
            </Field>
          </div>
          <p className="text-xs text-muted-foreground" data-testid="fin-dividir-previa">{amount && part !== null ? <>{value.person || "A outra pessoa"} fica com <b className="text-emerald">{brl(part)}</b> e você com <b className="text-foreground">{brl(Math.round((amount - part) * 100) / 100)}</b>. A parte dela(e) entra como receita a receber.</> : "A parte dela(e) entra como receita a receber; o total do banco não muda."}</p>
        </div>
      )}
    </div>
  );
}

export function PlanForm({ initial, onSave, onCancel, defaultCardId }: { initial?: Plan | undefined; onSave: (p: Plan) => void; onCancel?: (() => void) | undefined; defaultCardId?: string | undefined }) {
  const { state, today } = useFinance();
  const todayYm = ymOf(today);
  const [desc, setDesc] = useState(initial?.desc ?? ""), [cardId, setCardId] = useState(initial?.cardId ?? defaultCardId ?? state.cards[0]?.id ?? "");
  const [total, setTotal] = useState<number | undefined>(initial?.total), [count, setCount] = useState(String(initial?.count ?? 12));
  const [per, setPer] = useState<number | undefined>(initial?.per), [perTouched, setPerTouched] = useState(!!initial);
  const [purchaseYm, setPurchaseYm] = useState(initial?.purchaseYm ?? addMonths(todayYm, -2));
  const [first, setFirst] = useState(initial?.first ?? addMonths(todayYm, -1)), [firstTouched, setFirstTouched] = useState(!!initial);
  const [mode, setMode] = useState<"datas" | "manual">("datas"), [paid, setPaid] = useState(String(initial ? planInfo(initial, state.cards.find((c) => c.id === initial.cardId), today).paid : 3));
  const [cat, setCat] = useState(initial?.category ?? "compras"), [share, setShare] = useState<Shared | undefined>(initial?.shared);
  const card = state.cards.find((c) => c.id === cardId);
  const n = Math.max(1, Math.min(60, Math.round(Number(count) || 1)));
  const perV = perTouched && per !== undefined ? per : total ? Math.round((total / n) * 100) / 100 : undefined;
  // primeira parcela sugerida: a fatura em que a compra caiu (se o mês da compra mudar e a pessoa não mexeu)
  const paidN = Math.max(0, Math.min(n, Math.round(Number(paid) || 0)));
  // "já paguei N": a próxima parcela (N+1) cai na próxima fatura a vencer; o mês da 1ª parcela sai dessa conta
  const firstV = mode === "manual" ? firstFromPaid(card, today, paidN) : firstTouched ? first : card ? invoiceMonthOf(card, `${purchaseYm}-15`) : first;
  const draft: Plan | null = total && perV && card ? { id: initial?.id ?? uid("plan-"), desc: desc.trim(), cardId, total, count: n, per: perV, purchaseYm, first: firstV, category: cat, createdAt: initial?.createdAt ?? isoOf(today), ...(share && share.person.trim() ? { shared: { person: share.person.trim(), percent: share.percent } } : {}) } : null;
  const info = useMemo(() => (draft ? planInfo(draft, card, today) : null), [draft, card, today]);
  return (
    <div className="space-y-4">
      <Field label="Descrição da compra"><TextInput value={desc} onChange={(e) => { setDesc(e.target.value); if (!initial) setCat(guessCategory(e.target.value)); }} placeholder="Ex.: Notebook, sofá, curso de inglês" autoFocus data-testid="fin-plano-desc" /></Field>
      <Grid>
        <Field label="Cartão utilizado"><Select value={cardId} onChange={(e) => setCardId(e.target.value)} data-testid="fin-plano-cartao">{state.cards.length === 0 && <option value="">Cadastre um cartão primeiro</option>}{state.cards.map((c) => <option key={c.id} value={c.id}>{c.name} •••• {c.last4}</option>)}</Select></Field>
        <Field label="Valor total"><MoneyInput value={total} onChange={setTotal} data-testid="fin-plano-total" /></Field>
        <Field label="Quantidade de parcelas"><TextInput type="number" min={1} max={60} value={count} onChange={(e) => setCount(e.target.value)} data-testid="fin-plano-parcelas" /></Field>
        <Field label="Valor de cada parcela" hint="Calculado pelo total; pode ajustar."><MoneyInput value={perV} onChange={(v) => { setPer(v); setPerTouched(true); }} /></Field>
        <Field label="Mês e ano da compra"><TextInput type="month" value={purchaseYm} onChange={(e) => setPurchaseYm(e.target.value)} /></Field>
        <Field label="Primeira parcela (mês do vencimento)" hint={mode === "manual" ? "Calculado a partir das parcelas já pagas." : undefined}><TextInput type="month" value={firstV} disabled={mode === "manual"} onChange={(e) => { setFirst(e.target.value); setFirstTouched(true); }} /></Field>
      </Grid>
      <Field group label="Situação atual"><Segmented value={mode} onChange={setMode} options={[{ value: "datas", label: "Calcular pelas datas" }, { value: "manual", label: "Informar parcelas pagas" }]} /></Field>
      {mode === "manual" && <Field label="Quantas parcelas já foram pagas?"><TextInput type="number" min={0} max={n} value={paid} onChange={(e) => setPaid(e.target.value)} /></Field>}
      <Field group label="Categoria"><CategoryPicker value={cat} onChange={setCat} /></Field>
      <SharePicker value={share} onChange={setShare} amount={total} label="Dividir esta compra com alguém" />
      {info && draft && (
        <div className="rounded-2xl border border-cyan/25 bg-cyan/[0.06] p-4" data-testid="fin-plano-previa" style={{ animation: "fin-fade .4s both" }}>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan">Como vai ficar</p>
          <div className="mt-2 flex flex-wrap items-center gap-2"><Pill color="var(--emerald)">{info.paid}/{draft.count} pagas</Pill><Pill color="var(--amber)">{info.remaining} restantes</Pill><Pill color="var(--violet)">termina em {monthLabel(info.lastYm)}</Pill></div>
          <p className="mt-2 text-sm text-muted-foreground">Ainda faltam <b className="text-foreground">{brl(info.remainingAmount)}</b>{draft.per * draft.count !== draft.total ? " (a última parcela ajusta os centavos)" : ""}.</p>
        </div>
      )}
      <Actions onCancel={onCancel} onSave={() => draft && onSave(draft)} disabled={!draft || !desc.trim()} />
    </div>
  );
}

/* ───────────── detalhar uma compra dentro de uma fatura ───────────── */
/**
 * Cadastra uma compra que já está dentro do total de uma fatura: o total do banco não muda (a parte "a detalhar" diminui)
 * e, se for parcelada, as parcelas seguintes passam a contar nas próximas faturas.
 */
export function InvoiceItemForm({ card, ym, onSave, onCancel }: { card: Card; ym: string; onSave: (r: { plan?: Plan; tx?: Transaction; recurring?: Recurring }) => void; onCancel?: (() => void) | undefined }) {
  const { state, today } = useFinance(), todayIso = isoOf(today);
  const [desc, setDesc] = useState(""), [kind, setKind] = useState<"parcelada" | "avista">("parcelada"), [per, setPer] = useState<number | undefined>();
  const [cur, setCur] = useState("1"), [count, setCount] = useState("10"), [cat, setCat] = useState("compras"), [day, setDay] = useState(String(today.getDate()));
  // assinatura é cobrança fixa mensal: troca o formulário (sem parcelas) e cadastra como assinatura, que vale todo mês até pausar
  const subs = cat === "assinaturas";
  const n = Math.max(1, Math.min(60, Math.round(Number(count) || 1))), x = Math.max(1, Math.min(n, Math.round(Number(cur) || 1)));
  const close = closingDateOf(card, ym), prevClose = closingDateOf(card, addMonths(ym, -1));
  // à vista: hoje, se hoje está dentro deste ciclo; senão o dia do fechamento (que pertence a esta fatura)
  const date = todayIso > prevClose && todayIso <= close ? todayIso : close;
  const inv = invoiceFor(state, card, ym), declared = card.declared?.[ym];
  const amount = per ?? 0, added = amount;
  const detailedAfter = Math.round((inv.total - inv.adjustment + added) * 100) / 100, totalAfter = declared !== undefined ? Math.max(declared, detailedAfter) : detailedAfter;
  const restantes = !subs && kind === "parcelada" ? n - x : 0;
  const save = () => {
    if (!per || !desc.trim()) return;
    if (subs) return onSave({ recurring: subscriptionForInvoice(card, ym, { id: uid("rec-"), desc: desc.trim(), amount: per, day: Number(day) }) });
    if (kind === "avista") return onSave({ tx: { id: uid("tx-"), kind: "despesa", desc: desc.trim(), amount: per, date, method: "credito", cardId: card.id, category: cat, inLimit: true } });
    onSave({ plan: planForInvoice(card, ym, { id: uid("plan-"), desc: desc.trim(), per, n, x, category: cat, todayIso }) });
  };
  return (
    <div className="space-y-4" data-testid="fin-detalhar-form">
      <Field label="O que é essa compra?"><TextInput value={desc} onChange={(e) => { setDesc(e.target.value); setCat(guessCategory(e.target.value)); }} placeholder="Ex.: Tênis, curso, celular" autoFocus data-testid="fin-detalhar-desc" /></Field>
      {!subs && <Field group label="Tipo"><Segmented value={kind} onChange={setKind} options={[{ value: "parcelada", label: "Parcelada" }, { value: "avista", label: "À vista no crédito" }]} /></Field>}
      <Grid>
        <Field label={subs ? "Valor mensal" : kind === "parcelada" ? "Valor de cada parcela" : "Valor"}><MoneyInput value={per} onChange={setPer} data-testid="fin-detalhar-valor" /></Field>
        {subs && <Field label="Dia da cobrança" hint="Dia do mês em que o cartão cobra."><TextInput type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} data-testid="fin-detalhar-dia" /></Field>}
        {!subs && kind === "parcelada" && <Field label="Total de parcelas"><TextInput type="number" min={1} max={60} value={count} onChange={(e) => setCount(e.target.value)} /></Field>}
        {!subs && kind === "parcelada" && <Field label="Qual parcela está nesta fatura?" hint={`Se esta fatura traz a ${x}ª, as anteriores já foram pagas.`}><TextInput type="number" min={1} max={n} value={cur} onChange={(e) => setCur(e.target.value)} data-testid="fin-detalhar-atual" /></Field>}
      </Grid>
      <Field group label="Categoria"><CategoryPicker value={cat} onChange={setCat} /></Field>
      <div className="rounded-2xl border border-cyan/25 bg-cyan/[0.06] p-4 text-sm" data-testid="fin-detalhar-previa">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-cyan">Como vai ficar</p>
        <p className="mt-2 text-muted-foreground">Esta fatura {declared !== undefined ? <>continua em <b className="text-foreground">{brl(totalAfter)}</b>{declared >= detailedAfter ? <>, com <b className="text-foreground">{brl(Math.round((declared - detailedAfter) * 100) / 100)}</b> ainda a detalhar</> : <> (os itens passam do total informado em <b className="text-foreground">{brl(Math.round((detailedAfter - declared) * 100) / 100)}</b>)</>}.</> : <>passa a ter <b className="text-foreground">{brl(totalAfter)}</b> (você ainda não informou o total do banco).</>}</p>
        {subs && <p className="mt-1.5 text-muted-foreground">É uma <b className="text-foreground">assinatura mensal</b>: entra todo mês nesta fatura e nas próximas, a partir de <b className="text-foreground">{monthLabel(closingYmOf(card, ym))}</b>, até você pausar na aba Assinaturas.</p>}
        {!subs && kind === "parcelada" && <p className="mt-1.5 text-muted-foreground">{restantes > 0 ? <>As próximas <b className="text-foreground">{restantes}</b> {restantes === 1 ? "parcela entra" : "parcelas entram"} nas faturas seguintes, a partir de <b className="text-foreground">{monthLabel(closingYmOf(card, addMonths(ym, 1)))}</b>.</> : "Esta é a última parcela: nada vai para as faturas seguintes."}</p>}
      </div>
      <Actions onCancel={onCancel} onSave={save} saveLabel={subs ? "Cadastrar assinatura" : "Detalhar na fatura"} disabled={!desc.trim() || !per} />
    </div>
  );
}

/* ───────────── despesa ou receita recorrente ───────────── */
export function RecurringForm({ initial, onSave, onCancel, subscription = false }: { initial?: Recurring | undefined; onSave: (r: Recurring) => void; onCancel?: (() => void) | undefined; subscription?: boolean }) {
  const { state, today } = useFinance();
  const [kind, setKind] = useState<TxKind>(subscription ? "despesa" : initial?.kind ?? "despesa"), [desc, setDesc] = useState(initial?.desc ?? ""), [amount, setAmount] = useState<number | undefined>(initial?.amount), [day, setDay] = useState(String(initial?.day ?? 5));
  const [cat, setCat] = useState(initial?.category ?? (subscription ? "assinaturas" : "moradia")), [method, setMethod] = useState<Method>(initial?.method ?? "debito");
  const [payId, setPayId] = useState(initial?.cardId ?? initial?.accountId ?? ((subscription ? state.cards[0]?.id : undefined) ?? state.accounts[0]?.id ?? ""));
  const isCard = state.cards.some((c) => c.id === payId), [share, setShare] = useState<Shared | undefined>(initial?.shared);
  // mantém pausas e a marca de assinatura ao editar
  const save = () => onSave({ ...initial, id: initial?.id ?? uid("rec-"), kind, desc: desc.trim(), amount: amount ?? 0, day: Math.max(1, Math.min(31, Math.round(Number(day) || 1))), category: cat, method: isCard ? "credito" : method === "credito" ? "debito" : method, accountId: isCard ? undefined : payId || undefined, cardId: isCard ? payId : undefined, startYm: initial?.startYm ?? ymOf(today), subscription: subscription || initial?.subscription || undefined, shared: kind === "despesa" && share && share.person.trim() ? { person: share.person.trim(), percent: share.percent } : undefined });
  return (
    <div className="space-y-4">
      {!subscription && <Segmented value={kind} onChange={(k) => { setKind(k); setCat(k === "receita" ? "salario" : "moradia"); }} options={[{ value: "despesa", label: "Despesa fixa" }, { value: "receita", label: "Receita fixa" }]} />}
      <Grid>
        <Field label={subscription ? "Nome da assinatura" : "Descrição"}><TextInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={subscription ? "Ex.: Netflix, Fortnite Crew, iFood Club" : kind === "despesa" ? "Ex.: Aluguel, Netflix, academia" : "Ex.: Salário"} autoFocus data-testid="fin-rec-desc" /></Field>
        <Field label="Valor"><MoneyInput value={amount} onChange={setAmount} data-testid="fin-rec-valor" /></Field>
        <Field label={subscription ? "Dia da cobrança" : "Dia do mês"}><TextInput type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        <Field label={kind === "despesa" ? "Paga com" : "Cai em"}>
          <Select value={payId} onChange={(e) => setPayId(e.target.value)}>
            <optgroup label="Contas">{state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
            {kind === "despesa" && state.cards.length > 0 && <optgroup label="Cartões">{state.cards.map((c) => <option key={c.id} value={c.id}>{c.name} •••• {c.last4}</option>)}</optgroup>}
          </Select>
        </Field>
      </Grid>
      <Field group label="Categoria"><CategoryPicker value={cat} onChange={setCat} income={kind === "receita"} /></Field>
      {kind === "despesa" && <SharePicker value={share} onChange={setShare} amount={amount} label="Dividir esta conta com alguém" />}
      <Actions onCancel={onCancel} onSave={save} disabled={!desc.trim() || !amount} />
    </div>
  );
}

/* ───────────── meta ───────────── */
const GOAL_KINDS: { value: GoalKind; label: string; hint: string }[] = [
  { value: "guardar", label: "Guardar um valor", hint: "Viagem, compra grande, qualquer objetivo." },
  { value: "reserva", label: "Reserva de emergência", hint: "Meses de segurança guardados." },
  { value: "quitar_cartao", label: "Quitar um cartão", hint: "Acompanhe o quanto já pagou." },
  { value: "economizar_mensal", label: "Economizar por mês", hint: "Uma meta de poupança mensal." },
  { value: "limite_categoria", label: "Limitar gastos de uma categoria", hint: "O Orion avisa quando passar." },
];
export const goalKindLabel = (k: GoalKind) => GOAL_KINDS.find((g) => g.value === k)?.label ?? k;
export function GoalForm({ initial, onSave, onCancel }: { initial?: Goal | undefined; onSave: (g: Goal) => void; onCancel?: (() => void) | undefined }) {
  const { state } = useFinance();
  const [kind, setKind] = useState<GoalKind>(initial?.kind ?? "guardar"), [title, setTitle] = useState(initial?.title ?? ""), [target, setTarget] = useState<number | undefined>(initial?.target), [current, setCurrent] = useState<number | undefined>(initial?.current ?? 0);
  const [deadline, setDeadline] = useState(initial?.deadline ?? ""), [cardId, setCardId] = useState(initial?.cardId ?? state.cards[0]?.id ?? ""), [category, setCategory] = useState(initial?.category ?? "restaurantes");
  const info = GOAL_KINDS.find((g) => g.value === kind)!;
  const auto = kind === "limite_categoria" ? `Limite de ${catOf(category).name}` : kind === "reserva" ? "Reserva de emergência" : kind === "economizar_mensal" ? "Economizar todo mês" : kind === "quitar_cartao" ? `Quitar o cartão ${state.cards.find((c) => c.id === cardId)?.name ?? ""}`.trim() : "";
  const save = () => onSave({ id: initial?.id ?? uid("goal-"), kind, title: title.trim() || auto || "Nova meta", target: target ?? 0, current: kind === "limite_categoria" ? 0 : current ?? 0, deadline: deadline || undefined, category: kind === "limite_categoria" ? category : undefined, cardId: kind === "quitar_cartao" ? cardId : undefined, monthly: kind === "economizar_mensal" ? target : undefined });
  return (
    <div className="space-y-4">
      <Field label="Tipo de meta" hint={info.hint}><Select value={kind} onChange={(e) => setKind(e.target.value as GoalKind)} data-testid="fin-meta-tipo">{GOAL_KINDS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</Select></Field>
      <Field label="Nome da meta"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={auto || "Ex.: Viagem para Lisboa"} data-testid="fin-meta-nome" /></Field>
      <Grid>
        {kind === "quitar_cartao" && <Field label="Cartão"><Select value={cardId} onChange={(e) => setCardId(e.target.value)}>{state.cards.map((c) => <option key={c.id} value={c.id}>{c.name} •••• {c.last4}</option>)}</Select></Field>}
        {kind === "limite_categoria" && <Field label="Categoria"><Select value={category} onChange={(e) => setCategory(e.target.value)}>{CATS.filter((c) => !c.income).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>}
        <Field label={kind === "limite_categoria" ? "Limite por mês" : kind === "economizar_mensal" ? "Quanto guardar por mês" : kind === "quitar_cartao" ? "Valor a quitar" : "Valor da meta"}><MoneyInput value={target} onChange={setTarget} data-testid="fin-meta-valor" /></Field>
        {kind !== "limite_categoria" && <Field label={kind === "economizar_mensal" ? "Já guardado neste mês" : kind === "quitar_cartao" ? "Já pago" : "Já guardado"}><MoneyInput value={current} onChange={setCurrent} /></Field>}
        {(kind === "guardar" || kind === "reserva" || kind === "quitar_cartao") && <Field label="Prazo (opcional)"><TextInput type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>}
      </Grid>
      <Actions onCancel={onCancel} onSave={save} disabled={!target} />
    </div>
  );
}

/* ───────────── movimentação (despesa ou receita) ───────────── */
export type TxResult = { tx?: Transaction; plan?: Plan };
export function TxForm({ initial, onSave, onCancel, lockMethod, initialMethod, saveLabel = "Adicionar", extraActions }: { initial?: Partial<Transaction> & { installments?: number } | undefined; onSave: (r: TxResult) => void; onCancel?: (() => void) | undefined; lockMethod?: Method | undefined; initialMethod?: Method | undefined; saveLabel?: string | undefined; extraActions?: ReactNode }) {
  const { state, today } = useFinance();
  const [kind, setKind] = useState<TxKind>(initial?.kind ?? "despesa"), [desc, setDesc] = useState(initial?.desc ?? ""), [amount, setAmount] = useState<number | undefined>(initial?.amount);
  const [method, setMethod] = useState<Method>(lockMethod ?? initial?.method ?? initialMethod ?? "debito"), [date, setDate] = useState(initial?.date ?? isoOf(today));
  const [cat, setCat] = useState(initial?.category ?? "outros"), [catTouched, setCatTouched] = useState(!!initial?.category);
  const [accountId, setAccountId] = useState(initial?.accountId ?? state.accounts[0]?.id ?? ""), [cardId, setCardId] = useState(initial?.cardId ?? state.cards[0]?.id ?? "");
  const [share, setShare] = useState<Shared | undefined>(initial?.shared);
  const [parcelado, setParcelado] = useState((initial?.installments ?? 1) > 1), [count, setCount] = useState(String(initial?.installments && initial.installments > 1 ? initial.installments : 3));
  const credit = kind === "despesa" && method === "credito";
  const catV = catTouched ? cat : guessCategory(desc, kind === "receita");
  const n = Math.max(2, Math.min(60, Math.round(Number(count) || 2)));
  const card = state.cards.find((c) => c.id === cardId);
  const needsPay = credit ? !!cardId : method === "dinheiro" ? true : !!accountId;
  const methods: { value: Method; label: string }[] = kind === "receita" ? [{ value: "pix", label: "Pix" }, { value: "debito", label: "Conta" }, { value: "dinheiro", label: "Dinheiro" }] : [{ value: "debito", label: "Débito" }, { value: "credito", label: "Crédito" }, { value: "dinheiro", label: "Dinheiro" }, { value: "pix", label: "Pix" }];
  const save = () => {
    const base = { desc: desc.trim(), category: catV, ...(kind === "despesa" && share && share.person.trim() ? { shared: { person: share.person.trim(), percent: share.percent } } : {}) };
    if (credit && parcelado && amount && card) {
      const first = invoiceMonthOf(card, date), per = Math.round((amount / n) * 100) / 100;
      return onSave({ plan: { id: uid("plan-"), ...base, cardId, total: amount, count: n, per, purchaseYm: ymOf(date), first, createdAt: date } });
    }
    onSave({ tx: { id: initial?.id ?? uid("tx-"), kind, ...base, amount: amount ?? 0, date, method: kind === "receita" && method === "credito" ? "pix" : method, accountId: credit ? undefined : method === "dinheiro" ? (state.accounts.find((a) => a.kind === "dinheiro")?.id ?? (accountId || undefined)) : accountId || undefined, cardId: credit ? cardId : undefined } });
  };
  return (
    <div className="space-y-4" data-testid="fin-form-mov">
      {!lockMethod && <Segmented value={kind} onChange={(k) => { setKind(k); setMethod(k === "receita" ? "pix" : "debito"); setCatTouched(false); }} options={[{ value: "despesa", label: "Despesa" }, { value: "receita", label: "Receita" }]} />}
      <Field label={kind === "despesa" ? "O que foi comprado?" : "O que você recebeu?"}><TextInput value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={kind === "despesa" ? "Ex.: Livro, almoço, farmácia" : "Ex.: Freela, venda"} autoFocus data-testid="fin-mov-desc" /></Field>
      <Grid>
        <Field label="Qual o valor?"><MoneyInput value={amount} onChange={setAmount} data-testid="fin-mov-valor" /></Field>
        <Field label="Data"><TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} max={isoOf(addDays(today, 0))} data-testid="fin-mov-data" /></Field>
      </Grid>
      {!lockMethod && <Field group label={kind === "despesa" ? "Foi débito, crédito ou dinheiro?" : "Como recebeu?"}><Segmented value={method} onChange={setMethod} options={methods} /></Field>}
      {credit ? (
        <Field label="Qual cartão?"><Select value={cardId} onChange={(e) => setCardId(e.target.value)} data-testid="fin-mov-cartao">{state.cards.length === 0 && <option value="">Cadastre um cartão primeiro</option>}{state.cards.map((c) => <option key={c.id} value={c.id}>{c.name} •••• {c.last4}</option>)}</Select></Field>
      ) : method !== "dinheiro" ? (
        <Field label="Qual conta?"><Select value={accountId} onChange={(e) => setAccountId(e.target.value)} data-testid="fin-mov-conta">{state.accounts.length === 0 && <option value="">Cadastre uma conta primeiro</option>}{state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
      ) : null}
      {credit && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
          <label className="flex cursor-pointer items-center justify-between gap-3"><span className="text-sm font-medium">Foi parcelado?</span>
            <button type="button" role="switch" aria-checked={parcelado} onClick={() => setParcelado(!parcelado)} data-testid="fin-mov-parcelado" className={`relative h-6 w-11 rounded-full transition ${parcelado ? "bg-emerald/70" : "bg-white/15"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${parcelado ? "left-[1.35rem]" : "left-0.5"}`} /></button></label>
          {parcelado && (
            <div className="mt-3 grid grid-cols-[7rem_1fr] items-end gap-3">
              <Field label="Parcelas"><TextInput type="number" min={2} max={60} value={count} onChange={(e) => setCount(e.target.value)} data-testid="fin-mov-nparcelas" /></Field>
              <p className="pb-2 text-sm text-muted-foreground">{amount ? <>{n}x de <b className="text-foreground">{brl(amount / n)}</b></> : "Informe o valor"}{card && amount ? <> · 1ª em <b className="text-foreground">{monthLabel(invoiceMonthOf(card, date))}</b></> : null}</p>
            </div>
          )}
        </div>
      )}
      {kind === "despesa" && <SharePicker value={share} onChange={setShare} amount={amount} />}
      <Field group label="Categoria da despesa"><CategoryPicker value={catV} onChange={(c) => { setCat(c); setCatTouched(true); }} income={kind === "receita"} /></Field>
      <Actions onCancel={onCancel} onSave={save} saveLabel={credit && parcelado ? "Adicionar compra parcelada" : saveLabel} disabled={!desc.trim() || !amount || !needsPay} extra={extraActions} />
    </div>
  );
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

