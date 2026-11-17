import { useMemo, useState } from "react";
import { ArrowRight, Check, MessageSquareText, PencilLine, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { brl, dateBR, invoiceMonthOf, monthLabel } from "@/lib/finance/calc";
import { catOf } from "@/lib/finance/categories";
import { examplePhrases, parseNatural, type Draft } from "@/lib/finance/parse";
import { uid, useFinance } from "@/lib/finance/store";
import type { Transaction } from "@/lib/finance/types";
import { TxForm, type TxResult } from "./forms";
import { CatBadge, Modal, Pill, Segmented, btn } from "./ui";

const METHOD_LABEL = { debito: "Débito", credito: "Crédito", dinheiro: "Dinheiro", pix: "Pix" } as const;

/** Grava o resultado do formulário: compra à vista vira movimentação; parcelada vira plano de parcelas. */
export function useCommit() {
  const f = useFinance();
  return (r: TxResult) => {
    if (r.plan) { f.upsertPlan(r.plan); toast.success(`Compra parcelada adicionada: ${r.plan.count}x de ${brl(r.plan.per)}`); }
    else if (r.tx) { f.upsertTx(r.tx); toast.success(r.tx.kind === "receita" ? "Receita adicionada" : "Despesa adicionada"); }
  };
}

/** Campos que a interpretação entendeu, para a pessoa conferir antes de registrar. */
export function DraftPreview({ draft, onEdit, onConfirm }: { draft: Draft; onEdit: () => void; onConfirm: () => void }) {
  const { state } = useFinance();
  const card = state.cards.find((c) => c.id === draft.cardId), account = state.accounts.find((a) => a.id === draft.accountId), cat = catOf(draft.category);
  const rows: { label: string; value: string; ok: boolean }[] = [
    { label: "O que foi", value: draft.desc, ok: !!draft.desc },
    { label: "Valor", value: draft.amount ? brl(draft.amount) : "não encontrei", ok: draft.amount > 0 },
    { label: "Forma", value: draft.method ? METHOD_LABEL[draft.method] : "não encontrei", ok: !!draft.method },
    { label: draft.method === "credito" ? "Cartão" : "Conta", value: card ? `${card.name} •••• ${card.last4}` : account ? account.name : draft.method === "dinheiro" ? "Dinheiro" : "não encontrei", ok: !!(card || account || draft.method === "dinheiro") },
    { label: "Data", value: dateBR(draft.date), ok: true },
    { label: "Categoria", value: cat.name, ok: true },
  ];
  if (draft.installments > 1) rows.splice(3, 0, { label: "Parcelas", value: `${draft.installments}x de ${brl(draft.amount / draft.installments)}`, ok: draft.amount > 0 });
  const complete = draft.missing.length === 0;
  return (
    <div className="rounded-3xl border border-violet/30 bg-violet/[0.07] p-4" style={{ animation: "fin-pop .45s both" }} data-testid="fin-previa-frase">
      <div className="mb-3 flex items-center gap-3">
        <CatBadge id={draft.category} size={40} />
        <div className="min-w-0"><p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-violet">Entendi assim</p><p className="truncate font-medium">{draft.kind === "receita" ? "Receita" : "Despesa"}: {draft.desc}</p></div>
        <span className="ml-auto"><Pill color={draft.confidence >= 0.8 ? "var(--emerald)" : draft.confidence >= 0.5 ? "var(--amber)" : "oklch(0.72 0.18 10)"}>{Math.round(draft.confidence * 100)}% entendido</Pill></span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map((r) => <div key={r.label}><dt className="text-[0.68rem] uppercase tracking-wider text-muted-foreground">{r.label}</dt><dd className={r.ok ? "font-medium" : "font-medium text-amber"}>{r.value}</dd></div>)}
      </dl>
      {!complete && <p className="mt-3 rounded-xl bg-amber/10 px-3 py-2 text-xs text-amber">Faltou: {draft.missing.join(", ")}. Toque em “Ajustar” para completar.</p>}
      {draft.method === "credito" && card && draft.installments > 1 && <p className="mt-3 text-xs text-muted-foreground">A 1ª parcela cai na fatura de <b className="text-foreground">{monthLabel(invoiceMonthOf(card, draft.date))}</b>.</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button className={btn.ghost} onClick={onEdit} data-testid="fin-frase-ajustar"><PencilLine size={14} /> Ajustar</button>
        <button className={btn.primary} onClick={onConfirm} disabled={!complete} data-testid="fin-frase-confirmar"><Check size={15} /> Confirmar lançamento</button>
      </div>
    </div>
  );
}

/** Campo "diga ao Orion": escreve a frase, o Orion interpreta e mostra para confirmar. */
export function NaturalComposer({ onOpenForm, autoFocus = false }: { onOpenForm: (d: Draft) => void; autoFocus?: boolean }) {
  const f = useFinance(), commit = useCommit();
  const [text, setText] = useState(""), [draft, setDraft] = useState<Draft | null>(null);
  const interpret = (t = text) => { if (t.trim()) setDraft(parseNatural(t, f.state, f.today)); };
  const confirm = () => {
    if (!draft) return;
    const base = { desc: draft.desc, category: draft.category };
    if (draft.method === "credito" && draft.installments > 1 && draft.cardId) {
      const card = f.state.cards.find((c) => c.id === draft.cardId)!;
      commit({ plan: { id: uid("plan-"), ...base, cardId: draft.cardId, total: draft.amount, count: draft.installments, per: Math.round((draft.amount / draft.installments) * 100) / 100, purchaseYm: draft.date.slice(0, 7), first: invoiceMonthOf(card, draft.date), createdAt: draft.date } });
    } else {
      const tx: Transaction = { id: uid("tx-"), kind: draft.kind, ...base, amount: draft.amount, date: draft.date, method: draft.method ?? "debito", accountId: draft.accountId, cardId: draft.cardId };
      commit({ tx });
    }
    setDraft(null); setText("");
  };
  return (
    <div data-testid="fin-compositor">
      <form className="relative" onSubmit={(e) => { e.preventDefault(); interpret(); }}>
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-violet"><Sparkles size={18} /></span>
        <input value={text} onChange={(e) => { setText(e.target.value); if (draft) setDraft(null); }} autoFocus={autoFocus} data-testid="fin-frase" aria-label="Diga ao Orion o que você gastou ou recebeu"
          placeholder="Diga ao Orion: “Hoje comprei um livro de R$ 30 no débito pelo Nubank”"
          className="w-full rounded-full border border-white/12 bg-black/30 py-3.5 pl-11 pr-14 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-violet/60 focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--violet)_16%,transparent)]" />
        <button type="submit" aria-label="Interpretar frase" disabled={!text.trim()} data-testid="fin-frase-enviar" className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-gradient-brand text-[#04121a] transition hover:brightness-110 disabled:opacity-40"><ArrowRight size={17} /></button>
      </form>
      {!draft && (
        <div className="mt-3 flex flex-wrap gap-2">
          {examplePhrases.slice(0, 3).map((p) => <button key={p} type="button" onClick={() => { setText(p); interpret(p); }} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-[0.74rem] text-muted-foreground transition hover:border-violet/40 hover:text-foreground">{p}</button>)}
        </div>
      )}
      {draft && <div className="mt-4"><DraftPreview draft={draft} onEdit={() => onOpenForm(draft)} onConfirm={confirm} /></div>}
      <p className="mt-3 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground"><Wand2 size={12} /> Por enquanto a frase é interpretada aqui mesmo; em breve o Orion fará isso por voz.</p>
    </div>
  );
}

/** "Adicionar movimentação": formulário rápido ou frase, no mesmo lugar. */
export function QuickAddModal({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: Draft | null | undefined }) {
  const commit = useCommit();
  const [mode, setMode] = useState<"form" | "frase">("form");
  const [fromDraft, setFromDraft] = useState<Draft | null>(null);
  const draft = preset ?? fromDraft;
  const initial = useMemo(() => (draft ? { kind: draft.kind, desc: draft.desc, amount: draft.amount || undefined, date: draft.date, method: draft.method ?? undefined, accountId: draft.accountId, cardId: draft.cardId, category: draft.category, installments: draft.installments } : undefined), [draft]);
  const close = () => { setFromDraft(null); setMode("form"); onClose(); };
  return (
    <Modal open={open} onClose={close} title="Adicionar movimentação" subtitle="Rápido: o que foi, quanto, e em qual conta ou cartão.">
      <div className="mb-5"><Segmented value={mode} onChange={setMode} options={[{ value: "form", label: "Preencher", icon: PencilLine }, { value: "frase", label: "Dizer com uma frase", icon: MessageSquareText }]} /></div>
      {mode === "frase" && !draft
        ? <NaturalComposer autoFocus onOpenForm={(d) => { setFromDraft(d); setMode("form"); }} />
        : <TxForm key={draft ? `${draft.desc}${draft.amount}` : "novo"} initial={initial as never} onSave={(r) => { commit(r); close(); }} onCancel={close} />}
    </Modal>
  );
}
