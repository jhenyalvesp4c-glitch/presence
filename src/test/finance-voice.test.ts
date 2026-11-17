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
    expect(fillerFor(["financeiro"], "x")).toMatch(/verific/i);
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
});
