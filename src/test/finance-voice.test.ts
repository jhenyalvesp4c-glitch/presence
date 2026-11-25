import { describe, expect, it } from "vitest";
import { answer, resolveMonth } from "@/lib/voice/finance-tool";
import { fillerFor } from "@/lib/voice/filler";
import { TOOLS } from "@/lib/voice/agent";
import { makeMock } from "@/lib/finance/mock";

const today = new Date(2026, 10, 17), s = makeMock(today);

describe("voz: financeiro", () => {
  it("entende o mês falado", () => {
    expect(resolveMonth("", today)).toBe("2026-11");
    expect(resolveMonth("mês passado", today)).toBe("2026-10");
    expect(resolveMonth("dezembro", today)).toBe("2026-12");
    expect(resolveMonth("Março", today)).toBe("2026-03");
    expect(resolveMonth("2026-09", today)).toBe("2026-09");
  });
  it("resumo traz saldo, o que saiu e o que falta pagar, com painel", () => {
    const r = answer(s, { acao: "resumo" }, today);
    expect(r.result["ok"]).toBe(true);
    expect(r.result["saldo_hoje"]).toBeGreaterThan(0);
    expect(r.result["saiu"]).toBeGreaterThan(0);
    expect(r.panel?.abrir?.para).toBe("/financeiro");
  });
  it("fatura de um cartão pelo nome; cartão inexistente pede outro nome", () => {
    const ok = answer(s, { acao: "fatura", cartao: "nubank" }, today);
    expect((ok.result["faturas"] as unknown[]).length).toBe(1);
    const no = answer(s, { acao: "fatura", cartao: "banco do planeta" }, today);
    expect(no.result["ok"]).toBe(false); expect(no.result["cartoes"]).toBeTruthy();
  });
  it("assinaturas separam ativas de pausadas", () => {
    const r = answer(s, { acao: "assinaturas" }, today);
    expect((r.result["pausadas"] as string[])).toContain("Disney+");
    expect((r.result["ativas"] as { nome: string }[]).map((x) => x.nome)).not.toContain("Disney+");
  });
  it("busca nas movimentações e categorias do mês", () => {
    expect(answer(s, { acao: "ultimos", busca: "livro" }, today).result["movimentacoes"]).toHaveLength(1);
    expect((answer(s, { acao: "categorias" }, today).result["categorias"] as unknown[]).length).toBeGreaterThan(0);
  });
  it("a ferramenta existe, é consulta (avisa que está verificando) e está descrita para a IA", () => {
    expect(TOOLS.some((t) => (t as { function: { name: string } }).function.name === "financeiro")).toBe(true);
    expect(fillerFor(["financeiro"], "x")).toMatch(/busca|olhada|ver isso|procurando/i);
  });
});

describe("faturas pelo mês de fechamento", () => {
  it("Nubank fecha dia 25 e vence dia 5: a fatura de novembro vence em dezembro; Mercado Pago fecha 10 e vence 17 (mesmo mês)", async () => {
    const { closingYmOf, dueYmOfClosing } = await import("@/lib/finance/calc");
    const nu = { closingDay: 25, dueDay: 5 }, mp = { closingDay: 10, dueDay: 17 };
    expect(closingYmOf(nu, "2026-12")).toBe("2026-11"); expect(dueYmOfClosing(nu, "2026-11")).toBe("2026-12");
    expect(closingYmOf(mp, "2026-12")).toBe("2026-12"); expect(dueYmOfClosing(mp, "2026-12")).toBe("2026-12");
  });
  it("pela voz, 'fatura do Nubank de novembro' traz a que fecha em novembro", () => {
    const r = answer(s, { acao: "fatura", cartao: "nubank", mes: "novembro" }, today);
    const f = (r.result["faturas"] as { periodo: string; vence: string }[])[0]!;
    expect(f.periodo).toMatch(/^fecha 25\/11/); expect(f.vence).toBe("05/12/2026");
  });
});

describe("voz: por que sobra ou falta", () => {
  it("detalhe traz a conta completa com as faturas", () => {
    const r = answer(s, { acao: "detalhe" }, today);
    expect(r.result["ok"]).toBe(true); expect(["sobra", "falta"]).toContain(r.result["situacao"]);
    expect((r.result["onde_vai"] as { grupo: string }[]).some((g) => g.grupo.startsWith("Faturas"))).toBe(true);
  });

  it("cobrir_falta: quanto pegar no Pix no crédito e como fica a fatura (sem gravar)", () => {
    // uma conta grande a pagar antes do fim do mês: o saldo fica negativo e a resposta diz quanto pegar, em múltiplos de 10, e a fatura antes/depois
    const pobre = { ...s, transactions: [...s.transactions, { id: "aluguel-x", kind: "despesa", desc: "Aluguel", amount: 9000, date: "2026-11-25", method: "pix", accountId: s.accounts[0]!.id, category: "moradia" }] } as typeof s;
    const r = answer(pobre, { acao: "cobrir_falta", cartao: "nubank" }, today);
    expect(r.result["precisa_pegar"]).toBeGreaterThan(0);
    expect(r.result["ok"]).toBe(true);
    const pegar = r.result["precisa_pegar"] as number; expect(pegar % 10).toBe(0); expect(pegar).toBeGreaterThanOrEqual(r.result["falta_exata"] as number);
    const f = r.result["fatura_que_recebe"] as { antes: number; depois: number }; expect(f.depois).toBeGreaterThan(f.antes);
    expect(Math.round((f.depois - f.antes) * 100) / 100).toBeCloseTo(pegar, 0);
    expect(r.panel?.titulo).toContain("Pix no crédito");
    // com taxa o valor lançado no cartão sobe
    const t = answer(pobre, { acao: "cobrir_falta", cartao: "nubank", taxa_percent: 10 }, today);
    expect(t.result["valor_lancado_no_cartao"]).toBeCloseTo(pegar * 1.1, 0);
  });
  it("cobrir_falta com sobra diz que não precisa pegar nada", () => {
    const rico = { ...s, accounts: s.accounts.map((a) => ({ ...a, balance: 1_000_000, initialBalance: 1_000_000 })) } as typeof s;
    const r = answer(rico, { acao: "cobrir_falta", cartao: "nubank" }, today);
    expect(r.result["precisa_pegar"]).toBe(0);
  });

  it("fatura traz só a minha parte quando há gasto dividido", () => {
    const card = s.cards[0]!;
    const comDivisao = { ...s, transactions: [...s.transactions, { id: "div-x", kind: "despesa", desc: "Jantar", amount: 200, date: "2026-11-10", method: "credito", cardId: card.id, category: "alimentacao", shared: { person: "Ana", percent: 50 } }] } as typeof s;
    const antes = answer(s, { acao: "fatura", cartao: card.name }, today).result, depois = answer(comDivisao, { acao: "fatura", cartao: card.name }, today).result;
    const f = (depois["faturas"] as { total: number; minha_parte: number; parte_dos_outros: number; quem_deve: { pessoa: string; valor: number }[] }[])[0]!;
    expect(f.parte_dos_outros).toBe(100); expect(f.minha_parte).toBeCloseTo(f.total - 100, 2); expect(f.quem_deve).toEqual([{ pessoa: "Ana", valor: 100 }]);
    expect(depois["minha_parte_todas"]).toBeLessThan(depois["total_todas"] as number); expect(antes["parte_dos_outros_todas"]).toBe(0);
    expect(answer(comDivisao, { acao: "resumo" }, today).result["faturas_abertas_so_minha_parte"]).toBeLessThan(answer(comDivisao, { acao: "resumo" }, today).result["faturas_abertas"] as number);
  });
});
