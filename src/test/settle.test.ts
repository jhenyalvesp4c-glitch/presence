import { describe, expect, it } from "vitest";
import { balance, effect, parseMoney, split, statementText, type SettleItem } from "@/lib/finance/settle";

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
});
