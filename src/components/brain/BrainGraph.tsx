import { useEffect, useMemo, useState } from "react";
import { Network } from "lucide-react";

import type { BrainEntry } from "@/lib/data/brain";

type NodeKind = "dossie" | "entry" | "doc" | "demanda";
type N = { id: string; kind: NodeKind; label: string; x: number; y: number; vx: number; vy: number; r: number; entry?: BrainEntry };
type E = { a: string; b: string };

const W = 1000, H = 620;
const CODE = /#?\b([GPM])0?(\d{2,3})\b/gi;
export const codesIn = (t: string) => [...new Set([...t.matchAll(CODE)].map((m) => `#${m[1]!.toUpperCase()}0${m[2]!.padStart(2, "0").slice(-2)}`))];

/** Monta nós (dossiês, anotações, documentação, demandas citadas) e as ligações entre eles. */
export function buildGraph(entries: BrainEntry[]) {
  const nodes = new Map<string, Omit<N, "x" | "y" | "vx" | "vy">>();
  const edges: E[] = [];
  const add = (id: string, kind: NodeKind, label: string, r: number, entry?: BrainEntry) => { if (!nodes.has(id)) nodes.set(id, { id, kind, label, r, ...(entry ? { entry } : {}) }); };
  for (const e of entries.slice(0, 140)) {
    const id = `e:${e.id}`;
    add(id, e.source === "documentacao" ? "doc" : "entry", e.title || e.text.slice(0, 40) || e.attachments[0]?.name || "Anotação", e.attachments.length ? 8 : 6, e);
    for (const d of e.dossiers) { add(`d:${d}`, "dossie", d, 15); edges.push({ a: id, b: `d:${d}` }); }
    for (const c of codesIn(`${e.title} ${e.text}`)) { add(`c:${c}`, "demanda", c, 9); edges.push({ a: id, b: `c:${c}` }); }
  }
  return { nodes: [...nodes.values()], edges };
}

/** Distribuição por forças (repulsão + molas + gravidade), calculada de uma vez. */
function layout(base: ReturnType<typeof buildGraph>): { nodes: N[]; edges: E[] } {
  const nodes: N[] = base.nodes.map((n, i) => {
    const a = (i / Math.max(1, base.nodes.length)) * Math.PI * 2;
    const ring = n.kind === "dossie" ? 120 : 250;
    return { ...n, x: W / 2 + Math.cos(a) * ring, y: H / 2 + Math.sin(a) * ring * 0.65, vx: 0, vy: 0 };
  });
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  for (let it = 0; it < 320; it++) {
    const cool = 1 - it / 320;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!, b = nodes[j]!;
      let dx = a.x - b.x, dy = a.y - b.y; let d2 = dx * dx + dy * dy;
      if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
      const f = (a.r + b.r + 26) ** 2 * 9 / d2 * cool;
      const d = Math.sqrt(d2);
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const e of base.edges) {
      const a = nodes[idx.get(e.a)!]!, b = nodes[idx.get(e.b)!]!;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - 120) * 0.03;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      n.vx += (W / 2 - n.x) * 0.004; n.vy += (H / 2 - n.y) * 0.006;
      n.x += Math.max(-14, Math.min(14, n.vx)) * 0.85; n.y += Math.max(-14, Math.min(14, n.vy)) * 0.85;
      n.vx *= 0.6; n.vy *= 0.6;
      n.x = Math.max(40, Math.min(W - 40, n.x)); n.y = Math.max(34, Math.min(H - 34, n.y));
    }
  }
  return { nodes, edges: base.edges };
}

const COLOR: Record<NodeKind, string> = { dossie: "var(--cyan)", entry: "var(--violet)", doc: "oklch(0.8 0.15 75)", demanda: "var(--pink, oklch(0.72 0.2 350))" };
const KIND_LABEL: Record<NodeKind, string> = { dossie: "Dossiê", entry: "Anotação", doc: "Documentação", demanda: "Demanda" };

export function BrainGraph({ entries, onOpen, onDossier }: { entries: BrainEntry[]; onOpen: (id: string) => void; onDossier: (name: string) => void }) {
  const [g, setG] = useState<{ nodes: N[]; edges: E[] } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const base = useMemo(() => buildGraph(entries), [entries]);
  useEffect(() => { setG(layout(base)); }, [base]);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of base.edges) { (m.get(e.a) ?? m.set(e.a, new Set()).get(e.a)!).add(e.b); (m.get(e.b) ?? m.set(e.b, new Set()).get(e.b)!).add(e.a); }
    return m;
  }, [base]);

  if (!entries.length) return <p className="grid h-72 place-items-center text-sm text-muted-foreground">Documente algo para o mapa nascer.</p>;
  if (!g) return <div className="grid h-72 place-items-center text-sm text-muted-foreground">Ligando as ideias…</div>;
  const by = new Map(g.nodes.map((n) => [n.id, n]));
  const lit = (id: string) => !hover || hover === id || neighbors.get(hover)?.has(id);
  const hoverNode = hover ? by.get(hover) : undefined;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-[radial-gradient(70%_70%_at_50%_50%,color-mix(in_oklab,var(--violet)_10%,transparent),transparent)]" data-testid="grafo">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Mapa de ligações do segundo cérebro">
        <defs>
          <filter id="bg-glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <pattern id="bg-dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="var(--muted-foreground)" opacity=".18" /></pattern>
        </defs>
        <rect width={W} height={H} fill="url(#bg-dots)" />
        {g.edges.map((e, i) => {
          const a = by.get(e.a)!, b = by.get(e.b)!;
          const on = !hover || hover === e.a || hover === e.b;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COLOR[b.kind]} strokeWidth={on && hover ? 1.8 : 1} opacity={on ? (hover ? 0.9 : 0.35) : 0.05} style={{ transition: "opacity .25s" }} />;
        })}
        {g.nodes.map((n) => {
          const c = COLOR[n.kind], on = lit(n.id);
          const showLabel = n.kind === "dossie" || n.kind === "demanda" || hover === n.id || (!!hover && neighbors.get(hover)?.has(n.id));
          return (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`} opacity={on ? 1 : 0.15} style={{ transition: "opacity .25s", cursor: "pointer" }}
              onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}
              onClick={() => (n.kind === "dossie" ? onDossier(n.label) : n.entry ? onOpen(n.entry.id) : undefined)} tabIndex={0} role="button" aria-label={`${KIND_LABEL[n.kind]}: ${n.label}`}
              onKeyDown={(ev) => { if (ev.key === "Enter") (n.kind === "dossie" ? onDossier(n.label) : n.entry && onOpen(n.entry.id)); }}>
              {n.kind === "dossie" && <circle r={n.r + 9} fill="none" stroke={c} strokeOpacity=".25" className="animate-pulse-ring" />}
              <circle r={hover === n.id ? n.r + 3 : n.r} fill={c} fillOpacity={n.kind === "entry" || n.kind === "doc" ? 0.85 : 0.95} filter="url(#bg-glow)" style={{ transition: "r .2s" }} />
              {n.entry && n.entry.attachments.length > 0 && <circle r={n.r + 4} fill="none" stroke="var(--emerald)" strokeWidth="1.4" strokeDasharray="3 3" />}
              {showLabel && <text y={-n.r - 8} textAnchor="middle" fontSize={n.kind === "dossie" ? 13 : 11} fill="var(--foreground)" style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3 }}>{n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label}</text>}
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-[0.65rem] text-muted-foreground">
        {(Object.keys(COLOR) as NodeKind[]).map((k) => <span key={k} className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2 py-0.5 backdrop-blur"><span className="h-2 w-2 rounded-full" style={{ background: COLOR[k], boxShadow: `0 0 8px ${COLOR[k]}` }} />{KIND_LABEL[k]}</span>)}
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2 py-0.5 backdrop-blur"><span className="h-2 w-2 rounded-full border border-dashed border-emerald" />com arquivo</span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-2 text-[0.7rem] text-muted-foreground">
        <Network size={12} className="text-cyan" />
        {hoverNode ? <span className="truncate"><b className="text-foreground">{KIND_LABEL[hoverNode.kind]}</b> · {hoverNode.label}{hoverNode.entry ? ` · ${hoverNode.entry.date.split("-").reverse().join("/")}` : ""} · clique para abrir</span> : <span>Passe o mouse num ponto para ver as ligações. Clique num dossiê para filtrar.</span>}
      </div>
    </div>
  );
}
