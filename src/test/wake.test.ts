import { describe, expect, it } from "vitest";
import { afterWake, heardWake } from "@/lib/voice/wake";

describe("palavra de ativação", () => {
  it("reconhece 'Presence' como o reconhecimento costuma escrever", () => {
    for (const t of ["Presence", "presence", "Presence, que horas são", "ei presence", "Presens", "Prisens", "presença", "Presença!", "ok Presence?", "PRESENCE"]) expect(heardWake(t), t).toBe(true);
  });
  it("não dispara com outras palavras", () => {
    for (const t of ["presente", "pressão", "preciso de ajuda", "representante", "essência", "presidente", "pré-sentença", "bom dia", ""]) expect(heardWake(t), t).toBe(false);
  });
  it("pega o pedido dito junto", () => {
    expect(afterWake("Presence, que horas são?")).toBe("que horas são?");
    expect(afterWake("Presence")).toBe("");
    expect(afterWake("ei presença cria uma tarefa")).toBe("cria uma tarefa");
    expect(afterWake("bom dia")).toBe("");
  });
});
