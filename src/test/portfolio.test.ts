import { describe, expect, it } from "vitest";
import { portfolioHealth } from "@/lib/portfolio";
import type { Client } from "@/lib/clients";

const mk = (id: string, o: Partial<Client> = {}): Client => ({ id, projectId: "p", dossierId: null, name: id, segment: "", contactName: "", email: "", phone: "", docNumber: "", status: "ativo", plan: "", monthlyValue: 0, contractEnd: null, notes: "", ...o });
const TODAY = "2026-11-22";

describe("saúde da carteira", () => {
  it("média só dos ativos, parados e sem contato", () => {
    const p = portfolioHealth({
      clients: [mk("A"), mk("B"), mk("C"), mk("Z", { status: "pausa" })],
      setups: [{ clientId: "A", total: 10, finished: 5, blocked: 0 }, { clientId: "B", total: 10, finished: 0, blocked: 0 }],
      lastContact: { A: "2026-11-20", B: "2026-09-01" }, openDemands: { A: 2, C: 1 },
    }, TODAY);
    expect(p.active).toBe(3);
    expect(p.avgPct).toBe(17);
    expect(p.notStarted).toBe(2);
    expect(p.silent).toBe(2); // B (82 dias) e C (nunca)
    expect(p.openDemands).toBe(3);
    expect(p.rows.map((r) => r.id)).toEqual(["B", "C", "A"]);
    expect(p.rows.find((r) => r.id === "A")!.level).toBe("ok");
    expect(p.rows.find((r) => r.id === "B")!.level).toBe("late");
  });
  it("travado vira atrasado e carteira vazia dá zero", () => {
    expect(portfolioHealth({ clients: [mk("A")], setups: [{ clientId: "A", total: 4, finished: 2, blocked: 1 }], lastContact: { A: TODAY }, openDemands: {} }, TODAY).rows[0]!.level).toBe("late");
    expect(portfolioHealth({ clients: [], setups: [], lastContact: {}, openDemands: {} }, TODAY).avgPct).toBe(0);
  });
});

import { planReplace, type SetupPhaseDef } from "@/lib/setup";
describe("trocar roteiro antigo pelo novo", () => {
  const tpl: SetupPhaseDef[] = [{ id: "a", name: "Fase A", tone: "cyan", goal: "", steps: [{ key: "k1", title: "Novo 1", hint: "" }, { key: "k2", title: "Novo 2", hint: "" }] }];
  it("mantém andamento, cria o que falta e só apaga o antigo intocado", () => {
    const p = planReplace(tpl, [
      { id: "1", key: "k1", status: "done", note: "" },
      { id: "2", key: "velho", status: "todo", note: "" },
      { id: "3", key: "velho2", status: "doing", note: "" },
      { id: "4", key: "custom-x", status: "todo", note: "" },
      { id: "5", key: "velho3", status: "todo", note: "anotei" },
    ]);
    expect(p.update.map((u) => u.id)).toEqual(["1"]);
    expect(p.insert.map((i) => i.key)).toEqual(["k2"]);
    expect(p.remove).toEqual(["2"]);
  });
});
