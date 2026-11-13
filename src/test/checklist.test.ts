import { describe, expect, it } from "vitest";
import { bySection, colorFor, findItems, findList, progress, score, type CItem, type CList } from "@/lib/checklist";

const it_ = (id: string, label: string, section = "", done = false, position = 0): CItem => ({ id, list_id: "L", section, label, done, position });
const praia: CItem[] = [it_("1", "Biquíni", "Roupas", false, 0), it_("2", "Toalha de praia", "Praia", false, 1), it_("3", "Toalha de rosto", "Banho", false, 2), it_("4", "Boia", "Praia", true, 3), it_("5", "Protetor solar", "Praia", false, 4)];

describe("listas", () => {
  it("acha o item por nome aproximado, sem acento e em qualquer caixa", () => {
    expect(findItems(praia, "biquini").item?.id).toBe("1");
    expect(findItems(praia, "PROTETOR").item?.id).toBe("5");
    expect(findItems(praia, "a boia").item?.id).toBe("4");
  });
  it("pergunta quando há dois parecidos", () => {
    const r = findItems(praia, "toalha");
    expect(r.item).toBeUndefined(); expect(r.ambiguo?.map((x) => x.id).sort()).toEqual(["2", "3"]);
    expect(findItems(praia, "toalha de rosto").item?.id).toBe("3");
  });
  it("não inventa o que não existe", () => { expect(findItems(praia, "guarda-sol")).toEqual({}); });
  it("acha a lista; sem nome usa a mais recente", () => {
    const ls: CList[] = [{ id: "a", title: "Viagem à praia", color: "cyan", updated_at: "", items: [] }, { id: "b", title: "Compras do mês", color: "cyan", updated_at: "", items: [] }];
    expect(findList(ls).list?.id).toBe("a");
    expect(findList(ls, "compras").list?.id).toBe("b");
    expect(findList(ls, "praia").list?.id).toBe("a");
    expect(findList(ls, "zzz")).toEqual({});
    expect(findList([], "x")).toEqual({});
  });
  it("agrupa por seção e calcula o progresso", () => {
    expect(bySection(praia).map((s) => [s.secao, s.itens.length])).toEqual([["Roupas", 1], ["Praia", 3], ["Banho", 1]]);
    expect(progress(praia)).toEqual({ feitos: 1, total: 5 });
  });
  it("pontua exato acima de parcial; cores se repetem em ciclo", () => {
    expect(score("Boia", "boia")).toBeGreaterThan(score("Boia grande", "boia"));
    expect(colorFor(0)).not.toBe(colorFor(1)); expect(colorFor(6)).toBe(colorFor(0));
  });
});
