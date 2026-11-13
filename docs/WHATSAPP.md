# WhatsApp no Presence (somente leitura, só no computador)

O Presence lê suas conversas e grupos do WhatsApp, avisa quando alguém **marcar você** (ou responder a uma mensagem sua) e conta o que foi dito, por voz.

## Como funciona
- `whatsapp-bridge/` é uma **ponte local** (Node 22.18+): entra no WhatsApp como "aparelho conectado" (biblioteca não oficial Baileys), guarda as mensagens num SQLite **no seu computador** (`~/.presence/whatsapp`, apagadas após 30 dias) e abre uma API só em `127.0.0.1:3939`, com senha (`bridge.json`).
- O app (servidor local) fala com a ponte em `/api/whatsapp` (`src/routes/api.whatsapp.ts`, `src/lib/whatsapp/bridge.ts`). No site publicado (Vercel) a ponte não existe: a tela mostra "Ponte desligada".
- **Somente leitura**: não há código para enviar mensagem, marcar como lida ou aparecer online (`markOnlineOnConnect: false`).
- Para ligar: dois cliques em `whatsapp.cmd`, depois Configurações → WhatsApp → ler o QR Code.

## Voz (src/lib/voice/agent.ts)
`whatsapp_conversas`, `whatsapp_ler` (por nome aproximado, período, busca, só novas), `whatsapp_mencoes`. "Novas" = ainda não lidas pelo Presence (ponteiro guardado só na ponte; não muda nada no WhatsApp).

## Avisos de marcação
`WhatsAppWatcher` consulta as marcações a cada ~20 s (quando a ponte está conectada): aviso na tela, notificação e voz (juntando o que chegou junto).

## Riscos e privacidade
- Não é integração oficial: o WhatsApp pode limitar o número. Uso por conta e risco.
- Ao pedir para ler/analisar, o trecho vai para a OpenAI. A fala do Presence é salva no histórico da conversa (e entra no Orion).
- Quem tem acesso à pasta `.presence` do computador acessa as mensagens e a sessão do WhatsApp.

## Testes
`src/test/whatsapp.test.ts` cobre a interpretação das mensagens (marcações, respostas, mídia), o armazenamento, a busca por nome e a API. **A conexão real com o WhatsApp não foi testada pela Claude** (precisa de um celular para ler o QR): teste no seu PC.
