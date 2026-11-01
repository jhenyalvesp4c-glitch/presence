import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/saude")({
  head: () => ({
    meta: [
      { title: "Presence · Saúde e bem-estar" },
      { name: "description", content: "Treino, dieta, hábitos e evolução com a Presence." },
      { property: "og:title", content: "Presence · Saúde e bem-estar" },
      { property: "og:description", content: "Treino, dieta, hábitos e evolução." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ComingSoon title="Saúde e bem-estar" text="Treino, dieta, hábitos e evolução." />,
});
