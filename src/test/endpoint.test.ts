import { describe, expect, it } from "vitest";
import { BASE_SILENCE_MS, silenceFor, silenceForSpeech } from "@/lib/voice/endpoint";

describe("quando o Orion acha que você terminou de falar", () => {
  it("pedido curto espera o básico; pergunta curta e completa responde mais cedo", () => {
    expect(silenceFor("que horas são")).toBe(BASE_SILENCE_MS);
    expect(silenceFor("Como você está?")).toBeLessThan(BASE_SILENCE_MS);
  });
  it("pedido longo espera mais entre as ideias", () => {
    const longo = "eu queria que você desse uma olhada no meu financeiro porque eu tenho duas faturas bem altas e só recebo mil e quinhentos reais";
    expect(silenceFor(longo)).toBeGreaterThan(BASE_SILENCE_MS + 1000);
  });
  it("parou no meio da frase (e, porque, que…): espera bem mais", () => {
    expect(silenceFor("eu queria saber quanto vou pagar porque")).toBeGreaterThan(silenceFor("eu queria saber quanto vou pagar hoje") + 1500);
    expect(silenceFor("tenho duas faturas e")).toBeGreaterThanOrEqual(BASE_SILENCE_MS + 1800);
  });
  it("nunca passa de 6,5 s e a gravação cresce com o quanto você falou", () => {
    expect(silenceFor(Array(80).fill("palavra").join(" ") + " e")).toBeLessThanOrEqual(6500);
    expect(silenceForSpeech(1000)).toBeLessThan(silenceForSpeech(20000)); expect(silenceForSpeech(10 ** 6)).toBeLessThanOrEqual(6500);
  });
});
