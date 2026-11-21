# Central do dia e Playbooks

## Central do dia (`/central`)
Tudo de hoje numa tela só: agenda (tarefas com horário), tarefas e atrasadas, rotina fixa, hábitos, treino e dieta, demandas com prazo (atrasadas, hoje e próximos 3 dias), faturas que fecham/vencem em até 7 dias, contratos de clientes que vencem em 30 dias e reuniões do dia. Marcar tarefa, rotina fixa ou hábito grava nas mesmas tabelas das telas originais. Cada seção carrega sozinha; se uma falhar, só ela avisa. Regras puras em `src/lib/central.ts`, consultas em `src/lib/data/central.ts`.

## Playbooks (Documentação → Playbooks)
Roteiro que cria, de uma vez e ligado ao dossiê: dossiê, cliente, pasta na Biblioteca com 4 documentos-modelo, tarefas (com datas relativas ao início), demandas (`#P0xx`, tipo "polo") e um checklist. Passos editáveis antes de executar. Rodar de novo para o mesmo cliente **reaproveita** o que existe e não duplica tarefas/demandas/documentos.
Modelos em `src/lib/playbooks.ts` (`PLAYBOOKS`); executor em `src/lib/data/playbooks.ts`; tela em `src/components/PlaybooksView.tsx`. Para um novo playbook, acrescente um item em `PLAYBOOKS`.
