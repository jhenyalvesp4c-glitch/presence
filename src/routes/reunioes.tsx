import { createFileRoute } from "@tanstack/react-router";
import { MeetingsPage } from "@/components/meetings/MeetingsPage";

export const Route = createFileRoute("/reunioes")({
  head: () => ({ meta: [{ title: "Reuniões · Orion" }, { name: "description", content: "Cole ou grave a reunião (ou traga grupos do WhatsApp) e receba ata, decisões, quem faz o quê, demandas e lembretes." }] }),
  validateSearch: (s: Record<string, unknown>): { gravar?: string | undefined; tipo?: string | undefined; aba?: string | undefined } => ({ gravar: s["gravar"] === "1" || s["gravar"] === 1 ? "1" : undefined, tipo: typeof s["tipo"] === "string" ? (s["tipo"] as string) : undefined, aba: typeof s["aba"] === "string" ? (s["aba"] as string) : undefined }),
  component: MeetingsPage,
});
