/** Diário de alimentos: escolher o alimento (das minhas opções ou da busca), informar gramas/colheres/unidades e o sistema soma os macros do dia. */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookPlus, Plus, Search, X } from "lucide-react";

import type { DietBundle } from "@/components/diet/DietHub";
import { FOODS, findFoods, foodForPlanItem, foodMacros, qtyLabel, type Food } from "@/lib/diet-foods";
import type { DayLog, Extra } from "@/lib/diet-plan";

const r0 = (n: number) => Math.round(n), r1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: string) => { const x = Number(v.replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : 0; };
const field = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none transition focus:border-amber/60";

export function DietDiary({ b, cur, write }: { b: DietBundle; cur: DayLog; write: (p: Partial<DayLog>) => void }) {
  const { plan, sum } = b, meals = [...sum.opt.refeicoes.map((m) => ({ id: m.id, nome: m.nome })), { id: "outros", nome: "Outros" }];
  const [meal, setMeal] = useState(meals[0]!.id), [q, setQ] = useState(""), [food, setFood] = useState<Food | null>(null), [qty, setQty] = useState(""), [unit, setUnit] = useState("g"), [custom, setCustom] = useState(false), [cf, setCf] = useState({ nome: "", kcal: "", p: "", c: "", f: "" });
  const mealId = meals.some((m) => m.id === meal) ? meal : meals[0]!.id;
  // "minhas opções": os alimentos do plano (com a quantidade do plano) + os mais registrados antes
  const mine = useMemo(() => {
    const seen = new Set<string>(), out: { food: Food; qty: number; unit: string; tag: string }[] = [];
    for (const m of sum.opt.refeicoes) for (const it of m.itens) { const fd = foodForPlanItem(it.alimento); if (!fd || seen.has(fd.id)) continue; seen.add(fd.id); const g = it.g ?? Number(it.qtd.match(/(\d+(?:[.,]\d+)?)\s*g\b/i)?.[1]?.replace(",", ".")); out.push({ food: fd, qty: Number.isFinite(g) && g ? g : 1, unit: Number.isFinite(g) && g ? "g" : fd.medidas[0]?.nome ?? "g", tag: m.nome }); }
    const freq = new Map<string, number>(); for (const l of b.logs) for (const e of l.extras) freq.set(e.nome, (freq.get(e.nome) ?? 0) + 1);
    for (const [nome] of [...freq].sort((a, c) => c[1] - a[1]).slice(0, 6)) { const fd = FOODS.find((x) => nome.toLowerCase().startsWith(x.nome.toLowerCase())); if (fd && !seen.has(fd.id)) { seen.add(fd.id); out.push({ food: fd, qty: 1, unit: fd.medidas[0]?.nome ?? "g", tag: "mais usados" }); } }
    return out;
  }, [sum.opt, b.logs]);
  const results = findFoods(q), preview = food && num(qty) ? foodMacros(food, num(qty), unit) : null;
  const pick = (fd: Food, quantity?: number, u?: string) => { setFood(fd); setUnit(u ?? "g"); setQty(quantity ? String(quantity).replace(".", ",") : ""); setQ(""); setCustom(false); };
  const add = (e: Omit<Extra, "id" | "meal">) => { write({ extras: [...cur.extras, { ...e, id: `${Date.now()}${Math.random().toString(36).slice(2, 5)}`, meal: mealId }] }); toast.success(`${e.nome} adicionado`); };
  const addFood = () => { if (!food || !preview) return; add({ nome: food.nome, qtd: qtyLabel(num(qty), unit), ...preview }); setFood(null); setQty(""); };
  const addCustom = () => { const p = num(cf.p), c = num(cf.c), g = num(cf.f); if (!cf.nome.trim()) { toast.error("Dê um nome ao alimento."); return; } add({ nome: cf.nome.trim(), qtd: "", kcal: num(cf.kcal) || p * 4 + c * 4 + g * 9, p, c, f: g }); setCf({ nome: "", kcal: "", p: "", c: "", f: "" }); };
  const byMeal = meals.map((m) => ({ ...m, items: cur.extras.filter((e) => (e.meal ?? "outros") === m.id) })).filter((m) => m.items.length);
  const orphan = cur.extras.filter((e) => !meals.some((m) => m.id === (e.meal ?? "outros")));
  return (
    <section className="glass relative overflow-hidden rounded-3xl p-5" data-testid="dieta-diario">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em]"><BookPlus size={15} className="text-amber" />O que eu comi</h3>
      <p className="mt-1 text-xs text-muted-foreground">Escolha o alimento, diga quanto (gramas, colheres, unidades) e o Orion soma tudo. Refeição com alimentos registrados vale pelo que você registrou, no lugar da porção do plano.</p>
      <div className="mt-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Refeição">{meals.map((m) => <button key={m.id} type="button" role="tab" aria-selected={m.id === mealId} onClick={() => setMeal(m.id)} data-testid={`diario-refeicao-${m.id}`} className={`rounded-full border px-3 py-1 text-xs transition active:scale-95 ${m.id === mealId ? "border-amber/60 bg-amber/15 text-amber" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{m.nome}</button>)}</div>
      <div className="mt-3"><p className="mb-1.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">Minhas opções</p>
        <div className="scroll-thin flex max-h-28 flex-wrap gap-1.5 overflow-y-auto" data-testid="diario-opcoes">{mine.map((o) => <button key={o.food.id} type="button" onClick={() => pick(o.food, o.qty, o.unit)} data-testid={`opcao-alimento-${o.food.id}`} title={o.tag} className={`rounded-full border px-2.5 py-1 text-[0.7rem] transition active:scale-95 ${food?.id === o.food.id ? "border-amber/60 bg-amber/15 text-amber" : "border-white/10 hover:border-amber/40"}`}>{o.food.nome}</button>)}</div></div>
      <label className="relative mt-3 block"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar outro alimento…" className={`${field} pl-9`} data-testid="diario-busca" /></label>
      {results.length > 0 && <ul className="mt-2 space-y-1" data-testid="diario-resultados">{results.map((fd) => <li key={fd.id}><button type="button" onClick={() => pick(fd, undefined, fd.medidas[0]?.nome ?? "g")} className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-1.5 text-left text-xs transition hover:border-amber/40"><span>{fd.nome}</span><span className="font-mono text-muted-foreground">{fd.per100.kcal} kcal/100 g</span></button></li>)}</ul>}
      {food && <div className="mt-3 rounded-2xl border border-amber/30 bg-black/25 p-3" data-testid="diario-quantidade" style={{ animation: "fin-rise .35s both" }}>
        <div className="flex items-center justify-between"><b className="text-sm">{food.nome}</b><button type="button" aria-label="Cancelar" onClick={() => setFood(null)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button></div>
        <div className="mt-2 flex gap-2"><input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="Quanto?" className={`${field} w-28 text-center font-display text-lg`} data-testid="diario-qtd" autoFocus />
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={`${field} flex-1`} data-testid="diario-unidade"><option value="g">gramas (g)</option>{food.medidas.map((m) => <option key={m.nome} value={m.nome}>{m.nome} (≈ {m.g} g)</option>)}</select></div>
        {preview ? <p className="mt-2 text-xs text-muted-foreground" data-testid="diario-previa"><b className="text-amber">{r0(preview.kcal)} kcal</b> · P {r1(preview.p)} g · C {r1(preview.c)} g · G {r1(preview.f)} g</p> : <p className="mt-2 text-xs text-muted-foreground">Digite a quantidade para ver os macros.</p>}
        <button type="button" onClick={addFood} disabled={!preview} className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald/50 bg-emerald/15 px-4 py-1.5 text-xs font-medium text-emerald transition hover:bg-emerald/25 active:scale-95 disabled:opacity-40" data-testid="diario-adicionar"><Plus size={13} /> Adicionar em {meals.find((m) => m.id === mealId)?.nome}</button></div>}
      <button type="button" onClick={() => setCustom((o) => !o)} className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" data-testid="extra-abrir">{custom ? "Fechar" : "Não achei: cadastrar com macros do rótulo"}</button>
      {custom && <div className="mt-2 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3" data-testid="extra-form"><input value={cf.nome} onChange={(e) => setCf({ ...cf, nome: e.target.value })} maxLength={80} placeholder="Nome (ex.: barra de proteína)" className={field} data-testid="extra-nome" />
        <div className="grid grid-cols-4 gap-2">{([["kcal", "kcal"], ["p", "Prot. g"], ["c", "Carbo g"], ["f", "Gord. g"]] as const).map(([k, l]) => <label key={k} className="rounded-xl border border-white/10 bg-black/25 p-2 text-[0.6rem] uppercase tracking-wider text-muted-foreground">{l}<input inputMode="decimal" value={cf[k]} onChange={(e) => setCf({ ...cf, [k]: e.target.value.replace(/[^\d.,]/g, "") })} data-testid={`extra-${k}`} className="mt-0.5 block w-full bg-transparent text-center font-display text-lg font-semibold normal-case tabular-nums text-foreground outline-none" placeholder="0" /></label>)}</div>
        <button type="button" onClick={addCustom} className="rounded-full border border-emerald/50 bg-emerald/15 px-4 py-1.5 text-xs font-medium text-emerald hover:bg-emerald/25 active:scale-95" data-testid="extra-salvar">Adicionar</button></div>}
      {(byMeal.length > 0 || orphan.length > 0) && <div className="mt-4 space-y-3 border-t border-white/10 pt-3" data-testid="diario-lista">{[...byMeal, ...(orphan.length ? [{ id: "x", nome: "Outra opção", items: orphan }] : [])].map((m) => { const t = m.items.reduce((a, e) => ({ kcal: a.kcal + e.kcal, p: a.p + e.p }), { kcal: 0, p: 0 }); return (
        <div key={m.id}><div className="mb-1 flex items-baseline justify-between text-xs"><b>{m.nome}</b><span className="font-mono text-muted-foreground">{r0(t.kcal)} kcal · P {r1(t.p)}</span></div>
          <ul className="space-y-1">{m.items.map((e) => <li key={e.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-xs"><span className="min-w-0 flex-1 truncate">{e.nome}{e.qtd ? <span className="text-muted-foreground"> · {e.qtd}</span> : null}</span><span className="shrink-0 font-mono text-muted-foreground">{r0(e.kcal)} kcal · P{r1(e.p)} C{r1(e.c)} G{r1(e.f)}</span><button type="button" aria-label={`Remover ${e.nome}`} onClick={() => write({ extras: cur.extras.filter((x) => x.id !== e.id) })} className="text-muted-foreground hover:text-foreground"><X size={13} /></button></li>)}</ul></div>); })}</div>}
    </section>
  );
}
