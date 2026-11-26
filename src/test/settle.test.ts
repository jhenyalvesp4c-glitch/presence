import { describe, expect, it } from "vitest";
import { balance, effect, parseBills, parseMoney, split, statementText, type SettleItem } from "@/lib/finance/settle";

const mk = (p: Partial<SettleItem> & { amount: number; payer: SettleItem["payer"] }): SettleItem => ({ id: Math.random().toString(), kind: "compra", date: "2026-11-10", description: "x", otherShare: 100, installment: "", ...p });

describe("Acerto de contas", () => {
  it("compra no meu cartão para ela: ela me deve tudo", () => {
    const b = balance([mk({ amount: 200, payer: "eu" })]);
    expect(b).toMatchObject({ owedToMe: 20000, net: 20000, direction: "outro_paga", amount: 200 });
  });
  it("compra no cartão dela para mim (otherShare 0): eu devo tudo", () => {
    const b = balance([mk({ amount: 90, payer: "outro", otherShare: 0 })]);
    expect(b).toMatchObject({ owedByMe: 9000, net: -9000, direction: "eu_pago", amount: 90 });
  });
  it("dividido: só a parte do outro entra", () => {
    expect(split({ amount: 100.01, otherShare: 50 })).toEqual({ other: 5001, mine: 5000 }); // nunca perde centavo
    expect(balance([mk({ amount: 300, payer: "eu", otherShare: 50 })]).net).toBe(15000);
    expect(balance([mk({ amount: 300, payer: "outro", otherShare: 50 })]).net).toBe(-15000);
  });
  it("soma e subtrai tudo e diz quem faz o pix", () => {
    const items = [
      mk({ amount: 500, payer: "eu" }),                       // ela me deve 500
      mk({ amount: 100, payer: "eu", otherShare: 50 }),        // ela me deve 50
      mk({ amount: 180, payer: "outro", otherShare: 0 }),      // eu devo 180
      mk({ amount: 20.5, payer: "outro", otherShare: 50 }),    // eu devo 10,25
    ];
    const b = balance(items);
    expect(b.owedToMe).toBe(55000); expect(b.owedByMe).toBe(19025); expect(b.net).toBe(35975);
    expect(b.direction).toBe("outro_paga"); expect(b.amount).toBe(359.75);
  });
  it("pagamentos (pix) já feitos entram no saldo", () => {
    const owe = mk({ amount: 100, payer: "outro", otherShare: 0 }); // eu devo 100
    expect(balance([owe, mk({ kind: "pagamento", amount: 100, payer: "eu" })]).direction).toBe("quite");
    expect(effect(mk({ kind: "pagamento", amount: 40, payer: "outro" }))).toBe(-4000);
    expect(balance([owe, mk({ kind: "pagamento", amount: 30, payer: "eu" })]).net).toBe(-7000);
  });
  it("texto do extrato tem as seções, os totais e o pix final", () => {
    const t = statementText({ me: "Jheny", person: "Ana", generatedOn: "2026-11-19", items: [
      mk({ amount: 200, payer: "eu", description: "Mercado" }), mk({ amount: 60, payer: "outro", otherShare: 0, description: "Farmácia", installment: "1/2" }),
    ] });
    expect(t).toContain("Acerto de contas — Jheny e Ana"); expect(t).toContain("Mercado"); expect(t).toContain("(1/2)");
    expect(t).toMatch(/Ana faz um pix de R\$\s?140,00 para Jheny/);
  });
  it("lê valores no formato brasileiro", () => {
    expect(parseMoney("R$ 1.234,56")).toBe(1234.56); expect(parseMoney("89,90")).toBe(89.9); expect(parseMoney("89.90")).toBe(89.9); expect(parseMoney("1.234.567")).toBe(1234567); expect(parseMoney("-45,00")).toBe(45); expect(parseMoney("abc")).toBeNull();
  });
  it("lê várias contas coladas de uma vez", () => {
    expect(parseBills("Luz 312,40\nInternet - R$ 120,00\nCondomínio: 1.200\n\nÁgua  89.90\nsem valor aqui")).toEqual([
      { description: "Luz", amount: 312.4 }, { description: "Internet", amount: 120 }, { description: "Condomínio", amount: 1200 }, { description: "Água", amount: 89.9 },
    ]);
    expect(parseBills("Parcela 3/10 da TV 150,00")).toEqual([{ description: "Parcela 3/10 da TV", amount: 150 }]);
  });
});

import { expandInstallments, parseInstallment } from "@/lib/finance/settle";

describe("Compra parcelada no acerto de contas", () => {
  const watch: SettleItem = { id: "w", kind: "compra", date: "2026-11-25", description: "Apple Watch", amount: 66.11, payer: "outro", otherShare: 0, installment: "9/18" };
  it("entende 9/18 e 9 de 18, e ignora o que não é parcela ou já acabou", () => {
    expect(parseInstallment("9/18")).toEqual({ n: 9, total: 18 }); expect(parseInstallment(" 3 de 12 ")).toEqual({ n: 3, total: 12 });
    expect(parseInstallment("18/18")).toBeNull(); expect(parseInstallment("")).toBeNull(); expect(parseInstallment("à vista")).toBeNull(); expect(parseInstallment("1/1")).toBeNull();
  });
  it("gera uma parcela por mês, no mesmo dia, até o mês pedido", () => {
    const dez = expandInstallments([watch], "2026-12");
    expect(dez).toHaveLength(1);
    expect(dez[0]).toMatchObject({ date: "2026-12-25", installment: "10/18", auto: true, amount: 66.11, payer: "outro", otherShare: 0 });
    const tudo = expandInstallments([watch], "2027-12");
    expect(tudo.map((i) => i.installment)).toEqual(["10/18", "11/18", "12/18", "13/18", "14/18", "15/18", "16/18", "17/18", "18/18"]);
    expect(tudo.at(-1)!.date).toBe("2027-08-25"); // 18/18 em agosto/27
    expect(expandInstallments([watch], "2026-11")).toEqual([]);
  });
  it("cada parcela entra na conta do mês: eu devo a parte minha ao Felipe, mês a mês", () => {
    const all = [watch, ...expandInstallments([watch], "2027-01")];
    expect(balance(all).owedByMe).toBe(66.11 * 100 * 3); // nov, dez e jan
    expect(balance(all).direction).toBe("eu_pago");
  });
  it("não duplica se a parcela já foi lançada à mão e respeita dia 31 e compras sem parcela", () => {
    const manual: SettleItem = { ...watch, id: "m", date: "2026-12-26", installment: "10/18" };
    const dez = expandInstallments([watch, manual], "2026-12");
    expect(dez).toEqual([]);
    const fim: SettleItem = { ...watch, id: "f", date: "2026-01-31", installment: "1/3" };
    expect(expandInstallments([fim], "2026-03").map((i) => i.date)).toEqual(["2026-02-28", "2026-03-31"]);
    expect(expandInstallments([{ ...watch, installment: "" }, { ...watch, kind: "pagamento", installment: "2/5" }, { ...watch, pending: true }], "2027-12")).toEqual([]);
  });
});

import { installmentLabel, parseFixed } from "@/lib/finance/settle";

describe("Gasto fixo no acerto de contas", () => {
  const net: SettleItem = { id: "n", kind: "compra", date: "2026-11-10", description: "Internet", amount: 120, payer: "outro", otherShare: 50, installment: "fixa" };
  it("entende fixa e fixa até um mês, e escreve o rótulo", () => {
    expect(parseFixed("fixa")).toEqual({ until: null }); expect(parseFixed("fixa:2027-06")).toEqual({ until: "2027-06" });
    expect(parseFixed("9/18")).toBeNull(); expect(parseFixed("")).toBeNull();
    expect([installmentLabel("fixa"), installmentLabel("fixa:2027-06"), installmentLabel("9/18")]).toEqual(["fixa", "fixa até 06/27", "9/18"]);
  });
  it("entra todo mês, sem fim, até o mês que está sendo visto", () => {
    const m = expandInstallments([net], "2027-02");
    expect(m.map((i) => i.date)).toEqual(["2026-12-10", "2027-01-10", "2027-02-10"]);
    expect(m.every((i) => i.auto && i.amount === 120 && i.payer === "outro" && i.otherShare === 50)).toBe(true);
    expect(expandInstallments([net], "2026-11")).toEqual([]);
  });
  it("para no mês 'até', não duplica o mês já lançado à mão e cada mês pesa na conta", () => {
    expect(expandInstallments([{ ...net, installment: "fixa:2027-01" }], "2027-12").map((i) => i.date)).toEqual(["2026-12-10", "2027-01-10"]);
    const manualDez: SettleItem = { ...net, id: "m", date: "2026-12-12" };
    expect(expandInstallments([net, manualDez], "2026-12")).toEqual([]);
    const all = [net, ...expandInstallments([net], "2027-01")]; // nov, dez, jan: eu pago 50% de 120 = 60 em cada
    expect(balance(all).owedByMe).toBe(6000 * 3);
  });
  it("aparece no texto do WhatsApp como fixa", () => {
    expect(statementText({ me: "Eu", person: "Felipe", items: [net], generatedOn: "2026-11-25" })).toContain("Internet (fixa)");
  });
});

import { acertoByMonth } from "@/lib/finance/settle";
import { monthClose, monthPlan, cashBreakdown } from "@/lib/finance/calc";
import { EMPTY_STATE, type FinanceState } from "@/lib/finance/types";

describe("Acerto de contas na sobra de caixa, mês a mês", () => {
  const mk = (id: string, o: Partial<SettleItem>): SettleItem => ({ id, kind: "compra", date: "2026-11-25", description: id, amount: 100, payer: "outro", otherShare: 0, installment: "", ...o });
  const watch = mk("Apple Watch", { amount: 66.11, installment: "9/18" });
  const net = mk("Internet", { amount: 120, otherShare: 50, installment: "fixa", date: "2026-11-10" });
  const groups = [{ person: "Felipe", items: [watch, net, mk("do financeiro", { linked: true, amount: 999 })] }];

  it("soma o que você paga em cada mês (parcela + fixo) e deixa de fora o que vem do financeiro", () => {
    const m = acertoByMonth(groups, "2026-11", "2027-02");
    expect(m["2026-11"]!.pagar).toBe(66.11 + 60);      // watch 9/18 inteiro + metade da internet
    expect(m["2026-12"]!.pagar).toBe(66.11 + 60);      // 10/18 + internet
    expect(m["2027-02"]!.pagar).toBe(66.11 + 60);
    expect(m["2026-11"]!.receber).toBe(0);
    expect(acertoByMonth(groups, "2026-12", "2027-02")["2026-11"]).toBeUndefined(); // mês passado fica de fora
  });
  it("compra no seu cartão que é do outro vira a receber (linha separada); pix já feito abate o que você deve; pix aguardando não conta", () => {
    const g = [{ person: "Felipe", items: [mk("no meu cartão", { payer: "eu", otherShare: 100, amount: 80 }), mk("eu devo", { amount: 200 }), mk("pix", { kind: "pagamento", payer: "eu", amount: 150 }), mk("pix futuro", { kind: "pagamento", payer: "eu", amount: 999, pending: true })] }];
    const m = acertoByMonth(g, "2026-11", "2026-11")["2026-11"]!;
    expect(m.pagar).toBe(50);                   // você deve 200 e já pagou 150 de pix → faltam 50
    expect(m.receber).toBe(80);                 // ele te deve 80 (compra no seu cartão), em linha separada
  });
  const st: FinanceState = { ...EMPTY_STATE, onboarded: true, accounts: [{ id: "a", name: "Conta", kind: "banco", tone: "roxo", balanceBase: 1000, baseDate: "2026-11-25" }] };
  const today = new Date("2026-11-25T12:00:00");
  it("a sobra de caixa e os próximos meses descontam o acerto", () => {
    const ac = acertoByMonth(groups, "2026-11", "2027-11");
    const sem = monthClose(st, today, "bolso", false), com = monthClose(st, today, "bolso", false, ac);
    expect(com.acertoPagar).toBe(126.11); expect(sem.sobra - com.sobra).toBeCloseTo(126.11, 2);
    const p = monthPlan(st, today, 3, "bolso", false, ac);
    expect(p.map((x) => x.acerto)).toEqual([126.11, 126.11, 126.11]);
    expect(p[1]!.items.find((i) => i.group === "acerto")).toMatchObject({ label: "Acerto de contas", amount: 126.11 });
    expect(monthPlan(st, today, 3, "bolso", false)[0]!.acerto).toBe(0);
    expect(cashBreakdown(st, today, "bolso", false, ac).groups.find((g) => g.id === "acerto")?.total).toBe(126.11);
    expect(monthClose(st, today, "cofrinho", false, ac).acertoPagar).toBe(0); // visão só cofrinho não mistura
  });
});

describe("Detalhe do acerto de contas no 'por que sobra'", () => {
  it("lista o que você paga, lançamento a lançamento", () => {
    const s: FinanceState = { ...EMPTY_STATE, onboarded: true, accounts: [{ id: "a", name: "Conta", kind: "banco", tone: "roxo", balanceBase: 1000, baseDate: "2026-11-25" }] };
    const items: SettleItem[] = [
      { id: "m", kind: "compra", date: "2026-11-29", description: "Mounjaro", amount: 140, payer: "outro", otherShare: 0, installment: "fixa" },
      { id: "w", kind: "compra", date: "2026-11-25", description: "Apple Watch", amount: 66.11, payer: "outro", otherShare: 0, installment: "9/18" },
    ];
    const ac = acertoByMonth([{ person: "Felipe", items }], "2026-11", "2026-12");
    const b = cashBreakdown(s, new Date("2026-11-25T12:00:00"), "bolso", false, ac).groups.find((g) => g.id === "acerto")!.items[0]!;
    expect(b.amount).toBe(206.11);
    expect(b.detail!.map((d) => [d.desc, d.amount, d.note])).toEqual([["Mounjaro", 140, "Felipe"], ["Apple Watch", 66.11, "Felipe"]]);
  });
});

describe("Acerto: as duas linhas separadas, sem abater uma da outra", () => {
  const mk = (id: string, o: Partial<SettleItem>): SettleItem => ({ id, kind: "compra", date: "2026-11-25", description: id, amount: 100, payer: "outro", otherShare: 0, installment: "", ...o });
  it("o que ele te deve e o que você deve aparecem cada um no seu lado", () => {
    const g = [{ person: "Felipe", items: [mk("Meli Mais", { payer: "eu", otherShare: 100, amount: 9.9, installment: "fixa", date: "2026-11-25" }), mk("Mounjaro", { amount: 140, installment: "fixa", date: "2026-11-29" })] }];
    const m = acertoByMonth(g, "2026-11", "2026-12");
    expect(m["2026-11"]).toMatchObject({ pagar: 140, receber: 9.9 });
    expect(m["2026-12"]).toMatchObject({ pagar: 140, receber: 9.9 });
    expect(m["2026-11"]!.itens.map((i) => [i.desc, i.receber])).toEqual([["Meli Mais", true], ["Mounjaro", false]]);
  });
  it("pix a mais de um lado vai para o outro, e a diferença (receber − pagar) continua a mesma de antes", () => {
    const g = [{ person: "Felipe", items: [mk("deve", { amount: 100 }), mk("pix a mais", { kind: "pagamento", payer: "eu", amount: 130 })] }];
    const m = acertoByMonth(g, "2026-11", "2026-11")["2026-11"]!;
    expect(m.pagar).toBe(0); expect(m.receber).toBe(30);
  });
});
