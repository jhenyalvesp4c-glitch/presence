import { createFileRoute, redirect } from "@tanstack/react-router";

/** As listas agora ficam dentro de Tarefas; o endereço antigo continua funcionando. */
export const Route = createFileRoute("/listas")({
  beforeLoad: () => { throw redirect({ to: "/tarefas", search: { aba: "listas" }, replace: true }); },
});
