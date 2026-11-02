import { createFileRoute } from "@tanstack/react-router";
import { HealthOverview } from "@/components/health-overview";
import cover from "@/assets/treino.jpg";

export const Route = createFileRoute("/saude_/treino")({
  head: () => ({ meta: [
    { title: "Seus treinos — Presence Saúde" }, { name: "description", content: "Consulte as sessões e exercícios da sua ficha de treino." },
    { property: "og:title", content: "Seus treinos — Presence Saúde" }, { property: "og:description", content: "Sua divisão de treino e exercícios organizados." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: cover }, { name: "twitter:image", content: cover },
  ] }), component: () => <HealthOverview tab="treino" />,
});