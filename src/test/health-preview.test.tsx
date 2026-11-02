import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthPreviewProvider, useHealthPreview } from "@/components/health-preview-provider";
import { workoutsForDate, type WorkoutSheet } from "@/lib/health-preview";

const workout: WorkoutSheet = {
  nome: "Treino semanal",
  sessoes: [
    { id: 1, nome: "Treino A", dias: ["seg", "qua"], exercicios: [{ nome: "Agachamento Livre", grupo: "Pernas" }] },
    { id: 2, nome: "Treino B", dias: ["ter", "sáb"], exercicios: [] },
  ],
};

describe("Imported health sheet behavior", () => {
  it("only includes sessions assigned to the selected weekday", () => {
    expect(workoutsForDate(workout, new Date(2026, 10, 2)).map(s => s.id)).toEqual([1]);
    expect(workoutsForDate(workout, new Date(2026, 10, 7)).map(s => s.id)).toEqual([2]);
    expect(workoutsForDate(workout, new Date(2026, 10, 8))).toEqual([]);
    expect(workoutsForDate(null, new Date(2026, 10, 2))).toEqual([]);
  });

  it("shares newly created workout, diet and measurement values between consumers", () => {
    const { result } = renderHook(() => [useHealthPreview(), useHealthPreview()], { wrapper: HealthPreviewProvider });
    act(() => {
      result.current[0]?.setWorkout(workout);
      result.current[0]?.setDiet({ name: "Rotina alimentar", goal: "Manutenção", macros: { calories: "2100", protein: "120", carbs: "250", fat: "65" }, notes: "", meals: [{ id: 1, name: "Almoço", time: "12:00", foods: ["Arroz", "Frango"] }] });
      result.current[0]?.setMeasurements({ nome: "Novembro", data: "2026-11-02", altura: "1,70", peso: "62,5", valores: { cintura: "72" }, obs: "", fotos: {} });
    });
    expect(result.current[1]?.workout?.sessoes[0]?.exercicios[0]?.nome).toBe("Agachamento Livre");
    expect(result.current[1]?.diet?.meals[0]?.foods).toEqual(["Arroz", "Frango"]);
    expect(result.current[1]?.diet?.macros.calories).toBe("2100");
    expect(result.current[1]?.measurements?.peso).toBe("62,5");
    act(() => result.current[0]?.setWorkout({ ...workout, nome: "Treino atualizado" }));
    expect(result.current[1]?.workout?.nome).toBe("Treino atualizado");
  });

  it("starts without sheets on a new provider, matching the source's in-memory behavior", () => {
    const first = renderHook(() => useHealthPreview(), { wrapper: HealthPreviewProvider });
    act(() => first.result.current.setWorkout(workout));
    expect(first.result.current.workout?.nome).toBe("Treino semanal");
    first.unmount();
    const fresh = renderHook(() => useHealthPreview(), { wrapper: HealthPreviewProvider });
    expect(fresh.result.current.workout).toBeNull();
    expect(fresh.result.current.diet).toBeNull();
    expect(fresh.result.current.measurements).toBeNull();
  });
});