import { describe, expect, it } from "vitest";
import { accountBalance, cardAvailable, invoiceFor, invoiceMonthOf, isoOf, isPaused } from "@/lib/finance/calc";
import { makeMock } from "@/lib/finance/mock";
import { applyWrite, readMore } from "@/lib/voice/finance-write";

const today = new Date(2026, 10, 17), s0 = () => makeMock(today);
const ok = (o: { result: Record<string, unknown> }) => o.result["ok"] === true;

describe("voz: consultas novas do financeiro", () => {
  it("contas fixas (sem assinaturas) com dia e onde cai", () => {
    const r = readMore(s0(), { acao: "fixas" }, today), saidas = r.result["saidas"] as { nome: string }[];
    expect(saidas.map((x) => x.nome)).toContain("Aluguel"); expect(saidas.map((x) => x.nome)).not.toContain("Netflix");
  });
  it("parcela por parcela de uma compra", () => {
    const r = readMore(s0(), { acao: "parcela_detalhe", alvo: "notebook" }, today);
    expect(r.result["ok"]).toBe(true); expect(r.result["parcelas"]).toBe(10); expect(r.panel?.secoes[0]!.itens).toHaveLength(10);
  });
  it("metas e abrir aba (inclui o cartão certo)", () => {
    expect((readMore(s0(), { acao: "metas" }, today).result["metas"] as unknown[]).length).toBeGreaterThan(0);
    expect(readMore(s0(), { acao: "abrir", aba: "próximos meses" }, today).navegar).toBe("/financeiro?aba=meses");
    expect(readMore(s0(), { acao: "abrir", aba: "cartões", cartao: "Mercado Pago" }, today).navegar).toBe("/financeiro?aba=contas&item=card:card-mp");
    expect(readMore(s0(), { acao: "abrir" }, today).navegar).toBe("/financeiro");
  });
});

describe("voz: pausar, reativar e editar", () => {
  it("pausa e reativa uma assinatura pelo nome", () => {
    const p = applyWrite(s0(), { acao: "pausar", alvo: "netflix" }, today);
    expect(ok(p)).toBe(true); expect(isPaused(p.state!.recurring.find((r) => r.id === "rec-netflix")!)).toBe(true);
    expect(applyWrite(p.state!, { acao: "pausar", alvo: "netflix" }, today).result["erro"]).toMatch(/já está pausada/);
    const r = applyWrite(p.state!, { acao: "reativar", alvo: "netflix" }, today);
    expect(ok(r)).toBe(true); expect(isPaused(r.state!.recurring.find((x) => x.id === "rec-netflix")!)).toBe(false);
  });
  it("nome parecido demais pede para escolher; nome inexistente lista opções", () => {
    expect(applyWrite(s0(), { acao: "editar", alvo: "Nubank", valor: 10 }, today).result["opcoes"]).toBeTruthy();
    const nf = applyWrite(s0(), { acao: "pausar", alvo: "xyz inexistente" }, today);
    expect(nf.result["ok"]).toBe(false);
  });
  it("edita o valor de uma assinatura e mostra antes e depois", () => {
    const e = applyWrite(s0(), { acao: "editar", alvo: "netflix", valor: 59.9 }, today);
    expect(e.state!.recurring.find((r) => r.id === "rec-netflix")!.amount).toBe(59.9);
    expect(String(e.result["valor_anterior"])).toContain("55,90");
  });
  it("edita uma movimentação (valor e categoria)", () => {
    const s = s0(), t = s.transactions.find((x) => x.id === "tx-livro")!;
    const e = applyWrite(s, { acao: "editar", tipo_alvo: "movimentacao", alvo: "Livro Hábitos Atômicos", valor: 35, categoria: "educacao" }, today);
    const n = e.state!.transactions.find((x) => x.id === t.id)!;
    expect(n.amount).toBe(35); expect(n.category).toBe("educacao");
  });
  it("acerta o saldo de uma conta sem perder o histórico (o saldo calculado vira o dito)", () => {
    const s = s0(), a = s.accounts[0]!, e = applyWrite(s, { acao: "editar", tipo_alvo: "conta", alvo: a.name, valor: 1234.56 }, today);
    expect(accountBalance(e.state!, e.state!.accounts[0]!, today)).toBeCloseTo(1234.56, 2);
  });
  it("acerta o limite disponível do cartão e muda o fechamento", () => {
    const s = s0(), e = applyWrite(s, { acao: "editar", tipo_alvo: "cartao", alvo: "Mercado Pago", disponivel: 1427.04, fechamento: 9, vencimento: 15 }, today);
    const c = e.state!.cards.find((x) => x.id === "card-mp")!;
    expect(cardAvailable(e.state!, c)).toBeCloseTo(1427.04, 2); expect(c.closingDay).toBe(9); expect(c.dueDay).toBe(15);
  });
  it("atualiza uma meta e uma compra parcelada (parcela e quantidade)", () => {
    const m = applyWrite(s0(), { acao: "editar", tipo_alvo: "meta", alvo: "Reserva de emergência", valor: 7000 }, today);
    expect(m.state!.goals.find((g) => g.id === "goal-reserva")!.current).toBe(7000);
    const p = applyWrite(s0(), { acao: "editar", alvo: "notebook", valor: 500, parcelas_total: 12 }, today).state!.plans.find((x) => x.id === "plan-notebook")!;
    expect(p.per).toBe(500); expect(p.count).toBe(12); expect(p.total).toBe(6000);
  });
  it("sem dizer o que mudar, pede", () => { expect(applyWrite(s0(), { acao: "editar", alvo: "netflix" }, today).result["ok"]).toBe(false); });
});

describe("voz: informar fatura, detalhar e cadastrar", () => {
  it("informa o total da fatura pelo mês de fechamento", () => {
    const s = s0(), c = s.cards.find((x) => x.id === "card-nubank")!, due = invoiceMonthOf(c, isoOf(today));
    const e = applyWrite(s, { acao: "fatura_total", cartao: "Nubank", valor: 5000 }, today);
    expect(ok(e)).toBe(true); expect(invoiceFor(e.state!, e.state!.cards.find((x) => x.id === c.id)!, due).total).toBe(5000);
  });
  it("detalhar parcelada dentro da fatura: total igual, restantes nas próximas, sem consumir limite", () => {
    let s = s0(); const c = s.cards.find((x) => x.id === "card-mp")!, due = invoiceMonthOf(c, isoOf(today));
    s = applyWrite(s, { acao: "fatura_total", cartao: "Mercado Pago", valor: 2000 }, today).state!;
    const livre = cardAvailable(s, s.cards.find((x) => x.id === c.id)!), antes = invoiceFor(s, s.cards.find((x) => x.id === c.id)!, due).total;
    const e = applyWrite(s, { acao: "detalhar", cartao: "Mercado Pago", descricao: "Tênis Nike", valor: 120, forma: "parcelada", parcelas_total: 10, parcela_atual: 3 }, today);
    expect(ok(e)).toBe(true); const cc = e.state!.cards.find((x) => x.id === c.id)!;
    expect(invoiceFor(e.state!, cc, due).total).toBe(antes); expect(e.result["restantes"]).toBe(7);
    expect(cardAvailable(e.state!, cc)).toBe(livre);
  });
  it("detalhar assinatura vira fixa mensal no cartão", () => {
    const e = applyWrite(s0(), { acao: "detalhar", cartao: "Nubank", descricao: "ChatGPT", valor: 100, forma: "assinatura", dia: 12 }, today);
    const r = e.state!.recurring.find((x) => x.desc === "ChatGPT")!;
    expect(r.subscription).toBe(true); expect(r.cardId).toBe("card-nubank"); expect(r.day).toBe(12);
  });
  it("cadastrar parcelada: compra de hoje consome o limite; com parcelas pagas, não e já alinha o calendário", () => {
    const s = s0(), c = s.cards.find((x) => x.id === "card-picpay")!, livre = cardAvailable(s, c);
    const nova = applyWrite(s, { acao: "cadastrar_parcelada", cartao: "PicPay", descricao: "TV", valor: 200, parcelas_total: 5 }, today);
    expect(cardAvailable(nova.state!, nova.state!.cards.find((x) => x.id === c.id)!)).toBeCloseTo(Math.max(0, livre - 1000), 2);
    const antiga = applyWrite(s, { acao: "cadastrar_parcelada", cartao: "PicPay", descricao: "Geladeira", valor: 300, parcelas_total: 10, parcelas_pagas: 3 }, today);
    const p = antiga.state!.plans.find((x) => x.desc === "Geladeira")!;
    expect(p.inLimit).toBe(true); expect(antiga.result["pagas"]).toBe(3); expect(cardAvailable(antiga.state!, antiga.state!.cards.find((x) => x.id === c.id)!)).toBe(livre);
  });
  it("cadastrar conta fixa e assinatura (precisa de conta ou cartão)", () => {
    expect(applyWrite(s0(), { acao: "cadastrar_fixa", descricao: "Internet", valor: 100, dia: 10 }, today).result["erro"]).toMatch(/conta ou cartão/);
    const f = applyWrite(s0(), { acao: "cadastrar_fixa", descricao: "Luz", valor: 150, dia: 20, conta: "Nubank" }, today);
    expect(f.state!.recurring.find((r) => r.desc === "Luz")!).toMatchObject({ kind: "despesa", method: "debito", day: 20 });
    const a = applyWrite(s0(), { acao: "cadastrar_fixa", descricao: "Disney", valor: 40, dia: 5, cartao: "Nubank", forma: "assinatura" }, today);
    expect(a.state!.recurring.find((r) => r.desc === "Disney")!).toMatchObject({ subscription: true, method: "credito", cardId: "card-nubank" });
    const sal = applyWrite(s0(), { acao: "cadastrar_fixa", descricao: "Aluguel recebido", valor: 900, dia: 3, conta: "Nubank", forma: "receita" }, today);
    expect(sal.state!.recurring.find((r) => r.desc === "Aluguel recebido")!.kind).toBe("receita");
  });
});

describe("voz: excluir sempre pede confirmação", () => {
  it("sem confirmar só pergunta; confirmando, exclui", () => {
    const p = applyWrite(s0(), { acao: "excluir", alvo: "netflix" }, today);
    expect(p.result["precisa_confirmar"]).toBe(true); expect(p.state).toBeUndefined();
    const e = applyWrite(s0(), { acao: "excluir", alvo: "netflix", confirmado: true }, today);
    expect(e.state!.recurring.some((r) => r.id === "rec-netflix")).toBe(false);
  });
  it("excluir cartão leva as parcelas dele e solta as movimentações", () => {
    const s = s0(), n = s.plans.filter((p) => p.cardId === "card-mp").length;
    expect(n).toBeGreaterThan(0);
    const e = applyWrite(s, { acao: "excluir", tipo_alvo: "cartao", alvo: "Mercado Pago", confirmado: true }, today).state!;
    expect(e.cards.some((c) => c.id === "card-mp")).toBe(false); expect(e.plans.some((p) => p.cardId === "card-mp")).toBe(false);
    expect(e.transactions.every((t) => t.cardId !== "card-mp")).toBe(true);
  });
  it("excluir compra parcelada e meta", () => {
    expect(applyWrite(s0(), { acao: "excluir", alvo: "notebook", confirmado: true }, today).state!.plans.some((p) => p.id === "plan-notebook")).toBe(false);
    expect(applyWrite(s0(), { acao: "excluir", tipo_alvo: "meta", alvo: "Viagem para Lisboa", confirmado: true }, today).state!.goals.some((g) => g.id === "goal-lisboa")).toBe(false);
  });
});
