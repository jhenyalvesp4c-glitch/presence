/** Resultado da análise: ata, decisões, quem faz o quê (por pessoa, com seleção para virar demanda/lembrete), pendências, resumo por grupo e próxima reunião. */
import { AlertCircle, BellRing, CalendarClock, Check, CheckCircle2, ClipboardList, FileText, Flag, Gavel, ListChecks, MessagesSquare, Users } from "lucide-react";

import type { Analysis, MAction } from "@/lib/meetings";
import { byPerson } from "@/lib/meetings";

const dm = (iso: string) => iso.split("-").reverse().slice(0, 2).join("/");
const PR = { alta: { c: "oklch(0.72 0.18 10)", l: "alta" }, media: { c: "var(--cyan)", l: "normal" }, baixa: { c: "var(--muted-foreground)", l: "baixa" } } as const;
const KIND = { demanda: { l: "Demanda", c: "var(--violet)", I: ClipboardList }, lembrete: { l: "Lembrete", c: "var(--amber)", I: BellRing }, tarefa: { l: "Tarefa", c: "var(--cyan)", I: ListChecks } } as const;
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";

function Card({ title, Icon, color = "var(--cyan)", n = 0, children, testId }: { title: string; Icon: typeof FileText; color?: string; n?: number; children: React.ReactNode; testId?: string }) {
  return (
    <section className="ex-card px-5 py-5 sm:px-6" style={{ "--rail": color, animation: "fin-rise .6s both", animationDelay: `${n * 90}ms` } as React.CSSProperties} data-testid={testId}>
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full opacity-[0.1] blur-3xl" style={{ background: color }} />
      <h3 className="relative mb-3 flex items-center gap-2.5"><Icon size={14} style={{ color }} /><span className="mono-caps !text-[0.68rem]">{title}</span><span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" /></h3>
      <div className="relative">{children}</div>
    </section>
  );
}

export function MeetingResult({ a, selected, sent, onToggle, onSelectAll }: { a: Analysis; selected: Set<number>; sent: Set<number>; onToggle: (i: number) => void; onSelectAll: (on: boolean) => void }) {
  const people = byPerson(a.acoes), pending = a.acoes.map((_, i) => i).filter((i) => !sent.has(i));
  let n = 0;
  return (
    <div className="space-y-3" data-testid="reuniao-resultado">
      {a.resumo && <Card title="Ata" Icon={FileText} n={n++} testId="ata">
        <p className="text-sm leading-relaxed">{a.resumo}</p>
        {a.participantes.length > 0 && <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Users size={12} />{a.participantes.map((p) => <span key={p} className="rounded-full border border-white/10 px-2 py-0.5">{p}</span>)}</p>}
        {a.topicos.length > 0 && <ol className="relative mt-4 space-y-3 border-l border-white/10 pl-4">{a.topicos.map((t, i) => <li key={t.assunto} style={{ animation: "fin-rise .5s both", animationDelay: `${i * 60}ms` }}><span aria-hidden className="absolute -left-[5px] mt-1.5 h-2 w-2 rounded-full bg-cyan shadow-[0_0_8px_var(--cyan)]" /><b className="text-sm">{t.assunto}</b>{t.pontos.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">{t.pontos.map((p) => <li key={p}>• {p}</li>)}</ul>}</li>)}</ol>}
      </Card>}

      {a.grupos.length > 0 && <Card title="Resumo por grupo" Icon={MessagesSquare} color="var(--emerald)" n={n++} testId="grupos">
        <div className="grid gap-3 lg:grid-cols-2">{a.grupos.map((g, i) => <article key={g.nome} className="rounded-2xl border border-white/10 bg-black/20 p-4" style={{ animation: "fin-rise .5s both", animationDelay: `${i * 70}ms` }}>
          <h4 className="flex items-center gap-2 font-display text-base font-semibold"><Users size={14} className="text-emerald" />{g.nome}</h4><p className="mt-1.5 text-sm text-muted-foreground">{g.resumo}</p>
          {g.destaques.length > 0 && <ul className="mt-2 space-y-1 text-xs">{g.destaques.map((d) => <li key={d} className="flex gap-2"><Flag size={11} className="mt-0.5 shrink-0 text-amber" />{d}</li>)}</ul>}
          {g.pedidos.length > 0 && <div className="mt-3 border-t border-white/10 pt-2"><p className="mb-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">Pedidos</p><ul className="space-y-1 text-xs">{g.pedidos.map((d) => <li key={d}>→ {d}</li>)}</ul></div>}</article>)}</div>
      </Card>}

      {a.decisoes.length > 0 && <Card title="Decisões" Icon={Gavel} color="var(--violet)" n={n++} testId="decisoes"><ul className="space-y-2">{a.decisoes.map((d, i) => <li key={d} className="flex items-start gap-2.5 text-sm" style={{ animation: "fin-rise .5s both", animationDelay: `${i * 60}ms` }}><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-violet" />{d}</li>)}</ul></Card>}

      {a.acoes.length > 0 && <Card title="Quem faz o quê" Icon={ListChecks} color="var(--emerald)" n={n++} testId="acoes">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{a.acoes.length} ação(ões) · {selected.size} marcada(s) para virar demanda/lembrete{sent.size ? ` · ${sent.size} já enviada(s)` : ""}</span>
          <span className="flex gap-3"><button type="button" onClick={() => onSelectAll(true)} className="text-emerald underline-offset-2 hover:underline" data-testid="marcar-todas">Marcar todas</button><button type="button" onClick={() => onSelectAll(false)} className="text-muted-foreground underline-offset-2 hover:underline">Limpar</button></span></div>
        <div className="grid gap-3 lg:grid-cols-2">{people.map((p, pi) => (
          <article key={p.quem} className={`rounded-2xl border p-3 ${p.minha ? "border-emerald/40 bg-emerald/[0.06]" : "border-white/10 bg-black/20"}`} style={{ animation: "fin-rise .5s both", animationDelay: `${pi * 70}ms` }}>
            <header className="mb-2 flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-cyan to-violet font-mono text-[0.7rem] font-bold text-[#04121a]">{initials(p.quem)}</span><b className="min-w-0 flex-1 truncate text-sm">{p.quem}</b>{p.minha && <span className="rounded-full bg-emerald/20 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-emerald">você</span>}<span className="font-mono text-[0.65rem] text-muted-foreground">{p.itens.length}</span></header>
            <ul className="space-y-1.5">{p.itens.map(({ a: x, i }) => <ActionRow key={i} x={x} on={selected.has(i)} sent={sent.has(i)} onToggle={() => onToggle(i)} />)}</ul>
          </article>))}</div>
        {pending.length === 0 && <p className="mt-3 text-center text-xs text-emerald">Tudo já foi enviado para a Central.</p>}
      </Card>}

      {a.pendencias.length > 0 && <Card title="Pendências em aberto" Icon={AlertCircle} color="var(--amber)" n={n++} testId="pendencias"><ul className="space-y-1.5 text-sm">{a.pendencias.map((d) => <li key={d} className="flex gap-2"><span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber shadow-[0_0_8px_var(--amber)]" />{d}</li>)}</ul></Card>}

      {a.proxima && <Card title="Próxima reunião" Icon={CalendarClock} color="var(--cyan)" n={n++} testId="proxima"><p className="text-sm"><b className="font-display text-lg text-cyan">{a.proxima.data ? dm(a.proxima.data) : "A definir"}{a.proxima.hora ? ` · ${a.proxima.hora}` : ""}</b>{a.proxima.assunto ? <span className="text-muted-foreground"> — {a.proxima.assunto}</span> : null}</p></Card>}
    </div>
  );
}

function ActionRow({ x, on, sent, onToggle }: { x: MAction; on: boolean; sent: boolean; onToggle: () => void }) {
  const k = KIND[x.tipo], pr = PR[x.prioridade];
  return (
    <li><button type="button" onClick={onToggle} disabled={sent} aria-pressed={on} data-testid="acao" className={`flex w-full items-start gap-2.5 rounded-xl border px-2.5 py-2 text-left transition active:scale-[0.99] ${sent ? "border-white/5 opacity-55" : on ? "border-emerald/50 bg-emerald/10 shadow-[0_0_18px_-8px_var(--emerald)]" : "border-white/10 hover:border-white/25"}`}>
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${on || sent ? "border-emerald bg-emerald/30 text-emerald" : "border-white/25"}`}>{(on || sent) && <Check size={11} strokeWidth={3} />}</span>
      <span className="min-w-0 flex-1"><span className="block text-[0.82rem] leading-snug">{x.oQue}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono text-[0.62rem]"><span className="inline-flex items-center gap-1" style={{ color: k.c }}><k.I size={10} />{k.l}</span>{x.prazo && <span className="text-muted-foreground">até {dm(x.prazo)}</span>}<span className="inline-flex items-center gap-1" style={{ color: pr.c }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: pr.c, boxShadow: `0 0 6px ${pr.c}` }} />{pr.l}</span>{sent && <span className="text-emerald">enviada</span>}</span></span></button></li>
  );
}
