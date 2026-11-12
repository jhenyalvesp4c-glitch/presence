# Central de entrada (tela inicial)

Na tela inicial (`/assistente`), o botão quadrado com o **+** ao lado de "Registrar demanda" abre a **Central de entrada**. Ela recebe texto, prints, PDFs e documentos, **interpreta com IA (OpenAI)** e mostra cada informação em **cartões por destino** para você revisar antes de ir para o módulo certo.

## Como usar
1. **Enviar:** digite ou cole um texto; **Ctrl+V** cola prints; arraste arquivos ou use **Anexar arquivo**; **Ditar** usa o microfone. O botão **Registrar demanda** continua ouvindo e agora joga o que você disse na Central e já interpreta.
2. **Interpretar conteúdo:** uma área de processamento mostra as etapas (lendo, identificando projeto/polo/dossiê, classificando, conferindo duplicidades).
3. **Revisar:** os registros aparecem agrupados em **Demandas, Calendário, Lembretes, Tarefas, Rotinas, Anotações, Documentação** (e Evidências), cada cartão com **projeto, polo/dossiê, datas, prioridade** em etiquetas.
   - **Editar** (lápis): todos os campos do registro, com listas reais de projetos, polos e categorias.
   - **Mover para outro destino:** o seletor na etiqueta do cartão reclassifica aproveitando o que já estava preenchido.
   - **Remover** (lixeira) tira o cartão.
   - **Dúvidas e pendências:** o que a IA não soube decidir (projeto, polo, data…) aparece numa caixa amarela; campos obrigatórios que faltam ficam em vermelho no cartão.
   - **Anexar como evidência:** nos cartões de demanda, marque quais dos arquivos enviados viram evidência dela.
   - **Duplicado:** se já existe algo equivalente, o cartão avisa e o ignora, a menos que você marque "criar mesmo assim".
   - **Adicionar registro** cria um cartão em branco; **Copiar registros** copia tudo organizado (Markdown); **Interpretar de novo** refaz.
4. **Confirmar e distribuir:** só habilita quando não há pendências. Depois mostra o que foi criado, em qual módulo, com link para abrir, e **Desfazer tudo**.

## Como funciona por baixo
- `interpretInbox` (função de servidor) manda o conteúdo à **OpenAI** (API Responses, chamada de função `organizar_informacoes`) junto com os **projetos, polos e categorias reais** do Presence. O prompt proíbe inventar ou "aproximar" nomes: o que não está claro vira dúvida. Imagens vão como `input_image`, PDFs como `input_file` e TXT/CSV/MD/JSON como texto.
- A IA devolve **rascunhos** (só o `tipo` é obrigatório). `validateInbox` roda a validação completa a cada edição: formato, projeto/polo/demanda reais e duplicidade — **a mesma validação do MCP** (`src/lib/mcp/plan.ts`).
- `distributeInbox` grava com `commitRecords` (`src/lib/mcp/commit.ts`), **a mesma gravação do `confirmar_registros` do MCP**, que reutiliza os serviços de cada módulo (`saveDemands`, `saveAppointment`, `createTaskRow`, `saveNotesDb`, `loadLibrary/saveLibrary`, `putMaterials`). O histórico fica em `mcp_operations` (cliente "Presence · Central de entrada") e `undoInbox` desfaz.
- Nada é gravado antes do seu "Confirmar e distribuir".

## O que precisa estar configurado
| Variável | Onde | Para quê |
|---|---|---|
| `OPENAI_API_KEY` | Vercel (Production) — **já existe** (veio do projeto antigo); confira se a chave ainda é válida | A IA. Sem ela a Central abre, avisa com clareza e deixa criar os registros **à mão**. |
| `OPENAI_MODEL` | Vercel (opcional) | Modelo usado. Padrão: `gpt-6.1-terra` (visão, rápido). Se a sua conta não tiver esse modelo, a Central avisa e você define esta variável. |
| `OPENAI_BASE_URL` | opcional | Só para testes (endereço alternativo da API). |

Variáveis novas só valem depois de **republicar** (Redeploy). A chamada usa `reasoning.effort: "low"` (mais rápida) e a função de servidor tem 60 s de tempo máximo na Vercel (`vite.config.ts`). Se o modelo não aceitar `reasoning`, o servidor repete sem esse parâmetro.

## Arquivos
**Criados:** `src/components/inbox/{InboxPanel,RecordCard}.tsx`, `src/components/inbox/files.ts`, `src/lib/inbox.ts`, `src/lib/inbox.functions.ts`, `src/lib/mcp/interpret.ts`, `src/lib/mcp/openai.ts`, `src/lib/mcp/commit.ts`, `src/test/inbox.test.ts`.
**Modificados:** `src/routes/assistente.tsx` (botão + abre a Central; voz alimenta a Central; o campo antigo de uma linha saiu), `src/lib/mcp/{tools,plan,lookup,ops,records}.ts` (gravação extraída para `commit.ts`, `rascunhoSchema`, consultas em paralelo), `vite.config.ts` (tempo máximo da função).

## Limites
- **Áudio:** arquivos de áudio ainda **não são transcritos**; use **Ditar** (microfone) ou cole a transcrição. **Word/Excel/PowerPoint** ainda não são lidos: salve como PDF.
- **Tamanho:** até 6 arquivos e ~3 MB no total por envio (limite de 4,5 MB do corpo da função na Vercel). Prints são reduzidos automaticamente (máx. 1600 px, JPEG); PDFs até 3 MB.
- **Qualidade:** a IA pode errar a classificação; por isso tudo passa pela sua revisão. Quando faltar projeto ou polo, ela pergunta em vez de chutar.
- **Anotações exigem projeto** (as notas do Presence são por projeto).
- **Lembretes não notificam** (o Presence não tem notificações): o lembrete é um registro com data e hora.
- **Testado:** fluxo completo no navegador com um servidor de IA **simulado** (que também confere o formato da chamada: endereço `/v1/responses`, chave, modelo e imagem como `input_image`) (prints, cartões por destino, pendências, edição, mover, remover, copiar, confirmar, desfazer) e a validação/gravação reais no banco. **A leitura real de prints/PDFs pela OpenAI só foi conferida contra a documentação oficial, não com a chave real; o nome do modelo padrão também não pôde ser verificado na sua conta.**
