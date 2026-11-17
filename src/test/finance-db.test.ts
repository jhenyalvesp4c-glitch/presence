import { describe, expect, it } from "vitest";
import { diffRows, emptyRows, fromRows, hasData, toRows } from "@/lib/finance/db-map";
import { makeMock } from "@/lib/finance/mock";
import { EMPTY_STATE } from "@/lib/finance/types";

const today = new Date(2026, 10, 17);
// o banco devolve números como texto e nulos explícitos: simula isso
const viaBanco = (st = makeMock(today)) => fromRows(JSON.parse(JSON.stringify(toRows(st), (_k, v) => (typeof v === "number" ? String(v) : v))) as ReturnType<typeof toRows>);

describe("financeiro: tradução para o banco", () => {
  it("ida e volta não perde nem muda nada (com dados de demonstração)", () => {
    const a = makeMock(today), b = viaBanco(a);
    expect(b.accounts).toEqual(a.accounts);
    expect(b.cards).toEqual(a.cards);
    expect(b.plans).toEqual(a.plans);
    expect(b.transactions).toEqual(a.transactions);
    expect(b.goals).toEqual(a.goals);
    expect(b.recurring.map((r) => r.id)).toEqual(a.recurring.map((r) => r.id));
    expect({ onboarded: b.onboarded, mock: b.mock }).toEqual({ onboarded: a.onboarded, mock: a.mock });
  });
  it("assinaturas e pausas sobrevivem à ida e volta", () => {
    const a = makeMock(today), b = viaBanco(a);
    const dis = b.recurring.find((r) => r.id === "rec-disney")!;
    expect(dis.subscription).toBe(true);
    expect(dis.pauses).toHaveLength(1);
    expect(dis.pauses![0]!.to).toBeUndefined();
    expect(b.recurring.find((r) => r.id === "rec-aluguel")!.pauses).toBeUndefined();
  });
  it("ajustes de fatura (outros valores pendentes) voltam como números", () => {
    const a = makeMock(today); a.cards[0]!.adjustments = { "2026-12": 500.5 };
    expect(viaBanco(a).cards[0]!.adjustments).toEqual({ "2026-12": 500.5 });
  });
  it("estado vazio ida e volta", () => { expect(fromRows(toRows(EMPTY_STATE))).toEqual(EMPTY_STATE); expect(hasData(EMPTY_STATE)).toBe(false); expect(hasData(makeMock(today))).toBe(true); });
});

describe("financeiro: gravação só do que mudou", () => {
  it("sem mudança, nada vai para a rede", () => { const r = toRows(makeMock(today)); expect(diffRows(r, toRows(makeMock(today))).empty).toBe(true); });
  it("tudo é novo na primeira subida", () => {
    const d = diffRows(emptyRows(), toRows(makeMock(today)));
    expect(d.upserts.fin_accounts).toHaveLength(4); expect(d.upserts.fin_cards).toHaveLength(3); expect(d.upserts.fin_transactions.length).toBeGreaterThan(50); expect(d.settings).toBe(true);
  });
  it("editar um lançamento envia só ele; apagar envia só o id", () => {
    const a = makeMock(today), b = structuredClone(a);
    b.transactions[0]!.amount += 1; const gone = b.transactions.pop()!;
    const d = diffRows(toRows(a), toRows(b));
    expect(d.upserts.fin_transactions.map((r) => r.id)).toEqual([a.transactions[0]!.id]);
    expect(d.deletes.fin_transactions).toEqual([gone.id]);
    expect(d.upserts.fin_accounts).toHaveLength(0);
  });
  it("pausar uma assinatura muda só aquela linha", () => {
    const a = makeMock(today), b = structuredClone(a);
    b.recurring.find((r) => r.id === "rec-netflix")!.pauses = [{ from: "2026-12" }];
    const d = diffRows(toRows(a), toRows(b));
    expect(d.upserts.fin_recurring.map((r) => r.id)).toEqual(["rec-netflix"]);
  });
  it("concluir o briefing grava só a configuração", () => {
    const a = makeMock(today); a.onboarded = false; const b = structuredClone(a); b.onboarded = true;
    const d = diffRows(toRows(a), toRows(b));
    expect(d.settings).toBe(true); expect(d.empty).toBe(false); expect(d.upserts.fin_transactions).toHaveLength(0);
  });
});
