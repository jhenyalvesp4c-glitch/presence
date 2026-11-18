import { createFileRoute } from "@tanstack/react-router";
import { AnalysisPage } from "@/components/health-analysis/AnalysisPage";

export const Route = createFileRoute("/analise")({
  head: () => ({ meta: [
    { title: "Análise corporal — Orion Saúde" },
    { name: "description", content: "Painel da sua evolução corporal: peso, medidas, composição, indicadores de saúde e fotos." },
    { property: "og:title", content: "Análise corporal — Orion Saúde" },
    { property: "og:description", content: "Gráficos da evolução do peso, das medidas e dos indicadores de saúde." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: AnalysisPage,
});
