import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Receipt, Search } from "lucide-react";
import { addMonths, brl, dateBR, monthEntries, monthName, sum, total, ymOf, expensesOf, incomeOf } from "@/lib/finance/calc";
import { catOf, CATS } from "@/lib/finance/categories";
import { useFinance } from "@/lib/finance/store";
import type { Entry, Transaction } from "@/lib/finance/types";
import { Money } from "./charts";
import { TxForm } from "./forms";
import { EntryRow } from "./rows";
import { ConfirmDelete, Empty, Modal, Panel, Segmented, Select, TextInput, btn } from "./ui";

const weekday = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" });

/** Todas as movimentações do mês, agrupadas por dia, com busca e filtros. */
export function TransactionsView({ onAdd }: { onAdd: () => void }) {
  const f = useFinance(), { state, today } = f;
  const [ym, setYm] = useState(ymOf(today)), [kind, setKind] = useState<"todas" | "despesas" | "receitas">("todas"), [q, setQ] = useState(""), [cat, setCat] = useState(""), [pay, setPay] = useState("");
  const [editTx, setEditTx] = useState<Transaction | null>(null), [del, setDel] = useState<Entry | null>(null);
  const all = useMemo(() => monthEntries(state, ym), [state, ym]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((e) => (kind === "todas" || (kind === "despesas" ? e.kind === "despesa" : e.kind === "receita")) && (!cat || e.category === cat) && (!pay || e.cardId === pay || e.accountId === pay) && (!t || `${e.desc} ${catOf(e.category).name}`.toLowerCase().includes(t)));
  }, [all, kind, q, cat, pay]);
  const groups = useMemo(() => { const m = new Map<string, Entry[]>(); for (const e of rows) (m.get(e.date) ?? m.set(e.date, []).get(e.date)!).push(e); return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0])); }, [rows]);
  return (
    <div className="space-y-5" data-testid="fin-movimentacoes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-serif text-3xl">Suas <span className="text-gradient italic">movimentações</span></h2><p className="text-sm text-muted-foreground">Tudo que entrou e saiu, em um só lugar.</p></div>
        <button className={btn.primary} onClick={onAdd}><Plus size={16} /> Adicionar movimentação</button>
      </div>
      <Panel glow="var(--cyan)" className="!p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1"><button className={btn.icon} aria-label="Mês anterior" onClick={() => setYm(addMonths(ym, -1))}><ChevronLeft size={16} /></button><span className="min-w-[10.5rem] text-center font-display font-semibold capitalize" data-testid="fin-mes">{monthName(ym)}</span><button className={btn.icon} aria-label="Próximo mês" onClick={() => setYm(addMonths(ym, 1))}><ChevronRight size={16} /></button></div>
          <div className="ml-auto flex gap-5 text-sm"><span className="text-muted-foreground">Entrou <b className="text-emerald tabular-nums"><Money value={total(incomeOf(rows))} /></b></span><span className="text-muted-foreground">Saiu <b className="tabular-nums text-foreground"><Money value={total(expensesOf(rows))} /></b></span></div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative"><Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por descrição ou categoria" className="!pl-10" data-testid="fin-busca" /></div>
          <Segmented value={kind} onChange={setKind} options={[{ value: "todas", label: "Tudo" }, { value: "despesas", label: "Despesas" }, { value: "receitas", label: "Receitas" }]} className="md:w-72" />
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filtrar por categoria" className="md:w-44"><option value="">Todas as categorias</option>{CATS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select value={pay} onChange={(e) => setPay(e.target.value)} aria-label="Filtrar por conta ou cartão" className="md:w-48"><option value="">Contas e cartões</option><optgroup label="Contas">{state.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup><optgroup label="Cartões">{state.cards.map((c) => <option key={c.id} value={c.id}>{c.name} •••• {c.last4}</option>)}</optgroup></Select>
        </div>
      </Panel>
      {groups.length === 0 ? <Empty icon={Receipt} title="Nenhuma movimentação encontrada" hint="Mude o mês ou os filtros, ou adicione uma nova." action={<button className={btn.primary} onClick={onAdd}><Plus size={16} /> Adicionar movimentação</button>} /> : (
        <div className="space-y-4">{groups.map(([date, es]) => {
          const net = sum(es.map((e) => (e.kind === "receita" ? e.amount : -e.amount)));
          return (
            <Panel key={date} glow="var(--violet)" className="!p-4">
              <div className="mb-2 flex items-baseline justify-between px-2"><p className="text-sm"><b className="capitalize">{weekday(date)}</b> <span className="text-muted-foreground">· {dateBR(date).slice(0, 5)}</span></p><span className={`text-xs tabular-nums ${net >= 0 ? "text-emerald" : "text-muted-foreground"}`}>{net >= 0 ? "+" : "−"}{brl(Math.abs(net))}</span></div>
              <ul>{es.map((e, i) => <EntryRow key={e.id} e={e} s={state} index={i} showDate={false} onEdit={(x) => { const t = state.transactions.find((y) => y.id === x.id); if (t) setEditTx(t); }} onDelete={setDel} />)}</ul>
            </Panel>
          );
        })}</div>
      )}
      <Modal open={!!editTx} onClose={() => setEditTx(null)} title="Editar movimentação">{editTx && <TxForm initial={editTx} saveLabel="Salvar alterações" onCancel={() => setEditTx(null)} onSave={(r) => { if (r.tx) f.upsertTx(r.tx); setEditTx(null); }} />}</Modal>
      <ConfirmDelete open={!!del} what={del ? `“${del.desc}” (${brl(del.amount)})` : ""} onCancel={() => setDel(null)} onConfirm={() => { if (del) f.removeTx(del.id); setDel(null); }} />
    </div>
  );
}
