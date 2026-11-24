# Assistente de voz (estilo Jarvis)

Toque na esfera da tela inicial (ou no botão de microfone no canto inferior esquerdo das outras telas) e converse. Ela ouve, pensa, **fala com a voz do ElevenLabs** e volta a ouvir sozinha. Toque de novo enquanto ela fala para interromper; o botão ▢ encerra; dizer "tchau" também.

## O que ela faz
| Pedido | O que acontece |
|---|---|
| "Abre demandas / saúde / tarefas / calendário…" | Abre a página (e continua a conversa nela). Também "abre as demandas do projeto X". |
| "Cria uma demanda / tarefa / compromisso / lembrete…" | Cria de verdade (mesma validação da Central de entrada: projeto, polo, categoria, duplicidade) e confirma falando. |
| "O que eu tenho hoje / amanhã?" | Resume em 2–3 frases e abre um painel com agenda, atrasadas e demandas em andamento. |
| "Marca a tarefa X como feita" | Conclui a tarefa. |
| "O que aconteceu com o disparo de Maceió?" | Pesquisa no Orion (segundo cérebro) e responde. |
| "Documenta que o disparo deu erro de pagamento" | Guarda no Orion com a data. |

Cada conversa também fica salva em `assistant_messages` (o Orion encontra depois).

## Como funciona (rapidez)
- Voz → texto, dois modos: (1) reconhecimento de fala do navegador (rápido, mas depende de um serviço do Google/Apple); (2) **modo gravação**: grava o microfone, percebe o fim da fala por silêncio (~1 s) e transcreve na OpenAI (`whisper-1`). Se o navegador der erro de rede ou não tiver reconhecimento, o app muda sozinho para o modo gravação e lembra a escolha (`localStorage presence.stt`). Não há caixa de texto: a própria esfera mostra o estado (ouvindo, pensando, falando) e a resposta aparece como legenda curta.
- Rodando local: coloque `OPENAI_API_KEY`, `ELEVENLABS_API_KEY` e `ELEVENLABS_VOICE_ID` no `.env`. Abra `/api/voz` e `/api/tts` no navegador para um diagnóstico (modelo e voz).
- `/api/voz`: Chat Completions em **streaming** com ferramentas (`src/lib/voice/agent.ts`). Cada frase pronta vai para `/api/tts` na hora (a próxima já é gerada enquanto a anterior toca).
- `/api/tts`: ElevenLabs (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`; modelo `eleven_flash_v2_5`, troque com `ELEVENLABS_MODEL`). Sem a chave, usa a voz do próprio navegador.
- IA: `OPENAI_API_KEY`; modelo `OPENAI_VOICE_MODEL` (ou `OPENAI_MODEL`).
- Proteções: só mesma origem + limite por IP (o app não tem login).

## Listas (checklists) por conversa

Ferramenta `lista` (`src/lib/voice/lists.ts`): criar, adicionar, remover, marcar/desmarcar, mostrar, listar, renomear e excluir. As listas ficam salvas no banco (`presence_app.checklists` e `checklist_items`, migração `20261120000100`) e aparecem em Tarefas → aba "Listas" (`/tarefas?aba=listas`; `/listas` redireciona para lá), onde também dá para marcar e adicionar itens com o dedo. No modal da voz, tocar num item marca/desmarca e tocar numa sugestão inclui, sem fechar o modal. A voz sempre oferece sugestões do que mais incluir (aparecem no painel e são faladas). Pedido ambíguo ("toalha" com duas toalhas) vira pergunta; nunca mexe num item por meia-correspondência. Excluir lista ou remover todos os itens pede confirmação.

## Toque de abertura

Ao tocar no orbe, enquanto aparece "Iniciando o Orion…", toca um toque de "sistema iniciando" estilo painel de IA, sem melodia: zumbido grave que cresce, varredura de energia, batida grave discreta e pulsos digitais com eco (gerado na hora pelo navegador, sem arquivo, em `src/lib/voice/boot-sound.ts`). Ele para (com fade) quando o Orion começa a falar. Para desligar: `localStorage["presence.voz.abertura"] = "0"`.

## Tempo para falar e texto acompanhando a fala

- O Orion só entende que você terminou depois de **2,5 s de silêncio** (`SILENCE_MS` em `use-voice.tsx`), tanto no reconhecimento do navegador (que agora continua ouvindo nas pausas) quanto na gravação.
- A legenda da fala foi removida (a esfera mostra só Ouvindo… / Pensando… / Falando…). `SpeechText.tsx` continua no código, sem uso, caso queira voltar.

## Roteiros de treinamento por voz

Ferramenta `roteiro` (`src/lib/voice/scripts.ts`, regras puras em `src/lib/script-edit.ts`): listar, mostrar, criar roteiro com blocos, adicionar bloco (no fim ou depois de outro), editar bloco (título, duração, "o que mostrar", dica, o que falar, por quês, perguntas frequentes), tirar passos, tirar bloco, mudar título/público/objetivo e excluir. Mexe no mesmo documento da tela (`training_library`), então o que ela pede por voz aparece em Documentação → Treinamentos. O conteúdo novo é escrito pela IA. Tirar bloco e excluir roteiro pedem confirmação; blocos repetidos e nomes ambíguos viram pergunta.

## Chamar falando "Orion" (como a Alexa)

Configurações → "Chamar por voz". Ligado, o navegador escuta continuamente (reconhecimento de voz do próprio navegador, `src/lib/voice/wake.ts`) e, ao ouvir "Orion" (e variações: presens, prisens, presença…), toca um tom curto e passa a ouvir. Se o pedido vier junto ("Orion, que horas são?"), responde direto. Enquanto a conversa está aberta (ou um lembrete é falado) a escuta da palavra fica pausada e volta depois.

Limites: só funciona com o Orion aberto (pode estar minimizado) num navegador com reconhecimento de voz (Chrome/Edge) e microfone liberado; o áudio é enviado ao serviço do navegador (no Chrome, o Google) enquanto estiver ligado; o navegador pode exigir um primeiro toque na página depois de abrir para liberar o som. Preferência local: `localStorage["presence.voz.chamar"]`.

### Dois modos de escutar "Orion"

1. **Navegador** (`webkitSpeechRecognition`): rápido, mas não existe ou não funciona em vários apps instalados.
2. **Gravação** (`wake-listen.ts`): usado automaticamente quando o modo 1 não existe, dá erro ("network"…) ou fica 25 s sem ouvir nada. Fica com o microfone aberto, detecta quando alguém fala, manda só esse trecho curto (WAV 16 kHz) para transcrever na OpenAI e procura a palavra no texto. Silêncio não é enviado; limite de 20 envios por minuto; chave/créditos inválidos desligam o recurso com aviso. Demora ~1–2 s depois de falar.

Configurações → "Chamar por voz" mostra o estado, o modo e a última coisa ouvida (para diagnosticar). Na tela inicial, o status mostra "Diga “Orion”" quando está ligado.

## Pedidos de melhoria para o Claude

Quando o Orion não consegue fazer algo (função que não existe, edição que o sistema não permite), ele usa a ferramenta `pedir_melhoria`: avisa que no momento não consegue e abre um **cartão de confirmação** com o que a pessoa pediu, um título e "como entendi que deve ficar" (editáveis). Só depois do clique em "Confirmar e enviar ao Claude" o pedido é gravado em `presence_app.improvement_requests` (migração `20261121000100`), com status `na_fila`. Configurações mostra a lista "Pedidos para o Claude" e a pessoa pode perguntar "como estão meus pedidos?".

O andamento (`em_andamento`, `feito`, `cancelado`, mais a nota em `claude_note`) é atualizado por quem implementa.

### Execução automática (rotina do Claude)

Existe uma rotina agendada do Claude Code ("Orion: pegar pedidos de melhoria confirmados", intervalo mínimo permitido: **1 hora**) que lê a fila, implementa **um pedido por execução** na branch `claude/busy-planck-p1i0im`, roda `tsc` e `vitest`, publica em produção pela Vercel, confere o deploy (com rollback se falhar) e atualiza o status e a nota. Ela só aceita linhas do dono `00000000-0000-0000-0000-000000000001` (a conta da Jheny), trata o texto do pedido como dado (nunca como instrução), só faz mudanças de banco aditivas e cancela com explicação o que for ambíguo, perigoso ou que falhe nos testes.

Segurança da fila: a tabela **não tem política para o papel `anon`** (migração `20261121000200`), então só quem está logado grava nela; sem isso, qualquer pessoa com a chave pública do Supabase poderia injetar um pedido.

### Acordar o Claude na hora (gatilho por API)

O intervalo mínimo da agenda é 1 hora, então, ao confirmar o pedido, o Orion também **acorda a rotina na hora** (`src/lib/improvements.functions.ts`, `fireImprovement`): chamada `POST https://api.anthropic.com/v1/claude_code/routines/<id>/fire` com o token da rotina (cabeçalhos `anthropic-beta: experimental-cc-routine-2026-04-01` e `anthropic-version: 2023-06-01`). O servidor confere que o pedido existe, está na fila e é de quem está logado; só aceita o endereço oficial da API; o token nunca vai para o navegador. Limites da plataforma: 30 disparos por hora por rotina. Se não estiver configurado ou falhar, o pedido continua na fila e a verificação agendada o pega.

Variáveis de ambiente (Vercel, só servidor): `ORION_ROUTINE_FIRE_URL` e `ORION_ROUTINE_FIRE_TOKEN` (ver `.env.example`).

**Estado atual: a rotina está criada, mas DESLIGADA e sem conectores.** Para funcionar, em claude.ai/code/routines: abrir a rotina "Orion: pegar pedidos de melhoria confirmados" → Edit → (1) conferir os conectores Supabase e Vercel e o repositório `jhenyalvesp4c-glitch/presence`; (2) em Trigger clicar em **+ → API**, copiar a Fire URL e **Generate token** (aparece uma vez); (3) manter a agenda de hora em hora como rede de segurança e ativar a rotina; (4) colocar a URL e o token nas variáveis acima na Vercel e fazer um novo deploy.

## Nunca ficar em silêncio ("estou verificando para você")

- **No servidor** (`filler.ts` + `runAgent`): quando o modelo vai usar ferramentas sem ter dito nada, o Orion fala na hora uma frase curta conforme o tipo ("Estou verificando para você.", "Estou abrindo o seu WhatsApp, só um instante.", "Pode deixar, já estou fazendo isso."). Ações imediatas (abrir tela, encerrar) e pedidos de melhoria não ganham aviso; se o modelo já falou, não repete.
- **No navegador** (`use-voice.tsx`): se passam 2,2 s sem chegar nenhuma resposta, fala "Um instante, estou verificando para você." (uma vez por pedido). Respostas rápidas não ganham aviso.

## Medidor de velocidade

Configurações → "Velocidade da conversa" mostra, para as últimas 8 respostas, quanto demorou a transcrição (só no modo gravação), a primeira palavra do texto e o início da fala, desde que a pessoa terminou de falar (`src/lib/voice/perf.ts`, guardado só no navegador). Além desses tempos, o Orion espera `SILENCE_MS` (2,5 s) de silêncio para entender que a pessoa terminou.


## Chamar falando "Orion": como evita falsos chamados
- **Modo por gravação** (`wake-listen.ts`): `createSegmenter` só manda para transcrever um trecho **curto (até 6 s)**, com voz de verdade (som por pelo menos 0,3 s) e que termina em silêncio. Silêncio e batidas rápidas (palma, porta, tecla) não geram trecho. Som que não para (ventilador, TV) é descartado e o nível de ruído de fundo sobe. Se o modelo está ocupado, o trecho mais recente espera a vez (não se perde a palavra dita agora).
- **A dica da transcrição não pode começar com o nome nem repeti-lo.** O modelo repete a dica quando só ouve ruído; com "Orion. Assistente Orion. Ei Orion…" qualquer barulho virava "Orion" e ativava. Hoje a dica é uma frase com o nome uma vez, no fim (`HINT`); se o modelo a repetir, o nome cai fora da janela do começo da fala e não ativa (há teste para isso). A transcrição usa `temperature = 0`.
- **Texto** (`wake.ts`): aceita as variações de escrita (Orion, Órion, Orian, Aurion, "o Ryan", "ori on"…), mas só **no começo da fala** (até 3 palavras antes: "ei", "bom dia"), e descarta falas com 3 ou mais "Orion" (é a IA repetindo a dica). Citar o nome no meio de uma conversa não ativa. Frases fantasma do modelo ("Obrigado.", "Legendas pela comunidade Amara.org") são ignoradas.
- Testes: `wake.test.ts` (texto) e `wake-segmenter.test.ts` (sons sintéticos: silêncio, palma, palavra, ruído constante, fala longa).
- **Diagnóstico na tela:** Configurações → "Chamar por voz" mostra o volume do microfone ao vivo e o mínimo para contar como fala (`MIN_THRESHOLD`), além de "Última coisa que ouvi". Microfone baixo demais para o app (barra nunca passa da marca) é a causa mais comum de "não ativa".

## Um sistema só (orbe, Perguntar, Documentar e chat)
- O orbe, o chat e o Perguntar/Documentar usam as mesmas tabelas e a mesma busca (`loadCorpus` em `orion.functions.ts`). O que se documenta em qualquer um aparece nos outros.
- A busca (Perguntar e `buscar_no_orion`) enxerga anotações, demandas, tarefas, notas, conversas, treinamentos **e** memórias, hábitos, saúde (peso/medidas, dieta, treino), listas, plano do dia, financeiro (saldos, faturas, assinaturas) e acertos de contas (`orion-extra.ts`).
- Para ações (lançar, editar, excluir) o orbe/chat usam as ferramentas específicas; o Perguntar só responde.

## Conversa natural (nome e avisos)
- Conversa comum ("tudo bem?", "como você está") é respondida direto, sem ferramenta e sem aviso.
- O aviso antes de demorar ("Já estou buscando.", "Vou dar uma olhada para você.") só sai quando uma ferramenta de verdade vai rodar (`src/lib/voice/filler.ts`, regras no `PERSONA` de `agent.ts`). O aviso de resposta lenta (`SLOW_FILLER`) só dispara depois de 4,5 s e diz apenas "Só um instante."
- O nome da pessoa é usado na saudação e raramente depois; nunca nos avisos.

## Papo rápido
`src/lib/voice/smalltalk.ts` (`isSmallTalk`): cumprimentos, "tudo bem?", "como você está?", agradecimentos. Nesses casos o servidor responde direto (uma frase, sem ferramentas e sem raciocínio, `reasoning_effort: "none"`), por isso é imediato. É estrito: qualquer palavra fora da lista (ex.: "que dia é hoje", "como está meu financeiro") segue o fluxo normal com ferramentas.

## Autonomia total (o que a voz faz por você)
Tudo que dá para fazer nas telas, a voz faz (e nunca usa `pedir_melhoria` para isso):
- **Cadastros** (`registry-tool.ts`, ferramenta `cadastros`): criar/editar/excluir/listar projetos, dossiês e clientes; cliente novo já cria o dossiê ligado e aplica o roteiro padrão; registrar contato; aplicar roteiro. Excluir sempre pede confirmação.
- **Hábitos** (`habits-tool.ts`): listar com sequência, criar, marcar/desmarcar, renomear, arquivar.
- **Treino** (`workout-tool.ts`): fichas e exercícios, divisão da semana, meta semanal.
- **Dieta** (`diet-tool.ts`): plano de hoje, refeições, água, opção do dia, metas. **Medidas**: `analise_corporal` ação `medida` (peso e circunferências).
- **Reuniões**: `gravar_reuniao` abre `/reunioes?gravar=1&tipo=…`; a gravação começa sozinha quando a conversa por voz termina (para não gravar a fala do Orion) e termina no botão Finalizar.
- **Abrir páginas**: Central do dia, Clientes, Documentação, Playbooks, Treinamentos, Reuniões, Cursos, Mapa, Configurações, Assinaturas… (`PAGES` em `agent.ts`; `/demandas?aba=docs&secao=cli` abre direto a seção).
- Já existiam: demandas, tarefas/lembretes/compromissos, listas, financeiro (incl. categorias, cartões, assinaturas), planejamento, ideias, roteiros de treinamento, WhatsApp (leitura), memória.

## Documentar e buscar em tudo
- `documentar` (segundo cérebro): título, texto completo (até 20 mil caracteres), data, projeto e dossiês/clientes citados. Recusa texto com senha/chave.
- `documentacao` (`documentation-tool.ts`): a Biblioteca da tela Documentação — listar, ler, criar (tutorial, processo, guia, checklist, manual), editar, mover, excluir e criar/excluir pasta. Nunca grava na pasta de logins.
- `buscar_no_orion` + `ler_documento`: a busca (`loadCorpus` em `orion.functions.ts`) cobre segundo cérebro, **Documentação (library_docs)**, clientes (ficha, documentos e histórico), reuniões, demandas, tarefas, roteiros, conversas, memórias, hábitos, saúde, **plano de dieta, fichas de treino e programa**, listas, plano do dia, financeiro e ideias. Cada trecho traz um `id`; `ler_documento` devolve o texto completo. O Perguntar/Documentar da tela usa a mesma busca.

## Juntar demandas do mesmo dossiê + checklist
- Cada demanda tem um **checklist** (tabela `demand_checklist`, migração `20261204000100`; `save_demands` grava junto). Na janela da demanda: marcar (risca), adicionar, tirar e "limpar os já feitos"; o cartão mostra a barrinha `feitos/total`; o "Progresso geral" usa o checklist.
- **Juntar** (`src/lib/demand-merge.ts`): demandas ABERTAS do tipo "por dossiê" com o mesmo dossiê viram uma só (fica com o código da primeira): título "Dossiê: N pendências", checklist com um passo por demanda (mais os checklists que já tinham), maior prioridade, menor prazo, texto/observações/histórico das absorvidas e **anexos movidos** (`moveMaterials`). Botão "Juntar do mesmo dossiê (N)" em Demandas (mostra o que vira o quê e deixa escolher) e voz `juntar_demandas` (com dossiê citado executa na hora; sem citar, pede confirmação).
- Voz: `atualizar_demanda` aceita `checklist_adicionar`, `checklist_marcar`, `checklist_desmarcar`, `checklist_remover`.

## Ditado (Ditar / Registrar demanda)
`useSpeech` (`src/lib/use-speech.ts`) avisa `orion:ditado` ao começar e ao terminar; o Orion (`use-voice.tsx`) solta o microfone da escuta de "Orion" e da conversa enquanto dura o ditado e depois volta (dois reconhecimentos de voz ao mesmo tempo se cancelavam: "Ouvindo…" aparecia e sumia). O ditado começa 0,45 s depois para o outro soltar o microfone, e os erros agora aparecem num aviso (microfone bloqueado, sem internet, nada ouvido).

## Demanda como tarefa
Demandas → janela da demanda: botão **"Adicionar às Tarefas"** (vira "Já está nas Tarefas" e leva para a lista); ao criar a demanda: caixa "Adicionar também às Tarefas". A tarefa vai para a categoria **Demandas** (criada na primeira vez, `ensureDemandCategory`), com título `P059 · …`, dossiê e checklist na descrição, prioridade e prazo da demanda (`deadlineIso`), ligada por `tasks.demand_code` + `project_id`; uma vez só por demanda (`addDemandAsTask`). Voz: `atualizar_demanda` com `adicionar_as_tarefas`.

## Aguardando retorno (pendências dentro da demanda)
- Cada passo do checklist pode ficar **Aguardando retorno** (ampulheta): de quem + observação + desde quando (`CheckItem.wait`). Selo âmbar no passo; **passando o mouse** aparece a observação e há quantos dias; **Recebi** tira o selo; concluir o passo também. O cartão da demanda mostra "N aguardando retorno" (tooltip com a lista).
- **Central do dia**: seção "Aguardando retorno" com todos os passos esperando (há quantos dias, vermelho a partir de 3), tooltip com a observação e link para a demanda (`useCentralWaiting`).
- Banco: colunas `waiting`, `waiting_from`, `waiting_note`, `waiting_since` em `demand_checklist` (migração só aditiva). Os dados da espera são gravados logo depois do `save_demands` (`saveDemands` em `project-data.ts`), então a função do banco não precisa mudar.
- Voz: `atualizar_demanda` com `checklist_aguardar` [{passo, de, nota}] e `checklist_recebido`.

## Tarefas: concluída some da lista
Em Tarefas, ao concluir, a linha risca, desliza e some (só ficam as pendentes); o aviso tem **Desfazer** e o link "Mostrar N concluídas" traz de volta.
