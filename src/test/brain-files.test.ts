import { describe, expect, it } from "vitest";
import { ARCHIVE_LIMITS, MAX_PENDING, batchVisual } from "@/lib/brain-files";

const img = (n: number, chars = 300_000) => Array.from({ length: n }, (_, i) => ({ name: `p${i}.jpg`, data: "x".repeat(chars) }));

describe("documentar com muitas imagens", () => {
  it("o painel do Orion aceita dezenas de arquivos; os outros fluxos seguem com o limite antigo", () => {
    expect(ARCHIVE_LIMITS.maxFiles).toBeGreaterThanOrEqual(100);
    expect(ARCHIVE_LIMITS.maxBytes).toBeGreaterThan(25 * 1024 * 1024);
    expect(MAX_PENDING).toBe(8);
  });
  it("a leitura por IA vai em grupos pequenos, sem passar do limite de corpo da função", () => {
    const g = batchVisual(img(16));
    expect(g.flat()).toHaveLength(16);
    for (const grupo of g) { expect(grupo.length).toBeLessThanOrEqual(4); expect(grupo.reduce((n, f) => n + f.data.length, 0)).toBeLessThanOrEqual(3_200_000); }
  });
  it("arquivos grandes viram grupos menores e nenhum é perdido ou repetido", () => {
    const g = batchVisual(img(6, 1_500_000));
    expect(g.flat().map((f) => f.name)).toEqual(img(6).map((f) => f.name));
    expect(g.every((x) => x.length <= 2)).toBe(true);
  });
  it("lista vazia não gera chamadas", () => { expect(batchVisual([])).toEqual([]); });
});
