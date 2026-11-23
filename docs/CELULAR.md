# Orion no celular (app instalável) e regras de acabamento

## Instalar
- **Android (Chrome):** menu ⋮ → "Instalar app" (ou o aviso que o Chrome mostra).
- **iPhone (Safari):** botão Compartilhar → "Adicionar à Tela de Início". Precisa ser o Safari.
O Orion abre em tela cheia, com o ícone da esfera, e tem atalhos (Central do dia, Tarefas, Financeiro, Reuniões) ao segurar o ícone.

## O que existe no código
- `public/manifest.webmanifest`: nome, cores, ícones e atalhos. `public/icons/*`: ícones (192, 512, arredondado e o do iPhone).
- `public/sw.js` + `src/components/ServiceWorkerRegistration.tsx` (só em produção): páginas **sempre da rede**; sem internet mostra `public/offline.html`; guarda só `/assets/*` e ícones; nada de `/api/*`, Supabase, voz ou login passa pelo service worker. Para invalidar tudo, troque `VERSION` em `sw.js`.
- Os botões "Limpar o que ficou guardado" (watchdog) e "Atualizar" (`refresh-app.ts`) removem o service worker e recarregam; ele se registra de novo na abertura. Não brigam com o novo.
- `src/components/TouchTargets.tsx`: em aparelhos de toque, amplia a área de clique de botões menores que 40 px (área invisível, sem mudar o desenho).
- `styles.css`: campos com 16 px em telas de toque (o iPhone dá zoom em letra menor), `touch-action: manipulation`, `max-h-[..dvh]` nas janelas (a barra do navegador do celular não corta).

## Regras para telas novas (celular primeiro)
1. Teste em 390 px de largura; nada pode gerar rolagem para o lado.
2. Botões e links com pelo menos 40 px de área de toque (use `TouchTargets` como rede de segurança, mas prefira `h-10`+).
3. Barras fixas e botões flutuantes: respeite `env(safe-area-inset-bottom)` e deixe espaço no fim da página.
4. Janelas: use `dvh` (não `vh`) e `pb-[env(safe-area-inset-bottom)]` nos rodapés.
5. Faixas de filtros/abas muito largas: uma fileira que rola para o lado, nunca sobrepondo conteúdo.


## Janelas (modais) no celular
- `src/components/ModalGuard.tsx`: quando há uma janela aberta (qualquer `[role=dialog]` ou camada fixa de tela cheia com z-index ≥ 50), marca `html[data-modal="1"]` e o CSS esconde a barra de baixo e os botões flutuantes. Assim nenhuma janela fica com o botão de salvar coberto, mesmo as presas dentro de blocos com animação.
- Janelas do Financeiro (`Modal` em `finance/ui.tsx`): os botões `Actions` (`.fin-actions`) ficam presos no pé da janela no celular; o corpo rola e o campo em foco continua visível com o teclado aberto (testado com a tela reduzida para ~508 px).
- Novas janelas: prefira `createPortal(document.body)` e `max-h-[..dvh]`; mantenha o botão principal no pé, fora da área que rola.

## Avisos com o app fechado (Web Push)
Configurações → **Avisos no celular**: liga as notificações **deste aparelho** (cada aparelho liga o seu), com botão "Enviar aviso de teste".
- **O que avisa** (horário de Brasília): lembretes na hora marcada (até 90 min depois); fatura **fechando/vencendo** e **assinatura renovando**, 1 dia antes e no dia, a partir das 9h. Regras em SQL: `presence_app.push_due` (`supabase/migrations/20261203000200_push.sql`).
- **Como funciona:** o `pg_cron` do Supabase chama `/api/push/cron` a cada minuto, com um segredo que só existe no banco (`push_config`). A rota chama `push_due`, envia com `web-push` (`src/lib/push/server.ts`), marca em `push_sent` (não avisa duas vezes) e remove aparelhos que saíram (404/410).
- **Chaves VAPID e segredo:** geradas e guardadas no banco (`push_config`, sem acesso direto; só pelas funções `push_*`). Não há nada para configurar na Vercel. A rota `/api/push/chave` entrega só a chave pública.
- **Aparelhos:** `push_subscriptions` (RLS por dono, sem `anon`). iPhone: só com o app instalado na tela inicial (iOS 16.4+).
- **Novo tipo de aviso:** acrescente um `select` ao `with items` de `push_due` (chave única em `k`, título, texto, url).
- **Desligar tudo:** `select cron.unschedule('orion-push')`.
