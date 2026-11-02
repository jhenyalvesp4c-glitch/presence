import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceSection } from "@/components/workspace-section";


export const Route = createFileRoute("/calendario")({
  head: () => ({ meta: [
    { title: "Calendário — Presence Saúde" },
    { name: "description", content: "Consulte os dias da sua rotina no calendário Saúde." },
    { property: "og:title", content: "Calendário — Presence Saúde" },
    { property: "og:description", content: "Seu calendário de atividades e bem-estar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <WorkspaceSection section="calendario" />,
});