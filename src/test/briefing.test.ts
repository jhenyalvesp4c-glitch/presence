import { describe, expect, it } from "vitest";
import { EMPTY_BRIEFING, GREET_MARK, briefingPrompt, greetingDirective, isDuplicateMemory, sanitize } from "../lib/briefing";

describe("briefing: o que a Presence sabe sobre a pessoa", () => {
  const b = { ...EMPTY_BRIEFING, call_name: "Jhe", tone: "Direta e objetiva.", greeting: "saudacao_hoje" as const, work: "Treinamentos e suporte", biggest_demand: "Disparos em massa", preferences: "Nunca me avise antes das 9h", completed_at: "2026-11-18" };

  it("o prompt traz o nome, o jeito, o trabalho, as regras e o que já aprendeu", () => {
    const p = briefingPrompt(b, [{ text: "Prefere resumos curtos", kind: "preferencia" }]);
    expect(p).toContain('"Jhe"'); expect(p).toContain("Direta e objetiva"); expect(p).toContain("Treinamentos e suporte"); expect(p).toContain("Disparos em massa");
    expect(p).toContain("SEMPRE"); expect(p).toContain("Prefere resumos curtos"); expect(p).toContain("lembrar");
  });
  it("sem nada, o prompt fica vazio", () => { expect(briefingPrompt(null, [])).toBe(""); expect(briefingPrompt(EMPTY_BRIEFING, [])).toBe(""); });

  it("a saudação segue o que a pessoa escolheu", () => {
    expect(greetingDirective({ ...b, greeting: "saudacao_hoje" })).toContain("resumo_do_dia");
    expect(greetingDirective({ ...b, greeting: "saudacao" })).toContain("UMA frase");
    expect(greetingDirective({ ...b, greeting: "saudacao_pergunta" })).toContain("como pode ajudar");
    expect(greetingDirective({ ...b, greeting: "esperar" })).toBe("");
    expect(greetingDirective(null)).toBe("");
    expect(greetingDirective({ ...b, greeting: "saudacao", greeting_note: "me pergunte como dormi" })).toContain("como dormi");
    expect(GREET_MARK).toBe("[[inicio]]");
  });

  it("não guarda a mesma coisa duas vezes", () => {
    const have = [{ text: "Prefere reuniões à tarde" }];
    expect(isDuplicateMemory("prefere reunioes a tarde", have)).toBe(true);
    expect(isDuplicateMemory("Prefere reuniões à tarde, depois das 14h", have)).toBe(true);
    expect(isDuplicateMemory("Gosta de café sem açúcar", have)).toBe(false);
    expect(isDuplicateMemory("   ", have)).toBe(true);
  });

  it("limpa e limita o que vem da tela", () => {
    const s = sanitize({ ...EMPTY_BRIEFING, call_name: "  Jhe   Alves ".padEnd(200, "x"), greeting: "qualquer" as never, work: "a".repeat(5000) });
    expect(s.call_name.length).toBeLessThanOrEqual(60); expect(s.work.length).toBe(1500); expect(s.greeting).toBe("esperar");
  });
});
