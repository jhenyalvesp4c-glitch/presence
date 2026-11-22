# Central do dia e Playbooks

## Central do dia (`/central`)
Tudo de hoje numa tela só: agenda (tarefas com horário), tarefas e atrasadas, rotina fixa, hábitos, treino e dieta, demandas com prazo (atrasadas, hoje e próximos 3 dias), faturas que fecham/vencem em até 7 dias, contratos de clientes que vencem em 30 dias e reuniões do dia. Marcar tarefa, rotina fixa ou hábito grava nas mesmas tabelas das telas originais. Cada seção carrega sozinha; se uma falhar, só ela avisa. Regras puras em `src/lib/central.ts`, consultas em `src/lib/data/central.ts`.

## Playbooks (Documentação → Playbooks)
Roteiro que cria, de uma vez e ligado ao dossiê: dossiê, cliente, pasta na Biblioteca com 4 documentos-modelo, tarefas (com datas relativas ao início), demandas (`#P0xx`, tipo "polo") e um checklist. Passos editáveis antes de executar. Rodar de novo para o mesmo cliente **reaproveita** o que existe e não duplica tarefas/demandas/documentos.
Modelos em `src/lib/playbooks.ts` (`PLAYBOOKS`); executor em `src/lib/data/playbooks.ts`; tela em `src/components/PlaybooksView.tsx`. Para um novo playbook, acrescente um item em `PLAYBOOKS`.

## Roteiro de implantação (Clientes → Implantação)
Passo a passo para colocar o sistema do cliente no ar: 7 fases (Base e acessos, Estrutura da empresa, Horário de funcionamento, Fluxo de atendimento, Kanban e funil, Canais e integrações, Testes e go-live), 29 passos com "como fazer". Cada passo tem status (a fazer, fazendo, concluído, travado, não se aplica), anotação por cliente (sem senhas) e dá para acrescentar passos. O playbook de onboarding cria o roteiro; também dá para criar pelo botão na ficha. **Modo guiado:** tela grande com trilha de fases, lista de passos e painel de foco. A Central do dia mostra as implantações em andamento.
Tabela `client_setup` (migração `20261201000500_client_setup.sql`, RLS só do dono). Modelo e regras puras em `src/lib/setup.ts`; tela em `src/components/SetupGuide.tsx`.

## Roteiro de implantação padrão do projeto
Configure uma vez e todo cliente novo já nasce com o seu roteiro. Duas formas: **Documentação → Playbooks → "Roteiro de implantação" → Editar padrão** (fases, passos, "como fazer", ordem) ou, dentro do modo guiado de um cliente, **"Usar como padrão"** (copia o roteiro daquele cliente, sem status nem anotações). Tabela `setup_templates` (um padrão por projeto, migração `20261201000600`). O padrão vale para clientes **novos**; quem já tem roteiro não muda. Sem padrão salvo, vale o modelo inicial (`SETUP_TEMPLATE` em `src/lib/setup.ts`). Editor em `src/components/SetupTemplateEditor.tsx`, dados em `src/lib/data/setup-templates.ts`.
