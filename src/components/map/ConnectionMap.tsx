/** Mapa de conexões: o segundo cérebro como uma rede viva (canvas): projetos, dossiês, demandas, anotações, ideias, reuniões, pessoas e pedidos ligados entre si, com física, partículas correndo pelas ligações, zoom, arrastar, busca e painel de detalhes. */
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Crosshair, Eye, EyeOff, FlaskConical, Pause, Play, RefreshCw, Search, Sparkles, X } from "lucide-react";

import { useCountUp } from "@/components/finance/charts";
import { MapSim, type SimNode, type View } from "@/components/map/engine";
import { useMapData } from "@/lib/data/map";
import { KIND, KINDS, buildMap, demoData, type Kind } from "@/lib/map-graph";

type RGB = [number, number, number];
const toRgb = (() => {
  const cache = new Map<string, RGB>(); let ctx: CanvasRenderingContext2D | null = null;
  return (c: string): RGB => {
    const hit = cache.get(c); if (hit) return hit;
    let css = c;
    if (c.startsWith("var(")) css = getComputedStyle(document.documentElement).getPropertyValue(c.slice(4, -1).trim()).trim() || "#7dd3fc";
    ctx ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    let out: RGB = [125, 211, 252];
    if (ctx) { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#000"; ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; out = [d[0]!, d[1]!, d[2]!]; }
    cache.set(c, out); return out;
  };
})();
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const ease = (t: number) => 1 - (1 - t) ** 3;
const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function Stat({ v, l, c }: { v: number; l: string; c: string }) {
  const n = Math.round(useCountUp(v));
  return <div className="text-center"><b className="block font-display text-2xl font-semibold tabular-nums" style={{ color: c, textShadow: `0 0 18px ${c}` }}>{n}</b><span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">{l}</span></div>;
}
function Corners() {
  const c = "pointer-events-none absolute h-4 w-4 border-cyan/60";
  return <><span className={`${c} left-3 top-3 border-l border-t`} /><span className={`${c} right-3 top-3 border-r border-t`} /><span className={`${c} bottom-3 left-3 border-b border-l`} /><span className={`${c} bottom-3 right-3 border-b border-r`} /></>;
}

export function ConnectionMap({ height = "calc(100vh - 250px)" }: { height?: string }) {
  const data = useMapData();
  const [demo, setDemo] = useState(false), [on, setOn] = useState<Set<Kind>>(() => new Set(KINDS.map((k) => k.k))), [onlyOpen, setOnlyOpen] = useState(false), [q, setQ] = useState(""), [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<string | null>(null), [hover, setHover] = useState<string | null>(null);
  const graph = useMemo(() => buildMap(demo ? demoData() : (data.data ?? { projects: [], dossiers: [], demands: [], execs: [], pnotes: [], entries: [], tasks: [], ideas: [], meetings: [], requests: [] })), [demo, data.data]);
  const wrap = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), mini = useRef<HTMLCanvasElement>(null), sim = useRef<MapSim | null>(null), view = useRef<View>({ x: 0, y: 0, k: 1 });
  const size = useRef({ w: 900, h: 600, dpr: 1 }), fly = useRef<{ to: View; t0: number } | null>(null), drag = useRef<{ kind: "pan" | "node"; node?: SimNode; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(null);
  const ui = useRef({ on, onlyOpen, q: "", paused, selected, hover, birth: 0 });
  ui.current = { ...ui.current, on, onlyOpen, q: q.trim().toLowerCase(), paused, selected, hover };

  const visible = useCallback((n: SimNode) => ui.current.on.has(n.kind) && (!ui.current.onlyOpen || !((n.kind === "demanda" || n.kind === "tarefa" || n.kind === "ideia") && !n.open)), []);
  const fit = useCallback(() => { const s = sim.current; if (s) fly.current = { to: s.fit(size.current.w, size.current.h, 60, visible, size.current.w < 700 ? 200 : 140), t0: performance.now() }; }, [visible]);

  // nasce uma simulação nova quando a rede muda
  useEffect(() => {
    const s = sim.current ?? new MapSim(graph, size.current.w, size.current.h); if (sim.current) s.load(graph); sim.current = s; s.w = size.current.w; s.h = size.current.h;
    for (let i = 0; i < 120; i++) s.tick(i * 16); // já começa arrumadinho
    ui.current.birth = performance.now(); view.current = s.fit(size.current.w, size.current.h, 60); setSelected(null);
  }, [graph]);

  // laço de animação
  useEffect(() => {
    const cv = canvas.current, box = wrap.current; if (!cv || !box) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const resize = () => { const r = box.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1); size.current = { w: r.width, h: r.height, dpr }; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); if (sim.current) { sim.current.w = r.width; sim.current.h = r.height; } };
    resize(); const ro = new ResizeObserver(resize); ro.observe(box);
    let raf = 0, last = 0; const calm = reduced();
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const s = sim.current; if (!s || document.hidden) return;
      const { w, h, dpr } = size.current, u = ui.current;
      if (!u.paused) { s.tick(calm ? 0 : t); if (calm && s.alpha < 0.05) s.alpha = 0.03; }
      const f = fly.current; if (f) { const p = Math.min(1, (t - f.t0) / 700), e = ease(p), v = view.current; view.current = { x: v.x + (f.to.x - v.x) * (0.08 + e * 0.18), y: v.y + (f.to.y - v.y) * (0.08 + e * 0.18), k: v.k + (f.to.k - v.k) * (0.08 + e * 0.18) }; if (p >= 1) fly.current = null; }
      const v = view.current, focus = u.hover ?? u.selected, near = focus ? s.neighbors(focus) : null, match = u.q ? (n: SimNode) => n.label.toLowerCase().includes(u.q) || n.sub.toLowerCase().includes(u.q) : null;
      const lit = (n: SimNode) => (focus ? n.id === focus || near!.has(n.id) : true) && (match ? match(n) : true);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
      const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, 0, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * 0.65); vg.addColorStop(0, "rgba(40,30,90,.18)"); vg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr * v.k, 0, 0, dpr * v.k, dpr * v.x, dpr * v.y);
      // ligações
      for (let i = 0; i < s.links.length; i++) {
        const l = s.links[i]!; if (!visible(l.s) || !visible(l.t)) continue;
        const hl = !!focus && (l.s.id === focus || l.t.id === focus), dim = (focus && !hl) || (match && !(match(l.s) && match(l.t)));
        const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y, len = Math.hypot(dx, dy) || 1, mx = (l.s.x + l.t.x) / 2 - (dy / len) * len * l.bend, my = (l.s.y + l.t.y) / 2 + (dx / len) * len * l.bend;
        const ca = toRgb(KIND[l.s.kind].color), cb = toRgb(KIND[l.t.kind].color), g = ctx.createLinearGradient(l.s.x, l.s.y, l.t.x, l.t.y);
        const a = dim ? 0.04 : hl ? 0.85 : 0.2; g.addColorStop(0, rgba(ca, a)); g.addColorStop(1, rgba(cb, a));
        ctx.strokeStyle = g; ctx.lineWidth = (hl ? 1.9 : 0.9) / Math.sqrt(v.k); ctx.beginPath(); ctx.moveTo(l.s.x, l.s.y); ctx.quadraticCurveTo(mx, my, l.t.x, l.t.y); ctx.stroke();
        if (!calm && !dim && (hl || i % 3 === 0)) { // partículas correndo pela ligação
          const n = hl ? 2 : 1; for (let p = 0; p < n; p++) { const tt = ((t * (hl ? 0.00042 : 0.00022) + (i * 0.37) + p * 0.5) % 1), it = 1 - tt, px = it * it * l.s.x + 2 * it * tt * mx + tt * tt * l.t.x, py = it * it * l.s.y + 2 * it * tt * my + tt * tt * l.t.y; ctx.fillStyle = rgba(hl ? [255, 255, 255] : ca, hl ? 0.95 : 0.55); ctx.beginPath(); ctx.arc(px, py, (hl ? 2.1 : 1.3) / Math.sqrt(v.k), 0, 6.283); ctx.fill(); }
        }
      }
      // nós
      ctx.globalCompositeOperation = "lighter";
      const age = t - u.birth;
      for (let i = 0; i < s.nodes.length; i++) {
        const n = s.nodes[i]!; if (!visible(n)) continue;
        const born = Math.max(0, Math.min(1, (age - i * 5) / 700)), grow = ease(born); if (grow <= 0) continue;
        const c = toRgb(KIND[n.kind].color), isF = n.id === focus, dim = !lit(n), pulse = 1 + Math.sin(t * 0.003 + n.phase) * (n.urgent ? 0.14 : n.open && n.kind === "demanda" ? 0.07 : 0.03), r = n.r * grow * pulse * (isF ? 1.18 : 1);
        const alpha = dim ? 0.1 : n.kind === "demanda" && !n.open ? 0.5 : 1, glow = r * (n.kind === "projeto" ? 4.4 : n.kind === "dossie" ? 3.6 : 3);
        const gg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glow); gg.addColorStop(0, rgba(c, 0.5 * alpha)); gg.addColorStop(0.35, rgba(c, 0.16 * alpha)); gg.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(n.x, n.y, glow, 0, 6.283); ctx.fill();
        if (n.urgent && !dim) { const ph = (t * 0.0012 + n.phase) % 1; ctx.strokeStyle = rgba([255, 90, 120], (1 - ph) * 0.7); ctx.lineWidth = 1.4 / Math.sqrt(v.k); ctx.beginPath(); ctx.arc(n.x, n.y, r + ph * 26, 0, 6.283); ctx.stroke(); }
        if (n.id === u.selected && !dim) for (let k = 0; k < 2; k++) { const ph = ((t * 0.0009) + k * 0.5) % 1; ctx.strokeStyle = rgba(c, (1 - ph) * 0.8); ctx.lineWidth = 1.6 / Math.sqrt(v.k); ctx.beginPath(); ctx.arc(n.x, n.y, r + 4 + ph * 34, 0, 6.283); ctx.stroke(); }
      }
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < s.nodes.length; i++) {
        const n = s.nodes[i]!; if (!visible(n)) continue;
        const born = Math.max(0, Math.min(1, (age - i * 5) / 700)), grow = ease(born); if (grow <= 0) continue;
        const c = toRgb(KIND[n.kind].color), dim = !lit(n), isF = n.id === focus, r = n.r * grow * (isF ? 1.18 : 1), alpha = dim ? 0.12 : n.kind === "demanda" && !n.open ? 0.55 : 1;
        const cg = ctx.createRadialGradient(n.x - r * 0.35, n.y - r * 0.4, r * 0.1, n.x, n.y, r); cg.addColorStop(0, rgba([Math.min(255, c[0] + 90), Math.min(255, c[1] + 90), Math.min(255, c[2] + 90)], alpha)); cg.addColorStop(1, rgba(c, alpha * 0.92));
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 6.283); ctx.fill();
        if (n.kind === "projeto" || n.kind === "dossie") { ctx.strokeStyle = rgba(c, alpha * 0.6); ctx.lineWidth = 1 / Math.sqrt(v.k); ctx.beginPath(); ctx.arc(n.x, n.y, r + 4 + Math.sin(t * 0.002 + n.phase) * 1.2, 0, 6.283); ctx.stroke(); }
        if (match && match(n)) { ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.6 / Math.sqrt(v.k); ctx.beginPath(); ctx.arc(n.x, n.y, r + 6, 0, 6.283); ctx.stroke(); }
        const showLabel = !dim && (n.kind === "projeto" || (n.kind === "dossie" && v.k > 0.5) || isF || (focus && near!.has(n.id)) || (match && match(n)) || (v.k > 1.35 && n.degree >= 2) || v.k > 2.2);
        if (showLabel) { const fs = Math.max(9, Math.min(16, (n.kind === "projeto" ? 15 : n.kind === "dossie" ? 12.5 : 11) / Math.sqrt(v.k))); ctx.font = `${n.kind === "projeto" ? 700 : 500} ${fs}px Sora, system-ui, sans-serif`; ctx.textAlign = "center"; ctx.lineWidth = 3.4 / Math.sqrt(v.k); ctx.strokeStyle = "rgba(4,6,18,.92)"; ctx.fillStyle = "rgba(240,245,255,.96)"; ctx.strokeText(n.label, n.x, n.y - r - 8 / Math.sqrt(v.k)); ctx.fillText(n.label, n.x, n.y - r - 8 / Math.sqrt(v.k)); }
      }
      // mini-mapa
      const mc = mini.current, mctx = mc?.getContext("2d");
      if (mc && mctx && (t - last > 120)) {
        last = t; mctx.clearRect(0, 0, mc.width, mc.height); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const n of s.nodes) { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x); y1 = Math.max(y1, n.y); }
        const sc = Math.min((mc.width - 12) / Math.max(1, x1 - x0), (mc.height - 12) / Math.max(1, y1 - y0)), ox = 6 - x0 * sc + (mc.width - 12 - (x1 - x0) * sc) / 2, oy = 6 - y0 * sc + (mc.height - 12 - (y1 - y0) * sc) / 2;
        for (const n of s.nodes) { if (!visible(n)) continue; mctx.fillStyle = rgba(toRgb(KIND[n.kind].color), 0.9); mctx.fillRect(n.x * sc + ox - 1, n.y * sc + oy - 1, n.kind === "projeto" ? 4 : 2, n.kind === "projeto" ? 4 : 2); }
        mctx.strokeStyle = "rgba(125,211,252,.9)"; mctx.lineWidth = 1; mctx.strokeRect(((-v.x) / v.k) * sc + ox, ((-v.y) / v.k) * sc + oy, (w / v.k) * sc, (size.current.h / v.k) * sc);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [visible]);

  const toWorld = (e: { clientX: number; clientY: number }) => { const r = canvas.current!.getBoundingClientRect(), v = view.current; return { sx: e.clientX - r.left, sy: e.clientY - r.top, wx: (e.clientX - r.left - v.x) / v.k, wy: (e.clientY - r.top - v.y) / v.k }; };
  const onDown = (e: React.PointerEvent) => {
    const s = sim.current; if (!s) return; canvas.current!.setPointerCapture(e.pointerId); fly.current = null;
    const p = toWorld(e), n = s.hit(p.wx, p.wy, 6 / view.current.k, visible);
    drag.current = n ? { kind: "node", node: n, sx: p.sx, sy: p.sy, vx: 0, vy: 0, moved: false } : { kind: "pan", sx: p.sx, sy: p.sy, vx: view.current.x, vy: view.current.y, moved: false };
    if (n) { n.pinned = true; s.reheat(0.4); }
  };
  const onMove = (e: React.PointerEvent) => {
    const s = sim.current; if (!s) return; const p = toWorld(e), d = drag.current;
    if (d) {
      if (Math.hypot(p.sx - d.sx, p.sy - d.sy) > 4) d.moved = true;
      if (d.kind === "node" && d.node) { d.node.x = p.wx; d.node.y = p.wy; s.reheat(0.35); } else if (d.kind === "pan") view.current = { ...view.current, x: d.vx + (p.sx - d.sx), y: d.vy + (p.sy - d.sy) };
      return;
    }
    const n = s.hit(p.wx, p.wy, 6 / view.current.k, visible); const id = n?.id ?? null; if (id !== ui.current.hover) { setHover(id); canvas.current!.style.cursor = id ? "pointer" : "grab"; }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null; if (!d) return; canvas.current?.releasePointerCapture(e.pointerId);
    if (d.kind === "node" && d.node) { d.node.pinned = false; if (!d.moved) { setSelected(d.node.id); } sim.current?.reheat(0.3); } else if (!d.moved) setSelected(null);
  };
  const onWheel = (e: React.WheelEvent) => {
    const p = toWorld(e), v = view.current, k = Math.max(0.12, Math.min(5, v.k * Math.exp(-e.deltaY * 0.0014)));
    view.current = { k, x: p.sx - p.wx * k, y: p.sy - p.wy * k }; fly.current = null;
  };
  const focusOn = (id: string) => { const n = sim.current?.byId.get(id); if (!n) return; setSelected(id); const { w, h } = size.current, k = Math.max(1.4, view.current.k); fly.current = { to: { k, x: w / 2 - n.x * k - (selected ? 0 : 0), y: h / 2 - n.y * k }, t0: performance.now() }; };
  useEffect(() => { const el = canvas.current; if (!el) return; const stop = (e: WheelEvent) => e.preventDefault(); el.addEventListener("wheel", stop, { passive: false }); return () => el.removeEventListener("wheel", stop); }, []);

  const sel = selected ? sim.current?.byId.get(selected) ?? null : null;
  const conns = useMemo(() => {
    if (!sel || !sim.current) return [] as { kind: Kind; items: SimNode[] }[];
    const by = new Map<Kind, SimNode[]>(); for (const id of sim.current.neighbors(sel.id)) { const n = sim.current.byId.get(id); if (n) (by.get(n.kind) ?? by.set(n.kind, []).get(n.kind)!).push(n); }
    return [...by.entries()].map(([kind, items]) => ({ kind, items: items.sort((a, b) => b.degree - a.degree) }));
  }, [selected, graph]);
  const empty = !demo && !data.isPending && graph.nodes.length === 0;
  const dateBR = (s?: string) => (s ? s.split("-").reverse().join("/") : "");

  return (
    <div ref={wrap} className="fin-frame glass relative overflow-hidden rounded-[2rem]" style={{ height, minHeight: 520, boxShadow: "inset 0 1px 0 oklch(1 0 0 / 7%), 0 50px 120px -60px var(--violet)" }} data-testid="mapa">
      <div aria-hidden className="fin-dots pointer-events-none absolute inset-0 opacity-40" />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-cyan/10 to-transparent" style={{ animation: "health-scan 7s ease-in-out infinite" }} />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full cursor-grab touch-none" style={{ width: "100%", height: "100%" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { if (!drag.current) setHover(null); }} onWheel={onWheel} data-testid="mapa-canvas" aria-label="Mapa de conexões do Orion" />
      <Corners />

      <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-col gap-2.5 sm:inset-x-6 sm:top-6" data-testid="mapa-topo">
       <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2.5">
        <div className="glass pointer-events-auto flex shrink-0 gap-5 rounded-2xl px-4 py-2.5" data-testid="mapa-stats"><Stat v={graph.nodes.length} l="nós" c="var(--cyan)" /><Stat v={graph.links.length} l="ligações" c="var(--violet)" /><Stat v={graph.nodes.filter((n) => n.urgent).length} l="urgentes" c="oklch(0.72 0.19 25)" /></div>
      <div className="pointer-events-auto flex w-full min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 sm:w-auto sm:flex-1 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
        <label className="glass flex items-center gap-2 rounded-full px-3.5 py-2"><Search size={13} className="text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no mapa…" className="w-32 bg-transparent text-xs outline-none sm:w-44 placeholder:text-muted-foreground" data-testid="mapa-busca" />{q && <button type="button" aria-label="Limpar" onClick={() => setQ("")}><X size={12} /></button>}</label>
        <div className="contents [&>*]:shrink-0">
          {([[fit, "Enquadrar", Crosshair, false], [() => { sim.current?.scatter(); setTimeout(fit, 900); }, "Reorganizar", RefreshCw, false], [() => setPaused((p) => !p), paused ? "Soltar movimento" : "Pausar", paused ? Play : Pause, paused], [() => setOnlyOpen((o) => !o), onlyOpen ? "Só pendentes" : "Tudo", onlyOpen ? EyeOff : Eye, onlyOpen]] as [() => void, string, typeof Crosshair, boolean][]).map(([fn, l, I, act]) => <button key={l} type="button" onClick={fn} className={`glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition active:scale-95 ${act ? "!border-cyan/50 text-cyan" : "text-muted-foreground hover:text-foreground"}`}><I size={12} />{l}</button>)}
          <button type="button" onClick={() => setDemo((d) => !d)} aria-pressed={demo} data-testid="mapa-exemplo" className={`glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition active:scale-95 ${demo ? "!border-amber/50 text-amber" : "text-muted-foreground hover:text-foreground"}`}><FlaskConical size={12} />{demo ? "Voltar aos meus dados" : "Ver exemplo"}</button>
        </div>
      </div>
       </div>
        <div className="pointer-events-auto flex flex-nowrap gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 sm:flex-wrap sm:overflow-visible sm:pb-0" data-testid="mapa-legenda">{KINDS.map((k) => graph.counts[k.k] > 0 && (
          <button key={k.k} type="button" aria-pressed={on.has(k.k)} onClick={() => setOn((s) => { const n = new Set(s); if (n.has(k.k)) n.delete(k.k); else n.add(k.k); return n; })} data-testid={`tipo-${k.k}`} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] backdrop-blur transition active:scale-95 ${on.has(k.k) ? "border-white/20 bg-background/60 text-foreground" : "border-white/5 bg-background/30 text-muted-foreground/50 line-through"}`}>
            <span className="h-2 w-2 rounded-full" style={{ background: k.color, boxShadow: `0 0 8px ${k.color}` }} />{k.label}<span className="font-mono opacity-60">{graph.counts[k.k]}</span></button>))}</div>
      </div>


      <canvas ref={mini} width={170} height={110} className="glass pointer-events-none absolute bottom-4 left-4 hidden rounded-xl sm:block sm:bottom-6 sm:left-6" aria-hidden />
      <p className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground md:flex"><Sparkles size={11} className="text-cyan" /> roda para zoom · arraste para mover · clique num nó{demo && <span className="text-amber">· exemplo</span>}</p>

      {data.isPending && !demo && <div className="absolute inset-0 grid place-items-center"><span className="mono-caps animate-pulse">Ligando as conexões…</span></div>}
      {empty && <div className="absolute inset-0 grid place-items-center p-6"><div className="glass max-w-sm rounded-3xl p-6 text-center"><p className="font-display text-lg font-semibold">O mapa nasce com o que você registra</p><p className="mt-1 text-sm text-muted-foreground">Crie projetos, demandas, anotações e reuniões e eles aparecem aqui, ligados.</p><button type="button" onClick={() => setDemo(true)} className="mt-3 rounded-full border border-cyan/50 bg-cyan/10 px-4 py-2 text-xs font-medium text-cyan hover:bg-cyan/20">Ver um exemplo</button></div></div>}

      {sel && (
        <aside className="glass scroll-thin absolute inset-y-4 right-4 z-10 flex w-[min(21rem,calc(100%-2rem))] flex-col overflow-y-auto rounded-3xl p-5 sm:inset-y-6 sm:right-6" style={{ animation: "fin-rise .4s both", top: "9.5rem" }} data-testid="mapa-painel">
          <div className="flex items-start justify-between gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider" style={{ color: KIND[sel.kind].color, borderColor: `color-mix(in oklab, ${KIND[sel.kind].color} 45%, transparent)` }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND[sel.kind].color, boxShadow: `0 0 8px ${KIND[sel.kind].color}` }} />{KIND[sel.kind].label.replace(/s$/, "")}</span><button type="button" onClick={() => setSelected(null)} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={15} /></button></div>
          <h3 className="mt-3 font-display text-lg font-semibold leading-snug" data-testid="painel-titulo">{sel.label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{sel.sub}{sel.date ? ` · ${dateBR(sel.date)}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[0.65rem]">{sel.urgent && <span className="rounded-full bg-[oklch(0.72_0.19_25/0.2)] px-2 py-0.5 text-[oklch(0.8_0.15_25)]">urgente</span>}{sel.open && <span className="rounded-full bg-amber/15 px-2 py-0.5 text-amber">em aberto</span>}<span className="rounded-full bg-white/10 px-2 py-0.5 font-mono">{sel.degree} ligações</span></div>
          <Link to={sel.link.split("?")[0] as "/demandas"} {...(sel.link.includes("?") ? { search: Object.fromEntries(new URLSearchParams(sel.link.split("?")[1])) as never } : {})} className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-cyan/50 bg-cyan/10 px-4 py-2 text-xs font-medium text-cyan transition hover:bg-cyan/20" data-testid="painel-abrir">Abrir no Orion <ArrowUpRight size={13} /></Link>
          <div className="mt-5 space-y-4">{conns.map((g) => <div key={g.kind}><p className="mb-1.5 flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ background: KIND[g.kind].color }} />{KIND[g.kind].label} <span className="opacity-60">{g.items.length}</span></p>
            <ul className="space-y-1">{g.items.slice(0, 12).map((n) => <li key={n.id}><button type="button" onClick={() => focusOn(n.id)} className="w-full truncate rounded-lg border border-white/5 px-2.5 py-1.5 text-left text-xs transition hover:border-white/20 hover:bg-white/5" data-testid="painel-conexao">{n.label}</button></li>)}{g.items.length > 12 && <li className="px-1 text-[0.65rem] text-muted-foreground">+{g.items.length - 12} outros</li>}</ul></div>)}
            {!conns.length && <p className="text-xs text-muted-foreground">Sem ligações ainda.</p>}</div>
        </aside>
      )}
    </div>
  );
}
