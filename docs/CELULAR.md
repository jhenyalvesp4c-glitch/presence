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

## Próximo degrau: avisos com o app fechado (push)
Exige VAPID (chaves), tabela de aparelhos e uma rotina de envio (cron). No iPhone só funciona com o app instalado (iOS 16.4+). Não implementado ainda.
