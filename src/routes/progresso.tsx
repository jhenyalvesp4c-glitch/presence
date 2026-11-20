import { createFileRoute, redirect } from "@tanstack/react-router";

// O antigo "Progresso" foi para dentro da Análise (uma tela só): quem chegar por links antigos é levado para lá.
export const Route = createFileRoute("/progresso")({ beforeLoad: () => { throw redirect({ to: "/analise", replace: true }); } });
