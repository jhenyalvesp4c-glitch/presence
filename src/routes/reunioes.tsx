import { createFileRoute } from "@tanstack/react-router";
import { MeetingsPage } from "@/components/meetings/MeetingsPage";

export const Route = createFileRoute("/reunioes")({
  head: () => ({ meta: [{ title: "Reuniões · Orion" }, { name: "description", content: "Cole ou grave a reunião (ou traga grupos do WhatsApp) e receba ata, decisões, quem faz o quê, demandas e lembretes." }] }),
  component: MeetingsPage,
});
