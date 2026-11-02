import { createFileRoute } from "@tanstack/react-router";
import { HealthProgress } from "@/components/health-progress";
import cover from "@/assets/hoje-corpo.jpg";

export const Route = createFileRoute("/progresso")({
  head: () => ({ meta: [
    { title: "Seu progresso — Presence Saúde" }, { name: "description", content: "Consulte seu peso, medidas corporais e fotos atuais." },
    { property: "og:title", content: "Seu progresso — Presence Saúde" }, { property: "og:description", content: "Sua ficha de peso e medidas com desenho corporal." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: cover }, { name: "twitter:image", content: cover },
  ] }), component: () => <HealthProgress />,
});