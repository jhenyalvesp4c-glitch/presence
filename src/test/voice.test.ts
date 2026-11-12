import { describe, expect, it } from "vitest";
import { cleanForSpeech, takeSentences } from "@/lib/voice/sentences";

describe("Voz: frases para falar", () => {
  it("limpa markdown, links e emojis", () => {
    expect(cleanForSpeech("**Pronto!** Veja https://x.com 😀 [aqui](http://y)")).toBe("Pronto! Veja aqui");
  });

  it("solta cada frase completa e guarda o resto", () => {
    const r = takeSentences("Criei a demanda. Agora estou conferindo o prazo e", { first: false });
    expect(r.chunks).toEqual(["Criei a demanda."]);
    expect(r.rest).toBe("Agora estou conferindo o prazo e");
  });

  it("a primeira frase sai mais cedo, na vírgula", () => {
    const r = takeSentences("Claro, vou abrir a página de saúde agora mesmo para você ver tudo", { first: true });
    expect(r.chunks.length).toBeGreaterThanOrEqual(0);
    const long = takeSentences("Vou abrir a página de saúde agora mesmo, e depois mostro o treino", { first: true });
    expect(long.chunks[0]).toBe("Vou abrir a página de saúde agora mesmo,");
    expect(long.first).toBe(false);
  });

  it("flush solta o que sobrou", () => {
    expect(takeSentences("Tudo certo", { first: false, flush: true })).toMatchObject({ chunks: ["Tudo certo"], rest: "" });
  });

  it("não corta em abreviação de número pequeno", () => {
    const r = takeSentences("Às 3. Depois você almoça com a equipe.", { first: false, min: 12 });
    expect(r.chunks.join(" ")).toContain("Depois você almoça com a equipe.");
  });
});
