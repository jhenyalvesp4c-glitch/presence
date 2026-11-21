/** O plano inteiro como foi escrito: estratégia, semanas, regras de progressão, RIR, cargas iniciais, metas e a ficha de cada dia. */
import { Check, Gauge, Target } from "lucide-react";

import { Ring } from "@/components/finance/charts";
import { dayName, faseDaSemana, type Program } from "@/lib/program";

const Card = ({ title, Icon = Gauge, color = "var(--cyan)", n = 0, children }: { title: string; Icon?: typeof Gauge; color?: string; n?: number; children: React.ReactNode }) => (
  <section className="ex-card px-5 py-5 sm:px-6" style={{ "--rail": color, animation: "fin-rise .6s both", animationDelay: `${n * 80}ms` } as React.CSSProperties}>
    <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-[0.1] blur-3xl" style={{ background: color }} />
    <h3 className="relative mb-4 flex items-center gap-2.5"><Icon size={14} style={{ color }} /><span className="mono-caps !text-[0.68rem]">{title}</span><span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" /></h3>
    <div className="relative">{children}</div>
  </section>
);

export function PlanTab({ program, week, onToggleGoal }: { program: Program; week: number; onToggleGoal: (i: number) => void }) {
  const done = program.metas.filter((m) => m.feita).length;
  return (
    <div className="space-y-3">
      {program.estrategia && <Card title="Estratégia" n={0}><p className="text-sm leading-relaxed">{program.estrategia}</p>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><thead><tr className="text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground"><th className="pb-2 font-medium">Dia</th><th className="pb-2 font-medium">Treino</th><th className="pb-2 font-medium">Foco</th></tr></thead>
          <tbody>{program.dias.map((d) => <tr key={d.id} className="border-t border-white/10"><td className="py-2 pr-3 font-medium">{dayName(d.dia)}</td><td className="py-2 pr-3">{d.titulo}</td><td className="py-2 text-muted-foreground">{d.foco}</td></tr>)}</tbody></table></div></Card>}

      <Card title={`As ${program.semanas} semanas`} n={1} color="var(--violet)">
        <ol className="grid gap-2 sm:grid-cols-2" data-testid="fases">{program.fases.map((f) => { const now = f.semana === week, past = f.semana < week; return (
          <li key={f.semana} className={`flex items-start gap-3 rounded-2xl border p-3 transition ${now ? "border-violet/60 bg-violet/15 shadow-[0_0_28px_-10px_var(--violet)]" : past ? "border-emerald/25 bg-emerald/[0.05]" : "border-white/10 bg-white/[0.02]"}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${past ? "bg-emerald/25 text-emerald" : now ? "bg-violet text-[#0b0614]" : "bg-white/10 text-muted-foreground"}`}>{past ? <Check size={13} /> : f.semana}</span>
            <div className="min-w-0"><p className="text-sm font-semibold">{f.objetivo}{now && <span className="ml-2 rounded-full bg-violet/25 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-violet">você está aqui</span>}</p><p className="text-xs text-muted-foreground">{f.orientacao}</p></div>
          </li>); })}</ol>
        {program.rirNota && <p className="mt-3 text-xs text-muted-foreground">{program.rirNota}</p>}</Card>

      <Card title="Quando aumentar a carga" n={2} color="var(--emerald)">
        <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-sm"><tbody>{program.regras.map((r) => <tr key={r.situacao} className="border-t border-white/10 first:border-0"><td className="py-2 pr-4">{r.situacao}</td><td className="py-2 text-right font-medium text-emerald">{r.acao}</td></tr>)}</tbody></table></div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{program.incrementos.map((i) => <li key={i}>{i}</li>)}</ul>
        {program.rirEscala.length > 0 && <div className="mt-4"><p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Escala de esforço (RIR = repetições em reserva)</p><ul className="grid gap-1.5 sm:grid-cols-5">{program.rirEscala.map((r) => <li key={r.rir} className="rounded-xl border border-white/10 bg-black/20 p-2 text-center"><b className="font-display text-xl text-cyan">{r.rir}</b><p className="text-[0.65rem] text-muted-foreground">{r.significado}</p></li>)}</ul></div>}</Card>

      {program.cargaInicial.length > 0 && <Card title="Cargas iniciais" n={3} color="var(--amber)"><ol className="list-decimal space-y-1.5 pl-5 text-sm">{program.cargaInicial.map((c) => <li key={c}>{c}</li>)}</ol></Card>}

      <Card title="Metas do primeiro ciclo" Icon={Target} n={4} color="var(--pink)">
        <div className="mb-3 flex items-center gap-4"><Ring pct={program.metas.length ? (done / program.metas.length) * 100 : 0} size={64} thickness={7} color="var(--emerald)"><span className="text-xs font-semibold tabular-nums">{done}/{program.metas.length}</span></Ring><p className="text-sm text-muted-foreground">Metas de desempenho, não de quilos ou centímetros. Marque conforme for cumprindo.</p></div>
        <ul className="space-y-1.5">{program.metas.map((m, i) => <li key={m.texto}><button type="button" onClick={() => onToggleGoal(i)} aria-pressed={m.feita} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition hover:bg-white/[0.04]" data-testid="meta"><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${m.feita ? "border-emerald bg-emerald/25 text-emerald" : "border-white/25"}`}>{m.feita && <Check size={11} />}</span><span className={m.feita ? "text-muted-foreground line-through" : ""}>{m.texto}</span></button></li>)}</ul></Card>

      <Card title="A ficha, dia a dia" n={5}>
        <div className="space-y-5">{program.dias.filter((d) => d.tipo !== "descanso").map((d) => <div key={d.id}>
          <p className="font-display font-semibold">{dayName(d.dia)} — {d.titulo} <span className="text-xs font-normal text-muted-foreground">· {d.foco}</span></p>
          <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[460px] text-sm"><thead><tr className="text-left text-[0.65rem] uppercase tracking-wider text-muted-foreground"><th className="pb-1 font-medium">Exercício</th><th className="pb-1 text-right font-medium">Séries</th><th className="pb-1 text-right font-medium">Repetições</th><th className="pb-1 text-right font-medium">Descanso</th></tr></thead>
            <tbody>{d.exercicios.map((e) => <tr key={e.id} className="border-t border-white/10"><td className="py-1.5">{e.nome}</td>{e.tipo === "forca" ? <><td className="py-1.5 text-right tabular-nums">{e.series}</td><td className="py-1.5 text-right tabular-nums">{e.repsMin === e.repsMax ? e.repsMin : `${e.repsMin}–${e.repsMax}`}{e.repsNota ? ` ${e.repsNota}` : ""}</td><td className="py-1.5 text-right tabular-nums">{e.descansoS} s</td></> : <td colSpan={3} className="py-1.5 text-right text-muted-foreground">{e.prescricao}</td>}</tr>)}</tbody></table></div>
          {d.aquecimento.length > 0 && <p className="mt-1.5 text-xs text-muted-foreground"><b>Aquecimento:</b> {d.aquecimento.join(" ")}</p>}
          {d.nota && <p className="mt-1 text-xs text-muted-foreground">{d.nota}</p>}
        </div>)}</div></Card>

      {(program.orientacoes.length > 0 || program.observacoes.length > 0 || program.acompanhamento.length > 0) && <Card title="Orientações e acompanhamento" n={6} color="var(--violet)">
        {program.acompanhamento.length > 0 && <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm">{program.acompanhamento.map((a) => <li key={a}>{a}</li>)}</ol>}
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">{[...program.orientacoes, ...program.observacoes].map((o) => <li key={o}>{o}</li>)}</ul>
        {faseDaSemana(program, week) && null}</Card>}
    </div>
  );
}
