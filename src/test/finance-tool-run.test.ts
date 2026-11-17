import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeMock } from "@/lib/finance/mock";

const state = makeMock(new Date());
const persist = vi.fn(async () => undefined);
vi.mock("@/lib/finance/cloud-repo", () => ({ cloudFinanceRepo: { readCloud: async () => structuredClone(state) }, persistChange: (...a: unknown[]) => persist(...(a as [])) }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

describe("ferramenta financeiro: leitura, gravação e navegação", () => {
  beforeEach(() => persist.mockClear());
  it("alteração grava a diferença e avisa a tela para atualizar", async () => {
    const { runFinanceTool } = await import("@/lib/voice/finance-tool");
    const r = await runFinanceTool({ acao: "pausar", alvo: "netflix" });
    expect(r.result["ok"]).toBe(true); expect(r.mudou).toBe(true); expect(persist).toHaveBeenCalledTimes(1);
  });
  it("excluir sem confirmar não grava nada", async () => {
    const { runFinanceTool } = await import("@/lib/voice/finance-tool");
    const r = await runFinanceTool({ acao: "excluir", alvo: "netflix" });
    expect(r.result["precisa_confirmar"]).toBe(true); expect(persist).not.toHaveBeenCalled(); expect(r.mudou).toBeUndefined();
  });
  it("falha ao gravar: avisa que nada mudou", async () => {
    persist.mockRejectedValueOnce(new Error("rede"));
    const { runFinanceTool } = await import("@/lib/voice/finance-tool");
    const r = await runFinanceTool({ acao: "pausar", alvo: "spotify" });
    expect(r.result["ok"]).toBe(false); expect(String(r.result["erro"])).toMatch(/Nada foi mudado/);
  });
  it("consultas não gravam; abrir devolve a navegação", async () => {
    const { runFinanceTool } = await import("@/lib/voice/finance-tool");
    expect((await runFinanceTool({ acao: "meses" })).result["ok"]).toBe(true);
    expect((await runFinanceTool({ acao: "abrir", aba: "assinaturas" })).navegar).toBe("/financeiro?aba=assinaturas");
    expect(persist).not.toHaveBeenCalled();
  });
});
