/** "Conte o que você comeu": escreva em linguagem natural; a IA monta as refeições e calcula calorias, proteína, carboidrato e gordura para você conferir e adicionar ao dia. */
import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles, X } from "lucide-react";

import { Thinking } from "@/components/ideas/fx";
import { useMyFoods } from "@/lib/data/diet-plan";
import { interpretMeals } from "@/lib/diet-plan.functions";
import { toEntries, totalOf, type AiResult } from "@/lib/diet-ai";
import type { DayLog, DietMeal } from "@/lib/diet-plan";

const r0 = (n: number) => Math.round(n), r1 = (n: number) => Math.round(n * 10) / 10;
const EXEMPLO = "Ex.: no almoço comi 3 colheres de arroz, 3 de feijão, 1 filé de frango de 120 g e salada; de lanche, 1 banana e 1 scoop de whey";

export function DietAiBox({ plan, customNames, cur, write, defaultMeal }: { plan: DietMeal[]; customNames: string[]; cur: DayLog; write: (p: Partial<DayLog>) => void; defaultMeal: string }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [res, setRes] = useState<AiResult | null>(null), mine = useMyFoods().data ?? [];
  const run = async () => {
    setBusy(true);
    try {
      const r = await interpretMeals({ data: { texto: text, refeicoes: [...plan.map((m) => m.nome), ...customNames], padrao: defaultMeal, meusAlimentos: mine.slice(0, 40).map((f) => ({ nome: f.nome, kcal: f.per100.kcal, p: f.per100.p, c: f.per100.c, f: f.per100.f, medidas: f.medidas })) } });
      if (r.ok) setRes(r.resultado); else toast.error(r.error);
    } catch (e) { toast.error(`Não consegui calcular: ${(e as Error).message}`); }
    setBusy(false);
  };
  const drop = (mi: number, ii: number) => setRes((x) => x && { ...x, refeicoes: x.refeicoes.map((m, k) => (k === mi ? { ...m, itens: m.itens.filter((_, j) => j !== ii) } : m)).filter((m) => m.itens.length) });
  const confirm = () => {
    if (!res?.refeicoes.length) return;
    const { extras, novas } = toEntries(res, plan, customNames, () => `${Date.now()}${Math.random().toString(36).slice(2, 6)}`);
    write({ extras: [...cur.extras, ...extras], customMeals: [...new Set([...cur.customMeals, ...novas])] });
    toast.success(`${extras.length} alimento(s) adicionados ao dia`); setRes(null); setText("");
  };
  const t = res ? totalOf(res) : null;
  return (
    <section className="glass fin-frame relative overflow-hidden rounded-3xl p-5" data-testid="dieta-ia">
      <span aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-44 w-44 rounded-full bg-violet opacity-15 blur-3xl" /><span aria-hidden className="pointer-events-none absolute -bottom-20 right-0 h-44 w-44 rounded-full bg-cyan opacity-10 blur-3xl" />
      <h3 className="relative flex items-center gap-2 font-display text-lg font-semibold"><Sparkles size={17} className="text-violet drop-shadow-[0_0_8px_var(--violet)]" /> Conte o que você comeu</h3>
      <p className="relative text-xs text-muted-foreground">Escreva do seu jeito, com as quantidades. O Orion separa as refeições e calcula as calorias e os macros.</p>
      {!res && <>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={4000} placeholder={EXEMPLO} disabled={busy} className="relative mt-3 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none transition focus:border-violet/60 disabled:opacity-60" data-testid="ia-texto" />
        {busy ? <Thinking lines={["Lendo o que você comeu…", "Convertendo colheres em gramas…", "Calculando proteínas e carboidratos…", "Montando as refeições…"]} />
          : <button type="button" onClick={() => void run()} disabled={!text.trim()} className="relative mt-3 inline-flex items-center gap-2 rounded-full border border-violet/50 bg-violet/15 px-5 py-2.5 text-sm font-medium text-violet transition hover:bg-violet/25 active:scale-95 disabled:opacity-40" data-testid="ia-calcular"><Sparkles size={15} /> Calcular com IA</button>}
      </>}
      {res && t && <div className="relative mt-4 space-y-3" data-testid="ia-resultado" style={{ animation: "fin-rise .4s both" }}>
        <div className="grid grid-cols-4 gap-2 text-center">{([["kcal", t.kcal, "var(--amber)"], ["Prot.", t.p, "var(--emerald)"], ["Carbo", t.c, "var(--cyan)"], ["Gord.", t.f, "var(--violet)"]] as const).map(([l, v, c]) => <div key={l} className="rounded-2xl border border-white/10 bg-black/30 py-2"><b className="block font-display text-xl tabular-nums" style={{ color: c }} data-testid={`ia-total-${l}`}>{l === "kcal" ? r0(v) : r1(v)}</b><span className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">{l}</span></div>)}</div>
        {res.refeicoes.map((m, mi) => <div key={m.refeicao + mi} className="rounded-2xl border border-white/10 bg-black/20 p-3"><p className="mb-1.5 font-display text-sm font-semibold">{m.refeicao}</p>
          <ul className="space-y-1">{m.itens.map((i, ii) => <li key={i.nome + ii} className="flex items-center gap-2 text-xs"><span className="min-w-0 flex-1"><span className="block truncate text-sm">{i.nome}{i.estimado && <span className="ml-1.5 rounded-full bg-amber/15 px-1.5 text-[0.6rem] text-amber">≈ estimado</span>}</span><span className="text-muted-foreground">{i.qtd}{i.gramas ? ` · ${r0(i.gramas)} g` : ""}</span></span><span className="shrink-0 text-right font-mono text-[0.68rem] text-muted-foreground"><b className="text-amber">{r0(i.kcal)} kcal</b><br />P{r1(i.p)} C{r1(i.c)} G{r1(i.f)}</span><button type="button" aria-label={`Tirar ${i.nome}`} onClick={() => drop(mi, ii)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button></li>)}</ul></div>)}
        {res.aviso && <p className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">{res.aviso}</p>}
        <p className="text-[0.68rem] text-muted-foreground">Cálculo estimado pela IA. Confira e tire o que estiver errado antes de adicionar.</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={confirm} disabled={!res.refeicoes.length} className="inline-flex items-center gap-2 rounded-full border border-emerald/50 bg-emerald/15 px-5 py-2 text-sm font-medium text-emerald transition hover:bg-emerald/25 active:scale-95 disabled:opacity-40" data-testid="ia-adicionar"><Check size={15} /> Adicionar ao dia</button><button type="button" onClick={() => setRes(null)} className="rounded-full border border-white/15 px-4 py-2 text-sm hover:bg-white/10" data-testid="ia-voltar">Editar texto</button></div></div>}
    </section>
  );
}
