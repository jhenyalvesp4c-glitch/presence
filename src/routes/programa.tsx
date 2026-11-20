import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProgramPage, type Tab } from "@/components/program/ProgramPage";

const TABS: Tab[] = ["hoje", "plano", "evolucao", "semana", "medidas", "relatorio"];

export const Route = createFileRoute("/programa")({
  validateSearch: (s: Record<string, unknown>): { aba?: Tab | undefined } => ({ aba: TABS.find((t) => t === s["aba"]) }),
  head: () => ({ meta: [{ title: "Programa de treino · Orion" }, { name: "description", content: "Seu programa de treino: treino do dia, cargas, progressão, avaliação semanal, medidas e relatório." }] }),
  component: Page,
});

function Page() {
  const { aba } = Route.useSearch(), navigate = useNavigate();
  return <ProgramPage tab={aba ?? "hoje"} onTab={(t) => void navigate({ to: "/programa", search: t === "hoje" ? {} : { aba: t }, replace: true })} />;
}
