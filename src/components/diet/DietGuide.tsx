/** Trocas (tabela prática + grupos com busca) e Guia (hidratação, intestino, treino, preferências, segurança). */
import { useState } from "react";
import { Search, ShieldAlert } from "lucide-react";

import type { DietPlan } from "@/lib/diet-plan";

const COLORS = ["var(--emerald)", "var(--cyan)", "var(--violet)", "var(--amber)"];
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function DietSwaps({ plan }: { plan: DietPlan }) {
  const [q, setQ] = useState(""), [open, setOpen] = useState<string | null>(null), nq = norm(q.trim());
  const groups = plan.grupos.map((g) => ({ g, itens: nq ? g.itens.filter((i) => norm(i.alimento).includes(nq)) : g.itens })).filter((x) => !nq || x.itens.length || norm(x.g.nome).includes(nq));
  return (
    <div className="space-y-5" data-testid="dieta-trocas">
      {plan.trocas.length > 0 && <section className="ex-card px-5 py-5"><h3 className="mb-3 mono-caps !text-[0.68rem]">Tabela prática de trocas</h3>
        <ul className="grid gap-2 sm:grid-cols-2">{plan.trocas.map((t, i) => <li key={t.se} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm" style={{ animation: "fin-rise .45s both", animationDelay: `${i * 40}ms` }}><b className="min-w-[6.5rem] text-emerald">{t.se}</b><span aria-hidden className="text-muted-foreground">→</span><span>{t.escolha}</span></li>)}</ul>{plan.trocasNota && <p className="mt-3 text-xs text-muted-foreground">{plan.trocasNota}</p>}</section>}
      {(plan.trocasProteina.length > 0 || plan.trocasCarbo.length > 0 || plan.frutas.length > 0) && <section className="grid gap-4 lg:grid-cols-3">
        {plan.trocasProteina.length > 0 && <div className="ex-card px-5 py-5"><h3 className="mb-2 mono-caps !text-[0.68rem] text-emerald">Proteínas</h3><ul className="space-y-1.5 text-sm">{plan.trocasProteina.map((s) => <li key={s.alimento}><b>{s.alimento}</b> <span className="text-muted-foreground">{s.porcao}</span></li>)}</ul>{plan.trocasProteinaNota && <p className="mt-2 text-xs text-muted-foreground">{plan.trocasProteinaNota}</p>}</div>}
        {plan.trocasCarbo.length > 0 && <div className="ex-card px-5 py-5"><h3 className="mb-2 mono-caps !text-[0.68rem] text-cyan">Carboidratos</h3><ul className="space-y-1.5 text-sm">{plan.trocasCarbo.map((s) => <li key={s.alimento}><b>{s.alimento}</b> <span className="text-muted-foreground">{s.porcao}</span></li>)}</ul>{plan.trocasCarboNota && <p className="mt-2 text-xs text-muted-foreground">{plan.trocasCarboNota}</p>}</div>}
        {plan.frutas.length > 0 && <div className="ex-card px-5 py-5"><h3 className="mb-2 mono-caps !text-[0.68rem] text-amber">Frutas</h3><p className="flex flex-wrap gap-1.5">{plan.frutas.map((f) => <span key={f} className="rounded-full border border-amber/30 bg-amber/10 px-2.5 py-0.5 text-xs text-amber">{f}</span>)}</p>{plan.frutasNota && <p className="mt-2 text-xs text-muted-foreground">{plan.frutasNota}</p>}</div>}
      </section>}
      <section className="ex-card px-5 py-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="mono-caps !text-[0.68rem]">Grupos de substituição</h3>
        <label className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alimento…" className="w-56 rounded-full border border-white/10 bg-black/25 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald/60" data-testid="trocas-busca" /></label></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{groups.map(({ g, itens }, i) => { const c = COLORS[i % COLORS.length]!, on = open === g.id || !!nq; return (
          <article key={g.id} className="overflow-hidden rounded-2xl border bg-black/20" style={{ borderColor: `color-mix(in oklab, ${c} 30%, transparent)` }} data-testid={`grupo-${g.id}`}>
            <button type="button" onClick={() => setOpen(on && !nq ? null : g.id)} className="flex w-full items-center justify-between gap-2 p-3 text-left"><span className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg font-mono text-xs" style={{ background: `color-mix(in oklab, ${c} 18%, transparent)`, color: c }}>{g.id}</span><span className="font-display text-base font-semibold">{g.nome}</span></span><span className="text-[0.68rem] text-muted-foreground">{g.referencia}</span></button>
            {on && <div className="border-t border-white/5 p-3"><ul className="space-y-1 text-sm">{itens.map((s) => <li key={s.alimento} className="flex justify-between gap-3"><span>{s.alimento}</span><span className="font-mono text-xs text-muted-foreground">{s.porcao}</span></li>)}</ul>{g.nota && <p className="mt-2 text-xs text-muted-foreground">{g.nota}</p>}</div>}</article>); })}</div>
        {!groups.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum alimento com “{q}”.</p>}</section>
    </div>
  );
}

const List = ({ title, items, color }: { title: string; items: string[]; color: string }) => items.length ? <div><h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color }}>{title}</h4><ul className="space-y-1 text-sm">{items.map((x) => <li key={x} className="flex gap-2"><span aria-hidden style={{ color }}>•</span>{x}</li>)}</ul></div> : null;
export function DietGuide({ plan }: { plan: DietPlan }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="dieta-guia">
      <section className="ex-card px-5 py-5"><h3 className="mono-caps mb-3 !text-[0.68rem] !text-cyan">Hidratação</h3><div className="space-y-3"><List title="Orientações" items={plan.hidratacao.orientacoes} color="var(--cyan)" /><List title="Como fazer" items={plan.hidratacao.estrategia} color="var(--emerald)" />{plan.hidratacao.aviso && <p className="text-xs text-muted-foreground">{plan.hidratacao.aviso}</p>}</div></section>
      <section className="ex-card px-5 py-5"><h3 className="mono-caps mb-3 !text-[0.68rem] !text-violet">Intestino</h3><div className="space-y-3">{plan.intestino.texto && <p className="text-sm text-muted-foreground">{plan.intestino.texto}</p>}<List title="Estratégias" items={plan.intestino.estrategias} color="var(--violet)" />{plan.intestino.aviso && <p className="rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">{plan.intestino.aviso}</p>}</div></section>
      <section className="ex-card px-5 py-5"><h3 className="mono-caps mb-3 !text-[0.68rem] !text-emerald">Treino e whey</h3><div className="space-y-3"><List title="Em volta do treino" items={plan.treinoNota} color="var(--emerald)" />{plan.whey.dose && <p className="text-sm"><b>Whey:</b> {plan.whey.dose}</p>}<List title="Sobre o whey" items={plan.whey.notas} color="var(--cyan)" /></div></section>
      <section className="ex-card px-5 py-5"><h3 className="mono-caps mb-3 !text-[0.68rem]">Preferências</h3><div className="space-y-3"><div><h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-emerald">Aceitos</h4><p className="flex flex-wrap gap-1.5">{plan.aceitos.map((a) => <span key={a} className="rounded-full border border-emerald/30 bg-emerald/10 px-2.5 py-0.5 text-xs text-emerald">{a}</span>)}</p></div>
        {plan.rejeitados.length > 0 && <div><h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-rose-300">Rejeitados</h4><p className="flex flex-wrap gap-1.5">{plan.rejeitados.map((a) => <span key={a} className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-0.5 text-xs text-rose-300 line-through">{a}</span>)}</p></div>}</div></section>
      <section className="ex-card px-5 py-5"><h3 className="mono-caps mb-3 !text-[0.68rem]">Quando revisar o plano</h3><List title="Sinais" items={plan.revisar} color="var(--amber)" /></section>
      <section className="ex-card px-5 py-5"><h3 className="mono-caps mb-3 flex items-center gap-2 !text-[0.68rem]"><ShieldAlert size={18} className="text-amber" />Segurança</h3><List title="Lembretes" items={plan.seguranca} color="var(--amber)" /></section>
    </div>
  );
}
