import { createFileRoute } from "@tanstack/react-router";

import { PlanShell } from "@/components/PlanShell";
import { WorkPage } from "@/components/WorkPage";

export const Route = createFileRoute("/trabalho")({
  head: () => ({
    meta: [
      { title: "Orion · Meu trabalho" },
      { name: "description", content: "Tudo o que você precisa fazer: tarefas dos polos e do trabalho geral, numa fila só." },
    ],
  }),
  component: () => (<PlanShell active={0}><WorkPage /></PlanShell>),
});
