import { createFileRoute } from "@tanstack/react-router";
import { HealthOverview } from "@/components/health-overview";

export const Route = createFileRoute("/saude_/dieta")({
  head: () => ({ meta: [
    { title: "Sua alimentação — Presence Saúde" }, { name: "description", content: "Consulte refeições, metas e alimentos da sua ficha de dieta." },
    { property: "og:title", content: "Sua alimentação — Presence Saúde" }, { property: "og:description", content: "Seu plano alimentar e metas diárias." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: () => <HealthOverview tab="dieta" />,
});