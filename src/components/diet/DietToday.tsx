/** Diário do dia (como um app de contagem de macros, no visual do Orion): navegar entre dias, metas e macros, refeições com alimentos em g/colheres, água e "como foi o dia". */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Droplets, Minus, MoreVertical, Plus, Repeat, Target, Undo2, X } from "lucide-react";

import { DietAiBox } from "@/components/diet/DietAiBox";
import { AddFoodSheet, type NewEntry } from "@/components/diet/AddFoodSheet";
import { emptyDay, type DietBundle } from "@/components/diet/DietHub";
import { Meter, Ring } from "@/components/finance/charts";
import { Burst } from "@/components/ideas/fx";
import { backdropProps } from "@/lib/backdrop";
import { customMealName, daySummary, mealMacros, sumMacros, swapsFor, type DayLog, type DietMeal, type Macros, type Swap } from "@/lib/diet-plan";

const SCALES: { key: "fullness" | "difficulty" | "energy" | "training" | "discomfort"; label: string; lo: string; hi: string; good: "high" | "low" }[] = [
  { key: "fullness", label: "Estômago cheio", lo: "leve", hi: "pesado", good: "low" }, { key: "difficulty", label: "Facilidade de cumprir", lo: "difícil", hi: "fácil", good: "high" },
  { key: "energy", label: "Energia", lo: "baixa", hi: "alta", good: "high" }, { key: "training", label: "Treino", lo: "fraco", hi: "forte", good: "high" }, { key: "discomfort", label: "Desconforto digestivo", lo: "nenhum", hi: "muito", good: "low" },
];
const toneOf = (v: number, good: "high" | "low") => { const s = good === "high" ? v : 6 - v; return s >= 4 ? "var(--emerald)" : s === 3 ? "var(--cyan)" : "oklch(0.78 0.16 70)"; };
const r0 = (n: number) => Math.round(n), r1 = (n: number) => Math.round(n * 10) / 10;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shift = (s: string, n: number) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const SUGGEST = ["Café da manhã", "Lanche da manhã", "Lanche da tarde", "Pré-treino", "Pós-treino", "Ceia"];
const C = { p: "var(--emerald)", c: "var(--cyan)", f: "var(--violet)", k: "var(--amber)" };

function MacroBar({ label, value, goal, color, unit = "g" }: { label: string; value: number; goal: number | null; color: string; unit?: string }) {
  return (
    <div><div className="flex items-baseline justify-between text-[0.7rem]"><span className="uppercase tracking-wider text-muted-foreground">{label}</span><span className="font-mono tabular-nums"><b style={{ color }}>{r0(value)}</b><span className="text-muted-foreground"> / {goal ?? "—"} {unit}</span></span></div>
      <div className="mt-1"><Meter pct={goal ? (value / goal) * 100 : 0} color={color} warn={false} height={7} /></div></div>
  );
}

function MetasDialog({ b, onClose }: { b: DietBundle; onClose: () => void }) {
  const m = b.plan.metas, [v, setV] = useState({ kcal: String(m.kcal ?? ""), p: String(m.p ?? ""), c: String(m.c ?? ""), f: String(m.f ?? "") });
  const n = (s: string) => { const x = Number(s.replace(",", ".")); return Number.isFinite(x) && x > 0 ? x : null; };
  const save = () => { b.actions.savePlan.mutate({ plan: { ...b.plan, metas: { kcal: n(v.kcal), p: n(v.p), c: n(v.c), f: n(v.f) } } }, { onSuccess: () => { toast.success("Metas salvas"); onClose(); }, onError: (e) => toast.error(e.message) }); };
  const auto = n(v.p) && n(v.c) && n(v.f) ? Math.round(n(v.p)! * 4 + n(v.c)! * 4 + n(v.f)! * 9) : null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/80 p-0 backdrop-blur-md sm:items-center sm:p-6" {...backdropProps(onClose)} data-testid="metas-dialogo">
      <div onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md rounded-t-[2rem] p-6 sm:rounded-[2rem]" style={{ animation: "fin-rise .4s both" }}>
        <div className="flex items-start justify-between"><div><p className="mono-caps">Metas do dia</p><h2 className="font-display text-2xl font-semibold">Quanto eu quero comer?</h2></div><button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button></div>
        <p className="mt-1 text-xs text-muted-foreground">A ficha não traz meta calórica. Defina a sua (com o nutricionista) para as barras do dia.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">{([["kcal", "Calorias (kcal)", C.k], ["p", "Proteína (g)", C.p], ["c", "Carboidrato (g)", C.c], ["f", "Gordura (g)", C.f]] as const).map(([k, l, c]) => <label key={k} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-[0.65rem] uppercase tracking-wider text-muted-foreground focus-within:border-cyan/50">{l}<input inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value.replace(/[^\d.,]/g, "") })} placeholder={k === "p" ? `${b.plan.proteina.min ?? ""}` : "—"} data-testid={`meta-${k}`} className="mt-1 block w-full bg-transparent text-center font-display text-3xl font-semibold normal-case tabular-nums outline-none" style={{ color: v[k] ? c : undefined }} /></label>)}</div>
        {auto && <button type="button" onClick={() => setV({ ...v, kcal: String(auto) })} className="mt-3 text-xs text-cyan underline-offset-2 hover:underline">Calcular calorias pelos macros: {auto} kcal</button>}
        <button type="button" onClick={save} disabled={b.actions.savePlan.isPending} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2.5 text-sm font-medium text-emerald transition hover:bg-emerald/25 active:scale-95 disabled:opacity-50" data-testid="metas-salvar">Salvar metas</button>
      </div>
    </div>, document.body);
}

type CardMeal = { id: string; nome: string; hora: string; plan: DietMeal | null; custom: boolean };
function MealCard({ meal, cur, b, delay, onAdd, onWrite }: { meal: CardMeal; cur: DayLog; b: DietBundle; delay: number; onAdd: () => void; onWrite: (p: Partial<DayLog>) => void }) {
  const [menu, setMenu] = useState(false), [open, setOpen] = useState(false), pm = meal.plan, entries = cur.extras.filter((e) => (e.meal ?? "outros") === meal.id), done = !!pm && cur.mealsDone.includes(pm.id);
  const m: Macros = entries.length ? sumMacros(entries) : pm && done ? mealMacros(pm, cur.swaps) : { kcal: 0, p: 0, c: 0, f: 0 };
  const swaps = cur.swaps, changed = !!pm && pm.itens.some((_, i) => swaps[`${pm.id}|${i}`]);
  const setSwap = (key: string, sw: Swap | null) => { const next = { ...swaps }; if (sw) next[key] = sw; else delete next[key]; onWrite({ swaps: next }); };
  const toggleDone = () => { if (!pm) return; onWrite({ mealsDone: done ? cur.mealsDone.filter((x) => x !== pm.id) : [...cur.mealsDone, pm.id] }); };
  const rename = () => { const n = window.prompt("Novo nome da refeição", meal.nome)?.trim().slice(0, 40); if (!n || n === meal.nome) return; const nid = `c:${n}`; onWrite({ customMeals: cur.customMeals.map((x) => (x === meal.nome ? n : x)), extras: cur.extras.map((e) => (e.meal === meal.id ? { ...e, meal: nid } : e)) }); };
  const remove = () => { if (entries.length && !window.confirm(`Excluir “${meal.nome}” e os ${entries.length} alimento(s) registrados?`)) return; onWrite({ customMeals: cur.customMeals.filter((x) => x !== meal.nome), extras: cur.extras.filter((e) => e.meal !== meal.id) }); };
  return (
    <article className={`glass relative rounded-3xl p-4 transition ${done || entries.length ? "border-emerald/30" : ""}`} style={{ animation: "fin-rise .5s both", animationDelay: `${delay}ms` }} data-testid={`refeicao-${meal.id}`}>
      <header className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-display text-lg font-semibold">{meal.nome}</h3>{meal.hora && <p className="font-mono text-[0.68rem] text-emerald">{meal.hora}{pm?.objetivo ? <span className="font-body text-muted-foreground"> · {pm.objetivo}</span> : null}</p>}</div>
        <div className="relative"><button type="button" aria-label={`Opções de ${meal.nome}`} onClick={() => setMenu((o) => !o)} className="rounded-full p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground" data-testid={`menu-${meal.id}`}><MoreVertical size={18} /></button>
          {menu && <><span className="fixed inset-0 z-10" onClick={() => setMenu(false)} /><ul className="absolute right-0 top-9 z-20 w-56 overflow-hidden rounded-2xl border border-white/10 bg-popover p-1 text-sm shadow-xl" onClick={() => setMenu(false)}>
            {pm && <li><button type="button" onClick={toggleDone} className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10" data-testid={`plano-feito-${meal.id}`}>{done ? "Desmarcar porção do plano" : "Comi a porção do plano"}</button></li>}
            {meal.custom && <li><button type="button" onClick={rename} className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10">Renomear</button></li>}
            {entries.length > 0 && !meal.custom && <li><button type="button" onClick={() => onWrite({ extras: cur.extras.filter((e) => e.meal !== meal.id) })} className="w-full rounded-xl px-3 py-2 text-left hover:bg-white/10">Limpar alimentos registrados</button></li>}
            {meal.custom && <li><button type="button" onClick={remove} className="w-full rounded-xl px-3 py-2 text-left text-rose-300 hover:bg-white/10" data-testid={`excluir-${meal.id}`}>Excluir refeição</button></li>}</ul></>}</div></header>
      <dl className="mt-3 grid grid-cols-4 gap-1 border-y border-white/10 py-2.5 text-center" data-testid={`totais-${meal.id}`}>{([["Carboidratos", m.c, C.c], ["Proteína", m.p, C.p], ["Gordura", m.f, C.f], ["Calorias", m.kcal, C.k]] as const).map(([l, v, c]) => <div key={l}><dd className="font-display text-xl font-semibold tabular-nums" style={{ color: v > 0 ? c : undefined }}>{r0(v)}</dd><dt className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">{l}</dt></div>)}</dl>
      {entries.length > 0 && <ul className="mt-3 space-y-1.5">{entries.map((e) => <li key={e.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"><span className="min-w-0 flex-1"><span className="block truncate">{e.nome}</span>{e.qtd && <span className="block text-[0.68rem] text-muted-foreground">{e.qtd}</span>}</span><span className="shrink-0 text-right font-mono text-[0.68rem] text-muted-foreground"><b className="text-amber">{r0(e.kcal)} kcal</b><br />P{r1(e.p)} C{r1(e.c)} G{r1(e.f)}</span><button type="button" aria-label={`Remover ${e.nome}`} onClick={() => onWrite({ extras: cur.extras.filter((x) => x.id !== e.id) })} className="text-muted-foreground hover:text-foreground"><X size={14} /></button></li>)}</ul>}
      <button type="button" onClick={onAdd} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan/30 bg-cyan/5 py-2.5 text-sm font-medium text-cyan transition hover:bg-cyan/15 active:scale-[0.98]" data-testid={`adicionar-${meal.id}`}><span className="grid h-5 w-5 place-items-center rounded-full bg-cyan text-[#04121a]"><Plus size={13} strokeWidth={3} /></span> Adicionar alimento</button>
      {pm && <div className="mt-3"><button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" data-testid={`plano-${meal.id}`}><Repeat size={12} /> {open ? "Esconder o plano" : `Ver o plano desta refeição${done ? " (feita)" : ""}`}{changed && <span className="rounded-full bg-cyan/15 px-1.5 text-cyan">com trocas</span>}</button>
        {open && <div className="mt-2 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs" data-testid={`trocas-${meal.id}`} style={{ animation: "fin-rise .35s both" }}>
          <ul className="space-y-1.5">{pm.itens.map((i, idx) => { const key = `${pm.id}|${idx}`, sw = swaps[key], s = swapsFor(b.plan, i.alimento); return (
            <li key={key} className="border-b border-white/5 pb-1.5 last:border-0"><div className="flex items-baseline justify-between gap-3 text-sm">{sw ? <span className="min-w-0"><b className="text-cyan">{sw.alimento}</b> <span className="text-xs text-muted-foreground line-through">{i.alimento}</span></span> : <span>{i.alimento}</span>}<span className="shrink-0 font-mono text-xs text-muted-foreground">{sw ? sw.porcao : i.qtd}</span></div>
              {(s.grupo || sw) && <details className="mt-1"><summary className="cursor-pointer text-[0.7rem] text-muted-foreground hover:text-foreground" data-testid={`trocar-${meal.id}-${idx}`}>Posso trocar?{sw && <button type="button" onClick={(e) => { e.preventDefault(); setSwap(key, null); }} className="ml-2 inline-flex items-center gap-1 text-cyan"><Undo2 size={10} /> voltar</button>}</summary>
                {s.tabela.length > 0 && <p className="mt-1 text-muted-foreground">Sugestão da ficha: {s.tabela.join(" · ")}</p>}
                {s.grupo && <div className="mt-1 flex flex-wrap gap-1.5">{s.grupo.opcoes.map((o) => { const on = sw?.alimento === o.alimento; return <button key={o.alimento} type="button" aria-pressed={on} onClick={() => setSwap(key, on ? null : { alimento: o.alimento, porcao: o.porcao, grupo: s.grupo!.nome })} data-testid={`troca-${o.alimento}`} className={`rounded-full border px-2.5 py-1 transition active:scale-95 ${on ? "border-cyan/60 bg-cyan/15 text-cyan" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{o.alimento} <span className="opacity-60">· {o.porcao}</span></button>; })}</div>}</details>}</li>); })}</ul>
          {pm.orientacoes.map((o) => <p key={o} className="text-muted-foreground">• {o}</p>)}
          <button type="button" onClick={toggleDone} aria-pressed={done} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition active:scale-95 ${done ? "border-emerald bg-emerald/20 text-emerald" : "border-white/15 hover:border-emerald/50"}`}>{done && <Check size={13} />} {done ? "Porção do plano marcada" : "Comi a porção do plano"}</button></div>}</div>}
    </article>
  );
}

export function DietToday({ b }: { b: DietBundle }) {
  const { plan, today } = b, save = b.actions.saveDay.mutate, [date, setDate] = useState(today), [adding, setAdding] = useState<string | null>(null), [metas, setMetas] = useState(false), [naming, setNaming] = useState<string | null>(null), [burst, setBurst] = useState(0);
  const stored = b.logs.find((l) => l.date === date) ?? null, base = daySummary(plan, stored), opt = base.opt;
  const cur: DayLog = stored ?? emptyDay(date, opt.id), sum = daySummary(plan, cur), m = sum.macros;
  const [note, setNote] = useState(cur.notes), tm = useRef<ReturnType<typeof setTimeout> | null>(null), wr = useRef<(p: Partial<DayLog>) => void>(() => {});
  useEffect(() => { setNote(stored?.notes ?? ""); }, [stored?.notes, date]);
  const write = (patch: Partial<DayLog>) => save({ ...cur, optionId: cur.optionId ?? opt.id, ...patch }, { onError: (e) => toast.error(e.message) });
  wr.current = write;
  const goalP = plan.metas.p ?? plan.proteina.min ?? plan.proteina.max, goalK = plan.metas.kcal, water = cur.waterMl ?? 0;
  const customNames = [...new Set([...cur.customMeals, ...cur.extras.map((e) => customMealName(e.meal)).filter((n): n is string => !!n)])];
  const cards: CardMeal[] = [...opt.refeicoes.map((x) => ({ id: x.id, nome: x.nome, hora: x.hora, plan: x, custom: false })), ...customNames.map((n) => ({ id: `c:${n}`, nome: n, hora: "", plan: null, custom: true })), ...(cur.extras.some((e) => (e.meal ?? "outros") === "outros") ? [{ id: "outros", nome: "Outros", hora: "", plan: null, custom: false }] : [])];
  const newMeal = (n0: string) => { const n = n0.trim().slice(0, 40); if (!n) { setNaming(null); return; } if (!cards.some((c) => c.nome.toLowerCase() === n.toLowerCase())) write({ customMeals: [...cur.customMeals, n] }); setNaming(null); };
  const label = date === today ? "Hoje" : date === shift(today, -1) ? "Ontem" : new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const addEntry = (e: NewEntry) => { if (!adding) return; write({ extras: [...cur.extras, { ...e, id: `${Date.now()}${Math.random().toString(36).slice(2, 5)}`, meal: adding }] }); setBurst((n) => n + 1); };
  const addingCard = cards.find((c) => c.id === adding);
  return (
    <div className="space-y-5" data-testid="dieta-hoje">
      <section className="glass fin-frame relative overflow-hidden rounded-3xl p-4 sm:p-5" data-testid="dieta-macros">
        <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber opacity-10 blur-3xl" />
        <div className="relative flex items-center justify-between gap-2"><button type="button" aria-label="Dia anterior" onClick={() => setDate(shift(date, -1))} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 hover:bg-white/10 active:scale-90" data-testid="dia-anterior"><ChevronLeft size={18} /></button>
          <button type="button" onClick={() => setDate(today)} className="text-center" data-testid="dia-atual"><span className="block font-display text-2xl font-semibold capitalize">{label}</span><span className="block font-mono text-[0.68rem] text-muted-foreground">{date.split("-").reverse().join("/")}{date !== today ? " · voltar para hoje" : ""}</span></button>
          <button type="button" aria-label="Próximo dia" disabled={date >= today} onClick={() => setDate(shift(date, 1))} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 hover:bg-white/10 active:scale-90 disabled:opacity-30" data-testid="dia-proximo"><ChevronRight size={18} /></button></div>
        <div className="relative mt-4 grid items-center gap-4 sm:grid-cols-[auto_1fr]">
          <div className="mx-auto"><Ring pct={goalK ? (m.kcal / goalK) * 100 : sum.done / Math.max(1, sum.total) * 100} color="var(--amber)" size={118} thickness={9}><div className="text-center"><b className="block font-display text-2xl tabular-nums" data-testid="macros-kcal">{r0(m.kcal)}<span className="sr-only"> kcal</span></b><span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">{goalK ? `de ${goalK} kcal` : "kcal"}</span></div></Ring></div>
          <div className="space-y-2.5"><MacroBar label="Proteína" value={m.p} goal={goalP} color={C.p} /><MacroBar label="Carboidrato" value={m.c} goal={plan.metas.c} color={C.c} /><MacroBar label="Gordura" value={m.f} goal={plan.metas.f} color={C.f} /></div></div>
        <div className="relative mt-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{sum.done}/{sum.total} refeições · estimativa pelos alimentos registrados</span>
          <button type="button" onClick={() => setMetas(true)} className="inline-flex items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-3 py-1.5 text-amber transition hover:bg-amber/20 active:scale-95" data-testid="metas-abrir"><Target size={13} /> Metas</button></div>
      </section>

      <div className="glass rounded-3xl p-4" data-testid="dieta-opcoes"><p className="mono-caps mb-2">Qual opção você está fazendo?</p>
        <div className="grid gap-2 sm:grid-cols-2">{plan.opcoes.map((o) => { const on = o.id === opt.id; return (
          <button key={o.id} type="button" aria-pressed={on} onClick={() => write({ optionId: o.id, mealsDone: cur.mealsDone.filter((id) => o.refeicoes.some((x) => x.id === id)) })} data-testid={`opcao-${o.id}`} className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${on ? "border-emerald/60 bg-emerald/10 shadow-[0_0_28px_-8px_var(--emerald)]" : "border-white/10 hover:border-white/25"}`}>
            <span className="block font-display text-base font-semibold">{o.nome}</span><span className="block text-xs text-muted-foreground">{o.tag}</span>{o.recomendada && <span className="mt-1 inline-block rounded-full bg-emerald/20 px-2 py-0.5 text-[0.62rem] text-emerald">recomendada p/ experimentar</span>}</button>); })}</div></div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="relative space-y-4" data-testid="dieta-refeicoes">
          <DietAiBox plan={opt.refeicoes} customNames={customNames} cur={cur} write={write} defaultMeal={opt.refeicoes.find((x) => !cur.mealsDone.includes(x.id) && !cur.extras.some((e) => e.meal === x.id))?.nome ?? "Outros"} />
          {cards.map((c, i) => <MealCard key={c.id} meal={c} cur={cur} b={b} delay={i * 70} onAdd={() => setAdding(c.id)} onWrite={write} />)}
          {burst > 0 && <span key={burst} className="pointer-events-none absolute right-6 top-2"><Burst /></span>}
          {naming === null ? <button type="button" onClick={() => setNaming("")} className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-amber/40 py-4 text-sm font-medium text-amber transition hover:bg-amber/10 active:scale-[0.99]" data-testid="nova-refeicao"><Plus size={16} /> Nova refeição</button>
            : <div className="glass rounded-3xl p-4" data-testid="nova-refeicao-form" style={{ animation: "fin-rise .35s both" }}><p className="mono-caps mb-2">Nome da refeição</p><div className="flex gap-2"><input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") newMeal(naming); if (e.key === "Escape") setNaming(null); }} maxLength={40} placeholder="Ex.: Lanche da manhã" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-amber/60" data-testid="nova-refeicao-nome" /><button type="button" onClick={() => newMeal(naming)} className="rounded-full border border-emerald/50 bg-emerald/15 px-4 text-sm text-emerald" data-testid="nova-refeicao-ok">Criar</button><button type="button" aria-label="Cancelar" onClick={() => setNaming(null)} className="text-muted-foreground"><X size={16} /></button></div>
              <div className="mt-2 flex flex-wrap gap-1.5">{SUGGEST.filter((s) => !cards.some((c) => c.nome === s)).map((s) => <button key={s} type="button" onClick={() => newMeal(s)} className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-muted-foreground hover:border-amber/40 hover:text-foreground">{s}</button>)}</div></div>}
        </div>
        <div className="space-y-4">
          <section className="glass rounded-3xl p-5" data-testid="dieta-agua"><div className="flex items-baseline justify-between"><h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em]"><Droplets size={15} className="text-cyan" />Água</h3><span className="font-display text-2xl font-semibold tabular-nums text-cyan">{(water / 1000).toFixed(2).replace(".", ",")}<span className="text-sm text-muted-foreground"> L</span></span></div>
            <div className="mt-3 flex gap-1.5">{Array.from({ length: 8 }, (_, i) => <span key={i} className={`h-8 flex-1 rounded-md border transition ${water >= (i + 1) * 250 ? "border-cyan/60 bg-cyan/40 shadow-[0_0_12px_-2px_var(--cyan)]" : "border-white/10 bg-white/[0.03]"}`} />)}</div>
            <div className="mt-3 flex flex-wrap gap-2">{[250, 500].map((ml) => <button key={ml} type="button" onClick={() => write({ waterMl: water + ml })} className="rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-xs text-cyan transition hover:bg-cyan/20 active:scale-95" data-testid={`agua-${ml}`}>+ {ml} ml</button>)}<button type="button" onClick={() => write({ waterMl: Math.max(0, water - 250) })} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted-foreground active:scale-95">− 250</button></div>
            <p className="mt-2 text-xs text-muted-foreground">Sem meta rígida: suba aos poucos{plan.hidratacao.atualMl ? ` (antes você bebia ≈ ${(plan.hidratacao.atualMl / 1000).toFixed(1).replace(".", ",")} L)` : ""}.</p></section>
          <section className="glass rounded-3xl p-5" data-testid="dieta-proteina"><div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">Proteína extra sem cadastrar (whey, ovo…)</span><span className="flex items-center gap-2"><button type="button" aria-label="Menos 5 g" onClick={() => write({ extraProteinG: Math.max(0, (cur.extraProteinG ?? 0) - 5) })} className="grid h-7 w-7 place-items-center rounded-full border border-white/10 active:scale-90"><Minus size={12} /></button><b className="w-12 text-center font-mono">{cur.extraProteinG ?? 0} g</b><button type="button" aria-label="Mais 5 g" onClick={() => write({ extraProteinG: (cur.extraProteinG ?? 0) + 5 })} className="grid h-7 w-7 place-items-center rounded-full border border-white/10 active:scale-90" data-testid="proteina-mais"><Plus size={12} /></button></span></div></section>
          <section className="glass rounded-3xl p-5" data-testid="dieta-dia"><h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.16em]">Como foi o dia</h3>
            <div className="space-y-3">{SCALES.map((s) => { const v = cur[s.key]; return (
              <div key={s.key}><div className="mb-1 flex items-baseline justify-between text-xs"><span>{s.label}</span><span className="text-[0.65rem] text-muted-foreground">{s.lo} ↔ {s.hi}</span></div>
                <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => { const on = v === n, c = toneOf(n, s.good); return <button key={n} type="button" aria-pressed={on} aria-label={`${s.label} ${n}`} onClick={() => write({ [s.key]: on ? null : n } as Partial<DayLog>)} data-testid={`dia-${s.key}-${n}`} className="h-9 flex-1 rounded-lg border text-sm font-semibold tabular-nums transition active:scale-90" style={{ borderColor: on ? c : "rgba(255,255,255,.1)", background: on ? `color-mix(in oklab, ${c} 22%, transparent)` : "transparent", color: on ? c : undefined, boxShadow: on ? `0 0 16px -4px ${c}` : undefined }}>{n}</button>; })}</div></div>); })}
              <div className="flex items-center justify-between text-xs"><span>Evacuou?</span><div className="flex gap-1.5">{([[true, "Sim"], [false, "Não"]] as const).map(([val, l]) => <button key={l} type="button" aria-pressed={cur.bowel === val} onClick={() => write({ bowel: cur.bowel === val ? null : val })} className={`rounded-full border px-3 py-1 transition active:scale-95 ${cur.bowel === val ? "border-emerald/60 bg-emerald/15 text-emerald" : "border-white/10 text-muted-foreground"}`}>{l}</button>)}</div></div>
              <textarea value={note} onChange={(e) => { setNote(e.target.value); if (tm.current) clearTimeout(tm.current); tm.current = setTimeout(() => wr.current({ notes: e.target.value }), 700); }} rows={2} maxLength={2000} placeholder="Observações do dia…" className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-emerald/60" data-testid="dia-obs" /></div></section>
        </div>
      </div>
      {adding && addingCard && <AddFoodSheet b={{ ...b, sum }} mealLabel={addingCard.nome} onAdd={addEntry} onClose={() => setAdding(null)} />}
      {metas && <MetasDialog b={b} onClose={() => setMetas(false)} />}
    </div>
  );
}
