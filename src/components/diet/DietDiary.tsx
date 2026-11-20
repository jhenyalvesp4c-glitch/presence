/** Diário de alimentos: refeições do plano ou criadas por mim, alimento (da base, da busca ou cadastrado por mim com meus macros), quantidade em gramas/colheres/unidades; o sistema soma os macros do dia. */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookPlus, Plus, Search, Trash2, X } from "lucide-react";

import type { DietBundle } from "@/components/diet/DietHub";
import { useMyFoodActions, useMyFoods } from "@/lib/data/diet-plan";
import { FOODS, customFood, findFoods, foodForPlanItem, foodMacros, qtyLabel, type Food } from "@/lib/diet-foods";
import { customMealName, type DayLog, type Extra } from "@/lib/diet-plan";

const r0 = (n: number) => Math.round(n), r1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: string) => { const x = Number(v.replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : 0; };
const field = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition focus:border-amber/60";
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs transition active:scale-95 ${on ? "border-amber/60 bg-amber/15 text-amber" : "border-white/10 text-muted-foreground hover:text-foreground"}`;
const EMPTY = { nome: "", kcal: "", p: "", c: "", f: "", base: "100g" as "100g" | "porcao", unidade: "", gramas: "", salvar: true };

export function DietDiary({ b, cur, write }: { b: DietBundle; cur: DayLog; write: (p: Partial<DayLog>) => void }) {
  const { sum } = b, mine = useMyFoods(), myFoods = mine.data ?? [], foodActs = useMyFoodActions();
  const pool = useMemo(() => [...myFoods, ...FOODS], [myFoods]);
  const [pending, setPending] = useState<string[]>([]), [newMeal, setNewMeal] = useState<string | null>(null);
  const customNames = [...new Set([...cur.extras.map((e) => customMealName(e.meal)).filter((n): n is string => !!n), ...pending])];
  const meals = [...sum.opt.refeicoes.map((m) => ({ id: m.id, nome: m.nome })), ...customNames.map((n) => ({ id: `c:${n}`, nome: n })), { id: "outros", nome: "Outros" }];
  const [meal, setMeal] = useState(meals[0]!.id), [q, setQ] = useState(""), [food, setFood] = useState<Food | null>(null), [qty, setQty] = useState(""), [unit, setUnit] = useState("g"), [custom, setCustom] = useState(false), [cf, setCf] = useState(EMPTY), [showMine, setShowMine] = useState(false);
  const mealId = meals.some((m) => m.id === meal) ? meal : meals[0]!.id, mealLabel = meals.find((m) => m.id === mealId)?.nome ?? "";
  // "minhas opções": os alimentos do plano (com a quantidade do plano) + meus alimentos + os mais registrados antes
  const options = useMemo(() => {
    const seen = new Set<string>(), out: { food: Food; qty: number; unit: string; tag: string }[] = [];
    for (const fd of myFoods.slice(0, 12)) { seen.add(fd.id); out.push({ food: fd, qty: 1, unit: fd.medidas[0]?.nome ?? "g", tag: "meu alimento" }); }
    for (const m of sum.opt.refeicoes) for (const it of m.itens) { const fd = foodForPlanItem(it.alimento); if (!fd || seen.has(fd.id)) continue; seen.add(fd.id); const g = it.g ?? Number(it.qtd.match(/(\d+(?:[.,]\d+)?)\s*g\b/i)?.[1]?.replace(",", ".")); out.push({ food: fd, qty: Number.isFinite(g) && g ? g : 1, unit: Number.isFinite(g) && g ? "g" : fd.medidas[0]?.nome ?? "g", tag: m.nome }); }
    const freq = new Map<string, number>(); for (const l of b.logs) for (const e of l.extras) freq.set(e.nome, (freq.get(e.nome) ?? 0) + 1);
    for (const [nome] of [...freq].sort((a, c) => c[1] - a[1]).slice(0, 6)) { const fd = pool.find((x) => nome.toLowerCase().startsWith(x.nome.toLowerCase())); if (fd && !seen.has(fd.id)) { seen.add(fd.id); out.push({ food: fd, qty: 1, unit: fd.medidas[0]?.nome ?? "g", tag: "mais usados" }); } }
    return out;
  }, [sum.opt, b.logs, myFoods, pool]);
  const results = findFoods(q, 8, pool), preview = food && num(qty) ? foodMacros(food, num(qty), unit) : null;
  const pick = (fd: Food, quantity?: number, u?: string) => { setFood(fd); setUnit(u ?? fd.medidas[0]?.nome ?? "g"); setQty(quantity ? String(quantity).replace(".", ",") : ""); setQ(""); setCustom(false); };
  const add = (e: Omit<Extra, "id" | "meal">) => { write({ extras: [...cur.extras, { ...e, id: `${Date.now()}${Math.random().toString(36).slice(2, 5)}`, meal: mealId }] }); toast.success(`${e.nome} em ${mealLabel}`); };
  const addFood = () => { if (!food || !preview) return; add({ nome: food.nome, qtd: qtyLabel(num(qty), unit), ...preview }); setFood(null); setQty(""); };
  const createMeal = () => { const n = (newMeal ?? "").trim().slice(0, 40); if (!n) { setNewMeal(null); return; } if (!customNames.includes(n)) setPending((p) => [...p, n]); setMeal(`c:${n}`); setNewMeal(null); };
  const saveCustom = async (andUse: boolean) => {
    const p = num(cf.p), c = num(cf.c), g = num(cf.f), kcal = num(cf.kcal) || p * 4 + c * 4 + g * 9;
    if (!cf.nome.trim()) { toast.error("Dê um nome ao alimento."); return; }
    if (!kcal && !p && !c && !g) { toast.error("Informe os macros (ou as calorias)."); return; }
    const fd = customFood({ nome: cf.nome, kcal, p, c, f: g, base: cf.base, unidade: cf.unidade, gramas: num(cf.gramas) });
    if (cf.salvar) { try { await foodActs.save.mutateAsync(fd); toast.success("Salvo em Meus alimentos"); } catch (e) { toast.error(`Não consegui salvar: ${(e as Error).message}`); return; } }
    setCf(EMPTY); setCustom(false);
    if (andUse) pick(fd, 1, fd.medidas[0]?.nome ?? "g");
  };
  const byMeal = meals.map((m) => ({ ...m, items: cur.extras.filter((e) => (e.meal ?? "outros") === m.id) })).filter((m) => m.items.length);
  const orphan = cur.extras.filter((e) => !meals.some((m) => m.id === (e.meal ?? "outros")));
  const units = food ? [{ nome: "g", g: 1 }, ...food.medidas] : [];
  return (
    <section className="glass relative overflow-hidden rounded-3xl p-5" data-testid="dieta-diario">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em]"><BookPlus size={15} className="text-amber" />O que eu comi</h3>
      <p className="mt-1 text-xs text-muted-foreground">Escolha a refeição e o alimento, diga quanto (gramas, colheres, unidades) e o Orion soma tudo. Refeição com alimentos registrados vale pelo que você registrou, no lugar da porção do plano.</p>
      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Refeição">{meals.map((m) => <button key={m.id} type="button" role="tab" aria-selected={m.id === mealId} onClick={() => setMeal(m.id)} data-testid={`diario-refeicao-${m.id}`} className={chip(m.id === mealId)}>{m.nome}</button>)}
        {newMeal === null ? <button type="button" onClick={() => setNewMeal("")} className="rounded-full border border-dashed border-amber/50 px-3 py-1 text-xs text-amber transition hover:bg-amber/10 active:scale-95" data-testid="nova-refeicao"><Plus size={12} className="mr-1 inline" />Nova refeição</button>
          : <span className="inline-flex gap-1"><input autoFocus value={newMeal} onChange={(e) => setNewMeal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") createMeal(); if (e.key === "Escape") setNewMeal(null); }} placeholder="Ex.: Lanche da manhã" maxLength={40} className="w-44 rounded-full border border-amber/50 bg-black/25 px-3 py-1 text-xs outline-none" data-testid="nova-refeicao-nome" /><button type="button" onClick={createMeal} className="rounded-full border border-emerald/50 bg-emerald/15 px-3 py-1 text-xs text-emerald" data-testid="nova-refeicao-ok">Criar</button></span>}</div>
      <div className="mt-3"><p className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">Minhas opções</p>
        <div className="scroll-thin flex max-h-28 flex-wrap gap-1.5 overflow-y-auto" data-testid="diario-opcoes">{options.map((o) => <button key={o.food.id} type="button" onClick={() => pick(o.food, o.qty, o.unit)} data-testid={`opcao-alimento-${o.food.id}`} title={o.tag} className={`rounded-full border px-2.5 py-1 text-[0.7rem] transition active:scale-95 ${food?.id === o.food.id ? "border-amber/60 bg-amber/15 text-amber" : o.tag === "meu alimento" ? "border-emerald/40 text-emerald hover:bg-emerald/10" : "border-white/10 hover:border-amber/40"}`}>{o.food.nome}</button>)}</div></div>
      <label className="relative mt-3 block"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar outro alimento…" className={`${field} pl-9`} data-testid="diario-busca" /></label>
      {results.length > 0 && <ul className="mt-2 space-y-1" data-testid="diario-resultados">{results.map((fd) => <li key={fd.id}><button type="button" onClick={() => pick(fd)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-left text-xs transition hover:border-amber/40"><span>{fd.nome}{fd.alias === "meu" && <span className="ml-1.5 text-emerald">· meu</span>}</span><span className="font-mono text-muted-foreground">{r0(fd.per100.kcal)} kcal/100 g</span></button></li>)}</ul>}
      {food && <div className="mt-3 rounded-2xl border border-amber/30 bg-black/25 p-3" data-testid="diario-quantidade" style={{ animation: "fin-rise .35s both" }}>
        <div className="flex items-center justify-between"><b className="text-sm">{food.nome}</b><button type="button" aria-label="Cancelar" onClick={() => setFood(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button></div>
        <label className="mt-2 block text-[0.65rem] uppercase tracking-wider text-muted-foreground">Quanto?<input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className={`${field} mt-1 text-center font-display text-2xl`} data-testid="diario-qtd" autoFocus /></label>
        <p className="mb-1 mt-2 text-[0.65rem] uppercase tracking-wider text-muted-foreground">Em quê?</p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Unidade" data-testid="diario-unidades">{units.map((u) => <button key={u.nome} type="button" role="radio" aria-checked={unit === u.nome} onClick={() => setUnit(u.nome)} data-testid={`unidade-${u.nome}`} className={chip(unit === u.nome)}>{u.nome === "g" ? "gramas (g)" : u.nome}{u.nome !== "g" && <span className="opacity-60"> ≈{u.g} g</span>}</button>)}</div>
        {preview ? <p className="mt-2 text-xs text-muted-foreground" data-testid="diario-previa"><b className="text-amber">{r0(preview.kcal)} kcal</b> · P {r1(preview.p)} g · C {r1(preview.c)} g · G {r1(preview.f)} g</p> : <p className="mt-2 text-xs text-muted-foreground">Digite a quantidade para ver os macros.</p>}
        <button type="button" onClick={addFood} disabled={!preview} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald/50 bg-emerald/15 px-4 py-1.5 text-xs font-medium text-emerald transition hover:bg-emerald/25 active:scale-95 disabled:opacity-40" data-testid="diario-adicionar"><Plus size={13} /> Adicionar em {mealLabel}</button></div>}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1"><button type="button" onClick={() => setCustom((o) => !o)} className="text-xs text-amber underline-offset-2 hover:underline" data-testid="extra-abrir">{custom ? "Fechar cadastro" : "+ Cadastrar alimento com meus macros"}</button>
        {myFoods.length > 0 && <button type="button" onClick={() => setShowMine((o) => !o)} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" data-testid="meus-alimentos-abrir">Meus alimentos ({myFoods.length})</button>}</div>
      {custom && <div className="mt-2 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3" data-testid="extra-form"><input value={cf.nome} onChange={(e) => setCf({ ...cf, nome: e.target.value })} maxLength={80} placeholder="Nome (ex.: barra de proteína)" className={field} data-testid="extra-nome" />
        <div className="flex gap-1.5" role="radiogroup" aria-label="Os macros são">{([["100g", "por 100 g"], ["porcao", "por porção"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={cf.base === k} onClick={() => setCf({ ...cf, base: k })} data-testid={`extra-base-${k}`} className={chip(cf.base === k)}>{l}</button>)}</div>
        {cf.base === "porcao" && <div className="grid grid-cols-2 gap-2"><input value={cf.unidade} onChange={(e) => setCf({ ...cf, unidade: e.target.value })} maxLength={30} placeholder="Porção: barra, colher, scoop…" className={field} data-testid="extra-unidade" /><input inputMode="decimal" value={cf.gramas} onChange={(e) => setCf({ ...cf, gramas: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="Pesa quantas g? (opcional)" className={field} data-testid="extra-gramas" /></div>}
        <div className="grid grid-cols-4 gap-2">{([["kcal", "kcal"], ["p", "Prot. g"], ["c", "Carbo g"], ["f", "Gord. g"]] as const).map(([k, l]) => <label key={k} className="rounded-xl border border-white/10 bg-black/25 p-2 text-[0.6rem] uppercase tracking-wider text-muted-foreground">{l}<input inputMode="decimal" value={cf[k]} onChange={(e) => setCf({ ...cf, [k]: e.target.value.replace(/[^\d.,]/g, "") })} data-testid={`extra-${k}`} className="mt-0.5 block w-full bg-transparent text-center font-display text-lg font-semibold normal-case tabular-nums text-foreground outline-none" placeholder="0" /></label>)}</div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={cf.salvar} onChange={(e) => setCf({ ...cf, salvar: e.target.checked })} data-testid="extra-salvar-lib" /> Salvar em “Meus alimentos” para usar depois</label>
        <button type="button" onClick={() => void saveCustom(true)} disabled={foodActs.save.isPending} className="rounded-full border border-emerald/50 bg-emerald/15 px-4 py-1.5 text-xs font-medium text-emerald hover:bg-emerald/25 active:scale-95 disabled:opacity-50" data-testid="extra-salvar">Salvar e usar agora</button></div>}
      {showMine && <ul className="mt-2 space-y-1" data-testid="meus-alimentos">{myFoods.map((fd) => <li key={fd.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-xs"><button type="button" onClick={() => pick(fd)} className="min-w-0 flex-1 truncate text-left hover:text-emerald">{fd.nome}</button><span className="shrink-0 font-mono text-muted-foreground">{r0(fd.per100.kcal)} kcal/100 g</span><button type="button" aria-label={`Apagar ${fd.nome}`} onClick={() => { if (window.confirm(`Apagar “${fd.nome}” de Meus alimentos?`)) foodActs.remove.mutate(fd.id, { onError: (e) => toast.error(e.message) }); }} className="text-muted-foreground hover:text-rose-300"><Trash2 size={13} /></button></li>)}</ul>}
      {(byMeal.length > 0 || orphan.length > 0) && <div className="mt-4 space-y-3 border-t border-white/10 pt-3" data-testid="diario-lista">{[...byMeal, ...(orphan.length ? [{ id: "x", nome: "Outra opção", items: orphan }] : [])].map((m) => { const t = m.items.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p }), { kcal: 0, p: 0 }); return (
        <div key={m.id}><div className="mb-1 flex items-baseline justify-between text-xs"><b>{m.nome}</b><span className="font-mono text-muted-foreground">{r0(t.kcal)} kcal · P {r1(t.p)}</span></div>
          <ul className="space-y-1">{m.items.map((e) => <li key={e.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-xs"><span className="min-w-0 flex-1 truncate">{e.nome}{e.qtd ? <span className="text-muted-foreground"> · {e.qtd}</span> : null}</span><span className="shrink-0 font-mono text-muted-foreground">{r0(e.kcal)} kcal · P{r1(e.p)} C{r1(e.c)} G{r1(e.f)}</span><button type="button" aria-label={`Remover ${e.nome}`} onClick={() => write({ extras: cur.extras.filter((x) => x.id !== e.id) })} className="text-muted-foreground hover:text-foreground"><X size={13} /></button></li>)}</ul></div>); })}</div>}
    </section>
  );
}
