import { afterEach, describe, expect, it } from "vitest";
import { CATS, EXPENSE_CATS, INCOME_CATS, applyCategories, catOf, guessCategory, type CatDef } from "@/lib/finance/categories";
import { categoryUsage, saveCategoryDefs } from "@/lib/finance/category-edit";
import { cleanCatDefs, fromRows, toRows } from "@/lib/finance/db-map";
import { EMPTY_STATE, type FinanceState } from "@/lib/finance/types";

afterEach(() => applyCategories([]));

const st = (o: Partial<FinanceState> = {}): FinanceState => ({ ...structuredClone(EMPTY_STATE), ...o });

describe("categorias editáveis do financeiro", () => {
  it("renomeia e troca cor/ícone de uma de fábrica sem criar duplicata", () => {
    const refCats = CATS, refExp = EXPENSE_CATS;
    applyCategories([{ id: "lazer", name: "Diversão", color: "oklch(0.7 0.2 20)", icon: "Gamepad2" }]);
    expect(catOf("lazer")).toMatchObject({ name: "Diversão", icon: "Gamepad2" });
    expect(CATS.filter((c) => c.id === "lazer")).toHaveLength(1);
    expect(CATS).toBe(refCats); expect(EXPENSE_CATS).toBe(refExp); // listas vivas: quem importou enxerga a mudança
  });
  it("cria categoria nova (despesa e receita) e a sugere pelas palavras", () => {
    applyCategories([{ id: "c-pet", custom: true, name: "Pet", icon: "PawPrint", words: ["ração", "veterinário"] }, { id: "c-aula", custom: true, income: true, name: "Aulas", words: ["aula particular"] }]);
    expect(EXPENSE_CATS.some((c) => c.id === "c-pet")).toBe(true);
    expect(INCOME_CATS.some((c) => c.id === "c-aula")).toBe(true);
    expect(guessCategory("Ração do Thor")).toBe("c-pet");
    expect(guessCategory("aula particular de inglês", true)).toBe("c-aula");
  });
  it("ocultar tira das escolhas mas o histórico continua com o nome; 'Outros' nunca some", () => {
    applyCategories([{ id: "lazer", hidden: true }, { id: "outros", hidden: true }]);
    expect(EXPENSE_CATS.some((c) => c.id === "lazer")).toBe(false);
    expect(catOf("lazer").name).toBe("Lazer");
    expect(EXPENSE_CATS.some((c) => c.id === "outros")).toBe(true);
  });
  it("categoria desconhecida cai em Outros", () => { expect(catOf("nao-existe").id).toBe("outros"); });

  it("apagar uma categoria sua leva os lançamentos para Outros / Renda extra", () => {
    const defs: CatDef[] = [{ id: "c-pet", custom: true, name: "Pet" }, { id: "c-aula", custom: true, income: true, name: "Aulas" }];
    const s = st({
      categories: defs,
      transactions: [{ id: "t1", kind: "despesa", desc: "ração", amount: 50, date: "2026-11-01", method: "debito", category: "c-pet" }, { id: "t2", kind: "receita", desc: "aula", amount: 80, date: "2026-11-02", method: "pix", category: "c-aula" }, { id: "t3", kind: "despesa", desc: "pizza", amount: 40, date: "2026-11-03", method: "debito", category: "restaurantes" }] as FinanceState["transactions"],
    });
    expect(categoryUsage(s, "c-pet")).toBe(1);
    const out = saveCategoryDefs(s, defs, [{ id: "c-pet", income: false }, { id: "c-aula", income: true }]);
    expect(out.categories).toEqual([]);
    expect(out.transactions.map((t) => t.category)).toEqual(["outros", "extra", "restaurantes"]);
  });
  it("não deixa apagar Outros/Renda extra", () => {
    const s = st({ transactions: [{ id: "t", kind: "despesa", desc: "x", amount: 1, date: "2026-11-01", method: "debito", category: "outros" }] as FinanceState["transactions"] });
    expect(saveCategoryDefs(s, [], [{ id: "outros", income: false }]).transactions[0]!.category).toBe("outros");
  });

  it("vai e volta pelo banco (settings.categories) e ignora lixo", () => {
    const defs: CatDef[] = [{ id: "lazer", name: "Diversão", icon: "Gamepad2" }, { id: "c-pet", custom: true, name: "Pet", words: ["ração"] }];
    const back = fromRows(toRows(st({ categories: defs })));
    expect(back.categories).toEqual(defs);
    expect(cleanCatDefs([{ id: "a" }, { id: "a" }, { nome: "x" }, null, { id: "b", name: "  ", hidden: "sim" }])).toEqual([{ id: "a" }, { id: "b" }]);
    expect(cleanCatDefs("lixo")).toEqual([]);
  });
});
