import { describe, expect, it } from "vitest";
import { canonicalDossier, dossierMentioned, fixDossiers, type Context, type Output } from "@/lib/mcp/interpret";

const list = ["Alagoinhas", "BH Centro", "BH Floresta", "Niterói", "Juiz de Fora", "São Vicente"].map((nome) => ({ nome }));
const ctx = { today: "2026-11-18", weekday: "quarta-feira", categories: [], projects: [{ id: "p1", nome: "P4C", descricao: "", status: "Ativo", rotulo_dossie: { singular: "Polo", plural: "Polos" }, dossiers: list.map((d, i) => ({ id: `d${i}`, nome: d.nome, descricao: "" })) }] } as unknown as Context;
const out = (registro: Record<string, unknown>, extra: Partial<Output> = {}): Output => ({ resumo: "x", itens: [{ registro } as Output["itens"][number]], duvidas: [], pendencias: [], ...extra });

describe("Central de entrada: polo/dossiê", () => {
  it("acerta o nome para o cadastrado (acento, caixa, 'Polo')", () => {
    expect(canonicalDossier("Polo Niterói", list)).toBe("Niterói");
    expect(canonicalDossier("polo de niteroi", list)).toBe("Niterói");
    expect(canonicalDossier("NITEROI", list)).toBe("Niterói");
    expect(canonicalDossier("Niterói", list)).toBe("Niterói");
    expect(canonicalDossier("Santos", list)).toBe("Santos"); // não existe: mantém
  });
  it("acha o polo citado no texto, só se for um", () => {
    expect(dossierMentioned("Disparar campanha Sonho em Dia para Niterói", list)).toBe("Niterói");
    expect(dossierMentioned("BH Floresta e BH Centro", list)).toBeNull();
    expect(dossierMentioned("sem nenhum polo", list)).toBeNull();
  });
  it("demanda de polo sem dossiê recebe o polo citado no título", () => {
    const r = fixDossiers(out({ tipo: "demanda", projeto_id: "p1", escopo: "polo", titulo: "Disparar campanha Sonho em Dia para Niterói", descricao: "Usar o template X" }), ctx);
    expect((r.itens[0]!.registro as Record<string, unknown>)["dossie"]).toBe("Niterói");
  });
  it("não inventa: demanda geral e polo ambíguo ficam como estão", () => {
    expect((fixDossiers(out({ tipo: "demanda", projeto_id: "p1", escopo: "geral", titulo: "Algo em Niterói" }), ctx).itens[0]!.registro as Record<string, unknown>)["dossie"]).toBeUndefined();
    expect((fixDossiers(out({ tipo: "demanda", projeto_id: "p1", escopo: "polo", titulo: "BH Floresta e BH Centro" }), ctx).itens[0]!.registro as Record<string, unknown>)["dossie"]).toBeUndefined();
  });
  it("corrige o nome escrito pela IA em polo e multipolo", () => {
    const r = fixDossiers(out({ tipo: "demanda", projeto_id: "p1", escopo: "multipolo", dossies: ["polo niteroi", "Alagoinhas"], titulo: "t" }), ctx);
    expect((r.itens[0]!.registro as Record<string, unknown>)["dossies"]).toEqual(["Niterói", "Alagoinhas"]);
  });
  it("sem projeto conhecido não mexe", () => {
    const r = fixDossiers(out({ tipo: "demanda", escopo: "polo", titulo: "Niterói" }), ctx);
    expect((r.itens[0]!.registro as Record<string, unknown>)["dossie"]).toBeUndefined();
  });
});
