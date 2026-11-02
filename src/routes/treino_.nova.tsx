import { createFileRoute } from "@tanstack/react-router";
import { NovaFichaTreino } from "@/components/health-workout-builder";
import cover from "@/assets/treino-hero.jpg";

export const Route = createFileRoute("/treino_/nova")({
  head: () => ({
    meta: [
      { title: "Nova ficha de treino — Presence Saúde" },
      { name: "description", content: "Crie sua ficha de treino para organizar exercícios, séries e acompanhar sua evolução." },
      { property: "og:title", content: "Nova ficha de treino — Presence Saúde" },
      { property: "og:description", content: "Monte sua ficha de treino em um painel futurista." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: cover },
      { name: "twitter:image", content: cover },
    ],
  }),
  component: NovaFichaTreino,
});
