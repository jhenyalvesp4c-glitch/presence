import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/ComingSoon";

export const Route = createFileRoute("/demandas")({
  head: () => ({
    meta: [
      { title: "Presence · Demandas" },
      { name: "description", content: "Organize seus projetos, demandas e prioridades com a Presence." },
      { property: "og:title", content: "Presence · Demandas" },
      { property: "og:description", content: "Organize seus projetos e prioridades." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ComingSoon title="Demandas" text="Organize seus projetos e prioridades." />,
});
