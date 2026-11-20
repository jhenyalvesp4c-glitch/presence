/** Orçamento da ideia: caixinhas de tudo que vai comprar (nome, quantidade, valor, link), com a soma final e o Orion montando a lista. */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, Plus, Sparkles, Trash2, Wallet } from "lucide-react";

import { Money } from "@/components/finance/charts";
import { useIdeaActions } from "@/lib/data/ideas";
import { brl, parseMoney } from "@/lib/finance/settle";
import { suggestBudget } from "@/lib/ideas.functions";
import { budgetTotals, cleanBudget, ideaText, type BudgetItem, type BudgetStatus, type Idea } from "@/lib/ideas";

const field = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition focus:border-emerald/60";
const STATUS: { id: BudgetStatus; label: string; color: string }[] = [{ id: "comprar", label: "A comprar", color: "var(--amber)" }, { id: "comprado", label: "Comprado", color: "var(--emerald)" }, { id: "tenho", label: "Já tenho", color: "var(--cyan)" }];
const nameFromLink = (u: string) => { try { const x = new URL(u); const slug = decodeURIComponent(x.pathname.split("/").filter(Boolean).sort((a, b) => b.length - a.length)[0] ?? "").replace(/[-_+]+/g, " ").replace(/\.\w+$/, "").trim(); return (slug.length > 3 ? slug : x.hostname.replace(/^www\./, "")).slice(0, 80); } catch { return u.slice(0, 60); } };
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `n${Date.now()}${Math.random().toString(36).slice(2, 6)}`);

export function Budget({ idea, seed }: { idea: Idea; seed?: BudgetItem[] | undefined }) {
  const acts = useIdeaActions(), [items, setItems] = useState<BudgetItem[]>(seed ?? idea.budget), [adding, setAdding] = useState(""), [busy, setBusy] = useState(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null), latest = useRef(items);
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); acts.update.mutate({ id: idea.id, budget: latest.current }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps -- grava o que sobrou ao fechar
  const commit = (next: BudgetItem[], now = false) => {
    setItems(next); latest.current = next;
    if (timer.current) clearTimeout(timer.current);
    const go = () => { timer.current = null; acts.update.mutate({ id: idea.id, budget: next }, { onError: (e) => toast.error(`Não consegui salvar o orçamento: ${e.message}`) }); };
    if (now) go(); else timer.current = setTimeout(go, 700);
  };
  const patch = (id: string, p: Partial<BudgetItem>, now = false) => commit(items.map((i) => (i.id === id ? { ...i, ...p, ...(p.valor !== undefined ? { estimado: false } : {}) } : i)), now);
  const t = budgetTotals(items), pct = t.total ? (t.comprado / t.total) * 100 : 0;

  const addOne = () => {
    const raw = adding.trim();
    if (!raw) return;
    const link = raw.match(/https?:\/\/\S+/i)?.[0] ?? "", rest = raw.replace(link, "").trim(), val = rest.match(/(?:r\$\s*)?(\d[\d.,]*)\s*$/i);
    const valor = val ? parseMoney(val[1]!) : null, nome = (val ? rest.slice(0, val.index).trim() : rest) || (link ? nameFromLink(link) : "");
    if (!nome) return;
    commit([...items, ...cleanBudget([{ id: newId(), nome, qtd: 1, valor, link, status: "comprar" }])], true); setAdding("");
  };
  const askOrion = async () => {
    setBusy(true);
    try {
      const r = await suggestBudget({ data: { texto: ideaText({ ...idea, budget: items }) } });
      if (!r.ok) { toast.error(r.error); setBusy(false); return; }
      const have = new Set(items.map((i) => i.nome.trim().toLowerCase())), fresh = r.itens.filter((i) => !have.has(i.nome.trim().toLowerCase())).map((i) => ({ ...i, id: newId() }));
      if (!fresh.length) toast("O Orion não achou itens novos para adicionar.");
      else { commit([...items, ...fresh], true); toast.success(`${fresh.length} ${fresh.length === 1 ? "item adicionado" : "itens adicionados"}`, { description: "Confira os valores: o que tem \"~\" é estimativa do Orion." }); }
    } catch (e) { toast.error(`Não consegui montar a lista: ${(e as Error).message}`); }
    setBusy(false);
  };

  return (
    <section className="card-premium mt-5 rounded-2xl !border-emerald/30 p-4" style={{ "--tone": "var(--emerald)" } as React.CSSProperties} data-testid="ideia-orcamento">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald/40 bg-emerald/10 text-emerald"><Wallet size={16} /></span>
        <div className="mr-auto"><h3 className="font-display text-base font-semibold">Orçamento e compras</h3><p className="text-xs text-muted-foreground">Tudo o que vai comprar, com valor e link, e a soma final.</p></div>
        <button onClick={() => void askOrion()} disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 px-4 py-2 text-sm text-emerald transition hover:bg-emerald/10 disabled:opacity-50" data-testid="orcamento-orion">{busy ? <><Loader2 size={15} className="animate-spin" /> Pensando…</> : <><Sparkles size={15} /> {items.length ? "Orion, complete a lista" : "Orion monta a lista"}</>}</button>
      </div>

      {items.length > 0 && <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4" data-testid="orcamento-total">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Total do projeto</p><p className="font-display text-4xl font-semibold tabular-nums text-emerald drop-shadow-[0_0_20px_color-mix(in_oklab,var(--emerald)_50%,transparent)]"><Money value={t.total} /></p></div>
          <div className="flex gap-5 text-right text-xs"><div><p className="text-muted-foreground">Já gasto</p><p className="font-medium tabular-nums">{brl(t.comprado)}</p></div><div><p className="text-muted-foreground">Falta gastar</p><p className="font-medium tabular-nums text-amber">{brl(t.falta)}</p></div></div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><span className="block h-full rounded-full bg-gradient-to-r from-emerald to-cyan transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
        {(t.semValor > 0 || t.estimados > 0) && <p className="mt-2 text-[0.7rem] text-amber">{t.semValor > 0 && `${t.semValor} ${t.semValor === 1 ? "item ainda sem valor" : "itens ainda sem valor"} (não entram na soma). `}{t.estimados > 0 && `${t.estimados} ${t.estimados === 1 ? "valor é estimativa" : "valores são estimativas"} do Orion.`}</p>}
      </div>}

      <ul className="mt-3 space-y-2" data-testid="orcamento-itens">{items.map((i) => { const st = STATUS.find((s) => s.id === i.status)!, line = i.valor === null ? null : brl(i.valor * i.qtd); return (
        <li key={i.id} className={`rounded-2xl border bg-white/[0.03] p-3 transition ${i.status === "tenho" ? "border-cyan/25 opacity-75" : i.status === "comprado" ? "border-emerald/30" : "border-white/10"}`} data-testid="orcamento-item">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => patch(i.id, { status: STATUS[(STATUS.findIndex((s) => s.id === i.status) + 1) % 3]!.id }, true)} title="Trocar: a comprar, comprado, já tenho" className="rounded-full border px-3 py-1 text-xs font-medium transition hover:brightness-125" style={{ color: st.color, borderColor: `color-mix(in oklab, ${st.color} 45%, transparent)`, background: `color-mix(in oklab, ${st.color} 12%, transparent)` }} data-testid="orcamento-status">{st.label}</button>
            <input defaultValue={i.nome} key={`n-${i.id}-${i.nome}`} onBlur={(e) => e.target.value.trim() && e.target.value !== i.nome && patch(i.id, { nome: e.target.value.trim() }, true)} aria-label="Item" className={`${field} min-w-0 flex-1 !py-1.5 font-medium`} data-testid="orcamento-nome" />
            <button type="button" onClick={() => commit(items.filter((x) => x.id !== i.id), true)} aria-label={`Remover ${i.nome}`} className="text-muted-foreground transition hover:text-destructive"><Trash2 size={14} /></button>
          </div>
          <div className="mt-2 grid grid-cols-[4.5rem_1fr] gap-2 sm:grid-cols-[4.5rem_9rem_1fr_auto]">
            <label className="text-[0.65rem] text-muted-foreground">Qtd<input type="number" min={1} max={999} defaultValue={i.qtd} key={`q-${i.id}-${i.qtd}`} onBlur={(e) => { const q = Math.max(1, Math.round(Number(e.target.value) || 1)); if (q !== i.qtd) patch(i.id, { qtd: q }, true); }} className={`${field} !py-1.5`} data-testid="orcamento-qtd" /></label>
            <label className="text-[0.65rem] text-muted-foreground">Valor (cada){i.estimado && <span className="ml-1 text-amber">~ estimado</span>}<input inputMode="decimal" placeholder="R$ 0,00" defaultValue={i.valor === null ? "" : i.valor.toFixed(2).replace(".", ",")} key={`v-${i.id}-${i.valor}`} onBlur={(e) => { const raw = e.target.value.trim(), v = raw ? parseMoney(raw) : null; if (v !== i.valor || i.estimado) patch(i.id, { valor: v }, true); }} className={`${field} !py-1.5 tabular-nums`} data-testid="orcamento-valor" /></label>
            <label className="col-span-2 text-[0.65rem] text-muted-foreground sm:col-span-1">Link<input defaultValue={i.link} key={`l-${i.id}-${i.link}`} placeholder="Cole o link do produto" onBlur={(e) => { const v = e.target.value.trim(); if (v !== i.link) patch(i.id, { link: /^https?:\/\/\S+$/i.test(v) ? v : "" }, true); }} className={`${field} !py-1.5 font-mono text-xs`} data-testid="orcamento-link" /></label>
            <p className="col-span-2 flex items-end justify-between gap-3 text-xs sm:col-span-1 sm:justify-end">{i.link && <a href={i.link} target="_blank" rel="noreferrer" aria-label="Abrir link" className="inline-flex items-center gap-1 text-cyan hover:underline"><ExternalLink size={12} /> abrir</a>}<span className="min-w-20 text-right font-medium tabular-nums">{i.status === "tenho" ? "já tenho" : line ?? "—"}</span></p>
          </div>
          {i.nota && <p className="mt-1.5 text-[0.7rem] text-muted-foreground">{i.nota}</p>}
        </li>); })}</ul>

      <div className="mt-3 flex gap-2">
        <input value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOne(); } }} placeholder='Adicionar item: "Prateleira 120cm 189,90" ou cole um link' className={field} data-testid="orcamento-novo" />
        <button type="button" onClick={addOne} disabled={!adding.trim()} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 px-4 text-sm transition hover:bg-white/10 disabled:opacity-40" data-testid="orcamento-add"><Plus size={14} /> Adicionar</button>
      </div>
    </section>
  );
}
