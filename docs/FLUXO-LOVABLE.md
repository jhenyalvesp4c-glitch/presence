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
- A Vercel (time `jheny1`) recusou criar projeto pela conexão atual. O deploy é feito pela própria Jheny em vercel.com/new.
- `ANTHROPIC_API_KEY` ainda não foi configurada, então a conversa com a IA não responde. O resto funciona sem ela.

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
| `/demandas` | Pronto | `demands` |
| `/saude` | Hábitos e treino prontos. Dieta e medidas **não** | `habits`, `habit_completions` |
| Financeiro, Progresso, Ajustes, Integrações, Fluxos, Dieta e medidas | **Sem tela.** Aguardam o front do Lovable (não inventar telas aqui) | |

Edição pelas telas: tarefas (`/tarefas`, clicar no título), demandas (`/demandas`, clicar no título) e treino
(`/treino` > "Editar ficha": exercícios, divisão da semana e meta). A conversa da assistente é gravada mesmo sem
`ANTHROPIC_API_KEY`.

## 7. Registro de importações

Acrescente uma linha a cada importação do Lovable (data, o que veio, o que foi ignorado, o que ficou para a Fase 2).

| Data | Origem | O que veio | Observações |
|---|---|---|---|
| 2026-11-01 | `seamless-project-migration` (zip) | Projeto inicial: 9 telas, componentes `ui/`, assets | Removidos `@lovable.dev/vite-tanstack-config`, `.lovable/`, telemetria do editor. Telas vinham com dados fixos; back-end feito depois, tela a tela. |
