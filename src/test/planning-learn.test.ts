import { describe, expect, it } from "vitest";
import { applyToLearned, insights, suggestionsFrom, type PlanEvent } from "@/lib/planning/learn";

const TODAY = "2026-11-17";
const day = (n: number) => { const d = new Date(Date.parse(TODAY) - n * 86400000); return d.toISOString().slice(0, 10); };
const ev = (o: Partial<PlanEvent> & { title: string; action: PlanEvent["action"]; ago: number }): PlanEvent => ({ plan_date: day(o.ago), kind: "habito", planned_time: null, at_time: null, created_at: `${day(o.ago)}T12:00:00Z`, ...o });

describe("aprendizado: sugestões a partir do seu dia", () => {
  it("sem histórico suficiente não sugere nada", () => { expect(suggestionsFrom([ev({ title: "Treino", action: "feito", ago: 1, planned_time: "16:30", at_time: "19:00" })], TODAY)).toHaveLength(0); });
  it("sugere mudar o horário quando você sempre faz bem mais tarde (3 vezes ou mais)", () => {
    const events = [1, 2, 3, 4].map((a) => ev({ title: "Treino", kind: "treino", action: "feito", ago: a, planned_time: "16:30", at_time: "19:10" }));
    const s = suggestionsFrom(events, TODAY);
    expect(s).toHaveLength(1); expect(s[0]).toMatchObject({ kind: "mover", payload: { title: "Treino", to: "19:15" } });
    expect(s[0]!.detail).toContain("16:30");
  });
  it("não sugere quando a diferença é pequena", () => {
    expect(suggestionsFrom([1, 2, 3].map((a) => ev({ title: "Leitura", action: "feito", ago: a, planned_time: "08:00", at_time: "08:40" })), TODAY)).toHaveLength(0);
  });
  it("avisa do que você adia 3 vezes ou mais", () => {
    const s = suggestionsFrom([2, 3, 5].map((a) => ev({ title: "Declarar imposto", kind: "tarefa", action: "adiado", ago: a })), TODAY);
    expect(s[0]).toMatchObject({ kind: "adiado", payload: { count: 3 } });
  });
  it("sugere limitar tarefas quando termina menos da metade", () => {
    const events = [...[1, 2, 3].map((a) => ev({ title: `T${a}`, kind: "tarefa", action: "feito", ago: a, at_time: "10:00" })), ...[1, 2, 3, 4, 5, 6].map((a) => ev({ title: `U${a}`, kind: "tarefa", action: "adiado", ago: a }))];
    expect(suggestionsFrom(events, TODAY).some((x) => x.kind === "limite")).toBe(true);
  });
  it("descobre o melhor horário para as tarefas", () => {
    const events = Array.from({ length: 10 }, (_, i) => ev({ title: `T${i}`, kind: "tarefa", action: "feito", ago: (i % 7) + 1, at_time: i < 7 ? "09:40" : "15:00" }));
    const s = suggestionsFrom(events, TODAY).find((x) => x.kind === "pico");
    expect(s?.payload["peakStart"]).toBe("09:00");
  });
  it("não repete o que já foi decidido ou mostrado", () => {
    const events = [1, 2, 3, 4].map((a) => ev({ title: "Treino", kind: "treino", action: "feito", ago: a, planned_time: "16:30", at_time: "19:10" }));
    const first = suggestionsFrom(events, TODAY);
    expect(suggestionsFrom(events, TODAY, new Set(first.map((s) => s.key)))).toHaveLength(0);
  });
  it("ignora eventos antigos (mais de 21 dias)", () => {
    expect(suggestionsFrom([40, 41, 42, 43].map((a) => ev({ title: "Treino", kind: "treino", action: "feito", ago: a, planned_time: "16:30", at_time: "19:10" })), TODAY)).toHaveLength(0);
  });
});

describe("aprendizado: aplicar o que foi aceito", () => {
  it("guarda limite, pico e horário preferido do hábito", () => {
    let l = applyToLearned({}, { key: "limite:5", kind: "limite", title: "", detail: "", payload: { limit: 5 } });
    l = applyToLearned(l, { key: "pico:9", kind: "pico", title: "", detail: "", payload: { peakStart: "09:00" } });
    l = applyToLearned(l, { key: "mover:x", kind: "mover", title: "", detail: "", payload: { title: "Leitura 20 min", to: "21:00" } });
    expect(l).toEqual({ taskLimit: 5, peakStart: "09:00", habitTimes: { "leitura 20 min": "21:00" } });
  });
  it("resumo em frases do que já sabe", () => {
    const events = [1, 2, 3, 4].map((a) => ev({ title: "Treino", kind: "treino", action: "feito", ago: a, planned_time: "16:30", at_time: "19:00" }));
    const t = insights(events, TODAY).join(" ");
    expect(t).toContain("4 atividades concluídas"); expect(t).toContain("19:00");
  });
});
