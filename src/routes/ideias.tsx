import { createFileRoute } from "@tanstack/react-router";
import { IdeasPage } from "@/components/ideas/IdeasPage";

export const Route = createFileRoute("/ideias")({
  head: () => ({ meta: [{ title: "Projetos e ideias · Orion" }, { name: "description", content: "Caixa de ideias com captura por texto, voz e print, desenvolvimento com o Orion e conversão em projeto, tarefa, lembrete ou documentação." }] }),
  component: IdeasPage,
});
