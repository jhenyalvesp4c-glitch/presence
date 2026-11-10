import { describe, expect, it } from "vitest";

import { sortTrainings, trainingAppointment, trainingStatus } from "@/lib/trainings";

const base = { group: "Turma Niterói", people: 6, scriptKey: "s1", scriptTitle: "Primeiros passos no CRM", date: "2026-11-12" };

describe("turmas de treinamento", () => {
  it("turma vira compromisso do calendário com título, roteiro e pessoas", () => {
    const a = trainingAppointment({ ...base, time: "14:00", end: "16:00", place: "Online", notes: "Levar lead de teste" });
    expect(a.title).toBe("Treinamento · Turma Niterói");
    expect(a.date).toBe("2026-11-12");
    expect(a.time).toBe("14:00");
    expect(a.end).toBe("16:00");
    expect(a.place).toBe("Online");
    expect(a.notes).toBe("Roteiro: Primeiros passos no CRM · 6 pessoas\nLevar lead de teste");
  });

  it("sem horário de início, o fim é ignorado (turma de dia todo)", () => {
    const a = trainingAppointment({ ...base, end: "16:00" });
    expect(a.time).toBeUndefined();
    expect(a.end).toBeUndefined();
  });

  it("status: feita quando marcada, próxima de hoje em diante, passou se ficou para trás", () => {
    expect(trainingStatus({ done: true, date: "2026-11-01" }, "2026-11-10")).toBe("feita");
    expect(trainingStatus({ done: false, date: "2026-11-10" }, "2026-11-10")).toBe("proxima");
    expect(trainingStatus({ done: false, date: "2026-11-09" }, "2026-11-10")).toBe("passou");
  });

  it("lista mostra próximas primeiro (mais perto antes) e depois as passadas (mais recente antes)", () => {
    const list = [
      { id: "a", done: true, date: "2026-10-28" },
      { id: "b", done: false, date: "2026-11-19" },
      { id: "c", done: true, date: "2026-11-05" },
      { id: "d", done: false, date: "2026-11-12", time: "09:00" },
    ];
    expect(sortTrainings(list, "2026-11-10").map((t) => t.id)).toEqual(["d", "b", "c", "a"]);
  });
});
