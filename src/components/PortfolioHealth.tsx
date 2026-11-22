/** Painel "Saúde da carteira" do topo de Clientes: andamento das implantações, parados e sem contato. */
import { CalendarX2, Rocket, MessagesSquare } from "lucide-react";
import { Ring, Sparkline } from "@/components/finance/charts";
import { LiveDot, OrbitArt } from "@/components/finance/fx";
import type { Portfolio } from "@/lib/portfolio";

const COR = { ok: "var(--emerald)", warn: "var(--amber)", late: "var(--destructive)" } as const;

export function PortfolioHealth({ p, onPick }: { p: Portfolio; onPick: (id: string) => void }) {
  const tone = p.avgPct >= 70 ? "var(--emerald)" : p.avgPct >= 35 ? "var(--cyan)" : "var(--amber)";
  const kpis = [
    { l: "Sem implantação iniciada", v: p.notStarted, c: "var(--amber)", hint: "clientes ativos", I: Rocket },
    { l: "Demandas abertas", v: p.openDemands, c: "var(--violet)", hint: "dos clientes ativos", I: MessagesSquare },
    { l: "Sem contato há 30 dias", v: p.silent, c: "var(--cyan)", hint: "ou nunca contatados", I: CalendarX2 },
  ];
  return (
    <div className="grid items-center gap-6 lg:grid-cols-[1.15fr_1fr]" data-testid="clientes-saude">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5"><p className="mono-caps">Saúde da carteira</p><LiveDot label={`${p.active} ativo${p.active === 1 ? "" : "s"}`} /></div>
        <div className="mt-3 flex items-center gap-5">
          <Ring pct={p.avgPct} color={tone} size={108} thickness={9}><span className="font-display text-2xl font-semibold tabular-nums" data-testid="saude-pct">{p.avgPct}%</span></Ring>
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold leading-tight"><span className="text-gradient">implantação média</span></p>
            <p className="mt-1 text-sm text-muted-foreground">{p.active} cliente{p.active === 1 ? "" : "s"} ativo{p.active === 1 ? "" : "s"} na carteira</p>
            <div className="mt-1.5 flex items-center gap-2 text-[0.65rem] text-muted-foreground"><Sparkline values={[2, 3, 3, 5, 4, 6, 7]} width={64} height={18} color={tone} /> roteiro de implantação</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {kpis.map((k, i) => (
            <div key={k.l} className="group relative overflow-hidden rounded-2xl border bg-white/[0.03] px-3 py-2.5 backdrop-blur" style={{ borderColor: `color-mix(in oklab, ${k.c} 28%, transparent)`, animation: `fin-rise .6s ${0.15 + i * 0.07}s both` }}>
              <k.I aria-hidden size={34} className="absolute -right-2 -top-2 opacity-[0.08] transition group-hover:scale-110" style={{ color: k.c }} />
              <p className="text-[0.6rem] font-semibold uppercase leading-tight tracking-[0.1em]" style={{ color: k.c }}>{k.l}</p>
              <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">{k.v}</p><p className="text-[0.65rem] text-muted-foreground">{k.hint}</p>
            </div>))}
        </div>
      </div>
      <div className="min-w-0" data-testid="saude-lista">
        <p className="mono-caps mb-2">Quem precisa de você · menos andado primeiro</p>
        {p.rows.length === 0 ? <div className="grid place-items-center py-6"><OrbitArt size={120}><Rocket size={22} className="text-cyan" /></OrbitArt><p className="mt-2 text-xs text-muted-foreground">Nenhum cliente ativo ainda.</p></div> : (
          <ul className="max-h-[17rem] space-y-1.5 overflow-y-auto pr-1">
            {p.rows.slice(0, 12).map((r, i) => (
              <li key={r.id} style={{ animation: `fin-rise .45s ${Math.min(i, 8) * 0.04}s both` }}>
                <button onClick={() => onPick(r.id)} className="group w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left backdrop-blur transition hover:border-white/25" data-testid={`saude-${r.id}`}>
                  <span className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COR[r.level], boxShadow: `0 0 10px ${COR[r.level]}`, animation: r.level === "late" ? "fin-pulse 1.8s ease-out infinite" : undefined }} />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{r.pct}%</span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(r.pct, 2)}%`, background: `linear-gradient(90deg, var(--cyan), ${COR[r.level]})` }} /></span>
                  <span className="mt-1 block truncate text-[0.62rem] text-muted-foreground">{r.blocked > 0 ? `${r.blocked} passo(s) travado(s) · ` : ""}{r.started ? "" : "implantação não iniciada · "}{r.silentDays === null ? "nunca contatado" : r.silentDays > 30 ? `sem contato há ${r.silentDays} d` : "contato em dia"}</span>
                </button>
              </li>))}
          </ul>)}
      </div>
    </div>
  );
}
