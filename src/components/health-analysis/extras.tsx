/** Blocos que vieram da antiga página "Progresso" e agora complementam a Análise: radar "antes × agora" e variação por medida. */
import { useId } from "react";

import { measurementLabels, toNumber, type MeasurementSheet } from "@/lib/health-preview";

const keys = Object.keys(measurementLabels);
const palette = ["var(--cyan)", "var(--violet)", "var(--emerald)", "oklch(0.75 0.18 340)", "oklch(0.82 0.15 80)", "oklch(0.72 0.16 250)", "oklch(0.78 0.14 180)"];
export const colorOf = (k: string) => palette[keys.indexOf(k) % palette.length]!;

export function Radar({ first, last }: { first: MeasurementSheet; last: MeasurementSheet }) {
  const id = useId().replace(/:/g, "");
  const S = 340, c = S / 2, R = 120;
  const max = Math.max(1, ...keys.flatMap((k) => [toNumber(first.valores[k]) ?? 0, toNumber(last.valores[k]) ?? 0])) * 1.05;
  const pt = (i: number, v: number) => { const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2; return [c + Math.cos(a) * R * (v / max), c + Math.sin(a) * R * (v / max)] as const; };
  const poly = (m: MeasurementSheet) => keys.map((k, i) => pt(i, toNumber(m.valores[k]) ?? 0).join(",")).join(" ");
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      <div className="absolute inset-[18%] rounded-full border border-dashed border-cyan/30 motion-safe:animate-[spin_30s_linear_infinite]" />
      <div className="absolute inset-[8%] rounded-full border border-violet/20 motion-safe:animate-[spin_45s_linear_infinite_reverse]" />
      <div className="absolute inset-[30%] rounded-full bg-violet/20 blur-3xl" />
      <svg viewBox={`0 0 ${S} ${S}`} className="relative w-full overflow-visible" role="img" aria-label="Comparação das medidas">
        <defs><radialGradient id={`${id}-f`}><stop offset="0%" stopColor="var(--cyan)" stopOpacity=".55" /><stop offset="100%" stopColor="var(--violet)" stopOpacity=".25" /></radialGradient></defs>
        {[0.25, 0.5, 0.75, 1].map((t) => <polygon key={t} points={keys.map((_, i) => pt(i, max * t).join(",")).join(" ")} fill="none" stroke="var(--border)" />)}
        {keys.map((k, i) => { const [ex, ey] = pt(i, max), [lx, ly] = pt(i, max * 1.18); return <g key={k}><line x1={c} y1={c} x2={ex} y2={ey} stroke="var(--border)" /><text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill={colorOf(k)}>{measurementLabels[k]}</text></g>; })}
        <polygon points={poly(first)} fill="var(--violet)" fillOpacity=".1" stroke="var(--violet)" strokeOpacity=".7" strokeDasharray="4 4" />
        <polygon points={poly(last)} fill={`url(#${id}-f)`} stroke="var(--cyan)" strokeWidth="2" style={{ filter: "drop-shadow(0 0 10px var(--cyan))" }} className="origin-center motion-safe:animate-[health-pop_1s_ease-out]" />
        {keys.map((k, i) => { const [px, py] = pt(i, toNumber(last.valores[k]) ?? 0); return <circle key={k} cx={px} cy={py} r="4" fill={colorOf(k)} style={{ filter: `drop-shadow(0 0 6px ${colorOf(k)})` }} />; })}
      </svg>
    </div>
  );
}

/** Primeira e última medida anotada em cada parte (um registro só com peso não zera o resto) e a diferença. */
export function deltasOf(history: MeasurementSheet[]) {
  return keys.map((k) => {
    const vals = history.map((h) => toNumber(h.valores[k])).filter((v): v is number => v !== null), a = vals[0] ?? null, b = vals.at(-1) ?? null;
    return { k, b, d: a !== null && b !== null && vals.length > 1 ? Math.round((b - a) * 10) / 10 : null };
  });
}

export function DeltaBars({ history }: { history: MeasurementSheet[] }) {
  const deltas = deltasOf(history), maxAbs = Math.max(1, ...deltas.map((d) => Math.abs(d.d ?? 0)));
  return (
    <ul className="space-y-4">{deltas.map(({ k, b, d }) => (
      <li key={k}>
        <div className="mb-1.5 flex justify-between text-sm"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: colorOf(k) }} />{measurementLabels[k]}</span>
          <span className="font-mono text-xs"><span className="text-muted-foreground">{b ?? "—"} cm</span>{d !== null && d !== 0 && <span className="ml-2" style={{ color: d < 0 ? "var(--emerald)" : "var(--violet)" }}>{d > 0 ? "+" : "−"}{String(Math.abs(d)).replace(".", ",")}</span>}</span></div>
        <div className="relative h-2 rounded-full bg-border/60"><span className="absolute left-1/2 top-[-3px] h-[14px] w-px bg-muted-foreground/50" />{d !== null && d !== 0 && <span className={`bar-grow absolute top-0 h-2 rounded-full ${d < 0 ? "right-1/2 origin-right" : "left-1/2"}`} style={{ width: `${(Math.abs(d) / maxAbs) * 50}%`, background: colorOf(k), boxShadow: `0 0 12px ${colorOf(k)}` }} />}</div>
      </li>))}</ul>
  );
}
