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
- A caixa de fala tem tamanho fixo e o texto **aparece frase a frase, quando cada frase começa a ser falada**; a caixa rola sozinha para o fim (`SpeechText.tsx`), então toda a mensagem pode ser lida.

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
