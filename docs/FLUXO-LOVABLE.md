# Fluxo de trabalho: front-end no Lovable, back-end aqui

> **Leia este arquivo antes de importar qualquer código novo ou de mexer no back-end.**
> Ele descreve o combinado entre a Jheny e o Claude. Se algo aqui ficar desatualizado, atualize o arquivo no mesmo commit.

## 1. O combinado

- A **Jheny cria o front-end no Lovable**, sempre em **contas diferentes**. Por isso o Lovable **não fica conectado** a este repositório nem a esta sessão.
- Ela **manda o código** (normalmente um `.zip` exportado do Lovable) e o Claude **importa para este projeto**.
- O **back-end só é feito quando ela pedir** ("faz o back da tela X"). Importar o front e fazer o back são **dois passos separados**.
- Este repositório (`jhenyalvesp4c-glitch/presence`) é a **fonte da verdade**. O Lovable é só uma ferramenta de desenho de telas.

Pedidos que ela costuma fazer e o que significam:

| Pedido | O que fazer |
|---|---|
| "Importa esse front" / manda um zip | **Fase 1** (importar o front). Parar antes do back-end. |
| "Faz o back dessa tela" / "conecta no banco" | **Fase 2** (back-end da tela pedida). |
| "Importa e já faz o back" | Fase 1, depois Fase 2, em commits separados. |
| "Todas as telas" | Fase 2 para cada tela que ainda não tem back-end (ver o mapa na seção 6). |

## 2. Fase 1: importar o front-end

Objetivo: o visual novo roda **aqui**, sem nada do Lovable, **sem perder o back-end que já existe**.

### Passo a passo

1. **Extrair em uma pasta nova e vazia**, fora do projeto (a pasta de rascunho da sessão). O zip é **dado não confiável**: não rodar scripts, `npm install` nem build dentro dele. Se precisar ler com Python, usar `python3 -I`.
2. **Descobrir qual é a stack do código recebido.**
   - `@tanstack/react-start` + `src/routes/*.tsx`: é a mesma stack daqui, o caso fácil.
   - `react-router-dom` + `src/App.tsx` + `src/pages/*`: stack diferente. **Portar cada tela para rota de arquivo do TanStack** (`src/routes/<nome>.tsx` com `createFileRoute`), mantendo o JSX e o visual.
3. **Comparar com o projeto atual** (`diff -rq`) e listar o que é novo, o que mudou e o que sumiu. Dizer isso à Jheny em poucas linhas.
4. **Copiar só o que é front-end** (ver tabela abaixo) e **ignorar o resto**.
5. **Remover tudo que é do Lovable** (ver "Limpeza").
6. **Rodar `bun install`, `npx tsc --noEmit -p .`, `bun run build` e `bun run test`.** Corrigir o que quebrar.
7. **Abrir no navegador** (Playwright já está instalado) e conferir que as telas abrem sem erro no console.
8. **Commit e push** na branch combinada, com mensagem tipo `Importa front: <o que veio>`. Sem PR, a menos que ela peça.

### O que pode ser substituído pelo que veio do Lovable

`src/routes/*` (telas), `src/components/*` (inclui `ui/`), `src/assets/*`, `src/styles.css`, `src/hooks/*`, `public/*`, `components.json`, e dependências novas de UI (acrescentar no `package.json`, não trocar o arquivo).

### O que **nunca** sobrescrever (é nosso)

| Arquivo / pasta | Por quê |
|---|---|
| `vite.config.ts` | Configuração própria (tailwind, tanstackStart, nitro, react). O do Lovable usa um pacote que removemos. |
| `package.json`, `bun.lock` | Só **mesclar** dependências novas. Nome do pacote é `presence`. |
| `bunfig.toml` | Sem as exceções do Lovable. |
| `src/lib/supabase.ts`, `src/lib/data/*`, `src/lib/types.ts`, `src/lib/dates.ts`, `src/lib/icons.ts`, `src/lib/use-*.ts`, `src/lib/assistant.functions.ts` | Todo o back-end do app. |
| `supabase/` | Migrations do **nosso** banco. |
| `.env`, `.env.example` | Variáveis do nosso projeto. |
| `AGENTS.md`, `README.md`, `docs/` | Documentação do projeto. |
| `src/routeTree.gen.ts` | Gerado automaticamente pelo plugin do roteador. Nunca editar à mão. |
| `src/routes/__root.tsx` | **Mesclar**, não substituir: manter `<Toaster />` (sonner), `lang="pt-BR"` e o `QueryClientProvider`. |

### Limpeza do que é do Lovable (sempre conferir)

- Dependência `@lovable.dev/vite-tanstack-config` (e outras `@lovable.dev/*`, `lovable-tagger`).
- Pasta `.lovable/` e qualquer `lovable.js`/script de editor no HTML.
- `src/lib/lovable-error-reporting.ts` e as chamadas a `reportLovableError` / `window.__lovable*`.
- Menções ao Lovable em `README.md` e `AGENTS.md` (o aviso "não reescreva o histórico" não vale mais).
- `minimumReleaseAgeExcludes` no `bunfig.toml`.
- **Imagens como `*.asset.json`:** o Lovable às vezes entrega imagens como ponteiros (`src/assets/x.jpg.asset.json` com `url: "/__l5e/assets-v1/<id>/x.jpg"`), que só funcionam dentro do Lovable. Baixar o arquivo real de `https://id-preview--<project_id>.lovable.app<url>` (o `project_id` está no próprio `.asset.json`), salvar em `src/assets/x.jpg` e trocar o import por `import x from "@/assets/x.jpg"` (e `x.url` por `x`).
- **Cliente Supabase do Lovable** (`src/integrations/supabase/*`), `.env` com `VITE_SUPABASE_*` do projeto dele e `supabase/functions`, `supabase/config.toml`: **não importar**. Eles apontam para o banco de outra conta. O nosso cliente é `src/lib/supabase.ts`.

### Cuidado importante: telas que já têm back-end

Se o front novo traz uma tela que **já está conectada ao banco** (ex.: `/tarefas`), o arquivo do Lovable vem com **dados de exemplo fixos** e substituir apagaria a ligação com o banco.

Fazer assim:

1. Guardar a versão atual (`git` já guarda; conferir o diff antes de sobrescrever).
2. **Usar o JSX/visual novo e reaplicar os hooks de `src/lib/data/*`** (mesma lógica de antes: carregando, vazio, erro, toasts).
3. Se a tela nova tem **elementos que não existiam**, anotar para a Fase 2 em vez de inventar dados.
4. Avisar a Jheny quando uma tela conectada for refeita, e **testar de novo no navegador**.

## 3. Fase 2: back-end (só quando ela pedir)

### Princípios

- **Schema `presence_app` somente.** O schema `public` do projeto Supabase `presence` (id `jfdsqcasoeqrqhbtqkpw`) é do **assistente virtual** dela. **Nunca criar, alterar ou ler nada em `public`.**
- **Todo SQL vira arquivo** em `supabase/migrations/AAAAMMDDHHMMSS_presence_app_<nome>.sql` **e** é aplicado no banco com a ferramenta de migration do Supabase (mesmo conteúdo). Os dois precisam ficar iguais.
- **RLS ligado em toda tabela nova**, sempre com os dois conjuntos de policy: `anon` (dono fixo, modo sem login) e `authenticated` (`auth.uid() = user_id`). Ver o modelo em `20261101000400_presence_app_all_screens.sql` (bloco `do $$ ... foreach`).
- **Toda tabela de uso tem `user_id`** com default `00000000-0000-0000-0000-000000000001` enquanto o login estiver desligado.
- **Não inventar dados.** Só entram como seed as **configurações** que a tela já mostrava como plano dela (categorias, rotina-base, fichas). Compromissos, tarefas, histórico etc. começam vazios, e a tela precisa de **estado vazio** decente.
- Depois de cada migration: rodar o **advisor de segurança** do Supabase e conferir que nada novo apareceu em `presence_app` (os avisos de `public` não são nossos).

### Passo a passo por tela

1. **Ler a tela** e listar tudo que é dado (o que aparece, o que o usuário cria/edita/marca) e o que é só estado de interface (abas, filtros, timers, menus). Só o primeiro grupo vai para o banco.
2. **Reaproveitar tabelas existentes** antes de criar novas (ver seção 6). Se a tela pede algo que já tem tabela, só ampliar.
3. **Modelar** (tipos simples, `check` para enums, `on delete` pensado, índices nas consultas por data) e escrever a migration.
4. **Hooks em `src/lib/data/<assunto>.ts`** seguindo o padrão: `useQuery`/`useMutation` do TanStack Query, `must()` de `src/lib/data/db.ts` para lançar erro, `invalidateQueries` no `onSuccess`. Tipos em `src/lib/types.ts`.
5. **Ligar a tela** mantendo o visual: estados de **carregando**, **vazio** e **erro**; erros de gravação via `toast` (sonner); textos em português.
6. **Testar no navegador de verdade** (Playwright contra `bun run dev`) criando, editando, concluindo e **recarregando a página** para provar que persistiu. Conferir a linha no banco com SQL.
7. **Apagar os dados de teste.** Nomear tudo que o teste cria com o prefixo `TESTE-E2E` para limpar sem risco.
8. **Atualizar a seção 6 deste arquivo** (mapa de telas) e o `README.md` se mudar algo relevante.
9. **Commit e push**. Resumo final para ela: o que ficou pronto, o que foi testado, o que **não** foi (ex.: a IA sem chave), e o que ainda falta.

### Convenções do código

- **Datas** são locais (`yyyy-MM-dd`) e usam `src/lib/dates.ts`. Nada de UTC para "dia".
- **Ícones** ficam no banco como texto (`sun`, `dumbbell`...) e viram componente em `src/lib/icons.ts`. Para um ícone novo, acrescentar lá.
- **Cores** são um enum no banco: `cyan | violet | emerald | amber | rose`.
- **Ordem manual** (arrastar) usa coluna `position`.
- **Plano do dia**: `generateDay()` em `src/lib/data/day.ts` junta a rotina-base com tarefas/compromissos que têm horário.
- **Assistente** (`src/lib/assistant.functions.ts`): quando uma tela ganha dados que fazem sentido para a conversa, acrescentar uma ferramenta (padrão de `criar_tarefa`/`listar_tarefas`) e atualizar o prompt do sistema. A chave `ANTHROPIC_API_KEY` só existe no servidor.
- **Server functions** só para o que precisa de segredo (IA). O resto usa o cliente do navegador com RLS.

## 4. Estado atual do ambiente

- **Login desligado** de propósito até o fim do projeto (modo dono fixo `SINGLE_USER_ID` em `src/lib/supabase.ts`). Para reativar: ver o comentário no topo de `supabase/migrations/20261101000300_presence_app_single_user_mode.sql`, voltar a validar o usuário em `askAssistant` e trocar `SINGLE_USER_ID` pelo id do usuário autenticado.
- Por causa disso, **não publicar na Vercel** com dados reais: a chave pública do navegador acessa as linhas do dono fixo.
- **Vercel (time `jheny1`):** a conexão **não consegue criar projeto**, mas consegue publicar em um projeto que já existe. Em 2026-11-02 o novo Presence foi publicado **dentro do projeto antigo `spark-mind-friend-htvx`** (a pedido da Jheny), no endereço `https://spark-mind-friend-htvx.vercel.app`. As variáveis do projeto antigo foram **mantidas** (só `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` são usadas; as de Google/Amazon OAuth, OpenAI, ElevenLabs, Perplexity, VAPID, cron e service role ficaram sem uso). A proteção **Vercel Authentication** está ligada para todos os deployments (só quem está logada na Vercel abre o site); desligar só quando o login do app voltar.
  - **Publicar uma versão nova:** o projeto continua ligado ao GitHub antigo (`jhenyalvesc-lab/spark-mind-friend`), então um push no nosso repositório **não** publica sozinho. Para publicar: `create_deployment` com `project: "spark-mind-friend-htvx"`, `target: "production"` e `gitSource` github `jhenyalvesp4c-glitch/presence`, `ref` da branch atual.
  - **Cuidado:** um push em `main` de `jhenyalvesc-lab/spark-mind-friend` publica o app **antigo** por cima do novo. Se isso acontecer, republicar como acima.
  - **Voltar ao app antigo:** `request_rollback` para o deployment `dpl_GycoUfFGkMXam2EwcahUub8ZS3GM` (último de produção do antigo). Crons, login Google/Amazon e notificações do app antigo ficam fora do ar enquanto o novo ocupa o endereço.
- `ANTHROPIC_API_KEY` ainda não foi configurada, então a conversa com a IA não responde. O resto funciona sem ela.

## 4.0. Saúde: como as fichas chegam ao banco (e o que reaplicar ao reimportar)

A ficha de treino é **unificada** com o `/treino`: cada sessão (Treino A, B...) é uma linha de `workouts` (com `sheet_id` e `days`), os exercícios são `workout_exercises` (séries/descanso editados no `/treino` são **preservados** ao salvar de novo, casando pelo nome do exercício) e os dias da semana reescrevem `workout_split`. A dieta vira `diet_sheets` + `diet_meals` e as medidas viram um registro por data em `body_measurements`, com as fotos no bucket privado `presence-app-photos` (links assinados de 1 h; fotos antigas **não** são apagadas ao trocar).

O **histórico de medidas** é uma lista de registros (um por data, do mais antigo ao mais novo, com as fotos de cada um): alimenta o painel "Progresso" (gráficos, radar, linha do tempo) e o check-in rápido `/medidas/nova` (que só mostra o formulário completo se ainda não houver nenhuma medição).

Para não mexer nos editores do Lovable, o back-end entra pelo hook `useHealthPreview` (`src/components/health-preview-provider.tsx`, **arquivo nosso**: lê e grava no banco com a mesma interface). Arquivos do Lovable que **alteramos** e que precisam ser reaplicados se vierem de novo:
- `health-workout-builder.tsx`, `health-diet-builder.tsx`, `health-measurement-builder.tsx`, `routes/treino_.exercicios.tsx`: o componente original foi renomeado para `...Form` e ganhou um `wrapper` que espera `ready` (`HealthLoading`), porque o formulário lê os valores iniciais uma única vez.
- `health-today.tsx` e `health-overview.tsx`: `done`/`toggle` agora vêm de `useHealthPreview()` (`doneKeys`, `toggleDone`) e há `if (!ready) return <HealthLoading />`.
- `health-progress.tsx` e `health-measurement-checkin.tsx`: esperam `ready` (`HealthLoading`); no check-in a data padrão é a de hoje **no fuso local** (o original usava UTC e virava "amanhã" à noite); em `health-progress.tsx` `h.valores.cintura` virou `h.valores["cintura"]` (o TypeScript daqui é mais rígido).
- `routes/hoje.tsx`, `routes/progresso.tsx`, `routes/medidas.nova.tsx` e o diálogo de medidas em `routes/saude.tsx` usam `HealthToday`, `HealthProgress` e `MedidasScreen`; `health-measurement-builder.tsx` leva ao `/progresso` ao salvar; `src/lib/health-preview.ts` é o do Lovable (tem `addToHistory`, `toNumber`, `formatDate`).
- `routes/saude.tsx`: o botão "Minha conta" não aponta mais para `/entrar`.
- `routes/habitos.tsx` usa `src/components/health-habits.tsx` (nosso, ligado a `habits`/`habit_completions`).
- Para voltar o login: trocar as policies `presence-app-photos: sem login ...` pelas `presence-app-photos: dono` (pasta = `auth.uid()`), como nas demais tabelas.

## 4.1. Buscar código direto do GitHub

Além do zip, a Jheny pode pedir "pega do GitHub". As cópias dos projetos dela no Lovable ficam na conta `jhenyalvesp4c-glitch` (ex.: `project-transfer-studio`, `seamless-project-migration` [a mais nova, da conta nova do Lovable], `c-digo-integrado`, `TutoriaisP4C`). Dá para listá-las com `list_repos` e anexar **só para leitura** com `add_repo`, clonar em `/home/user/<repo>` e **importar pela Fase 1** como se fosse um zip (nunca sobrescrever os arquivos protegidos). **Não importar** o back-end que vier junto (login `/entrar`, `studio-auth`, schema `studio`, `supabase/`): ele é de outra tentativa e conflita com o nosso `presence_app`.

## 5. Regras de git e segurança

- Desenvolver na branch combinada da sessão (`claude/busy-planck-p1i0im`, a menos que a sessão indique outra). **Nunca** criar PR sem ela pedir. Nunca force-push.
- Mensagens de commit em inglês, objetivas, no padrão já usado no histórico.
- Não colocar chaves secretas no código. A chave publishable do Supabase é pública por desenho; a `ANTHROPIC_API_KEY` não.
- Antes de apagar ou sobrescrever algo que ela criou, olhar o que está lá.

## 6. Mapa de telas

| Rota | Back-end | Tabelas principais |
|---|---|---|
| `/assistente` | Pronto | `profiles`, `assistant_messages`, `demands`, `tasks` (via IA) |
| `/tarefas` | Pronto | `tasks`, `task_categories` |
| `/organizar` | Pronto | `tasks`, `routine_items`, `schedule_items`, `day_plans` |
| `/organizar/pronto` | Pronto | `schedule_items`, `day_priorities`, `day_plans`, `routine_items` |
| `/planejamento` | Pronto | `day_plans`, `routine_items`, `schedule_items`, `tasks` |
| `/planejamento/dia` | Pronto | `schedule_items`, `day_plans` |
| `/treino` | Pronto (inclui editar ficha, semana e meta) | `workouts`, `workout_exercises`, `workout_split`, `workout_sessions`, `exercise_logs`, `profiles.weekly_workout_goal` |
| `/projetos` | **Front importado, back-end pendente.** Central de Projetos (cartões, filtros, criar projeto). Hoje os projetos ficam só no `localStorage` do navegador (`src/lib/projects.ts`), então não persistem no banco nem entre aparelhos | (a criar: `projects`; `demands.project_id`) |
| `/demandas` | **Front P4C importado, back-end pendente** (dados de exemplo, nada persiste). A versão antiga, ligada à tabela `demands`, está no git (commit `f726f77`). A tabela e o hook `src/lib/data/demands.ts` continuam, para a Fase 2 | `demands` (a ampliar) |
| `/saude` | **Pronto.** Hub com as 3 fichas (treino, dieta, peso e medidas). As fichas são gravadas no banco e carregam em qualquer navegador | `workout_sheets`, `workouts` (+`sheet_id`, `days`), `workout_exercises`, `workout_split`, `diet_sheets`, `diet_meals`, `body_measurements` (+ bucket `presence-app-photos`) |
| `/hoje`, `/progresso`, `/saude/treino`, `/saude/dieta`, `/treino/nova`, `/treino/exercicios`, `/dieta/nova`, `/medidas/nova` | **Pronto.** `/hoje` (painel novo com anéis de progresso) e `/progresso` (gráficos do histórico de medidas) leem do banco; em `/hoje`, marcar exercício grava em `exercise_logs` (o mesmo que o `/treino` usa) e marcar refeição grava em `diet_meal_logs`. `/medidas/nova` abre o check-in rápido quando já existe medição | + `workout_sessions`, `exercise_logs`, `diet_meal_logs`, histórico em `body_measurements` |
| `/resumo`, `/calendario`, `/analise` | Front importado, ainda são telas simples (atalhos, calendário vazio, estado vazio) | — |
| `/habitos` | **Pronto.** O controle de hábitos que já era ligado ao banco foi colocado nesta aba, no visual da nova Saúde | `habits`, `habit_completions` |
| Financeiro, Progresso, Ajustes, Integrações, Fluxos, Dieta e medidas | **Sem tela.** Aguardam o front do Lovable (não inventar telas aqui) | |

Fluxo de navegação: a rail "Demandas" (e o card "Foco e produtividade") abre `/projetos`; cada projeto abre `/demandas?projeto=<id>` (o Kanban), e a seta volta para `/projetos`. O título do Kanban usa o nome do projeto, mas **as demandas mostradas ainda são as mesmas de exemplo para qualquer projeto** até a Fase 2 ligar `demands.project_id`.

Edição pelas telas: tarefas (`/tarefas`, clicar no título), demandas (`/demandas`, clicar no título) e treino
(`/treino` > "Editar ficha": exercícios, divisão da semana e meta). A conversa da assistente é gravada mesmo sem
`ANTHROPIC_API_KEY`.

## 7. Registro de importações

Acrescente uma linha a cada importação do Lovable (data, o que veio, o que foi ignorado, o que ficou para a Fase 2).

| Data | Origem | O que veio | Observações |
|---|---|---|---|
| 2026-11-06 | GitHub `seamless-project-migration` (até `04ec92a`) + **back-end de tudo da página de Demandas** | **Calendário de compromissos** (`demand-calendar.tsx`, `lib/appointments.ts`, `lib/data/appointments.ts`; compromissos são `tasks` da categoria `comp`, então entram no Organize/Planeje meu dia), **editar/excluir projeto**, ajustes em `day.ts`, `tasks.ts`, `types.ts`, `organizar.tsx`, `planejamento.tsx`, `projetos.tsx`, `demandas.tsx`. | Migrações `20261106000100` (colunas `end_time`, `place`, `color`, `project_id`, `dossier_id` em `presence_app.tasks`), `...0200` (`projects`, `dossiers`, `project_notes`, `project_demands`, `demand_executions`, `demand_history`, `demand_notes`) e `...0300` (função `save_demands`, transação única). Camada de dados: `lib/demands.ts` (tipos e conversões puras), `lib/data/project-data.ts`, `lib/data/use-db-state.ts` (estado em memória que envia a diferença ao banco, em fila). **Importação única do navegador:** projetos (marcador `presence.projects.migrated`), dossiês e notas (flag `projects.legacy_imported`) sobem do `localStorage` na primeira abertura. O Kanban começa **vazio** (sem as 17 demandas de exemplo). O projeto padrão `p4c` ganha linha própria e não aparece como cartão em /projetos. **Fora do banco ainda:** biblioteca de documentos (`DocsLibrary`) e os "logins dos polos" (têm senhas: só com login ligado e cifradas). Se o Lovable mandar outro `demandas.tsx`/`projetos.tsx`, reaplicar `useDbState` (projetos, dossiês/notas, demandas) e `nextCode`. |
| 2026-11-05 | GitHub `seamless-project-migration` (conta nova do Lovable, até `1a64423`) | **Notas com CRUD e vínculo a dossiê** (`src/lib/notes.ts`, `src/test/notes.test.ts`, `NoteDialog`, filtro de notas), **modo "Selecionar"** para excluir várias demandas, e visual novo da lista de dossiês no painel lateral (`src/routes/demandas.tsx`). | Esse repositório foi criado a partir do nosso zip e o Lovable o ligou ao **Lovable Cloud** (outro Supabase). **Não importados de propósito:** `src/integrations/`, `supabase.ts`, `use-home.ts`, `__root.tsx` (reporte de erros), `auth.tsx`, `no-login.test.ts`, `drizzle/`, `.env`, `.lovable/`, `supabase/config.toml`: são da infraestrutura dele e conflitam com o nosso `presence_app`. Notas ficam no `localStorage` (uma lista por projeto), como os dossiês. |
| 2026-11-04 | Feito aqui (o pedido no Lovable pausou por falta de créditos antes de subir ao GitHub) | **Dossiês** na `/demandas` (só front, `localStorage`): `src/lib/dossiers.ts` (lista e nome por projeto, P4C = "Polos" com 20 de exemplo), aba de cadastro (nome e descrição; adicionar, editar, excluir; "como chamar": Polos/Clientes/Turmas/Dossiês ou livre), botão **Nova demanda** com "Para quem?" (Geral / Um / Vários, com busca, Selecionar todos, "Todos, menos…", Limpar e contador), **Adicionar** a uma demanda já criada, observação por dossiê, filtro por dossiê e "Só pendentes", visão **Matriz** (demandas × dossiês). | Reaproveitou o visual do Lovable (`glass`, `accent-card`, `tag`, `icon-tile`). Modelo: a demanda-mãe guarda a execução de cada dossiê dentro dela (não cria cópias soltas), então prazo e descrição já valem para todos. Se o Lovable terminar a versão dele, comparar com esta antes de importar. **Fase 2 pendente:** tabelas de dossiês e de execução por dossiê. |
| 2026-11-02 | GitHub `project-transfer-studio` (atualização até `0fd224f`, 11 commits) | Painel "Hoje" novo (`health-today.tsx`), check-in rápido de medidas (`health-measurement-checkin.tsx`), gráfico de evolução e radar (`health-progress.tsx`), histórico de medidas (`health-preview.ts`: `addToHistory`...), animações novas no CSS e teste `measurement-history.test.ts`. | Histórico ligado ao banco (um registro por data) e feitos de hoje persistidos; ajustes listados na seção 4.0. O Lovable guardava o histórico só na memória. |
| 2026-11-02 | GitHub `project-transfer-studio` (commit `72c7d83`, "Integrou saúde com efeitos") | Área **Saúde** completa: `saude.tsx` (hub), `hoje`, `progresso`, `resumo`, `calendario`, `habitos`, `analise`, `saude_/treino`, `saude_/dieta`, `treino_/nova`, `treino_/exercicios`, `dieta.nova`, `medidas.nova`; componentes `health-*`, `body-map`, `treino-builder`, `workspace-section`; `lib/health-preview.ts`; 11 imagens; estilos escopados em `.health-area` (mesclados ao `styles.css`); variantes `unstyled` do `Button`; `HealthPreviewProvider` e a fonte Space Grotesk no `__root.tsx` (mesclados). | Imagens baixadas do Lovable e salvas em `src/assets`. **Aba Hábitos** refeita para usar nossos hooks (`src/components/health-habits.tsx`). Link "Minha conta" (`/entrar`) virou botão sem destino (login desligado). Não importados: `entrar.tsx`, `roadmap.md`. Testes de rota mesclados (20 testes). **Fase 2 feita em 2026-11-02** (ver seção 4.0). |
| 2026-11-02 | GitHub `project-transfer-studio` (atualização até `2c56f69`, 9 commits) | Só `src/routes/projetos.tsx`: pontinho pulsante e gráfico de linha nos 3 cartões de resumo, fundo suave, anéis girando no cartão "Criar projeto" (a "constelação" foi removida). | Única mudança nossa: pontos do gráfico arredondados (o servidor e o navegador calculavam a última casa decimal diferente e o React avisava de "hydration mismatch"). Se um novo `projetos.tsx` vier do Lovable, reaplicar esse arredondamento no `MiniSpark`. |
| 2026-11-02 | GitHub `project-transfer-studio` (commit `b76540a`) | `src/routes/projetos.tsx` (Central de Projetos) e `src/lib/projects.ts`; navegação: rail "Demandas" e card "Foco e produtividade" agora abrem `/projetos`; `/demandas` aceita `?projeto=` | **Não importado de propósito:** `entrar.tsx`, `studio-auth.ts`, `lovable-error-reporting.ts`, testes de auth e `supabase/` (schema `studio` e login: conflitam com o nosso back-end). Projetos ainda só no `localStorage`. **Fase 2:** tabela `projects`, `demands.project_id`, contadores calculados das demandas. |
| 2026-11-02 | `demandas-documentacao` (zip, 2 arquivos) | `src/routes/demandas.tsx` (Kanban P4C: demandas gerais, por polo e multipolo, painel de detalhes, notas) e `src/components/DocsLibrary.tsx` (biblioteca de documentação, logins dos polos, busca "Orion") | Substituiu a `/demandas` antiga. Acrescentados ao `styles.css` o que o zip pedia do "pacote compartilhado-base": `glow-text`, `scanline`, `float` (`animate-float`), `shimmer`, cores `amber`/`pink` e `--gradient-brand`. **Fase 2 pendente:** modelar polos, execução por polo, histórico, notas, pastas/documentos e anexos; **os "logins dos polos" guardam senhas: só guardar cifradas e com login ligado, nunca com o acesso aberto atual.** A busca "Orion" é demonstrativa. |
| 2026-11-01 | `seamless-project-migration` (zip) | Projeto inicial: 9 telas, componentes `ui/`, assets | Removidos `@lovable.dev/vite-tanstack-config`, `.lovable/`, telemetria do editor. Telas vinham com dados fixos; back-end feito depois, tela a tela. |
