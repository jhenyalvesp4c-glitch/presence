import { describe, expect, it } from "vitest";
import { dueOf, quickAnswer, summarize, type Client, type ClientDoc } from "@/lib/clients";

const mk = (o: Partial<Client>): Client => ({ id: "1", projectId: "p", dossierId: null, name: "Clínica Vida Plena", segment: "", contactName: "", email: "", phone: "", docNumber: "", status: "ativo", plan: "", monthlyValue: 1000, contractEnd: null, notes: "", ...o });
const TODAY = "2026-11-21";

describe("clientes", () => {
  it("vencimento: 30 dias alerta, passado é atrasado, pausado não alerta, sem data é neutro", () => {
    expect(dueOf(mk({ contractEnd: "2026-12-04" }), TODAY)).toEqual({ days: 13, level: "soon" });
    expect(dueOf(mk({ contractEnd: "2026-12-22" }), TODAY).level).toBe("ok");
    expect(dueOf(mk({ contractEnd: "2026-11-10" }), TODAY).level).toBe("late");
    expect(dueOf(mk({ contractEnd: "2026-11-25", status: "pausa" }), TODAY).level).toBe("ok");
    expect(dueOf(mk({}), TODAY)).toEqual({ days: null, level: "none" });
  });
  it("resumo soma só os ativos e conta os que pedem atenção", () => {
    const s = summarize([mk({ id: "a", monthlyValue: 4800, contractEnd: "2026-12-04" }), mk({ id: "b", status: "neg", monthlyValue: 2400 }), mk({ id: "c", status: "pausa", monthlyValue: 1500, contractEnd: "2026-11-25" })], 3, TODAY);
    expect(s).toMatchObject({ active: 1, total: 3, monthly: 4800, negotiating: 2400, expiring: 1, openDemands: 3 });
  });
  it("respostas rápidas usam os dados reais", () => {
    const clients = [mk({ id: "a", contractEnd: "2026-12-04" }), mk({ id: "b", name: "Construtora Alvorada", contractEnd: "2027-06-01" })];
    const docs: ClientDoc[] = [{ id: "d", clientId: "b", title: "Contrato 2026.pdf", kind: "Contrato", docDate: "2026-01-08", attachments: [], summary: "" }];
    const demands = [{ clientId: "a", code: "1", title: "Enviar relatório", status: "todo", deadline: "28/11" }, { clientId: "b", code: "2", title: "Feita", status: "done", deadline: "" }];
    expect(quickAnswer("quais contratos vencem?", { clients, docs, demands }, TODAY)?.lines[0]).toContain("Clínica Vida Plena");
    expect(quickAnswer("demandas abertas", { clients, docs, demands }, TODAY)?.title).toBe("1 demanda aberta");
    expect(quickAnswer("onde está o contrato da Alvorada?", { clients, docs, demands }, TODAY)).toMatchObject({ clientId: "b" });
    expect(quickAnswer("qualquer coisa", { clients, docs, demands }, TODAY)).toBeNull();
  });
});
