import { describe, expect, it } from "vitest";
import { buildMap, demoData } from "@/lib/map-graph";
import { MapSim } from "./engine";

describe("MapSim", () => {
  const sim = new MapSim(buildMap(demoData()), 1000, 700);
  for (let i = 0; i < 400; i++) sim.tick(i * 16);
  it("converge sem números inválidos e sem nós empilhados", () => {
    expect(sim.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    let overlaps = 0; for (let i = 0; i < sim.nodes.length; i++) for (let j = i + 1; j < sim.nodes.length; j++) { const a = sim.nodes[i]!, b = sim.nodes[j]!; if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.5) overlaps++; }
    expect(overlaps).toBeLessThan(sim.nodes.length * 0.05);
  });
  it("nós ligados ficam mais perto que os não ligados (em média)", () => {
    const linked = sim.links.reduce((s, l) => s + Math.hypot(l.s.x - l.t.x, l.s.y - l.t.y), 0) / sim.links.length;
    let all = 0, n = 0; for (let i = 0; i < sim.nodes.length; i += 3) for (let j = i + 1; j < sim.nodes.length; j += 3) { all += Math.hypot(sim.nodes[i]!.x - sim.nodes[j]!.x, sim.nodes[i]!.y - sim.nodes[j]!.y); n++; }
    expect(linked).toBeLessThan(all / n);
  });
  it("acha o nó sob o ponto, enquadra tudo e não passa de 'esfriar' abaixo do mínimo", () => {
    const p = sim.nodes.find((x) => x.kind === "projeto")!; expect(sim.hit(p.x, p.y)?.id).toBe(p.id); expect(sim.hit(-9999, -9999)).toBeNull();
    const v = sim.fit(1000, 600); const sx = p.x * v.k + v.x, sy = p.y * v.k + v.y; expect(sx).toBeGreaterThan(0); expect(sx).toBeLessThan(1000); expect(sy).toBeGreaterThan(0); expect(sy).toBeLessThan(600);
    expect(sim.alpha).toBeGreaterThanOrEqual(0.03);
  });
  it("fixar um nó o mantém parado e reaquecer funciona", () => { const n = sim.nodes[0]!; n.pinned = true; const x = n.x; sim.reheat(); for (let i = 0; i < 30; i++) sim.tick(i); expect(n.x).toBe(x); n.pinned = false; });
});

describe("MapSim em escala", () => {
  it("1.500 nós e 3.000 ligações: cada passo da física é rápido", () => {
    const nodes = Array.from({ length: 1500 }, (_, i) => ({ id: `n${i}`, kind: (["demanda", "anotacao", "tarefa", "dossie"] as const)[i % 4]!, label: `N${i}`, sub: "", open: i % 3 === 0, urgent: false, link: "/", degree: 2, r: 8 }));
    const links = Array.from({ length: 3000 }, (_, i) => ({ a: `n${i % 1500}`, b: `n${(i * 7 + 13) % 1500}`, rel: "contem" as const })).filter((l) => l.a !== l.b);
    const s = new MapSim({ nodes, links, counts: { projeto: 0, dossie: 375, demanda: 375, anotacao: 375, doc: 0, tarefa: 375, ideia: 0, reuniao: 0, pessoa: 0, conversa: 0, pedido: 0 } }, 1200, 800);
    const t0 = performance.now(); for (let i = 0; i < 20; i++) s.tick(i * 16); const per = (performance.now() - t0) / 20;
    expect(s.nodes.every((n) => Number.isFinite(n.x))).toBe(true); expect(per).toBeLessThan(60);
  });
});
