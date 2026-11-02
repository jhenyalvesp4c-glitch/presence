import { createFileRoute } from "@tanstack/react-router";
import { HealthHabits } from "@/components/health-habits";


export const Route = createFileRoute("/habitos")({
  head: () => ({ meta: [
    { title: "Hábitos — Presence Saúde" },
    { name: "description", content: "Consulte a área de hábitos da sua rotina Saúde." },
    { property: "og:title", content: "Hábitos — Presence Saúde" },
    { property: "og:description", content: "Sua área de hábitos e bem-estar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: HealthHabits,
});