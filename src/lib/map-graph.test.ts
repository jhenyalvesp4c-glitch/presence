import { describe, expect, it } from "vitest";
import { buildMap, codesIn, demoData, emptyData } from "./map-graph";

describe("map-graph", () => {
  it("extrai códigos de demanda do texto", () => { expect(codesIn("veja #P055 e g41 e M010, não 12 nem X1")).toEqual(["P055", "G041", "M010"]); });
  it("liga projeto, dossiê, demanda, anotação e reunião", () => {
    const d = emptyData(); d.projects = [{ id: "p4c", name: "P4C" }]; d.dossiers = [{ project_id: "p4c", id: "d1", name: "Alagoinhas" }];
    d.demands = [{ project_id: "p4c", code: "P055", type: "polo", title: "Verificar mensagens", status: "todo", priority: "alta", dossier_name: "Alagoinhas" }];
    d.entries = [{ id: "e1", title: "Ata", text: "Conversamos sobre #P055 hoje", date: "2026-11-20", project_id: "p4c", dossier_names: [], source: "orion" }];
    d.meetings = [{ id: "r1", title: "Reunião em Alagoinhas", analysis: { participantes: ["Ana"], resumo: "" }, happened_on: "2026-11-20" }];
    const g = buildMap(d), has = (a: string, b: string) => g.links.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
    expect(has("p:p4c", "d:p4c:d1")).toBe(true); expect(has("m:p4c:P055", "p:p4c")).toBe(true); expect(has("m:p4c:P055", "d:p4c:d1")).toBe(true);
    expect(has("e:e1", "p:p4c")).toBe(true); expect(has("e:e1", "m:p4c:P055")).toBe(true); expect(has("r:r1", "d:p4c:d1")).toBe(true); expect(has("r:r1", "s:ana")).toBe(true);
    expect(g.nodes.find((n) => n.id === "m:p4c:P055")).toMatchObject({ open: true, urgent: true }); expect(g.counts.demanda).toBe(1);
  });
  it("não duplica ligações e calcula grau e tamanho", () => {
    const d = emptyData(); d.projects = [{ id: "a", name: "A" }]; d.demands = [1, 2, 3].map((i) => ({ project_id: "a", code: `G0${40 + i}`, type: "geral", title: `T${i}`, status: "done", priority: "media", dossier_name: null }));
    const g = buildMap(d); expect(g.links).toHaveLength(3); const p = g.nodes.find((n) => n.id === "p:a")!; expect(p.degree).toBe(3); expect(p.r).toBeGreaterThan(24);
  });
  it("pedidos do WhatsApp criam conversa e pessoa; rede de exemplo tem de tudo", () => {
    const g = buildMap(demoData()); expect(g.nodes.length).toBeGreaterThan(50); expect(g.links.length).toBeGreaterThan(g.nodes.length * 0.8);
    for (const k of ["projeto", "dossie", "demanda", "anotacao", "doc", "tarefa", "ideia", "reuniao", "pessoa", "conversa", "pedido"] as const) expect(g.counts[k]).toBeGreaterThan(0);
    expect(g.nodes.find((n) => n.kind === "conversa" && n.label.includes("Petrolina"))).toBeTruthy();
  });
});
