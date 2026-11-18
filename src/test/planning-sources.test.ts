import { describe, expect, it } from "vitest";
import { makeMock } from "@/lib/finance/mock";
import { demandsDue, financeEventsFor, mealsFrom, parseDeadline, toHabitsIn, toTaskIn, workoutFor } from "@/lib/planning/sources";
import type { Category, Habit, SplitDay, Task } from "@/lib/types";

describe("planejamento: dados reais das áreas", () => {
  it("treino pela divisão da semana: com treino, descanso ou sem divisão", () => {
    const split: SplitDay[] = [{ id: "1", weekday: 2, title: "Glúteo", workout_id: "w1" }, { id: "2", weekday: 3, title: "Descanso", workout_id: null }];
    const ws = [{ id: "w1", name: "Glúteo e Posterior", duration_min: 55 }];
    expect(workoutFor(split, ws, 2)).toEqual({ title: "Glúteo e Posterior", durationMin: 55 });
    expect(workoutFor(split, ws, 3)).toBe("descanso"); expect(workoutFor(split, ws, 6)).toBe("descanso");
    expect(workoutFor([], ws, 2)).toBeNull();
  });
  it("hábitos: só os ativos, marcando os feitos hoje", () => {
    const hs: Habit[] = [{ id: "a", name: "Leitura", icon: "book", color: "emerald", position: 1, active: true }, { id: "b", name: "Velho", icon: "x", color: "cyan", position: 2, active: false }];
    const r = toHabitsIn(hs, new Set(["a"]));
    expect(r).toHaveLength(1); expect(r[0]!.doneToday).toBe(true);
  });
  it("tarefa de categoria 'comp' é compromisso", () => {
    const cats: Category[] = [{ id: "c1", slug: "comp", name: "Compromissos", icon: "x", color: "violet", position: 1 }];
    const t = { id: "t", title: "Dentista", description: null, category_id: "c1", priority: "media", due_date: "2026-11-17", due_time: "14:00:00", done: false, done_at: null, position: 1, created_at: "", end_time: "15:00:00", place: "Centro", color: "pink" } as Task;
    expect(toTaskIn(t, cats)).toMatchObject({ isCompromisso: true, color: "rose", place: "Centro" });
  });
  it("refeições só com horário válido", () => { expect(mealsFrom([{ name: "Café", meal_time: "7:30" }, { name: "Lanche", meal_time: null }, { name: "X", meal_time: "de manhã" }])).toEqual([{ name: "Café", time: "07:30" }]); });
  it("prazo de demanda em vários formatos", () => {
    expect(parseDeadline("2026-11-17", "2026-11-01")).toBe("2026-11-17"); expect(parseDeadline("17/11/2026", "2026-11-01")).toBe("2026-11-17");
    expect(parseDeadline("5/12", "2026-11-17")).toBe("2026-12-05"); expect(parseDeadline("sexta", "2026-11-17")).toBeNull(); expect(parseDeadline(null, "2026-11-17")).toBeNull();
  });
  it("demandas com prazo hoje e não concluídas", () => {
    const rows = [{ code: "D-1", title: "A", priority: "alta", status: "em_andamento", deadline: "17/11" }, { code: "D-2", title: "B", priority: "media", status: "concluida", deadline: "17/11" }, { code: "D-3", title: "C", priority: "media", status: "nova", deadline: "18/11" }];
    expect(demandsDue(rows, "2026-11-17").map((d) => d.code)).toEqual(["D-1"]);
  });
  it("financeiro do dia: fatura que vence e conta fixa do dia", () => {
    const s = makeMock(new Date(2026, 10, 17));
    const nu = s.cards.find((c) => c.id === "card-nubank")!; // vence dia 5
    const ev = financeEventsFor(s, "2026-12-05");
    expect(ev.some((e) => e.title === `Pagar a fatura ${nu.name}`)).toBe(true);
    expect(ev.some((e) => e.title === "Pagar Aluguel")).toBe(true); // aluguel fixo dia 5, em conta
    expect(financeEventsFor(s, "2026-11-18")).toHaveLength(0);
  });
});
