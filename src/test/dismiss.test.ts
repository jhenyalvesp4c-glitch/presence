import { describe, expect, it } from "vitest";
import { isDismiss } from "@/lib/voice/dismiss";

describe("dispensar o painel por voz", () => {
  it("agradecimentos e pedidos para fechar", () => {
    for (const t of ["Ok, Orion, muito obrigada", "obrigado!", "valeu", "pode fechar", "fecha isso", "não preciso mais", "já vi, obrigada", "tchau Orion", "ok, isso era só"]) expect(isDismiss(t), t).toBe(true);
  });
  it("não fecha quando há um pedido novo ou é conversa comum", () => {
    for (const t of ["obrigada, agora me mostra as tarefas", "abre o financeiro", "o que tenho hoje", "como estão meus hábitos", "", "oi"]) expect(isDismiss(t), t).toBe(false);
  });
});
