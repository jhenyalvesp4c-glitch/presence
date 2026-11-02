import { createFileRoute } from "@tanstack/react-router";
import { MedidasScreen } from "@/components/health-measurement-checkin";
import cover from "@/assets/medidas-hero.jpg";

export const Route = createFileRoute("/medidas/nova")({
  head: () => ({
    meta: [
      { title: "Nova ficha de medidas — Presence Saúde" },
      { name: "description", content: "Registre peso, medidas corporais e fotos para acompanhar sua evolução." },
      { property: "og:title", content: "Nova ficha de medidas — Presence Saúde" },
      { property: "og:description", content: "Acompanhe a evolução do seu corpo registrando medidas, peso e fotos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: cover },
      { name: "twitter:image", content: cover },
    ],
  }),
  component: () => <MedidasScreen />,
});
