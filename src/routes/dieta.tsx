import { createFileRoute } from "@tanstack/react-router";
import { DietPage } from "@/components/diet/DietPage";

export const Route = createFileRoute("/dieta")({
  head: () => ({ meta: [{ title: "Dieta · Orion" }, { name: "description", content: "Monte seu plano alimentar: use a ficha pronta ou envie a sua." }] }),
  component: DietPage,
});
