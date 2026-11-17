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

describe("palavra de ativação: menos falsos chamados, mais acertos", () => {
  it("o texto que a transcrição inventa com ruído NÃO ativa (a dica antiga repetia 'Orion' várias vezes)", () => {
    expect(heardWake("Orion. Assistente Orion. Ei Orion, bom dia, Orion. Órion.")).toBe(false);
    expect(heardWake("Orion, Orion, Orion")).toBe(false);
  });
  it("só vale no começo da fala: citar o nome no meio de uma conversa não ativa", () => {
    for (const t of ["falei com o Orion ontem", "oi tudo bem Orion", "hoje eu vi o Orion no carro e foi legal"]) expect(heardWake(t), t).toBe(false);
  });
  it("chamados normais continuam funcionando, até com um prefixo curto ou o nome repetido duas vezes", () => {
    for (const t of ["Ei, Orion!", "bom dia Orion", "Orion Orion", "oi Orion, tudo bem?", "Orion?", "ei ei Orion"]) expect(heardWake(t), t).toBe(true);
  });
  it("aceita o nome quebrado em dois pedaços ('o Ryan', 'ou Rian', 'ori on')", () => {
    for (const t of ["o Ryan", "ou Rian", "ori on", "O Orion", "Ó Ryan, que horas são"]) expect(heardWake(t), t).toBe(true);
  });
  it("palavras comuns do português e ruídos escritos não ativam", () => {
    for (const t of ["aria", "ária", "ari", "ouro", "ouvir", "rio", "orgão", "Obrigado.", "Legendas pela comunidade Amara.org", "hum", "oi", "ok", "bom dia tudo bem", "onde", "Maria"]) expect(heardWake(t), t).toBe(false);
  });
  it("o pedido dito junto continua sendo separado", () => {
    expect(afterWake("o Ryan, cria uma tarefa")).toBe("cria uma tarefa");
    expect(afterWake("Ei, Orion! Que horas são?")).toBe("Que horas são?");
    expect(afterWake("falei com o Orion ontem")).toBe("");
  });
});
