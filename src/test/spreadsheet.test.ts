import { describe, expect, it } from "vitest";
import { parseCsv, summarizeSheets } from "@/lib/spreadsheet";

const rows = (n: number) => [["Nome", "Telefone", "Cidade", "Status"], ...Array.from({ length: n }, (_, i) => [`Cliente ${i}`, i % 10 === 0 ? "" : `5582999${String(100000 + i)}`, i % 3 ? "Maceió" : "Penedo", "Inadimplente"])];

describe("resumo de planilha para a IA", () => {
  it("diz abas, colunas, linhas, valores comuns, telefones válidos e amostra", () => {
    const t = summarizeSheets("base_maceio.xlsx", [{ sheet: "Contatos", data: rows(1250) }, { sheet: "Vazia", data: [[]] }]);
    expect(t).toContain("Planilha: base_maceio.xlsx"); expect(t).toContain('Aba "Contatos": 1.250 linhas de dados · 4 colunas: Nome, Telefone, Cidade, Status');
    expect(t).toContain("Maceió ("); expect(t).toContain("Penedo ("); expect(t).toContain('Coluna "Telefone": 1.125 de 1.250 linhas com telefone válido'); expect(t).toContain("Amostra (8 primeiras linhas)");
    expect(t).not.toContain("Vazia"); expect(t.length).toBeLessThan(5000);
  });
  it("formata datas e números e aceita planilha vazia", () => {
    const t = summarizeSheets("x.xlsx", [{ sheet: "A", data: [["Data", "Valor"], [new Date(Date.UTC(2026, 10, 24)), 12.5]] }]);
    expect(t).toContain("Data: 24/11/2026"); expect(t).toContain("Valor: 12,5");
    expect(summarizeSheets("v.xlsx", [{ sheet: "A", data: [] }])).toContain("vazia");
  });
  it("lê CSV com ponto e vírgula e aspas", () => {
    expect(parseCsv('Nome;Obs\n"Ana; Souza";"disse ""oi"""\nBia;ok\n')).toEqual([["Nome", "Obs"], ["Ana; Souza", 'disse "oi"'], ["Bia", "ok"]]);
  });
});
