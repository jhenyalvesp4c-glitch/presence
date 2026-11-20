/** Meu plano: comparação das opções (2 × 3 refeições), prioridades, proteína e a versão prática. */
import { useState } from "react";
import { Flame, Star, Target } from "lucide-react";

import { Tilt } from "@/components/finance/fx";
import type { DietBundle } from "@/components/diet/DietHub";
import { mealProtein, optionProtein } from "@/lib/diet-plan";

export function DietPlanView({ b }: { b: DietBundle }) {
  const { plan } = b, [sel, setSel] = useState(plan.opcoes.find((o) => o.recomendada)?.id ?? plan.opcoes[0]!.id), opt = plan.opcoes.find((o) => o.id === sel)!;
  return (
    <div className="space-y-5" data-testid="dieta-plano">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
        { k: "Proteína/dia", v: plan.proteina.min ? `${plan.proteina.min}–${plan.proteina.max ?? plan.proteina.min} g` : "—", c: "var(--emerald)" },
        { k: "Meta calórica", v: "Sem meta", sub: plan.tmb ? `TMB ≈ ${plan.tmb.toLocaleString("pt-BR")} kcal` : "", c: "var(--cyan)" },
        { k: "Treino", v: plan.perfil.treino || "—", sub: plan.perfil.duracaoTreino, c: "var(--violet)" },
        { k: "Horários", v: plan.perfil.horarios || "—", sub: plan.perfil.preferencia, c: "var(--amber)" },
      ].map((x, i) => <Tilt key={x.k} max={6} className="rounded-2xl"><div className="glass h-full rounded-2xl p-4" style={{ animation: "fin-rise .5s both", animationDelay: `${i * 70}ms` }}><p className="mono-caps">{x.k}</p><p className="mt-1 font-display text-xl font-semibold leading-tight" style={{ color: x.c }}>{x.v}</p>{x.sub && <p className="text-xs text-muted-foreground">{x.sub}</p>}</div></Tilt>)}</section>
      {plan.semMeta && <p className="rounded-2xl border border-cyan/25 bg-cyan/5 px-4 py-3 text-sm text-muted-foreground"><Flame size={14} className="mr-1.5 inline text-cyan" />{plan.semMeta}</p>}
      <section className="glass rounded-3xl p-5"><h3 className="mb-3 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em]"><Target size={15} className="text-violet" />Prioridades</h3>
        <ol className="grid gap-2 sm:grid-cols-2">{plan.estrategia.map((e, i) => <li key={e} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-violet/20 font-mono text-xs text-violet">{i + 1}</span>{e}</li>)}</ol></section>
      <section className="glass rounded-3xl p-5">
        <div className="mb-4 flex flex-wrap gap-2" role="tablist">{plan.opcoes.map((o) => <button key={o.id} role="tab" aria-selected={o.id === sel} onClick={() => setSel(o.id)} data-testid={`plano-opcao-${o.id}`} className={`rounded-full border px-4 py-2 text-sm transition ${o.id === sel ? "border-emerald/60 bg-emerald/15 text-emerald shadow-[0_0_22px_-8px_var(--emerald)]" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>{o.recomendada && <Star size={12} className="mr-1 inline" />}{o.nome}</button>)}</div>
        <p className="mb-4 text-sm text-muted-foreground">{opt.resumo} <b className="text-emerald">≈ {optionProtein(opt)} g de proteína</b> no dia.</p>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3" key={opt.id}>{opt.refeicoes.map((m, i) => (
          <article key={m.id} className="rounded-2xl border border-white/10 bg-black/25 p-4" style={{ animation: "fin-rise .5s both", animationDelay: `${i * 80}ms` }}>
            <div className="flex items-baseline justify-between"><h4 className="font-display text-lg font-semibold">{m.nome}</h4><span className="font-mono text-xs text-emerald">{m.hora}</span></div>
            <table className="mt-2 w-full text-sm"><tbody>{m.itens.map((it) => <tr key={it.alimento} className="border-b border-white/5 last:border-0"><td className="py-1.5">{it.alimento}</td><td className="py-1.5 text-right font-mono text-xs text-muted-foreground">{it.qtd}</td></tr>)}</tbody></table>
            <p className="mt-2 text-[0.7rem] text-emerald">≈ {Math.round(mealProtein(m))} g proteína</p>{m.orientacoes.map((o) => <p key={o} className="mt-1 text-xs text-muted-foreground">• {o}</p>)}</article>))}</div>
      </section>
      {plan.versaoPratica.length > 0 && <section className="glass rounded-3xl p-5"><h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.16em]">Versão prática (3 refeições)</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-sm"><thead><tr className="text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground"><th className="pb-1 font-medium">Refeição</th><th className="pb-1 font-medium">Principal</th><th className="pb-1 font-medium">Alternativas</th></tr></thead><tbody>{plan.versaoPratica.map((v) => <tr key={v.refeicao} className="border-t border-white/5"><td className="py-2 font-medium">{v.refeicao}</td><td className="py-2">{v.principal}</td><td className="py-2 text-muted-foreground">{v.alternativas}</td></tr>)}</tbody></table></div></section>}
      {plan.objetivoFinal && <p className="text-center text-sm italic text-muted-foreground">{plan.objetivoFinal}</p>}
    </div>
  );
}
