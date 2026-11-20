/** Adicionar alimento a uma refeição: minhas opções, busca, quantidade em g/colheres/unidades com macros ao vivo, e cadastro de alimentos com meus macros (salvos para reusar). */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Plus, Search, Trash2, X } from "lucide-react";

import type { DietBundle } from "@/components/diet/DietHub";
import { backdropProps } from "@/lib/backdrop";
import { useMyFoodActions, useMyFoods } from "@/lib/data/diet-plan";
import { FOODS, customFood, findFoods, foodForPlanItem, foodMacros, qtyLabel, type Food } from "@/lib/diet-foods";
import type { Extra } from "@/lib/diet-plan";

const r0 = (n: number) => Math.round(n), r1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: string) => { const x = Number(v.replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : 0; };
const field = "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none transition focus:border-cyan/60";
const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs transition active:scale-95 ${on ? "border-cyan/60 bg-cyan/15 text-cyan shadow-[0_0_18px_-6px_var(--cyan)]" : "border-white/10 text-muted-foreground hover:text-foreground"}`;
const EMPTY = { nome: "", kcal: "", p: "", c: "", f: "", base: "100g" as "100g" | "porcao", unidade: "", gramas: "", salvar: true };
export type NewEntry = Omit<Extra, "id" | "meal">;

export function AddFoodSheet({ b, mealLabel, onAdd, onClose }: { b: DietBundle; mealLabel: string; onAdd: (e: NewEntry) => void; onClose: () => void }) {
  const mine = useMyFoods(), myFoods = mine.data ?? [], foodActs = useMyFoodActions(), pool = useMemo(() => [...myFoods, ...FOODS], [myFoods]);
  const [q, setQ] = useState(""), [food, setFood] = useState<Food | null>(null), [qty, setQty] = useState(""), [unit, setUnit] = useState("g"), [custom, setCustom] = useState(false), [cf, setCf] = useState(EMPTY), [showMine, setShowMine] = useState(false), [count, setCount] = useState(0);
  const options = useMemo(() => {
    const seen = new Set<string>(), out: { food: Food; qty: number; unit: string; tag: string }[] = [];
    for (const fd of myFoods.slice(0, 12)) { seen.add(fd.id); out.push({ food: fd, qty: 1, unit: fd.medidas[0]?.nome ?? "g", tag: "meu alimento" }); }
    for (const m of b.sum.opt.refeicoes) for (const it of m.itens) { const fd = foodForPlanItem(it.alimento); if (!fd || seen.has(fd.id)) continue; seen.add(fd.id); const g = it.g ?? Number(it.qtd.match(/(\d+(?:[.,]\d+)?)\s*g\b/i)?.[1]?.replace(",", ".")); out.push({ food: fd, qty: Number.isFinite(g) && g ? g : 1, unit: Number.isFinite(g) && g ? "g" : fd.medidas[0]?.nome ?? "g", tag: m.nome }); }
    const freq = new Map<string, number>(); for (const l of b.logs) for (const e of l.extras) freq.set(e.nome, (freq.get(e.nome) ?? 0) + 1);
    for (const [nome] of [...freq].sort((a, c) => c[1] - a[1]).slice(0, 8)) { const fd = pool.find((x) => nome.toLowerCase().startsWith(x.nome.toLowerCase())); if (fd && !seen.has(fd.id)) { seen.add(fd.id); out.push({ food: fd, qty: 1, unit: fd.medidas[0]?.nome ?? "g", tag: "mais usados" }); } }
    return out;
  }, [b.sum.opt, b.logs, myFoods, pool]);
  const results = findFoods(q, 8, pool), preview = food && num(qty) ? foodMacros(food, num(qty), unit) : null, units = food ? [{ nome: "g", g: 1 }, ...food.medidas] : [];
  const pick = (fd: Food, quantity?: number, u?: string) => { setFood(fd); setUnit(u ?? fd.medidas[0]?.nome ?? "g"); setQty(quantity ? String(quantity).replace(".", ",") : ""); setQ(""); setCustom(false); };
  const addFood = () => { if (!food || !preview) return; onAdd({ nome: food.nome, qtd: qtyLabel(num(qty), unit), ...preview }); toast.success(`${food.nome} em ${mealLabel}`); setCount((n) => n + 1); setFood(null); setQty(""); };
  const saveCustom = async () => {
    const p = num(cf.p), c = num(cf.c), g = num(cf.f), kcal = num(cf.kcal) || p * 4 + c * 4 + g * 9;
    if (!cf.nome.trim()) { toast.error("Dê um nome ao alimento."); return; }
    if (!kcal && !p && !c && !g) { toast.error("Informe os macros (ou as calorias)."); return; }
    const fd = customFood({ nome: cf.nome, kcal, p, c, f: g, base: cf.base, unidade: cf.unidade, gramas: num(cf.gramas) });
    if (cf.salvar) { try { await foodActs.save.mutateAsync(fd); toast.success("Salvo em Meus alimentos"); } catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); return; } }
    setCf(EMPTY); setCustom(false); pick(fd, 1, fd.medidas[0]?.nome ?? "g");
  };
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 backdrop-blur-md sm:items-center sm:p-6" {...backdropProps(onClose)} data-testid="adicionar-alimento">
      <div onClick={(e) => e.stopPropagation()} className="glass scroll-thin max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] p-5 sm:rounded-[2rem] sm:p-6" style={{ animation: "fin-rise .4s both" }}>
        <div className="flex items-start justify-between gap-3"><div><p className="mono-caps">Adicionar alimento</p><h2 className="font-display text-2xl font-semibold">{mealLabel}</h2></div><button onClick={onClose} aria-label="Fechar" className="rounded-full border border-white/15 p-2 text-muted-foreground hover:text-foreground" data-testid="sheet-fechar">{count > 0 ? <span className="px-1 text-xs">Concluir ({count})</span> : <X size={16} />}</button></div>
        <label className="relative mt-4 block"><Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alimento (arroz, banana, whey…)" className={`${field} pl-10`} data-testid="diario-busca" /></label>
        {results.length > 0 && <ul className="mt-2 space-y-1" data-testid="diario-resultados">{results.map((fd) => <li key={fd.id}><button type="button" onClick={() => pick(fd)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2 text-left text-sm transition hover:border-cyan/40"><span>{fd.nome}{fd.alias === "meu" && <span className="ml-1.5 text-xs text-emerald">· meu</span>}</span><span className="font-mono text-xs text-muted-foreground">{r0(fd.per100.kcal)} kcal/100 g</span></button></li>)}</ul>}
        {food && <div className="mt-4 rounded-2xl border border-cyan/30 bg-black/30 p-4" data-testid="diario-quantidade" style={{ animation: "fin-rise .35s both" }}>
          <div className="flex items-center justify-between"><b className="font-display text-lg">{food.nome}</b><button type="button" aria-label="Cancelar" onClick={() => setFood(null)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button></div>
          <label className="mt-2 block text-[0.65rem] uppercase tracking-wider text-muted-foreground">Quanto?<input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={`${field} mt-1 text-center font-display text-3xl`} data-testid="diario-qtd" autoFocus /></label>
          <p className="mb-1.5 mt-3 text-[0.65rem] uppercase tracking-wider text-muted-foreground">Em quê?</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Unidade" data-testid="diario-unidades">{units.map((u) => <button key={u.nome} type="button" role="radio" aria-checked={unit === u.nome} onClick={() => setUnit(u.nome)} data-testid={`unidade-${u.nome}`} className={chip(unit === u.nome)}>{u.nome === "g" ? "gramas (g)" : u.nome}{u.nome !== "g" && <span className="opacity-60"> ≈{u.g} g</span>}</button>)}</div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center" data-testid="diario-previa">{([["kcal", preview?.kcal, "var(--amber)"], ["Prot.", preview?.p, "var(--emerald)"], ["Carbo", preview?.c, "var(--cyan)"], ["Gord.", preview?.f, "var(--violet)"]] as const).map(([l, v, c]) => <div key={l} className="rounded-xl border border-white/10 bg-black/25 py-2"><b className="block font-display text-lg tabular-nums" style={{ color: c }}>{v === undefined ? "—" : l === "kcal" ? r0(v) : r1(v)}</b><span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">{l}</span></div>)}</div>
          <button type="button" onClick={addFood} disabled={!preview} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-emerald/50 bg-emerald/15 px-4 py-2.5 text-sm font-medium text-emerald transition hover:bg-emerald/25 active:scale-95 disabled:opacity-40" data-testid="diario-adicionar"><Plus size={15} /> Adicionar em {mealLabel}</button></div>}
        {!food && <div className="mt-4"><p className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">Minhas opções</p>
          <div className="scroll-thin flex max-h-40 flex-wrap gap-1.5 overflow-y-auto" data-testid="diario-opcoes">{options.map((o) => <button key={o.food.id} type="button" onClick={() => pick(o.food, o.qty, o.unit)} data-testid={`opcao-alimento-${o.food.id}`} title={o.tag} className={`rounded-full border px-3 py-1.5 text-xs transition active:scale-95 ${o.tag === "meu alimento" ? "border-emerald/40 text-emerald hover:bg-emerald/10" : "border-white/10 hover:border-cyan/40"}`}>{o.food.nome}</button>)}</div></div>}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1"><button type="button" onClick={() => setCustom((o) => !o)} className="text-xs text-cyan underline-offset-2 hover:underline" data-testid="extra-abrir">{custom ? "Fechar cadastro" : "+ Cadastrar alimento com meus macros"}</button>
          {myFoods.length > 0 && <button type="button" onClick={() => setShowMine((o) => !o)} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" data-testid="meus-alimentos-abrir">Meus alimentos ({myFoods.length})</button>}</div>
        {custom && <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3" data-testid="extra-form"><input value={cf.nome} onChange={(e) => setCf({ ...cf, nome: e.target.value })} maxLength={80} placeholder="Nome (ex.: barra de proteína)" className={field} data-testid="extra-nome" />
          <div className="flex gap-1.5" role="radiogroup" aria-label="Os macros são">{([["100g", "por 100 g"], ["porcao", "por porção"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={cf.base === k} onClick={() => setCf({ ...cf, base: k })} data-testid={`extra-base-${k}`} className={chip(cf.base === k)}>{l}</button>)}</div>
          {cf.base === "porcao" && <div className="grid grid-cols-2 gap-2"><input value={cf.unidade} onChange={(e) => setCf({ ...cf, unidade: e.target.value })} maxLength={30} placeholder="Porção: barra, colher, scoop…" className={field} data-testid="extra-unidade" /><input inputMode="decimal" value={cf.gramas} onChange={(e) => setCf({ ...cf, gramas: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="Pesa quantas g? (opcional)" className={field} data-testid="extra-gramas" /></div>}
          <div className="grid grid-cols-4 gap-2">{([["kcal", "kcal"], ["p", "Prot. g"], ["c", "Carbo g"], ["f", "Gord. g"]] as const).map(([k, l]) => <label key={k} className="rounded-xl border border-white/10 bg-black/25 p-2 text-[0.6rem] uppercase tracking-wider text-muted-foreground">{l}<input inputMode="decimal" value={cf[k]} onChange={(e) => setCf({ ...cf, [k]: e.target.value.replace(/[^\d.,]/g, "") })} data-testid={`extra-${k}`} className="mt-0.5 block w-full bg-transparent text-center font-display text-lg font-semibold normal-case tabular-nums text-foreground outline-none" placeholder="0" /></label>)}</div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={cf.salvar} onChange={(e) => setCf({ ...cf, salvar: e.target.checked })} data-testid="extra-salvar-lib" /> Salvar em “Meus alimentos” para usar depois</label>
          <button type="button" onClick={() => void saveCustom()} disabled={foodActs.save.isPending} className="rounded-full border border-emerald/50 bg-emerald/15 px-4 py-2 text-xs font-medium text-emerald hover:bg-emerald/25 active:scale-95 disabled:opacity-50" data-testid="extra-salvar">Salvar e usar agora</button></div>}
        {showMine && <ul className="mt-3 space-y-1" data-testid="meus-alimentos">{myFoods.map((fd) => <li key={fd.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs"><button type="button" onClick={() => pick(fd)} className="min-w-0 flex-1 truncate text-left hover:text-emerald">{fd.nome}</button><span className="shrink-0 font-mono text-muted-foreground">{r0(fd.per100.kcal)} kcal/100 g</span><button type="button" aria-label={`Apagar ${fd.nome}`} onClick={() => { if (window.confirm(`Apagar “${fd.nome}” de Meus alimentos?`)) foodActs.remove.mutate(fd.id, { onError: (e) => toast.error(e.message) }); }} className="text-muted-foreground hover:text-rose-300"><Trash2 size={13} /></button></li>)}</ul>}
      </div>
    </div>, document.body);
}
