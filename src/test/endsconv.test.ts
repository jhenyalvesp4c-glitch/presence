import { describe, expect, it } from "vitest";
import { endsConversation, isDismiss } from "@/lib/voice/dismiss";

describe("agradeceu: fecha a tela e para de ouvir", () => {
  it("agradecimento e despedida encerram", () => { for (const t of ["Ok, Orion, muito obrigada", "valeu", "tchau Orion", "não preciso mais", "isso era só", "pode parar", "obrigado!"]) expect(endsConversation(t), t).toBe(true); });
  it("pedir para fechar a tela só fecha, continua ouvindo", () => { for (const t of ["pode fechar", "fecha isso"]) { expect(isDismiss(t), t).toBe(true); expect(endsConversation(t), t).toBe(false); } });
  it("agradecer e já pedir outra coisa não encerra", () => { for (const t of ["obrigada, agora me mostra as tarefas", "valeu, e o financeiro?", "valeu e o financeiro", "como estão meus hábitos"]) expect(endsConversation(t), t).toBe(false); });
});
