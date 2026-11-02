import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceSection } from "@/components/workspace-section";


export const Route = createFileRoute("/analise")({
  head: () => ({ meta: [
    { title: "Análise — Presence Saúde" },
    { name: "description", content: "Acesse a área de análise de peso e medidas do Saúde." },
    { property: "og:title", content: "Análise — Presence Saúde" },
    { property: "og:description", content: "Sua evolução corporal na área de análise." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <WorkspaceSection section="analise" />,
});