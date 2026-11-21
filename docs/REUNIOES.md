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
