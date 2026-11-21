# WhatsApp no Orion (somente leitura, só no computador)

O Orion lê suas conversas e grupos do WhatsApp, avisa quando alguém **marcar você** (ou responder a uma mensagem sua) e conta o que foi dito, por voz.

## Como funciona
- `whatsapp-bridge/` é uma **ponte local** (Node 22.18+): entra no WhatsApp como "aparelho conectado" (biblioteca não oficial Baileys), guarda as mensagens num SQLite **no seu computador** (`~/.presence/whatsapp`, apagadas após 30 dias) e abre uma API só em `127.0.0.1:3939`, com senha (`bridge.json`).
- O app (servidor local) fala com a ponte em `/api/whatsapp` (`src/routes/api.whatsapp.ts`, `src/lib/whatsapp/bridge.ts`). No site publicado (Vercel) a ponte não existe: a tela mostra "Ponte desligada".
- **Somente leitura**: não há código para enviar mensagem, marcar como lida ou aparecer online (`markOnlineOnConnect: false`).
- Para ligar **sem janela**: Configurações → WhatsApp → **Ligar o WhatsApp aqui** (app do computador; o servidor do app inicia a ponte escondida, `src/lib/whatsapp/launcher.ts`) ou, para ficar ligada sempre e também com o site publicado, dois cliques em `whatsapp-fundo.cmd` **uma vez**: ele põe um atalho invisível na pasta Inicializar do Windows (`OrionWhatsApp.vbs` → `whatsapp-fundo.vbs`) e liga a ponte agora. Para desfazer: `whatsapp-parar.cmd`. O registro da ponte fica em `~/.presence/whatsapp/ponte.log`.
- `whatsapp.cmd` continua existindo para depurar (mostra a janela com as mensagens da ponte).
- Depois de ligar, Configurações → WhatsApp → ler o QR Code (só na primeira vez; a sessão fica guardada).

## Site publicado (Vercel) e o aplicativo do Windows
O aplicativo "Orion" do Windows abre o **site publicado**. Mesmo assim o WhatsApp funciona: o **navegador** (que roda no PC da pessoa) fala direto com a ponte em `http://127.0.0.1:3939`.
- A ponte aceita só origens exatas (`DEFAULT_ORIGINS` em `whatsapp-bridge/src/server.ts`, mais `localhost`/`127.0.0.1`), confere o `Host`, responde ao pré-pedido do navegador (CORS + `Access-Control-Allow-Private-Network`) e entrega a senha por `GET /parear` só para essas origens.
- O navegador pode pedir permissão ("acessar dispositivos na rede local"): é preciso clicar em Permitir. A tela de Configurações só tenta no site publicado depois que a pessoa clica em "Procurar a ponte neste computador" (`presence.wa.ativo`).
- Voz no site publicado: o servidor não alcança a ponte, então `runAgent` para com um evento `ferramenta`; o navegador executa `runWhatsAppTool` na ponte e reenvia a rodada com `continuar` (estado + resultados) para `/api/voz`. No app local (servidor alcança a ponte) tudo roda no servidor, como antes.
- Se o site publicado ganhar outro endereço, acrescente em `DEFAULT_ORIGINS`.

## Varredura e mídia (para "Demandas do WhatsApp")
- `GET /varredura?since=&limit=` devolve as mensagens (grupos e privadas, de todos) depois de `since`, até 3.000, com `has_media`/`media_mime`. `GET /midia?chat=&id=` devolve a imagem/PDF guardado em base64 (só arquivos dentro de `~/.presence/whatsapp/media`).
- A ponte baixa imagens e PDFs (até 6 MB) de cada mensagem nova (`downloadMediaMessage`, nunca derruba a ponte se falhar) e apaga os arquivos junto com as mensagens antigas.

## Conversas sem nome
O WhatsApp só entrega à ponte o nome de quem escreveu (nome do perfil) e o que sincroniza dos contatos; quem nunca escreveu, ou escreve sem nome, aparece pelo **número** (ou por um id interno `@lid`). `GET /chats` devolve `preview` (última mensagem) e `sem_nome`, e a busca (`?q=`) acha por nome **ou pedaço do número** em todas as conversas (não só nas primeiras). `POST /nome?jid=&nome=` dá o nome a uma conversa (vale na lista e nas mensagens). Em Reuniões → Do WhatsApp, o lápis ao lado do contato faz isso.

## Voz (src/lib/voice/agent.ts, src/lib/whatsapp/tools.ts)
`whatsapp_conversas`, `whatsapp_ler` (por nome aproximado, período, busca, só novas), `whatsapp_mencoes`. "Novas" = ainda não lidas pelo Orion (ponteiro guardado só na ponte; não muda nada no WhatsApp).

## Conversa na tela e "lido"
As mensagens lidas pela voz aparecem como no aplicativo (balões um embaixo do outro, nome, horário, separador de dia; `WhatsChat.tsx`). "Marcar tudo como lido" (botão em Configurações ou pela voz: `whatsapp_marcar_lidas`) zera só o ponteiro do Orion; **nada é marcado como lido no WhatsApp** (continua somente leitura).

## Avisos de marcação
`WhatsAppWatcher` consulta as marcações a cada ~20 s (quando a ponte está conectada): aviso na tela, notificação e voz (juntando o que chegou junto).

## Riscos e privacidade
- Não é integração oficial: o WhatsApp pode limitar o número. Uso por conta e risco.
- Ao pedir para ler/analisar, o trecho vai para a OpenAI. A fala do Orion é salva no histórico da conversa (e entra no Orion).
- Quem tem acesso à pasta `.presence` do computador acessa as mensagens e a sessão do WhatsApp.

## Testes
`src/test/whatsapp.test.ts` cobre a interpretação das mensagens (marcações, respostas, mídia), o armazenamento, a busca por nome e a API. **A conexão real com o WhatsApp não foi testada pela Claude** (precisa de um celular para ler o QR): teste no seu PC.

## Avisos por nome e por assunto (CRM)

Além de marcações e respostas, o Orion avisa (tela, notificação e voz) quando:
- alguém escreve o seu nome, em qualquer grafia (Jheny, Jenny, Jeny, Jhenny, Jeni…), com ou sem marcar;
- a mensagem fala de CRM (P4C, disparo em massa, usuários, templates, conexão, QR code, API oficial…), **exceto** se também falar de campanha, anúncio, valor, preço, orçamento, verba, saldo ou R$.

As regras ficam em `src/lib/whatsapp/relevance.ts` (só texto, sem IA, sem custo) e podem ser ajustadas em Configurações → WhatsApp → "Ajustar as palavras dos avisos". Exige a ponte atualizada (rota `GET /recentes`); com a ponte antiga só avisa marcações.
