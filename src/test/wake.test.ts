import { describe, expect, it } from "vitest";
import { afterWake, heardWake } from "@/lib/voice/wake";

describe("palavra de ativação", () => {
  it("reconhece 'Orion' como o reconhecimento costuma escrever", () => {
    for (const t of ["Orion", "orion", "Órion", "Orion, que horas são", "ei orion", "Orian", "Aurion", "ok Orion?", "ORION", "Orions", "Órion", "Ório", "Orio", "Ori on", "ô Orion", "Orião", "Hórion", "Auria", "Ourion"]) expect(heardWake(t), t).toBe(true);
  });
  it("não dispara com outras palavras", () => {
    for (const t of ["origem", "oriente", "Marion", "organizar", "original", "orar", "oração", "bom dia", "presence", "orientação", "oriundo", "ordem", ""]) expect(heardWake(t), t).toBe(false);
  });
  it("pega o pedido dito junto", () => {
    expect(afterWake("Orion, que horas são?")).toBe("que horas são?");
    expect(afterWake("Orion")).toBe("");
    expect(afterWake("ei Órion cria uma tarefa")).toBe("cria uma tarefa");
    expect(afterWake("bom dia")).toBe("");
  });
});
