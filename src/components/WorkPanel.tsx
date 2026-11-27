/** Painel do topo de Clientes (suporte): "Prioridades" (o que está atrasado/hoje e quem precisa de você) e "Esta semana". */
import { AlarmClock, CalendarCheck2, Flag } from "lucide-react";

import { Ring } from "@/components/finance/charts";
import { LiveDot, OrbitArt } from "@/components/finance/fx";
import type { Panel, WeekDay } from "@/lib/work-panel";

const COR = { late: "var(--destructive)", warn: "var(--amber)", ok: "var(--cyan)", idle: "var(--violet)" } as const;
const dm = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return `${["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`; };

export function PriorityPanel({ p, onPick }: { p: Panel; onPick: (id: string) => void }) {
  const tone = p.pct >= 70 ? "var(--emerald)" : p.pct >= 35 ? "var(--cyan)" : "var(--amber)";
  const kpis = [
    { l: "Atrasadas", v: p.overdue, c: "var(--destructive)", hint: "tarefas com data vencida", I: AlarmClock },
    { l: "Para hoje", v: p.today, c: "var(--amber)", hint: "tarefas com a data de hoje", I: CalendarCheck2 },
    { l: "Sem próxima etapa", v: p.noNext, c: "var(--violet)", hint: "polos sem tarefa aberta", I: Flag },
  ];
  return (
    <div className="grid items-center gap-6 lg:grid-cols-[1.15fr_1fr]" data-testid="clientes-prioridades">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5"><p className="mono-caps">Seu trabalho</p><LiveDot label={`${p.active} polo${p.active === 1 ? "" : "s"} ativo${p.active === 1 ? "" : "s"}`} /></div>
        <div className="mt-3 flex items-center gap-5">
          <Ring pct={p.pct} color={tone} size={108} thickness={9}><span className="font-display text-2xl font-semibold tabular-nums" data-testid="prioridades-pct">{p.pct}%</span></Ring>
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold leading-tight"><span className="text-gradient">tarefas concluídas</span></p>
            <p className="mt-1 text-sm text-muted-foreground">{p.done} de {p.total} tarefas dos polos ativos</p>
            <p className="mt-1 text-[0.7rem] text-muted-foreground">{p.clientsDone} de {p.active} polos com tudo feito</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {kpis.map((k, i) => (
            <div key={k.l} className="group relative overflow-hidden rounded-2xl border bg-white/[0.03] px-3 py-2.5 backdrop-blur" style={{ borderColor: `color-mix(in oklab, ${k.c} 28%, transparent)`, animation: `fin-rise .6s ${0.15 + i * 0.07}s both` }}>
              <k.I aria-hidden size={34} className="absolute -right-2 -top-2 opacity-[0.08] transition group-hover:scale-110" style={{ color: k.c }} />
              <p className="text-[0.6rem] font-semibold uppercase leading-tight tracking-[0.1em]" style={{ color: k.c }}>{k.l}</p>
              <p className="mt-0.5 font-display text-xl font-semibold tabular-nums" data-testid={`prioridades-${i}`}>{k.v}</p><p className="text-[0.65rem] text-muted-foreground">{k.hint}</p>
            </div>))}
        </div>
      </div>
      <div className="min-w-0" data-testid="prioridades-lista">
        <p className="mono-caps mb-2">Quem precisa de você · mais urgente primeiro</p>
        {p.rows.length === 0 ? <div className="grid place-items-center py-6"><OrbitArt size={120}><Flag size={22} className="text-cyan" /></OrbitArt><p className="mt-2 text-xs text-muted-foreground">Nenhum cliente ativo ainda.</p></div> : (
          <ul className="max-h-[17rem] space-y-1.5 overflow-y-auto pr-1">
            {p.rows.slice(0, 40).map((r, i) => (
              <li key={r.id} style={{ animation: `fin-rise .45s ${Math.min(i, 8) * 0.04}s both` }}>
                <button onClick={() => onPick(r.id)} className="group w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left backdrop-blur transition hover:border-white/25" data-testid={`prioridade-${r.id}`}>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COR[r.level], boxShadow: `0 0 10px ${COR[r.level]}`, animation: r.level === "late" ? "fin-pulse 1.8s ease-out infinite" : undefined }} />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                    {r.overdue > 0 && <span className="shrink-0 rounded-full bg-rose-400/20 px-2 py-0.5 text-[0.62rem] text-rose-300">{r.overdue} atrasada{r.overdue === 1 ? "" : "s"}</span>}
                    {r.today > 0 && <span className="shrink-0 rounded-full bg-amber/20 px-2 py-0.5 text-[0.62rem] text-amber">{r.today} hoje</span>}
                  </span>
                  <span className="mt-1 block whitespace-pre-wrap break-words text-[0.7rem] text-muted-foreground">{r.next ? <><span className="text-foreground/80">Etapa atual:</span> {r.next}</> : r.pending === 0 && r.pct === 100 ? "Tudo feito" : "Sem próxima etapa — crie as tarefas"}</span>
                </button>
              </li>))}
          </ul>)}
      </div>
    </div>
  );
}

export function WeekPanel({ days, onPick }: { days: WeekDay[]; onPick: (id: string) => void }) {
  const total = days.reduce((n, d) => n + d.items.length, 0);
  return (
    <div data-testid="clientes-semana">
      <div className="flex flex-wrap items-center gap-2.5"><p className="mono-caps">Atrasadas e próximos 7 dias</p><LiveDot label={`${total} tarefa${total === 1 ? "" : "s"}`} /></div>
      {days.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Nada com data nesta semana. 🎉</p> : (
        <div className="mt-3 grid max-h-[18rem] gap-3 overflow-y-auto pr-1 md:grid-cols-2 lg:grid-cols-3">
          {days.map((d) => (
            <section key={d.date} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3" data-testid={`semana-${d.date}`}>
              <h3 className={`text-xs font-semibold uppercase tracking-[0.1em] ${d.overdue ? "text-rose-300" : "text-cyan"}`}>{d.overdue ? "Atrasadas" : dm(d.date)} <span className="font-normal text-muted-foreground">{d.items.length}</span></h3>
              <ul className="mt-1.5 space-y-1">
                {d.items.map((t) => (
                  <li key={t.id}><button onClick={() => onPick(t.clientId)} className="w-full text-left text-xs transition hover:text-cyan"><b className="font-medium">{t.clientName}</b> <span className="text-muted-foreground">· {t.time ? `${t.time} · ` : ""}{t.title}</span></button></li>))}
              </ul>
            </section>))}
        </div>)}
    </div>
  );
}
