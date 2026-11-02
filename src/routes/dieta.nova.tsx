import { createFileRoute } from "@tanstack/react-router";
import { DietBuilder } from "@/components/health-diet-builder";
import cover from "@/assets/dieta-atleta.jpg";

export const Route = createFileRoute("/dieta/nova")({
  head: () => ({ meta: [
    { title: "Nova ficha de dieta — Presence Saúde" },
    { name: "description", content: "Organize sua ficha de dieta com objetivos, metas diárias e refeições personalizadas." },
    { property: "og:title", content: "Nova ficha de dieta — Presence Saúde" },
    { property: "og:description", content: "Planeje suas refeições em uma ficha de alimentação personalizada." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { property: "og:image", content: cover },
    { name: "twitter:image", content: cover },
  ] }),
  component: DietBuilder,
});
