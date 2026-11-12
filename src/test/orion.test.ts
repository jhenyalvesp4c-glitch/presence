import { describe, expect, it } from "vitest";
import { keywords, mentionedDossiers, periodOf, rank, scoreDoc, snippet, type OrionDoc } from "@/lib/orion";

const doc = (id: string, title: string, text: string, date?: string, kind: OrionDoc["kind"] = "demanda"): OrionDoc => ({ id, kind, title, text, date, link: "/" });

describe("Orion", () => {
  it("palavras-chave ignoram palavras comuns e acentos", () => {
    expect(keywords("Qual foi a média de falhas nos disparos de Maceió?")).toEqual(["disparos", "maceio"]);
  });

  it("período citado na pergunta", () => {
    expect(periodOf("o que fiz hoje", "2026-11-12")).toMatchObject({ from: "2026-11-12", to: "2026-11-12" });
    expect(periodOf("ontem teve erro?", "2026-11-12")?.from).toBe("2026-11-11");
    expect(periodOf("semana passada", "2026-11-12")).toMatchObject({ from: "2026-11-02", to: "2026-11-08" });
    expect(periodOf("no mês passado", "2026-11-12")).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodOf("neste mês", "2026-11-12")).toMatchObject({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodOf("erro de cartão", "2026-11-12")).toBeNull();
  });

  it("ordena por relevância e dá preferência às anotações do Orion", () => {
    const docs = [
      doc("a", "Disparo Niterói", "Tudo certo.", "2026-11-01"),
      doc("b", "Anotação", "Disparo de Maceió deu erro de pagamento no cartão", "2026-11-10", "registro"),
      doc("c", "Outra coisa", "Nada a ver", "2026-11-11"),
    ];
    const r = rank(docs, "teve erro de pagamento no disparo de Maceió?", "2026-11-12");
    expect(r.docs.map((d) => d.id)[0]).toBe("b");
    expect(r.docs.map((d) => d.id)).not.toContain("c");
  });

  it("sem palavras-chave lista os mais recentes do período", () => {
    const docs = [doc("a", "x", "x", "2026-11-12"), doc("b", "y", "y", "2026-11-12"), doc("c", "z", "z", "2026-11-01")];
    expect(rank(docs, "o que aconteceu hoje?", "2026-11-12").docs.map((d) => d.id).sort()).toEqual(["a", "b"]);
  });

  it("tolera plural e flexão pelo radical", () => {
    expect(scoreDoc(doc("a", "t", "houve falhas no disparo"), ["disparos"])).toBeGreaterThan(0);
  });

  it("trecho centrado na palavra e etiqueta de dossiês", () => {
    const long = `${"abc ".repeat(80)}erro de pagamento ${"def ".repeat(80)}`;
    expect(snippet(long, ["pagamento"])).toContain("pagamento");
    expect(mentionedDossiers("Disparo em Juiz de Fora e Maceió", ["Maceió", "Juiz de Fora", "Santos"])).toEqual(["Maceió", "Juiz de Fora"]);
  });
});
