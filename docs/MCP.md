# Presence × MCP — distribuição inteligente de informações

O Presence agora tem um servidor **MCP** (Model Context Protocol) remoto. O ChatGPT (ou qualquer cliente MCP) lê o que você manda — texto, print, documento, transcrição de áudio —, **consulta o Presence** para achar o projeto, o polo e o dossiê certos, **mostra um resumo para você aprovar** e, só depois do seu "CONFIRMAR", grava cada informação no módulo correto.

> Estado: implementado e testado localmente (versão de desenvolvimento e build de produção). **Para funcionar de fora você precisa de 2 passos manuais** (seção 5 e 7): definir `MCP_TOKEN` e liberar o endpoint da proteção da Vercel.

---

## 1. Arquitetura

```
ChatGPT / Claude / Cursor ──HTTPS──►  /api/mcp   (rota do TanStack Start, na Vercel)
                                        │  auth.ts      token (Bearer ou no endereço)
                                        │  http.ts      limite de requisições, tamanho, CORS
                                        │  protocol.ts  JSON-RPC 2.0: initialize · ping · tools/list · tools/call
                                        │  tools.ts     15 ferramentas (leitura → propor → confirmar → desfazer)
                                        ├── lookup.ts   consultas (projetos, dossiês, demandas, tarefas…)
                                        ├── plan.ts     valida, procura duplicidade, monta o resumo
                                        ├── execute.ts  grava e desfaz, REUSANDO os serviços das telas
                                        └── ops.ts      propostas pendentes + histórico (mcp_operations)
                                                          │
                                                          ▼
                                   Supabase, schema presence_app (chave publishable + RLS)
```

- **Sem estado e sem SSE:** cada POST traz uma mensagem e recebe a resposta em JSON (o que o ChatGPT e os outros clientes usam). `GET`/`DELETE` respondem 405.
- **Sem chave administrativa:** o servidor usa a mesma chave *publishable* do app, sob as mesmas políticas RLS. Nunca usa `SUPABASE_SERVICE_ROLE_KEY` (que existe no ambiente da Vercel, vinda do app antigo, e **não é lida** por este código).
- **Duas etapas para escrever:** `propor_registros` (valida e guarda a proposta; **não grava nos módulos**) → você responde `CONFIRMAR 1234` → `confirmar_registros`.

## 2. Ferramentas

**Consulta (somente leitura)** — para achar o destino certo antes de cadastrar:

| Ferramenta | O que faz |
|---|---|
| `presence_guia` | Data/hora de agora (São Paulo), regras de encaminhamento e limites atuais. |
| `listar_projetos` | Projetos, status, como chamam seus dossiês (Polos…), contagens. |
| `listar_dossies` | Dossiês/polos de um projeto, com o nome exato. |
| `listar_demandas` | Demandas do projeto: tipo, status, prioridade, prazo, polos e andamento por polo. |
| `listar_categorias_e_status` | Categorias de tarefa, status, prioridades e tipos de demanda. |
| `listar_calendario` | Compromissos (e opcionalmente tarefas com data) entre duas datas. |
| `listar_tarefas` | Minhas Tarefas (filtros por situação, categoria, datas, texto). |
| `listar_lembretes` | Lembretes e seus vínculos. |
| `listar_anotacoes` | Anotações do projeto, gerais ou de um polo. |
| `consultar_documentacao` | Roteiros e exemplos/procedimentos (Documentação → Treinamentos). |
| `buscar_registros` | Busca um texto em todos os módulos (achar relacionados, evitar duplicidade). |
| `listar_operacoes` | Histórico do que o MCP criou ou desfez. |

**Escrita (sempre com confirmação):**

| Ferramenta | O que faz |
|---|---|
| `propor_registros` | Recebe 1 a 12 registros relacionados, valida contra o Presence, procura duplicidade e devolve **resumo + código de 4 dígitos**. Não grava. |
| `confirmar_registros` | Cria os registros da proposta. Exige o código e `confirmacao_do_usuario=true`. Uma proposta só pode ser confirmada uma vez e vale 30 min. |
| `desfazer_operacao` | Remove o que uma operação criou (exige autorização; marcada como *destrutiva* para o cliente pedir aprovação). |

**Tipos de registro aceitos em `propor_registros`** e onde cada um é gravado:

| `tipo` | Módulo do Presence | Campos principais |
|---|---|---|
| `demanda` | **Demandas** (Kanban do projeto) | `projeto_id`, `escopo` (geral · polo · multipolo), `dossie` / `dossies`, `titulo`, `descricao`, `prioridade`, `prazo`, `checklist`, `responsavel` |
| `compromisso` | **Calendário** | `titulo`, `data`, `inicio`, `fim`, `local`, `escopo` (pessoal · profissional), `projeto_id`, `dossie`, `demanda`, `lembrete_minutos_antes` |
| `lembrete` | **Lembretes** (registro com data/hora em Minhas Tarefas) | `texto`, `data`, `hora` (opcional), `projeto_id`, `dossie`, `demanda`, `compromisso` |
| `tarefa` | **Minhas Tarefas** | `titulo`, `categoria` (rotina, comp, auto, saude, trab, casa, fin, pes), `prioridade`, `data`, `hora` |
| `rotina` | **Rotina do dia** (recorrência diária) | `titulo`, `hora`, `natureza` |
| `anotacao` | **Anotações** (Notas do projeto) | `projeto_id`, `dossie`, `texto`, `cor` |
| `documentacao` | **Documentação** (exemplos/procedimentos do projeto) | `projeto_id`, `titulo`, `situacao`, `texto`, `categoria` |
| `evidencia` | **Anexos da demanda** (texto, prints, arquivos) | `demanda`, `texto` e/ou `conteudo_base64` + `nome` |

Vários registros da mesma mensagem se ligam por `ref`: uma demanda com `"ref":"d1"`, um compromisso com `"demanda":"ref:d1"` e um lembrete com `"compromisso":"ref:c1"`.

## 3. Relacionamentos e serviços reutilizados

Nada de módulo paralelo. O MCP chama as **mesmas funções das telas**:

| Registro | Função reutilizada | Tabelas |
|---|---|---|
| Demanda (+ polos) | `loadDemands` / `saveDemands` (função SQL `save_demands`, transação única) e `nextCode` | `project_demands`, `demand_executions`, `demand_history` |
| Evidência | `getMaterials` / `putMaterials` / `deleteMaterials` | `demand_materials`, `demand_files` + bucket `presence-app-demand-files` |
| Compromisso | `saveAppointment` / `syncSchedule` (entra no Organize/Planeje meu dia) | `tasks` (categoria `comp`), `schedule_items` |
| Tarefa / lembrete | `createTaskRow` (extraída da tela de tarefas) | `tasks` |
| Anotação | `loadProjectState` / `saveNotesDb` | `project_notes` |
| Documentação | `loadLibrary` / `saveLibrary` / `upsertExample` | `training_library` |
| Projetos / dossiês | `ensureProject`, tabelas existentes | `projects`, `dossiers` |

**Vínculos (únicas colunas novas, em `tasks`):** `demand_code` (demanda do mesmo projeto), `related_task_id` (ex.: o lembrete aponta para o compromisso), `kind` (`tarefa` ou `lembrete`) e `source = 'mcp'`. Projeto e polo/dossiê já existiam (`project_id`, `dossier_id`).

**Tabelas novas (só da camada MCP):** `mcp_proposals` (propostas aguardando confirmação) e `mcp_operations` (histórico: o que foi criado, quando, por qual cliente, resumo, e como desfazer).

## 4. Arquivos

**Criados:** `src/lib/mcp/{auth,protocol,records,lookup,plan,execute,ops,tools,http}.ts`, `src/routes/api.mcp.ts`, `src/routes/api.mcp.$token.ts`, `supabase/migrations/20261112000100_presence_app_mcp.sql`, `src/test/mcp.test.ts`, este guia.

**Modificados (mudanças pequenas, sem mexer em telas):** `src/lib/data/tasks.ts` (função `createTaskRow` extraída do hook), `src/lib/data/appointments.ts` (projeto pode ser vazio, para compromisso pessoal), `src/lib/data/project-data.ts` (`ensureProject` exportada), `src/lib/demand-materials.ts` (não quebra no servidor), `src/lib/types.ts`, `.env.example`, `AGENTS.md`, `src/routeTree.gen.ts` (gerado).

## 5. Variáveis de ambiente

| Variável | Onde | Para quê |
|---|---|---|
| `MCP_TOKEN` | **Vercel (Production)** — você precisa criar | Segredo do endpoint (mín. 24 caracteres). **Sem ele o endpoint responde 503 "MCP desligado".** |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | já existem | Conexão com o Supabase (chave publishable). |

Gerar um token no seu computador: `openssl rand -hex 32`. Na Vercel: *Project → Settings → Environment Variables → Add* (`MCP_TOKEN`, ambiente Production, marque como **Sensitive**) → depois **Redeploy** (variáveis só valem em novas publicações).

## 6. Endpoint

```
https://spark-mind-friend-htvx.vercel.app/api/mcp            (token no cabeçalho Authorization: Bearer)
https://spark-mind-friend-htvx.vercel.app/api/mcp/<MCP_TOKEN> (token no endereço, para clientes que só aceitam URL)
```
Transporte: HTTP POST com JSON-RPC 2.0 (MCP "Streamable HTTP" sem sessão). Versões do protocolo: 2025-06-18, 2025-03-26 e 2024-11-05.

## 7. Autenticação e segurança

1. **Token do MCP** (`MCP_TOKEN`): `Authorization: Bearer <token>`, ou `x-mcp-token`, ou no endereço. Comparação em tempo constante. Sem token configurado → 503; token errado → 401.
2. **Proteção da Vercel (importante):** o projeto tem *Vercel Authentication* ligada — é ela que protege o app inteiro (que não tem login). Isso **bloqueia o ChatGPT** de chegar ao endpoint. Não desligue a proteção (o app ficaria público). Use *Project → Settings → Deployment Protection → **Protection Bypass for Automation***: gere o segredo e acrescente ao endereço `?x-vercel-protection-bypass=<SEGREDO>` (ou envie o cabeçalho `x-vercel-protection-bypass`). Atenção: esse segredo também abre o resto do app; trate-o como senha.
3. **Dados:** só a chave *publishable* + RLS; sem `service_role`; sem SQL livre; só as ferramentas listadas. Parâmetros validados com zod; arquivos até 4 MB; mensagens até 8 MB; 240 requisições/min por origem.
4. **Escrita só com confirmação:** a proposta guarda o resumo e um código de 4 dígitos; o `confirmar` exige o código (você o digita ao responder) e é de uso único e com validade de 30 min. Antes de gravar, tudo é **revalidado** contra o estado atual (projeto, polo, demanda, duplicidade).
5. **Histórico e desfazer:** toda criação/desfazer fica em `mcp_operations`.

> Limite honesto: o código de 4 dígitos é uma trava de fluxo (o assistente só o conhece depois do resumo e é instruído a pedi-lo a você), não uma autenticação por pessoa. A autenticação do endpoint é o `MCP_TOKEN`. Quando o login do Presence voltar, dá para trocar por OAuth.

## 8. Como conectar

**ChatGPT** (nomes de menu mudam; o caminho geral): *Configurações → Aplicativos/Conectores → Avançado → Modo desenvolvedor → Criar* → tipo **MCP**:
- Nome: `Presence`
- URL: `https://spark-mind-friend-htvx.vercel.app/api/mcp/<MCP_TOKEN>?x-vercel-protection-bypass=<SEGREDO>`
- Autenticação: **nenhuma** (o token já está na URL).
- Ative o conector na conversa. Dica: em um **Projeto** do ChatGPT, cole nas instruções: *"Use o conector Presence para tudo que eu mandar: consulte antes, proponha com propor_registros, mostre o resumo e só confirme depois do meu 'CONFIRMAR <código>'."*

**Claude (conector personalizado)**: *Configurações → Conectores → Adicionar conector personalizado* → mesma URL.

**Cursor / VS Code / Claude Desktop** (arquivo de configuração MCP):
```json
{ "mcpServers": { "presence": {
  "url": "https://spark-mind-friend-htvx.vercel.app/api/mcp?x-vercel-protection-bypass=<SEGREDO>",
  "headers": { "Authorization": "Bearer <MCP_TOKEN>" } } } }
```
(clientes que só falam stdio: `npx mcp-remote <url> --header "Authorization: Bearer <MCP_TOKEN>"`.)

**Testar à mão:**
```bash
curl -s https://spark-mind-friend-htvx.vercel.app/api/mcp/<MCP_TOKEN>?x-vercel-protection-bypass=<SEGREDO> \
  -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
Ou o inspetor oficial: `npx @modelcontextprotocol/inspector`.

## 9. Testes de classificação e distribuição

Executados contra o banco real (dados de teste marcados `TESTE-MCP`, todos removidos com `desfazer_operacao`) — na versão de desenvolvimento **e** no build de produção. Além disso, 20 testes automáticos (`src/test/mcp.test.ts`).

| Situação | Resultado esperado | ✔ |
|---|---|---|
| Projeto que não existe | Erro com os projetos reais; não adivinha | ✔ |
| Polo aproximado ("Nit") | Pede escolha e mostra "Niterói" | ✔ |
| Compromisso profissional sem projeto | Pede o projeto | ✔ |
| Data impossível (31/02) · demanda geral com polo · ref inexistente | Recusado com motivo | ✔ |
| Mensagem com 7 informações (demanda multipolo, reunião, 2 lembretes, tarefa pessoal, anotação do polo, documentação, evidência) | **Uma proposta** com resumo e código; **nada gravado** antes de confirmar | ✔ |
| Código errado · sem `confirmacao_do_usuario` · confirmar duas vezes | Recusado | ✔ |
| Depois de confirmar | Demanda multipolo com 3 polos, prazo e prioridade em **Demandas**; reunião em **Calendário** ligada à demanda, ao projeto e ao polo; lembrete 30 min antes **e** lembrete manual ligados à demanda (um deles ao compromisso); tarefa pessoal só em **Minhas Tarefas** (não virou demanda); anotação do polo; documentação; evidência anexada à demanda | ✔ |
| Mesmo conteúdo de novo | Detectado como duplicado e bloqueado | ✔ |
| Histórico | Operação e itens registrados | ✔ |
| Desfazer | Tudo removido (inclusive o arquivo no Storage); desfazer de novo é recusado | ✔ |

## 10. Limitações e o que ainda depende de implementação

- **Lembretes não notificam:** o Presence não tem envio de notificação/push. Um lembrete é um registro com data e hora (aparece em Minhas Tarefas e no Planeje meu dia). Notificação de verdade depende de um módulo de notificações que não existe ainda.
- **Documentação:** a biblioteca de pastas e documentos da tela ainda não é salva no banco (e guarda senhas de polos; não deve ir para o MCP). Por isso `documentacao` grava no **banco de exemplos de Treinamentos** do projeto, que é o que já tem back-end.
- **Anotações exigem projeto** (as notas do Presence são por projeto). Não há "anotação pessoal solta".
- **Recorrência:** só existe rotina **diária**; semanal/mensal não existem no Presence.
- **Prazo da demanda** é guardado como dia/mês (sem ano), como na tela.
- **Prints, áudios e documentos:** o ChatGPT lê/transcreve e manda **texto**. Arquivos só entram como `conteudo_base64` (até 4 MB) se o cliente conseguir fornecer os bytes — o ChatGPT normalmente **não** consegue repassar um arquivo enviado por você. Evidência em **texto** funciona sempre; arquivo é "o que for possível".
- **Não há ferramenta para editar/excluir** registros existentes (por segurança); só criar e desfazer o que o MCP criou.
- **Responsável** (pessoa) vira texto na descrição; o Presence não tem cadastro de responsáveis.
- **Confirmação:** o código de 4 dígitos é trava de fluxo, não autenticação por pessoa (veja seção 7).
- **Limite de requisições** é por instância do servidor (best effort).
- **Os vínculos novos** (`demand_code`, `related_task_id`, `kind`) ainda não aparecem nas telas (não redesenhamos nada); aparecem nas consultas do MCP.
- **Histórico de testes:** os testes deixaram 2 operações e 1 proposta de teste em `mcp_operations`/`mcp_proposals` (sem nenhum registro nos módulos).
