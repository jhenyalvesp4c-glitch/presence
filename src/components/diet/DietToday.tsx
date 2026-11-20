/** Hoje na dieta: escolher a opção, marcar as refeições, proteína estimada, água e "como foi o dia". */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Droplets, Flame, Minus, Plus, Repeat, Undo2, X } from "lucide-react";

import { Meter } from "@/components/finance/charts";
import { Burst } from "@/components/ideas/fx";
import { DietDiary } from "@/components/diet/DietDiary";
import { emptyDay, type DietBundle } from "@/components/diet/DietHub";
import { groupKcal, mealMacros, swapsFor, type DayLog, type DietMeal, type Extra, type Swap } from "@/lib/diet-plan";

const SCALES: { key: "fullness" | "difficulty" | "energy" | "training" | "discomfort"; label: string; lo: string; hi: string; good: "high" | "low" }[] = [
  { key: "fullness", label: "Estômago cheio", lo: "leve", hi: "pesado", good: "low" }, { key: "difficulty", label: "Facilidade de cumprir", lo: "difícil", hi: "fácil", good: "high" },
  { key: "energy", label: "Energia", lo: "baixa", hi: "alta", good: "high" }, { key: "training", label: "Treino", lo: "fraco", hi: "forte", good: "high" }, { key: "discomfort", label: "Desconforto digestivo", lo: "nenhum", hi: "muito", good: "low" },
];
const toneOf = (v: number, good: "high" | "low") => { const s = good === "high" ? v : 6 - v; return s >= 4 ? "var(--emerald)" : s === 3 ? "var(--cyan)" : "oklch(0.78 0.16 70)"; };

function MealCard({ m, done, onToggle, plan, delay, swaps, onSwap }: { m: DietMeal; done: boolean; onToggle: () => void; plan: DietBundle["plan"]; delay: number; swaps: Record<string, Swap>; onSwap: (key: string, sw: Swap | null) => void }) {
  const [open, setOpen] = useState(false), mm = mealMacros(m, swaps), p = Math.round(mm.p), changed = m.itens.some((_, i) => swaps[`${m.id}|${i}`]);
  return (
    <article className={`relative overflow-hidden rounded-2xl border p-4 transition ${done ? "border-emerald/50 bg-emerald/10" : "border-white/10 bg-black/25"}`} style={{ animation: "fin-rise .5s both", animationDelay: `${delay}ms` }} data-testid={`refeicao-${m.id}`}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={onToggle} aria-pressed={done} aria-label={`${done ? "Desmarcar" : "Marcar"} ${m.nome}`} className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border transition active:scale-90 ${done ? "border-emerald bg-emerald text-[#04121a] shadow-[0_0_18px_var(--emerald)]" : "border-white/20 hover:border-emerald/60"}`}>{done && <Check size={16} strokeWidth={3} />}</button>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-display text-lg font-semibold">{m.nome}</h3><span className="font-mono text-xs text-emerald">{m.hora}</span></div>
          {m.objetivo && <p className="text-xs text-muted-foreground">{m.objetivo}</p>}
          <ul className="mt-3 space-y-1.5">{m.itens.map((i, idx) => { const sw = swaps[`${m.id}|${idx}`]; return <li key={i.alimento} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1.5 text-sm last:border-0">{sw ? <span className="min-w-0"><b className="text-cyan">{sw.alimento}</b> <span className="text-xs text-muted-foreground line-through">{i.alimento}</span></span> : <span>{i.alimento}</span>}<span className="shrink-0 font-mono text-xs text-muted-foreground">{sw ? sw.porcao : i.qtd}</span></li>; })}</ul>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.7rem]"><span className="rounded-full border border-emerald/30 bg-emerald/10 px-2 py-0.5 text-emerald">≈ {p} g proteína</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-muted-foreground">≈ {Math.round(mm.kcal)} kcal</span>{changed && <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-cyan">com trocas</span>}
            <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-muted-foreground hover:text-foreground" data-testid={`trocar-${m.id}`}><Repeat size={11} /> {open ? "Fechar trocas" : "Posso trocar?"}</button></div>
          {m.orientacoes.length > 0 && <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">{m.orientacoes.map((o) => <li key={o}>{o}</li>)}</ul>}
          {open && <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs" data-testid={`trocas-${m.id}`}>{m.itens.map((i, idx) => { const key = `${m.id}|${idx}`, sw = swaps[key], s = swapsFor(plan, i.alimento); if (!s.grupo && !s.tabela.length) return null; return (
            <div key={key}><div className="mb-1.5 flex items-center justify-between gap-2"><b>{i.alimento}</b>{sw && <button type="button" onClick={() => onSwap(key, null)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Undo2 size={11} /> voltar ao original</button>}</div>
              {s.tabela.length > 0 && <p className="mb-1.5 text-muted-foreground">Sugestão da ficha: {s.tabela.join(" · ")}</p>}
              {s.grupo && <div className="flex flex-wrap gap-1.5"><span className="w-full text-[0.65rem] uppercase tracking-wider text-muted-foreground">{s.grupo.nome}</span>{s.grupo.opcoes.map((o) => { const on = sw?.alimento === o.alimento; return <button key={o.alimento} type="button" aria-pressed={on} onClick={() => onSwap(key, on ? null : { alimento: o.alimento, porcao: o.porcao, grupo: s.grupo!.nome })} data-testid={`troca-${o.alimento}`} className={`rounded-full border px-2.5 py-1 transition active:scale-95 ${on ? "border-cyan/60 bg-cyan/15 text-cyan" : "border-white/10 text-muted-foreground hover:border-white/30 hover:text-foreground"}`}>{o.alimento} <span className="opacity-60">· {o.porcao}</span></button>; })}</div>}
            </div>); })}</div>}
        </div>
      </div>
    </article>
  );
}

const MC = { p: "var(--emerald)", c: "var(--cyan)", f: "var(--amber)" };
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Macros do dia: calorias, proteína/carbo/gordura e o cadastro de alimentos extras. */
function MacrosPanel({ b }: { b: DietBundle }) {
  const { plan, sum } = b, m = sum.macros;
  const kcalFromMacros = m.p * 4 + m.c * 4 + m.f * 9, tot = kcalFromMacros || 1, pmin = plan.proteina.min ?? 0, pmax = plan.proteina.max ?? sum.plannedProtein;
  return (
    <section className="glass relative overflow-hidden rounded-3xl p-5" data-testid="dieta-macros"><span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-amber opacity-10 blur-3xl" />
      <div className="relative flex items-baseline justify-between"><h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em]"><Flame size={15} className="text-amber" />Macros do dia</h3><span className="font-display text-2xl font-semibold tabular-nums text-amber" data-testid="macros-kcal">{Math.round(m.kcal)}<span className="text-sm text-muted-foreground"> kcal</span></span></div>
      <div className="relative mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/8" aria-hidden>{([["p", m.p * 4], ["c", m.c * 4], ["f", m.f * 9]] as const).map(([k, v]) => <span key={k} style={{ width: `${(v / tot) * 100}%`, background: MC[k], transition: "width .8s" }} />)}</div>
      <div className="relative mt-3 grid grid-cols-3 gap-2 text-center">{([["Proteína", m.p, MC.p, pmin ? `meta ${pmin}–${pmax}` : ""], ["Carboidrato", m.c, MC.c, ""], ["Gordura", m.f, MC.f, ""]] as const).map(([l, v, c, meta]) => <div key={l} className="rounded-2xl border border-white/10 bg-black/25 p-2.5"><b className="block font-display text-xl tabular-nums" style={{ color: c }}>{Math.round(v)}<span className="text-xs text-muted-foreground"> g</span></b><span className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">{l}</span>{meta && <span className="block text-[0.6rem] text-muted-foreground">{meta}</span>}</div>)}</div>
      <p className="relative mt-2 text-[0.65rem] text-muted-foreground">Estimativa pelas porções marcadas, trocas e alimentos extras. Sem meta calórica na ficha: use como acompanhamento.</p>
    </section>
  );
}

export function DietToday({ b }: { b: DietBundle }) {
  const { plan, today, todayLog, sum } = b, save = b.actions.saveDay.mutate, opt = sum.opt;
  const cur: DayLog = todayLog ?? emptyDay(today, opt.id), [burst, setBurst] = useState(0), [note, setNote] = useState(cur.notes), tm = useRef<ReturnType<typeof setTimeout> | null>(null), wr = useRef<(p: Partial<DayLog>) => void>(() => {});
  useEffect(() => { setNote(todayLog?.notes ?? ""); }, [todayLog?.notes]);
  const write = (patch: Partial<DayLog>) => save({ ...cur, optionId: cur.optionId ?? opt.id, ...patch }, { onError: (e) => toast.error(e.message) });
  wr.current = write;
  const toggle = (id: string) => { const on = cur.mealsDone.includes(id); write({ mealsDone: on ? cur.mealsDone.filter((x) => x !== id) : [...cur.mealsDone, id] }); if (!on) setBurst((n) => n + 1); };
  const water = cur.waterMl ?? 0, pmin = plan.proteina.min ?? 0, pmax = plan.proteina.max ?? sum.plannedProtein, ptarget = pmin || pmax;
  const setWater = (ml: number) => write({ waterMl: Math.max(0, ml) });
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]" data-testid="dieta-hoje">
      <div className="space-y-4">
        <div className="glass rounded-3xl p-4" data-testid="dieta-opcoes"><p className="mono-caps mb-2">Qual opção você está fazendo hoje?</p>
          <div className="grid gap-2 sm:grid-cols-2">{plan.opcoes.map((o) => { const on = o.id === opt.id; return (
            <button key={o.id} type="button" aria-pressed={on} onClick={() => write({ optionId: o.id, mealsDone: cur.mealsDone.filter((id) => o.refeicoes.some((m) => m.id === id)) })} data-testid={`opcao-${o.id}`} className={`relative overflow-hidden rounded-2xl border p-3 text-left transition ${on ? "border-emerald/60 bg-emerald/10 shadow-[0_0_28px_-8px_var(--emerald)]" : "border-white/10 hover:border-white/25"}`}>
              <span className="block font-display text-base font-semibold">{o.nome}</span><span className="block text-xs text-muted-foreground">{o.tag}</span>{o.recomendada && <span className="mt-1 inline-block rounded-full bg-emerald/20 px-2 py-0.5 text-[0.62rem] text-emerald">recomendada p/ experimentar</span>}</button>); })}</div></div>
        <div className="relative space-y-3">{opt.refeicoes.map((m, i) => <MealCard key={m.id} m={m} plan={plan} done={cur.mealsDone.includes(m.id)} onToggle={() => toggle(m.id)} delay={i * 80} swaps={cur.swaps} onSwap={(key, sw) => { const next = { ...cur.swaps }; if (sw) next[key] = sw; else delete next[key]; write({ swaps: next }); }} />)}
          {burst > 0 && <span key={burst} className="pointer-events-none absolute right-6 top-2"><Burst /></span>}</div>
      </div>
      <div className="space-y-4">
        <MacrosPanel b={b} /><DietDiary b={b} cur={cur} write={write} />
        <section className="glass rounded-3xl p-5" data-testid="dieta-proteina"><div className="flex items-baseline justify-between"><h3 className="font-display text-sm font-semibold uppercase tracking-[0.16em]">Proteína do dia</h3><span className="font-display text-2xl font-semibold tabular-nums text-emerald">{sum.protein}<span className="text-sm text-muted-foreground"> / {pmin ? `${pmin}–${pmax}` : pmax} g</span></span></div>
          <div className="mt-3"><Meter pct={(sum.protein / (ptarget || 1)) * 100} color="var(--emerald)" warn={false} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Estimativa pelas porções marcadas{sum.protein < ptarget && sum.done > 0 ? ` · faltam ≈ ${Math.max(0, ptarget - sum.protein)} g (um whey cobre ~25 g)` : ""}.</p>
          <div className="mt-3 flex items-center gap-2 text-xs"><span className="text-muted-foreground">Proteína extra (whey, ovo…)</span><button type="button" aria-label="Menos 5 g" onClick={() => write({ extraProteinG: Math.max(0, (cur.extraProteinG ?? 0) - 5) })} className="grid h-7 w-7 place-items-center rounded-full border border-white/10 active:scale-90"><Minus size={12} /></button><b className="w-12 text-center font-mono">{cur.extraProteinG ?? 0} g</b><button type="button" aria-label="Mais 5 g" onClick={() => write({ extraProteinG: (cur.extraProteinG ?? 0) + 5 })} className="grid h-7 w-7 place-items-center rounded-full border border-white/10 active:scale-90" data-testid="proteina-mais"><Plus size={12} /></button></div></section>
        <section className="glass rounded-3xl p-5" data-testid="dieta-agua"><div className="flex items-baseline justify-between"><h3 className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em]"><Droplets size={15} className="text-cyan" />Água</h3><span className="font-display text-2xl font-semibold tabular-nums text-cyan">{(water / 1000).toFixed(2).replace(".", ",")}<span className="text-sm text-muted-foreground"> L</span></span></div>
          <div className="mt-3 flex gap-1.5">{Array.from({ length: 8 }, (_, i) => <span key={i} className={`h-8 flex-1 rounded-md border transition ${water >= (i + 1) * 250 ? "border-cyan/60 bg-cyan/40 shadow-[0_0_12px_-2px_var(--cyan)]" : "border-white/10 bg-white/[0.03]"}`} />)}</div>
          <div className="mt-3 flex flex-wrap gap-2">{[250, 500].map((ml) => <button key={ml} type="button" onClick={() => setWater(water + ml)} className="rounded-full border border-cyan/40 bg-cyan/10 px-3 py-1.5 text-xs text-cyan transition hover:bg-cyan/20 active:scale-95" data-testid={`agua-${ml}`}>+ {ml} ml</button>)}<button type="button" onClick={() => setWater(water - 250)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted-foreground active:scale-95">− 250</button></div>
          <p className="mt-2 text-xs text-muted-foreground">Sem meta rígida: suba aos poucos{plan.hidratacao.atualMl ? ` (hoje você bebe ≈ ${(plan.hidratacao.atualMl / 1000).toFixed(1).replace(".", ",")} L)` : ""}.</p></section>
        <section className="glass rounded-3xl p-5" data-testid="dieta-dia"><h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.16em]">Como foi o dia</h3>
          <div className="space-y-3">{SCALES.map((s) => { const v = cur[s.key]; return (
            <div key={s.key}><div className="mb-1 flex items-baseline justify-between text-xs"><span>{s.label}</span><span className="text-[0.65rem] text-muted-foreground">{s.lo} ↔ {s.hi}</span></div>
              <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => { const on = v === n, c = toneOf(n, s.good); return <button key={n} type="button" aria-pressed={on} aria-label={`${s.label} ${n}`} onClick={() => write({ [s.key]: on ? null : n } as Partial<DayLog>)} data-testid={`dia-${s.key}-${n}`} className="h-9 flex-1 rounded-lg border text-sm font-semibold tabular-nums transition active:scale-90" style={{ borderColor: on ? c : "rgba(255,255,255,.1)", background: on ? `color-mix(in oklab, ${c} 22%, transparent)` : "transparent", color: on ? c : undefined, boxShadow: on ? `0 0 16px -4px ${c}` : undefined }}>{n}</button>; })}</div></div>); })}
            <div className="flex items-center justify-between text-xs"><span>Evacuou hoje?</span><div className="flex gap-1.5">{([[true, "Sim"], [false, "Não"]] as const).map(([val, label]) => <button key={label} type="button" aria-pressed={cur.bowel === val} onClick={() => write({ bowel: cur.bowel === val ? null : val })} className={`rounded-full border px-3 py-1 transition active:scale-95 ${cur.bowel === val ? "border-emerald/60 bg-emerald/15 text-emerald" : "border-white/10 text-muted-foreground"}`}>{label}</button>)}</div></div>
            <textarea value={note} onChange={(e) => { setNote(e.target.value); if (tm.current) clearTimeout(tm.current); tm.current = setTimeout(() => wr.current({ notes: e.target.value }), 700); }} rows={2} maxLength={2000} placeholder="Observações do dia…" className="w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm outline-none focus:border-emerald/60" data-testid="dia-obs" /></div></section>
      </div>
    </div>
  );
}
