import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useProgram } from "@/lib/data/program";
import { MedidasScreen } from "@/components/health-measurement-checkin";
import cover from "@/assets/medidas-hero.jpg";

export const Route = createFileRoute("/medidas/nova")({
  head: () => ({
    meta: [
      { title: "Nova ficha de medidas — Orion Saúde" },
      { name: "description", content: "Registre peso, medidas corporais e fotos para acompanhar sua evolução." },
      { property: "og:title", content: "Nova ficha de medidas — Orion Saúde" },
      { property: "og:description", content: "Acompanhe a evolução do seu corpo registrando medidas, peso e fotos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: cover },
      { name: "twitter:image", content: cover },
    ],
  }),
  component: Page,
});

// Com programa de treino, o cadastro de medidas é a aba "Medidas e fotos" da Análise (tela única).
function Page() {
  const { data: program, isLoading } = useProgram(), navigate = useNavigate();
  useEffect(() => { if (program) void navigate({ to: "/analise", search: { aba: "medidas" }, replace: true }); }, [program, navigate]);
  if (isLoading || program) return <main className="grid min-h-[60vh] place-items-center"><span className="mono-caps animate-pulse">Abrindo as medidas…</span></main>;
  return <MedidasScreen />;
}
