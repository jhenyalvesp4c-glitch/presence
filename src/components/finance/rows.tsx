import { Pencil, Repeat, Trash2 } from "lucide-react";
import { brl, dateBR } from "@/lib/finance/calc";
import { catOf } from "@/lib/finance/categories";
import type { Entry, FinanceState } from "@/lib/finance/types";
import { CatBadge, Pill, btn } from "./ui";

const METHOD = { debito: "Débito", credito: "Crédito", dinheiro: "Dinheiro", pix: "Pix" } as const;

export function payLabel(s: FinanceState, e: Pick<Entry, "cardId" | "accountId" | "method">): string {
  const card = s.cards.find((c) => c.id === e.cardId), acc = s.accounts.find((a) => a.id === e.accountId);
  return [METHOD[e.method], card ? `${card.name} •••• ${card.last4}` : acc?.name].filter(Boolean).join(" · ");
}

/** Uma linha do extrato: ícone da categoria, descrição, onde foi pago, valor (verde se entrou) e ações para o que é editável. */
export function EntryRow({ e, s, onEdit, onDelete, index = 0, showDate = true }: { e: Entry; s: FinanceState; onEdit?: (e: Entry) => void; onDelete?: (e: Entry) => void; index?: number; showDate?: boolean }) {
  const income = e.kind === "receita";
  return (
    <li className="group flex items-center gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.045]" style={{ animation: `fin-pop .4s ${Math.min(index, 12) * 0.03}s both` }}>
      <CatBadge id={e.category} size={38} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium"><span className="truncate">{e.desc}</span>
          {e.parcel && <Pill color="var(--amber)">parcela {e.parcel}</Pill>}
          {e.source === "recorrente" && <Pill color="var(--violet)"><Repeat size={10} /> fixa</Pill>}
          {e.source === "compartilhada" && <Pill color="var(--emerald)">a receber de {e.person}</Pill>}</p>
        <p className="truncate text-xs text-muted-foreground">{showDate ? `${dateBR(e.date)} · ` : ""}{catOf(e.category).name} · {payLabel(s, e)}</p>
      </div>
      <p className={`shrink-0 text-sm font-semibold tabular-nums ${income ? "text-emerald" : ""}`}>{income ? "+" : "−"}{brl(e.amount)}</p>
      {e.source === "tx" && (onEdit || onDelete) && (
        <span className="flex shrink-0 gap-1 opacity-70 transition group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {onEdit && <button className={btn.icon} aria-label={`Editar ${e.desc}`} onClick={() => onEdit(e)}><Pencil size={14} /></button>}
          {onDelete && <button className={`${btn.icon} hover:!border-destructive/50 hover:!text-destructive`} aria-label={`Excluir ${e.desc}`} onClick={() => onDelete(e)}><Trash2 size={14} /></button>}
        </span>
      )}
    </li>
  );
}
