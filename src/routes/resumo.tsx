import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceSection } from "@/components/workspace-section";


export const Route = createFileRoute("/resumo")({
  head: () => ({ meta: [
    { title: "Resumo — Presence Saúde" },
    { name: "description", content: "Acesse seus treinos, dieta e medidas no painel de resumo." },
    { property: "og:title", content: "Resumo — Presence Saúde" },
    { property: "og:description", content: "Sua rotina de bem-estar em um só lugar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <WorkspaceSection section="resumo" />,
});