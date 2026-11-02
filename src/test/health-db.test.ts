import { describe, expect, it } from "vitest";

import { dietFromRows, dietToRow, formatNumber, measurementToRow, parseNumber, photoSlug, splitFromSessions, uniqueMuscles, workoutSheetFromRows } from "@/lib/health-db";

describe("números", () => {
  it("aceita vírgula e ponto", () => {
    expect(parseNumber("Altura", "1,70", 0.3, 3)).toBe(1.7);
    expect(parseNumber("Peso", "80.5", 1, 700)).toBe(80.5);
  });
  it("vazio vira null", () => {
    expect(parseNumber("Peso", "  ", 1, 700)).toBeNull();
    expect(parseNumber("Peso", undefined, 1, 700)).toBeNull();
  });
  it("lança erro claro para texto e valor fora do limite", () => {
    expect(() => parseNumber("Peso", "abc", 1, 700)).toThrow(/Peso/);
    expect(() => parseNumber("Altura", "170", 0.3, 3, "em metros")).toThrow(/entre 0.3 e 3/);
  });
  it("formata de volta no padrão brasileiro", () => {
    expect(formatNumber(80)).toBe("80");
    expect(formatNumber("80.50")).toBe("80,5");
    expect(formatNumber(null)).toBe("");
  });
});

describe("divisão semanal", () => {
  const sessions = [
    { nome: "Treino A", dias: ["seg", "qui"] },
    { nome: "Treino B", dias: ["qui", "sex"] },
  ];
  it("une sessões no mesmo dia e usa a primeira como treino do dia", () => {
    const split = splitFromSessions(sessions);
    expect(split).toHaveLength(7);
    expect(split[1]).toEqual({ weekday: 1, title: "Treino A", sessionIndex: 0 });
    expect(split[4]).toEqual({ weekday: 4, title: "Treino A + Treino B", sessionIndex: 0 });
    expect(split[5]).toEqual({ weekday: 5, title: "Treino B", sessionIndex: 1 });
  });
  it("dias sem sessão são descanso (domingo = 0)", () => {
    const split = splitFromSessions(sessions);
    expect(split[0]).toEqual({ weekday: 0, title: "Descanso", sessionIndex: null });
    expect(split[6]!.sessionIndex).toBeNull();
  });
});

describe("conversões do banco para a tela", () => {
  it("ficha de treino: id da sessão é a posição + 1", () => {
    const sheet = workoutSheetFromRows(
      "Minha ficha",
      [{ id: "w1", name: "Treino A", days: ["seg"] }, { id: "w2", name: "Treino B", days: [] }],
      [{ workout_id: "w2", name: "Stiff", muscle: "Posterior" }, { workout_id: "w1", name: "Agachamento", muscle: "Quadríceps" }],
    );
    expect(sheet.sessoes.map((s) => s.id)).toEqual([1, 2]);
    expect(sheet.sessoes[0]!.exercicios).toEqual([{ nome: "Agachamento", grupo: "Quadríceps" }]);
    expect(sheet.sessoes[1]!.exercicios[0]!.nome).toBe("Stiff");
  });
  it("dieta: números viram texto e refeições ganham ids", () => {
    const diet = dietFromRows(
      { name: "Cutting", goal: "Definição", calories: 1800, protein: "130.0", carbs: null, fat: 45.5, notes: "" },
      [{ name: "Café", meal_time: "07:00", foods: ["ovo"] }],
    );
    expect(diet.macros).toEqual({ calories: "1800", protein: "130", carbs: "", fat: "45,5" });
    expect(diet.meals[0]).toEqual({ id: 1, name: "Café", time: "07:00", foods: ["ovo"] });
  });
});

describe("da tela para o banco", () => {
  it("dieta valida os macros", () => {
    const row = dietToRow({ name: " X ", goal: "Saúde", macros: { calories: "1.400", protein: "", carbs: "120", fat: "45" }, notes: "", meals: [] });
    expect(row.name).toBe("X");
    expect(() => dietToRow({ name: "", goal: "", macros: { calories: "99999", protein: "", carbs: "", fat: "" }, notes: "", meals: [] })).toThrow(/Calorias/);
  });
  it("medidas: usa a data de hoje quando vazia e descarta campos em branco", () => {
    const row = measurementToRow({ nome: "N", data: "", altura: "1,70", peso: "80,5", valores: { peito: "95", braco: " " }, obs: "", fotos: {} }, "2026-11-02");
    expect(row).toMatchObject({ measured_on: "2026-11-02", height_m: 1.7, weight_kg: 80.5, values: { peito: "95" } });
  });
});

describe("pequenos utilitários", () => {
  it("grupos musculares distintos", () => {
    expect(uniqueMuscles([{ grupo: "Peito" }, { grupo: " peito" }, { grupo: "" }, { grupo: "Costas" }])).toEqual(["Peito", "peito", "Costas"]);
  });
  it("nome seguro para arquivo", () => {
    expect(photoSlug("Outras fotos")).toBe("outras-fotos");
    expect(photoSlug("Lâdo")).toBe("lado");
  });
});
