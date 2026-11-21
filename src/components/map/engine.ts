/** Motor do mapa de conexões: física (molas + repulsão em grade + gravidade), enquadramento e acerto de clique. Sem React, para testar à parte. */
import { KIND, type Kind, type MapGraph, type MapLink, type MapNode } from "@/lib/map-graph";

export type SimNode = MapNode & { x: number; y: number; vx: number; vy: number; pinned: boolean; phase: number };
export type SimLink = MapLink & { s: SimNode; t: SimNode; bend: number };
export type View = { x: number; y: number; k: number };

/** Gerador pseudo-aleatório fixo (a mesma rede nasce sempre no mesmo lugar). */
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

export class MapSim {
  nodes: SimNode[] = []; links: SimLink[] = []; alpha = 1; byId = new Map<string, SimNode>(); adj = new Map<string, Set<string>>();
  constructor(g: MapGraph, public w = 1000, public h = 700) { this.load(g); }
  load(g: MapGraph) {
    const rand = rng(7), ring: Record<Kind, number> = { projeto: 0.08, dossie: 0.3, demanda: 0.5, reuniao: 0.45, pessoa: 0.6, conversa: 0.55, pedido: 0.65, anotacao: 0.7, doc: 0.7, tarefa: 0.8, ideia: 0.85 };
    const old = this.byId; this.byId = new Map(); this.adj = new Map();
    this.nodes = g.nodes.map((n, i) => {
      const prev = old.get(n.id), a = (i / Math.max(1, g.nodes.length)) * Math.PI * 2 * 7 + rand() * 0.6, rad = ring[n.kind] * Math.min(this.w, this.h) * 0.75 * (0.7 + rand() * 0.6);
      const s: SimNode = { ...n, x: prev?.x ?? this.w / 2 + Math.cos(a) * rad, y: prev?.y ?? this.h / 2 + Math.sin(a) * rad, vx: 0, vy: 0, pinned: false, phase: rand() * 6.28 };
      this.byId.set(n.id, s); return s;
    });
    this.links = g.links.map((l, i) => ({ ...l, s: this.byId.get(l.a)!, t: this.byId.get(l.b)!, bend: (i % 2 ? 1 : -1) * (0.08 + (i % 5) * 0.025) }));
    for (const l of g.links) { (this.adj.get(l.a) ?? this.adj.set(l.a, new Set()).get(l.a)!).add(l.b); (this.adj.get(l.b) ?? this.adj.set(l.b, new Set()).get(l.b)!).add(l.a); }
    this.alpha = 1;
  }
  reheat(a = 0.7) { this.alpha = Math.max(this.alpha, a); }
  /** Reembaralha perto do centro e deixa a física arrumar de novo. */
  scatter() { const rand = rng(Date.now() & 0xffff); for (const n of this.nodes) { n.x = this.w / 2 + (rand() - 0.5) * this.w * 0.6; n.y = this.h / 2 + (rand() - 0.5) * this.h * 0.6; n.vx = n.vy = 0; } this.alpha = 1; }

  tick(time = 0) {
    const N = this.nodes, a = this.alpha, cx = this.w / 2, cy = this.h / 2;
    // repulsão: só entre vizinhos da grade (custo ~linear)
    const cell = 150, grid = new Map<number, SimNode[]>(), key = (gx: number, gy: number) => gx * 73856093 ^ gy * 19349663;
    for (const n of N) { const k = key(Math.floor(n.x / cell), Math.floor(n.y / cell)); (grid.get(k) ?? grid.set(k, []).get(k)!).push(n); }
    for (const n of N) {
      const gx = Math.floor(n.x / cell), gy = Math.floor(n.y / cell);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (const m of grid.get(key(gx + ox, gy + oy)) ?? []) {
        if (m === n || m.id < n.id) continue;
        let dx = n.x - m.x, dy = n.y - m.y, d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = (Math.sin(n.phase) || 0.1); dy = (Math.cos(m.phase) || 0.1); d2 = 1; }
        const d = Math.sqrt(d2), min = n.r + m.r + 14;
        const f = (5200 * (1 + (n.r + m.r) / 36)) / (d2 + 500) * (0.4 + a) + (d < min ? (min - d) * 0.35 : 0);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        if (!n.pinned) { n.vx += fx; n.vy += fy; } if (!m.pinned) { m.vx -= fx; m.vy -= fy; }
      }
    }
    for (const l of this.links) {
      const dx = l.t.x - l.s.x, dy = l.t.y - l.s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const rest = 52 + (l.s.r + l.t.r) * 2.3 + (l.rel === "cita" ? 34 : 0), f = (d - rest) * 0.022 * (0.5 + a);
      const fx = (dx / d) * f, fy = (dy / d) * f;
      if (!l.s.pinned) { l.s.vx += fx; l.s.vy += fy; } if (!l.t.pinned) { l.t.vx -= fx; l.t.vy -= fy; }
    }
    for (const n of N) {
      if (n.pinned) { n.vx = n.vy = 0; continue; }
      const g = n.degree === 0 ? 0.0012 : n.kind === "projeto" ? 0.01 : 0.0028;
      n.vx += (cx - n.x) * g; n.vy += (cy - n.y) * g * 1.1;
      // respiração: um balanço leve e contínuo para o mapa nunca ficar parado
      n.vx += Math.sin(time * 0.0007 + n.phase) * 0.012; n.vy += Math.cos(time * 0.0006 + n.phase * 1.3) * 0.012;
      n.vx *= 0.8; n.vy *= 0.8;
      const sp = Math.hypot(n.vx, n.vy), max = 14; if (sp > max) { n.vx = (n.vx / sp) * max; n.vy = (n.vy / sp) * max; }
      n.x += n.vx; n.y += n.vy;
    }
    this.alpha = Math.max(0.03, a * 0.985);
  }

  /** Nó sob o ponto (coordenadas do mundo), o mais perto do centro. */
  hit(wx: number, wy: number, slack = 5, enabled?: (n: SimNode) => boolean): SimNode | null {
    let best: SimNode | null = null, bd = Infinity;
    for (const n of this.nodes) { if (enabled && !enabled(n)) continue; const d = Math.hypot(n.x - wx, n.y - wy); if (d <= n.r + slack && d < bd) { best = n; bd = d; } }
    return best;
  }
  /** Enquadramento que mostra todos os nós (com folga). */
  /** `top`: faixa reservada no alto (filtros sobrepostos): o grafo é enquadrado só na área que sobra. */
  fit(w: number, h: number, pad = 70, enabled?: (n: SimNode) => boolean, top = 0): View {
    const L = this.nodes.filter((n) => !enabled || enabled(n));
    if (!L.length) return { x: w / 2, y: h / 2, k: 1 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of L) { x0 = Math.min(x0, n.x - n.r); y0 = Math.min(y0, n.y - n.r); x1 = Math.max(x1, n.x + n.r); y1 = Math.max(y1, n.y + n.r); }
    const k = Math.min(1.6, Math.max(0.15, Math.min((w - pad * 2) / Math.max(1, x1 - x0), (h - top - pad * 2) / Math.max(1, y1 - y0))));
    return { k, x: w / 2 - ((x0 + x1) / 2) * k, y: top + (h - top) / 2 - ((y0 + y1) / 2) * k };
  }
  neighbors(id: string): Set<string> { return this.adj.get(id) ?? new Set(); }
}
export const colorOf = (k: Kind) => KIND[k].color;
