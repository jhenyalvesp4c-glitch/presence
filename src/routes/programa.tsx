import { createFileRoute } from "@tanstack/react-router";
import { ProgramPage } from "@/components/program/ProgramPage";

export const Route = createFileRoute("/programa")({
  head: () => ({ meta: [{ title: "Programa de treino · Orion" }, { name: "description", content: "Monte seu programa de treino: use a ficha pronta ou envie a sua." }] }),
  component: ProgramPage,
});
