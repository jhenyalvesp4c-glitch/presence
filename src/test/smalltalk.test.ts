import { describe, expect, it } from "vitest";
import { isSmallTalk } from "@/lib/voice/smalltalk";

describe("papo rápido", () => {
  it("reconhece conversa curta", () => {
    for (const t of ["Oi Orion, tudo bem?", "Oi Orion, tudo bem? Como você está hoje?", "Como você está?", "e você?", "Obrigada!", "valeu Orion", "Bom dia", "oi Jheny tudo bem"]) expect(isSmallTalk(t, ["Jheny"]), t).toBe(true);
  });
  it("NÃO trata pedidos como papo (seguem com ferramentas)", () => {
    for (const t of ["Que dia é hoje?", "Como está meu financeiro?", "Como vai minha agenda?", "Oi, abre as tarefas", "Tudo bem, cria uma demanda", "o que eu tenho hoje", "como estão meus hábitos", "", "ok anota isso"]) expect(isSmallTalk(t, ["Jheny"]), t).toBe(false);
  });
});
