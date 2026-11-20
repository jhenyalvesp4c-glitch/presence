/** Corpo holográfico: silhueta com malha, varredura de luz, pontos de medida com valor e variação, e o gráfico do ponto escolhido. */
import { useId, useMemo, useState } from "react";

import { AreaChart } from "@/components/finance/charts";
import bodyAsset from "@/assets/hoje-corpo.jpg";
import { SPOTS, bodyData, fmtCm, fmtDelta, totalChange, type SpotData, type SpotKey } from "@/lib/body";
import type { MeasurementSheet } from "@/lib/health-preview";

const TONE = { good: "var(--emerald)", bad: "oklch(0.8 0.15 75)", neutral: "var(--cyan)", none: "oklch(0.6 0.02 260)" } as const;
export function BodyScan({ data, focus, onFocus, compact = false }: { data: Record<SpotKey, SpotData>; focus: SpotKey | null; onFocus?: ((k: SpotKey | null) => void) | undefined; compact?: boolean }) {
  const uid = useId().replace(/:/g, ""), f = focus ? SPOTS.find((s) => s.key === focus) : null;
  return (
    <svg viewBox="0 0 768 1024" className="mx-auto block w-full overflow-hidden rounded-2xl" style={{ maxWidth: compact ? 360 : 460 }} role="img" aria-label="Corpo com as medidas registradas" data-testid="corpo-scan">
      <defs>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cyan)" stopOpacity="0" /><stop offset="50%" stopColor="var(--cyan)" stopOpacity=".5" /><stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" /></linearGradient>
        <linearGradient id={`${uid}h`} x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--cyan)" stopOpacity="0" /><stop offset="50%" stopColor="var(--cyan)" stopOpacity=".42" /><stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" /></linearGradient>
      </defs>
      {/* o corpo é a imagem original */}
      <image href={bodyAsset} x="0" y="0" width="768" height="1024" preserveAspectRatio="xMidYMid slice" />
      {/* varredura de luz sobre o corpo e anel de plataforma */}
      <rect x="0" y="0" width="768" height="110" fill={`url(#${uid}b)`} data-body-fx style={{ animation: "body-scan-lg 6.5s ease-in-out infinite" }} />
      {f && <rect x="170" y={f.y - 26} width="430" height="52" fill={`url(#${uid}h)`} style={{ animation: "fin-fade .4s both" }} />}
      <ellipse cx="384" cy="996" rx="190" ry="20" fill="none" stroke="var(--cyan)" strokeOpacity=".55" strokeWidth="2" strokeDasharray="10 14" data-body-fx style={{ animation: "body-ring 3s linear infinite" }} />
      <ellipse cx="384" cy="996" rx="140" ry="13" fill="none" stroke="var(--violet)" strokeOpacity=".55" strokeWidth="2" />
      {/* pontos de medida */}
      {SPOTS.map((s, i) => {
        const d = data[s.key], c = TONE[d.tone], on = focus === s.key, has = d.current !== null, left = s.side === "l", tx = left ? 196 : 572, ax = left ? 206 : 562, anchor = left ? "end" : "start";
        return (
          <g key={s.key} opacity={focus && !on ? 0.5 : 1} style={{ transition: "opacity .3s" }}>
            <path d={`M${s.x},${s.y} L${left ? 236 : 532},${s.labelY - 8} L${ax},${s.labelY - 8}`} fill="none" stroke={c} strokeOpacity={on ? 0.95 : 0.5} strokeWidth={on ? 3 : 1.8} strokeDasharray={has ? undefined : "5 6"} />
            {has && <circle cx={s.x} cy={s.y} r="10" fill={c} opacity=".7" data-body-fx style={{ transformOrigin: `${s.x}px ${s.y}px`, animation: "fin-pulse 2.4s ease-out infinite", animationDelay: `${(i % 5) * 0.3}s` }} />}
            <circle cx={s.x} cy={s.y} r={on ? 12 : 8} fill={has ? c : "rgba(0,0,0,.4)"} stroke={c} strokeWidth="3" strokeDasharray={has ? undefined : "4 4"} style={{ filter: has ? `drop-shadow(0 0 9px ${c})` : undefined, transition: "r .25s" }} />
            <g role="button" tabIndex={0} aria-label={`${s.label}: ${d.current !== null ? `${fmtCm(d.current)} centímetros` : "sem medida"}`} aria-pressed={on} style={{ cursor: "pointer", outline: "none" }} onClick={() => onFocus?.(on ? null : s.key)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFocus?.(on ? null : s.key); } }} data-testid={`ponto-${s.key}`}>
              <rect x={left ? 0 : 560} y={s.labelY - 62} width="208" height="84" fill="transparent" />
              <text x={tx} y={s.labelY - 36} textAnchor={anchor} fontSize="19" letterSpacing="2.4" fill="#cfe9ff" opacity=".7" style={{ textTransform: "uppercase" }}>{s.short}</text>
              <text x={tx} y={s.labelY} textAnchor={anchor} fontSize="40" fontWeight="700" fill="#ffffff" opacity={has ? 1 : 0.35}>{fmtCm(d.current)}{has && <tspan fontSize="19" fontWeight="500" opacity=".65"> cm</tspan>}{fmtDelta(d.delta) && <tspan fontSize="23" fontWeight="700" fill={c} dx="10">{fmtDelta(d.delta)}</tspan>}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

/** Corpo + resumo + gráfico do ponto escolhido. `live` mostra o que está sendo digitado; `focus/onFocus` deixam outro lugar controlar o ponto. */
export function BodyPanel({ history, live, focus, onFocus, compact = false }: { history: MeasurementSheet[]; live?: Record<string, string>; focus?: SpotKey | null; onFocus?: (k: SpotKey | null) => void; compact?: boolean }) {
  const data = useMemo(() => bodyData(history, live), [history, live]), [inner, setInner] = useState<SpotKey | null>(null);
  const sel = focus !== undefined ? focus : inner, set = onFocus ?? setInner, d = sel ? data[sel] : null, spot = sel ? SPOTS.find((s) => s.key === sel) : null, tot = totalChange(data);
  const measured = Object.values(data).filter((x) => x.current !== null).length;
  return (
    <div data-testid="corpo-painel">
      <BodyScan data={data} focus={sel} onFocus={set} compact={compact} />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[0.7rem]">
        <span className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-cyan">{measured} de {SPOTS.length} pontos medidos</span>
        {tot.n > 0 && <span className="rounded-full border border-white/15 px-3 py-1 text-muted-foreground">variação total {tot.cm > 0 ? "+" : tot.cm < 0 ? "−" : ""}{String(Math.abs(tot.cm)).replace(".", ",")} cm</span>}
        <span className="text-muted-foreground/70"><span className="text-[var(--emerald)]">●</span> na direção do objetivo · <span style={{ color: TONE.bad }}>●</span> ao contrário</span>
      </div>
      {d && spot && <div className="glass mt-3 rounded-2xl p-4" style={{ animation: "fin-rise .4s both" }} data-testid="corpo-detalhe">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-display-h text-lg">{spot.label}</p><p className="tabular-nums"><b className="font-display text-2xl">{fmtCm(d.current)}</b> <span className="text-xs text-muted-foreground">cm</span>{d.delta !== null && d.delta !== 0 && <span className="ml-2 text-sm font-semibold" style={{ color: TONE[d.tone] }}>{fmtDelta(d.delta)} cm</span>}</p></div>
        {d.series.length >= 2 ? <div className="mt-2"><AreaChart points={d.series.map((p) => ({ label: p.date === "agora" ? "agora" : p.date.split("-").reverse().slice(0, 2).join("/"), value: p.value }))} format={(n) => `${String(n).replace(".", ",")} cm`} height={130} color={TONE[d.tone === "none" ? "neutral" : d.tone]} /></div> : <p className="mt-2 text-xs text-muted-foreground">{d.current === null ? "Ainda sem medida neste ponto." : "Com mais um registro, o gráfico e a variação aparecem aqui."}</p>}
      </div>}
    </div>
  );
}
