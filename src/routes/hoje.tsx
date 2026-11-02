import { createFileRoute } from "@tanstack/react-router";
import { HealthOverview } from "@/components/health-overview";
import cover from "@/assets/hoje-corpo.jpg";

export const Route = createFileRoute("/hoje")({
  head: () => ({ meta: [
    { title: "Hoje — Sua rotina na Presence" },
    { name: "description", content: "Seu treino do dia, plano alimentar e medidas atuais em um só lugar." },
    { property: "og:title", content: "Hoje — Sua rotina na Presence" },
    { property: "og:description", content: "Acompanhe treino, refeições e corpo no seu painel diário." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: cover }, { name: "twitter:image", content: cover },
  ] }), component: () => <HealthOverview tab="hoje" />,
});