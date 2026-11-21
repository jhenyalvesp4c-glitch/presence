import { describe, expect, it } from "vitest";
import { COURSES, lessonsOf } from "@/lib/courses";
import { backupJson, empty, parseBackup, sanitize } from "@/lib/courses/storage";

describe("cursos", () => {
  const meta = COURSES[0]!;
  it("toda aula tem fontes oficiais https e data válida ou pendente", () => {
    for (const l of lessonsOf(meta)) {
      expect(l.sources.length).toBeGreaterThan(0);
      for (const s of l.sources) expect(s.url).toMatch(/^https:\/\//);
      if (l.verified) expect(l.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect(new Set(lessonsOf(meta).map((l) => l.id)).size).toBe(lessonsOf(meta).length);
  });
  it("quiz: resposta aponta para uma alternativa existente", () => {
    for (const q of meta.quiz) { expect(q.answer).toBeGreaterThanOrEqual(0); expect(q.answer).toBeLessThan(q.options.length); }
  });
  it("sanitize descarta lixo e aulas que não existem", () => {
    const ids = lessonsOf(meta).map((l) => l.id);
    const s = sanitize({ completed: ["eco-1", "x", 5], notes: 3, bestScore: 999, caseNotes: { 0: "a", z: "b" }, attempts: [{ at: "2026-01-01", score: 150 }, "lixo"] }, ids);
    expect(s).toMatchObject({ completed: ["eco-1"], notes: "", bestScore: 100, caseNotes: { 0: "a" }, attempts: [{ at: "2026-01-01", score: 100 }] });
    expect(sanitize(null)).toEqual(empty);
  });
  it("backup: ida e volta, rejeita arquivo de outro app ou curso", () => {
    const st = { ...empty, completed: ["eco-1"], notes: "n" };
    expect(parseBackup("meta-academy", backupJson("meta-academy", st)).completed).toEqual(["eco-1"]);
    expect(() => parseBackup("meta-academy", "não é json")).toThrow(/JSON/);
    expect(() => parseBackup("meta-academy", JSON.stringify({ app: "outro", data: {} }))).toThrow(/outro aplicativo/);
    expect(() => parseBackup("meta-academy", JSON.stringify({ app: "orion-cursos", course: "x", data: {} }))).toThrow(/outro curso/);
    expect(parseBackup("meta-academy", JSON.stringify({ completed: ["qua-1"] })).completed).toEqual(["qua-1"]);
  });
});
