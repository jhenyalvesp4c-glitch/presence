import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { workoutsForDate, type WorkoutSheet } from "@/lib/health-preview";

// A camada do banco é simulada: aqui só se testa o comportamento do hook (cache compartilhado, gravação, validação).
const { mocks, keys } = vi.hoisted(() => ({
  mocks: { saveWorkout: vi.fn(), saveDiet: vi.fn(), saveMeasurement: vi.fn(), toastError: vi.fn(), toastSuccess: vi.fn() },
  keys: {
    workout: ["health", "workout"], diet: ["health", "diet"], measurement: ["health", "measurement"],
    todayExercises: ["health", "today-exercise-logs"], todayMeals: ["health", "today-meal-logs"],
  } as const,
}));
vi.mock("@/lib/data/health", () => ({
  healthKeys: keys,
  useHealthWorkout: () => useQuery({ queryKey: keys.workout, queryFn: async () => null }),
  useHealthDiet: () => useQuery({ queryKey: keys.diet, queryFn: async () => null }),
  useHealthMeasurement: () => useQuery({ queryKey: keys.measurement, queryFn: async () => [] as unknown[] }),
  useTodayExerciseLogs: () => useQuery({ queryKey: keys.todayExercises, queryFn: async () => [] as string[] }),
  useTodayMealLogs: () => useQuery({ queryKey: keys.todayMeals, queryFn: async () => [] as string[] }),
  useToggleMeal: () => useMutation({ mutationFn: async () => {} }),
  upsertEntry: (list: { measuredOn: string }[], entry: { measuredOn: string }) =>
    [...list.filter((e) => e.measuredOn !== entry.measuredOn), entry].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)),
  saveWorkoutSheetDb: mocks.saveWorkout, saveDietDb: mocks.saveDiet, saveMeasurementDb: mocks.saveMeasurement,
}));
vi.mock("@/lib/data/workouts", () => ({ useLogExercise: () => ({ mutate: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import { useHealthPreview } from "@/components/health-preview-provider";

const workout: WorkoutSheet = {
  nome: "Treino semanal",
  sessoes: [
    { id: 1, nome: "Treino A", dias: ["seg", "qua"], exercicios: [{ nome: "Agachamento Livre", grupo: "Pernas" }] },
    { id: 2, nome: "Treino B", dias: ["ter", "sáb"], exercicios: [] },
  ],
};
const diet = { name: "Rotina alimentar", goal: "Manutenção", macros: { calories: "2100", protein: "120", carbs: "250", fat: "65" }, notes: "", meals: [{ id: 1, name: "Almoço", time: "12:00", foods: ["Arroz", "Frango"] }] };

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => [useHealthPreview(), useHealthPreview()] as const, { wrapper });
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.saveWorkout.mockResolvedValue(undefined);
  mocks.saveDiet.mockResolvedValue(undefined);
  mocks.saveMeasurement.mockResolvedValue(undefined);
});

describe("Health sheets (imported behavior)", () => {
  it("only includes sessions assigned to the selected weekday", () => {
    expect(workoutsForDate(workout, new Date(2026, 10, 2)).map(s => s.id)).toEqual([1]);
    expect(workoutsForDate(workout, new Date(2026, 10, 7)).map(s => s.id)).toEqual([2]);
    expect(workoutsForDate(workout, new Date(2026, 10, 8))).toEqual([]);
    expect(workoutsForDate(null, new Date(2026, 10, 2))).toEqual([]);
  });
});

describe("Health sheets backed by the database", () => {
  it("starts empty and becomes ready once the database answers", async () => {
    const { result } = setup();
    expect(result.current[0].ready).toBe(false);
    await waitFor(() => expect(result.current[0].ready).toBe(true));
    expect(result.current[0].workout).toBeNull();
    expect(result.current[0].diet).toBeNull();
    expect(result.current[0].doneKeys).toEqual([]);
  });

  it("shows new sheets immediately to every consumer while they are being saved", async () => {
    // Gravações que ainda não terminaram: a tela já mostra o valor novo (otimista).
    mocks.saveWorkout.mockReturnValue(new Promise(() => {}));
    mocks.saveDiet.mockReturnValue(new Promise(() => {}));
    mocks.saveMeasurement.mockReturnValue(new Promise(() => {}));
    const { result } = setup();
    await waitFor(() => expect(result.current[0].ready).toBe(true));
    act(() => {
      result.current[0].setWorkout(workout);
      result.current[0].setDiet(diet);
      result.current[0].setMeasurements({ nome: "Novembro", data: "2026-11-02", altura: "1,70", peso: "62,5", valores: { cintura: "72" }, obs: "", fotos: {} });
    });
    await waitFor(() => expect(result.current[1].workout?.sessoes[0]?.exercicios[0]?.nome).toBe("Agachamento Livre"));
    expect(result.current[1].diet?.meals[0]?.foods).toEqual(["Arroz", "Frango"]);
    expect(result.current[1].measurements?.peso).toBe("62,5");
    expect(mocks.saveWorkout).toHaveBeenCalledWith(workout);
    expect(mocks.saveDiet).toHaveBeenCalledWith(diet);
    expect(mocks.saveMeasurement).toHaveBeenCalledTimes(1);
  });

  it("confirms each save with a message", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current[0].ready).toBe(true));
    act(() => {
      result.current[0].setWorkout(workout);
      result.current[0].setDiet(diet);
    });
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Ficha de treino salva"));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Ficha de dieta salva"));
  });

  it("keeps a measurement history: one entry per date, oldest first, replacing the same date", async () => {
    mocks.saveMeasurement.mockReturnValue(new Promise(() => {}));
    const { result } = setup();
    await waitFor(() => expect(result.current[0].ready).toBe(true));
    const check = (data: string, peso: string) => ({ nome: "N", data, altura: "1,70", peso, valores: {}, obs: "", fotos: {} });
    act(() => result.current[0].setMeasurements(check("2026-11-10", "61")));
    act(() => result.current[0].setMeasurements(check("2026-11-01", "63")));
    await waitFor(() => expect(result.current[1].measurementHistory.map((m) => m.data)).toEqual(["2026-11-01", "2026-11-10"]));
    expect(result.current[1].measurements?.peso).toBe("61");
    act(() => result.current[0].setMeasurements(check("2026-11-10", "60,5")));
    await waitFor(() => expect(result.current[1].measurementHistory).toHaveLength(2));
    expect(result.current[1].measurements?.peso).toBe("60,5");
  });

  it("refuses invalid numbers instead of saving (and tells the user)", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current[0].ready).toBe(true));
    expect(() => result.current[0].setDiet({ ...diet, macros: { ...diet.macros, calories: "abc" } })).toThrow(/Calorias/);
    expect(() => result.current[0].setMeasurements({ nome: "", data: "", altura: "170", peso: "62", valores: {}, obs: "", fotos: {} })).toThrow(/Altura/);
    expect(mocks.toastError).toHaveBeenCalledTimes(2);
    expect(mocks.saveDiet).not.toHaveBeenCalled();
    expect(mocks.saveMeasurement).not.toHaveBeenCalled();
    expect(result.current[0].diet).toBeNull();
  });

  it("reports a failed save", async () => {
    mocks.saveWorkout.mockRejectedValue(new Error("sem conexão"));
    const { result } = setup();
    await waitFor(() => expect(result.current[0].ready).toBe(true));
    act(() => result.current[0].setWorkout(workout));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining("sem conexão")));
  });
});
