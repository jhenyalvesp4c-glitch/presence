import { createFileRoute } from "@tanstack/react-router";

import { CoursesPage } from "@/components/courses/CoursesPage";

export const Route = createFileRoute("/cursos")({
  head: () => ({ meta: [{ title: "Cursos · Orion" }, { name: "description", content: "Trilhas de estudo com aulas, simulados, flashcards, laboratório de casos, fontes oficiais e data de verificação." }] }),
  component: CoursesPage,
});
