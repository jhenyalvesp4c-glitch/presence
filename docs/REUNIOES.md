# Assistente de reuniões (`/reunioes`)

Cole a conversa, grave a reunião ou traga grupos do WhatsApp. O Orion devolve **ata, decisões, quem faz o quê, pendências, próxima reunião** (e, nos grupos, o **resumo de cada grupo** com os pedidos) e manda as ações para a **Central de entrada**, que as transforma em **demandas, lembretes, tarefas e compromisso** depois da sua revisão.

## Como usar
1. **Reunião** ou **Resumir grupos** (alterna o jeito de analisar).
2. **Origem:** *Colar texto* (conversa exportada do WhatsApp, transcrição, anotações) · *Gravar* (gravação contínua, sem limite de tempo: o texto aparece enquanto você grava e, ao tocar em **Finalizar e organizar**, o Orion junta tudo e já gera a ata) · *Do WhatsApp* (escolha grupos e o período: hoje, 24 h, 3 ou 7 dias).
3. Opcional: **título** e **seu nome na conversa** (assim as ações suas aparecem marcadas "você").
4. **Gerar ata com o Orion.** O resultado fica salvo em *Reuniões anteriores*.
5. Em **Quem faz o quê**, marque as ações e toque em **Criar demandas e lembretes**: a Central abre já interpretando (projeto/polo/dossiê reais, datas, duplicidade). Nada é criado antes do seu "Confirmar e distribuir" (e dá para desfazer). A próxima reunião vai como compromisso.
6. **Copiar ata** (Markdown) para colar no WhatsApp ou e-mail.

## Por baixo
- `analyzeMeeting` (`src/lib/meetings.functions.ts`): OpenAI (`registrar_reuniao`), hoje + dia da semana para resolver "amanhã/sexta", não inventa responsável nem prazo. A limpeza do que volta é `cleanAnalysis` (`src/lib/meetings.ts`, com testes).
- Criar demandas/lembretes **reaproveita a Central** (`InboxPanel`, `interpretInbox`, `distributeInbox`): mesma validação e gravação do MCP. As ações enviadas ficam marcadas (campo `created` da reunião); "Liberar" permite enviar de novo.
- Tabela `presence_app.meetings` (título, origem, modo, texto original, análise, ações enviadas, data), só do dono. As reuniões entram na busca do Orion (`loadCorpus`, tipo "Reunião").
- **WhatsApp:** a leitura usa a ponte local (somente leitura), como em Configurações. No site publicado o navegador fala direto com a ponte (`whatsapp.cmd` ligado; permita o acesso à rede local se o navegador pedir). Sem a ponte, a aba mostra como ligar; o resto funciona colando texto. Até 200 mensagens por conversa por vez (use um período menor para pegar tudo).
- Voz (`src/lib/use-live-recorder.ts`): o microfone fica aberto e o áudio é cortado em trechos de ~25 s que são transcritos (`transcribeAudio`, OpenAI) enquanto a gravação continua, cada um recebendo o fim do anterior como contexto. Em navegadores com reconhecimento de voz (Chrome/Edge) as palavras também aparecem na hora, em cinza, até o trecho ser confirmado. A tela fica acesa (wake lock) e o navegador avisa antes de fechar a aba. Trecho que falha é refeito ao finalizar; se ainda faltar, o texto vem sem ele, com aviso. Para testar com trechos curtos: `/reunioes?trecho=4000` (milissegundos).

## Limites
- Precisa de `OPENAI_API_KEY` (como a Central). Texto até 60 mil caracteres por análise.
- A IA pode errar responsável ou prazo: tudo passa pela sua revisão antes de virar registro. Lembretes são registros com data; o Orion ainda não notifica.
- Testado no navegador com um servidor de IA simulado (resultado, envio à Central, histórico). Não testado com a OpenAI real nem com a ponte do WhatsApp real.

## Demandas do WhatsApp (aba "Demandas do WhatsApp")
Um clique em **Verificar agora** lê **todos os grupos e conversas privadas** do período (desde a última verificação, hoje, 24 h, 3 ou 7 dias), a IA lista os **pedidos** feitos a você e **você decide** o que é demanda.
- **Fluxo:** a tela busca as mensagens na ponte (`/varredura`, grupos e privadas, de todos, incluindo as suas respostas para a IA saber se algo já foi resolvido) → `groupChats`/`buildBatches` (`src/lib/wa-requests.ts`) separam por conversa e cortam em lotes de ~40 mil caracteres → cada lote vai para `findRequests` (`wa-requests.functions.ts`, OpenAI, `listar_pedidos`) junto com as **imagens e PDFs** do lote (as 6 mais recentes por lote, reduzidas a 1600 px) → os pedidos de todos os lotes são juntados sem repetir.
- **Cartão de cada pedido:** título, quem pediu, grupo ou conversa privada, quando, prazo, prioridade, detalhes, a mensagem original e miniaturas das imagens (clique para ampliar). Etiquetas: "pedido geral" (era para o grupo, não só para você), "parece resolvido" (alguém disse que foi feito; fica escondido até você pedir) e "confiança média/baixa".
- **Você decide:** marque ✔ no que é demanda e toque em **Criar demandas**; **Não é demanda** descarta (com "Desfazer"); "Descartar os não marcados" limpa o resto. Os decididos ficam em `whatsapp_requests` (chave estável do pedido) e **não voltam** nas próximas verificações. A "última verificação" só avança quando todos os lotes foram lidos.
- **Criar demandas:** abre a Central de entrada com o texto dos pedidos marcados e as **imagens/PDFs como evidência** (a Central aceita até 6 arquivos por vez; o excedente é avisado). Lá você revisa projeto/polo e confirma.
- **Imagens e PDFs:** a ponte baixa para o seu computador (`~/.presence/whatsapp/media`, até 6 MB cada) as imagens e PDFs que **chegarem depois de ligada com esta versão**; mensagens antigas aparecem só como "[imagem]". São apagadas junto com as mensagens (30 dias). Para atualizar a ponte: `whatsapp-parar.cmd` e depois `whatsapp-fundo.cmd`.
- **Limites:** até 3.000 mensagens por verificação (use um período menor se passar); vídeo, áudio e figurinha não são lidos; o conteúdo vai para a OpenAI. A IA pode errar o que é pedido: por isso nada vira demanda sem a sua marcação e a revisão da Central.
- **Testado** com a ponte real (armazenamento e API, com arquivo de imagem) e uma IA simulada no navegador (verificar, marcar, descartar, criar demandas com a imagem). **Não testado** com o WhatsApp real (baixar mídia pelo Baileys) nem com a OpenAI real.
