import { createContext, useContext, useState, type ReactNode } from "react";
import type { WorkoutSheet, DietSheet, MeasurementSheet } from "@/lib/health-preview";


type Preview = {
  workout: WorkoutSheet | null; diet: DietSheet | null; measurements: MeasurementSheet | null;
  setWorkout: (sheet: WorkoutSheet) => void; setDiet: (sheet: DietSheet) => void; setMeasurements: (sheet: MeasurementSheet) => void;
};
const PreviewContext = createContext<Preview | null>(null);
export function HealthPreviewProvider({ children }: { children: ReactNode }) {
  const [workout, setWorkout] = useState<WorkoutSheet | null>(null);
  const [diet, setDiet] = useState<DietSheet | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementSheet | null>(null);
  return <PreviewContext.Provider value={{ workout, diet, measurements, setWorkout, setDiet, setMeasurements }}>{children}</PreviewContext.Provider>;
}
export function useHealthPreview() {
  const context = useContext(PreviewContext);
  if (!context) throw new Error("Health preview provider is required");
  return context;
}