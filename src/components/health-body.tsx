/** Corpo holográfico: silhueta com malha, varredura de luz, pontos de medida com valor e variação, e o gráfico do ponto escolhido. */
import { useId, useMemo, useState } from "react";

import { AreaChart } from "@/components/finance/charts";
import { SPOTS, bodyData, fmtCm, fmtDelta, totalChange, type SpotData, type SpotKey } from "@/lib/body";
import type { MeasurementSheet } from "@/lib/health-preview";

const TONE = { good: "var(--emerald)", bad: "oklch(0.8 0.15 75)", neutral: "var(--cyan)", none: "oklch(0.6 0.02 260)" } as const;
const SHAPES = {
  head: "M200,13 C212,13 217,24 217,35 C217,50 210,56 200,56 C190,56 183,50 183,35 C183,24 188,13 200,13 Z",
  torso: "M192,56 L192,68 C180,72 166,74 158,82 C156,92 158,104 162,116 C166,132 170,146 174,160 C172,176 162,190 160,208 C160,228 166,244 170,262 C171,296 172,326 174,356 C170,372 170,396 174,420 C176,438 176,452 174,462 L187,468 L189,432 C191,406 191,380 193,356 C195,322 197,294 200,268 C203,294 205,322 207,356 C209,380 209,406 211,432 L213,468 L226,462 C224,452 224,438 226,420 C230,396 230,372 226,356 C228,326 229,296 230,262 C234,244 240,228 240,208 C238,190 228,176 226,160 C230,146 234,132 238,116 C242,104 244,92 242,82 C234,74 220,72 208,68 L208,56 Z",
  armL: "M158,84 C146,92 140,112 138,134 C135,164 131,192 128,222 L127,244 C127,250 136,252 138,246 L144,224 C148,196 152,168 156,146 C158,130 160,112 162,100 Z",
} as const;

export function BodyScan({ data, focus, onFocus, compact = false }: { data: Record<SpotKey, SpotData>; focus: SpotKey | null; onFocus?: ((k: SpotKey | null) => void) | undefined; compact?: boolean }) {
  const uid = useId().replace(/:/g, ""), f = focus ? SPOTS.find((s) => s.key === focus) : null;
  return (
    <svg viewBox="0 0 400 480" className="mx-auto block w-full" style={{ maxWidth: compact ? 360 : 460 }} role="img" aria-label="Corpo com as medidas registradas" data-testid="corpo-scan">
      <defs>
        <linearGradient id={`${uid}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cyan)" stopOpacity=".34" /><stop offset="55%" stopColor="var(--violet)" stopOpacity=".24" /><stop offset="100%" stopColor="var(--cyan)" stopOpacity=".1" /></linearGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--cyan)" /><stop offset="100%" stopColor="var(--violet)" /></linearGradient>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--cyan)" stopOpacity="0" /><stop offset="50%" stopColor="var(--cyan)" stopOpacity=".55" /><stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" /></linearGradient>
        <radialGradient id={`${uid}g`} cx="50%" cy="45%" r="55%"><stop offset="0%" stopColor="var(--violet)" stopOpacity=".28" /><stop offset="100%" stopColor="var(--violet)" stopOpacity="0" /></radialGradient>
        <pattern id={`${uid}l`} width="4" height="7" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="var(--cyan)" fillOpacity=".35" /></pattern>
        <filter id={`${uid}w`} x="-20%" y="-10%" width="140%" height="120%"><feGaussianBlur stdDeviation="3.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <clipPath id={`${uid}c`}><path d={SHAPES.torso} /><path d={SHAPES.head} /><path d={SHAPES.armL} /><path d={SHAPES.armL} transform="translate(400,0) scale(-1,1)" /></clipPath>
      </defs>
      <ellipse cx="200" cy="230" rx="190" ry="226" fill={`url(#${uid}g)`} />
      {/* plataforma */}
      <ellipse cx="200" cy="470" rx="112" ry="13" fill="none" stroke="var(--cyan)" strokeOpacity=".5" strokeDasharray="6 8" data-body-fx style={{ animation: "body-ring 3s linear infinite" }} />
      <ellipse cx="200" cy="470" rx="84" ry="9" fill="none" stroke="var(--violet)" strokeOpacity=".5" />
      <g data-body-fx style={{ animation: "body-float 6s ease-in-out infinite" }}>
        {/* silhueta */}
        <g filter={`url(#${uid}w)`} fill={`url(#${uid}f)`} stroke={`url(#${uid}s)`} strokeWidth="1.6" strokeLinejoin="round"><path d={SHAPES.torso} /><path d={SHAPES.head} /><path d={SHAPES.armL} /><path d={SHAPES.armL} transform="translate(400,0) scale(-1,1)" /></g>
        {/* malha */}
        <g clipPath={`url(#${uid}c)`}>
          <rect x="110" y="10" width="180" height="470" fill={`url(#${uid}l)`} />
          {[-34, -17, 0, 17, 34].map((o) => <path key={o} d={`M${200 + o * 0.3},56 C${200 + o * 1.5},150 ${200 + o * 1.8},300 ${200 + o * 0.9},466`} fill="none" stroke="var(--violet)" strokeOpacity=".28" strokeWidth=".8" />)}
          {[88, 124, 160, 196, 232, 268].map((y) => <path key={y} d={`M150,${y} Q200,${y + 9} 250,${y}`} fill="none" stroke="var(--cyan)" strokeOpacity=".22" strokeWidth=".8" />)}
          {f && <rect x="110" y={f.y - 14} width="180" height="28" fill="var(--cyan)" fillOpacity=".28" />}
          <rect x="110" y="0" width="180" height="46" fill={`url(#${uid}b)`} data-body-fx style={{ animation: "body-scan 6.5s ease-in-out infinite" }} />
        </g>
      </g>
      {/* pontos */}
      {SPOTS.map((s) => {
        const d = data[s.key], c = TONE[d.tone], on = focus === s.key, has = d.current !== null, ax = s.side === "l" ? 98 : 302, tx = s.side === "l" ? 92 : 308, anchor = s.side === "l" ? "end" : "start";
        const dim = focus && !on ? 0.5 : 1;
        return (
          <g key={s.key} opacity={dim} style={{ transition: "opacity .3s" }}>
            <path d={`M${s.x},${s.y} L${s.side === "l" ? 112 : 288},${s.labelY - 4} L${ax},${s.labelY - 4}`} fill="none" stroke={c} strokeOpacity={on ? 0.9 : 0.4} strokeWidth={on ? 1.4 : 0.9} strokeDasharray={has ? undefined : "2 3"} />
            {has && <circle cx={s.x} cy={s.y} r="5" fill={c} data-body-fx style={{ transformOrigin: `${s.x}px ${s.y}px`, animation: "fin-pulse 2.4s ease-out infinite", animationDelay: `${(SPOTS.indexOf(s) % 5) * 0.3}s` }} opacity=".7" />}
            <circle cx={s.x} cy={s.y} r={on ? 6 : 4} fill={has ? c : "none"} stroke={c} strokeWidth="1.5" strokeDasharray={has ? undefined : "2 2"} style={{ filter: has ? `drop-shadow(0 0 5px ${c})` : undefined, transition: "r .25s" }} />
            <g role="button" tabIndex={0} aria-label={`${s.label}: ${d.current !== null ? `${fmtCm(d.current)} centímetros` : "sem medida"}`} aria-pressed={on} style={{ cursor: "pointer", outline: "none" }} onClick={() => onFocus?.(on ? null : s.key)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFocus?.(on ? null : s.key); } }} data-testid={`ponto-${s.key}`}>
              <rect x={s.side === "l" ? 0 : 304} y={s.labelY - 26} width="96" height="34" fill="transparent" />
              <text x={tx} y={s.labelY - 14} textAnchor={anchor} fontSize="8.5" letterSpacing="1.2" fill="currentColor" opacity=".6" style={{ textTransform: "uppercase" }}>{s.short}</text>
              <text x={tx} y={s.labelY + 2} textAnchor={anchor} fontSize="15" fontWeight="700" fill={has ? "currentColor" : "currentColor"} opacity={has ? 1 : 0.35}>{fmtCm(d.current)}{has && <tspan fontSize="8" fontWeight="500" opacity=".6"> cm</tspan>}{fmtDelta(d.delta) && <tspan fontSize="9.5" fontWeight="600" fill={c} dx="5">{fmtDelta(d.delta)}</tspan>}</text>
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
