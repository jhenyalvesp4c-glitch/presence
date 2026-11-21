import { createFileRoute } from "@tanstack/react-router";

import { CentralDoDia } from "@/components/central/CentralDoDia";

export const Route = createFileRoute("/central")({
  head: () => ({ meta: [{ title: "Central do dia · Orion" }, { name: "description", content: "Tudo de hoje numa tela só: agenda, tarefas, rotina, hábitos, treino, dieta, demandas, faturas, contratos e reuniões." }] }),
  component: CentralDoDia,
});
