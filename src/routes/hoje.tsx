import { createFileRoute } from "@tanstack/react-router";
import { HealthToday } from "@/components/health-today";
import cover from "@/assets/hoje-corpo.jpg";

export const Route = createFileRoute("/hoje")({
  head: () => ({ meta: [
    { title: "Hoje — Sua rotina no Presence" },
    { name: "description", content: "Seu treino do dia, plano alimentar e medidas atuais em um só lugar." },
    { property: "og:title", content: "Hoje — Sua rotina no Presence" },
    { property: "og:description", content: "Acompanhe treino, refeições e corpo no seu painel diário." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: cover }, { name: "twitter:image", content: cover },
  ] }), component: () => <HealthToday />,
});