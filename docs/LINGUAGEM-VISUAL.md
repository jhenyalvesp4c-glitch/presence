# Linguagem visual do Orion — LEIA ANTES DE IMPLEMENTAR QUALQUER TELA

**Regra de ouro:** toda tela, painel ou card novo precisa parecer um sistema caro e futurista. Nunca entregue uma lista seca ou uma tabela sem vida. Antes de escrever UI, procure o que já existe e **reutilize os melhores efeitos** — não invente um estilo novo.

## Checklist (toda implementação)
1. **Fundo vivo** atrás da página: `FinBackdrop` (auroras, estrelas, feixe, grade em perspectiva). Em painéis de vidro, o fundo precisa ter o que mostrar atrás (luzes, grade, estrelas), senão o vidro vira "caixa escura".
2. **Vidro de verdade:** painéis `glass` (+ `glass-clear` quando o fundo precisa aparecer: pouco desfoque, reflexo, borda clara); cards `ex-card` (+ `ex-glass` para tom da cor + reflexo diagonal). Cor do card via `--rail`/`--glow` (`var(--cyan|violet|emerald|amber|pink)`).
3. **Um desenho ou gráfico por tela** (nunca só texto): `Ring`, `Donut`, `Meter`, `Sparkline`, `OrbitArt`, barras com gradiente, linhas do tempo com bolinhas conectadas, ilustrações das telas existentes.
4. **Movimento:** entrada em cascata (`fin-rise` com atraso por item), pulso em itens que pedem atenção (`fin-pulse`), brilho que varre no hover (`card-sheen`), `Tilt` em cards de destaque, números que contam (`Money`). Respeite `prefers-reduced-motion`.
5. **Destaque de topo:** `HeroPanel` com um número grande em `text-gradient`, `LiveDot` e 3 mini-cards (KPIs) com ícone marca-d'água.
6. **Detalhes:** rótulos em `mono-caps`, `icon-tile` nos ícones, `tag` nas etiquetas, ícones `lucide-react`, sombras com glow na cor do item, bordas finas `white/10`.
7. **IA/voz:** caixa com borda de luz girando (`ai-border`), ondas de voz e brilho de carregamento (`ai-shimmer`) — ver `DocAi.tsx`.
8. **Estados vazios bonitos:** `OrbitArt` + frase curta + ação. Nunca "Nenhum item" solto.
9. **Responsivo e sem vazar:** `min-w-0`, `[overflow-wrap:anywhere]`, `line-clamp-*` (não combine com `block`), nada de largura fixa que estoure no painel estreito.
10. **Um padrão só:** barra lateral é só a `GlobalRail`; não desenhe outra. Textos em português do Brasil.

## Interação e acabamento (também obrigatório)
11. **Janelas e botões flutuantes sempre que for viável:** detalhes, formulários e visualizações abrem em janela flutuante (`Dialog` com vidro `bg-[oklch(0.14_0.035_265/0.88)] backdrop-blur-2xl`, cantos `rounded-[2rem]`) em cima da tela atual, **sem redirecionar** para outra página (ex.: reunião aberta dentro da ficha do cliente, caixa de IA dentro do documento). Ações principais em botões flutuantes/arredondados com brilho. Só leve para outra rota quando for inevitável.
12. **Movimento ao passar o mouse em tudo que é clicável:** elevar/escalar de leve (`hover:scale-*`, `hover:-translate-y-*`), borda que acende na cor do item, brilho que varre (`card-sheen`), ícone que gira/cresce (`group-hover`), `Tilt` nos destaques. Todo clique tem resposta (`active:scale-95`, transição suave de 200–400 ms). Respeite `prefers-reduced-motion`.
13. **Impecável em cada detalhe, cada coisinha:** alinhamento e espaçamento consistentes, nada cortado ou vazando (veja item 9), estados de carregando/vazio/erro desenhados, textos curtos em português do Brasil, foco por teclado visível, `aria-label` em botões só de ícone, mensagens de confirmação (`toast`) claras. Antes de entregar, confira a tela em largura estreita e larga e passe o mouse por tudo.
14. **Não entregue "só funciona":** se a funcionalidade ficou certa mas feia ou seca, ainda não está pronta.

## Onde estão as peças
| Peça | Onde |
|---|---|
| `FinBackdrop`, `HeroPanel`, `Tilt`, `LiveDot`, `OrbitArt`, `SectionTitle` | `src/components/finance/fx.tsx` |
| `Ring`, `Donut`, `Meter`, `Sparkline`, `Money` | `src/components/finance/charts.tsx` |
| utilitários `glass`, `glass-clear`, `ex-card`, `ex-glass`, `accent-card`, `icon-tile`, `tag`, `mono-caps`, `text-gradient`, `card-sheen`, `ai-border`, `ai-shimmer`, keyframes `fin-*` | `src/styles.css` |
| Exemplos de referência | Clientes (`ClientsView`, `PortfolioHealth`), Financeiro, Central do dia, Documentação (`DocsLibrary`, `DocAi`), Mapa, Cursos |

## Como pedir/entregar
- Descreva no resumo final **quais efeitos** foram usados e reaproveitados.
- Se criar um efeito novo e ele servir para outras telas, vire utilitário em `styles.css` e acrescente aqui.
- Ao receber captura de tela da usuária, compare com as telas de referência acima (Clientes é o padrão de "vidro transparente").

## HUD do Orion (o que a voz mostra na tela)
Painéis da voz usam `HudPanel` (`src/components/voice/HudPanel.tsx`): cartões de vidro **flutuantes** (não bloqueiam a tela) com cantos de mira, varredura de luz, entrada de lados diferentes com desfoque, flutuação lenta, troca automática de página a cada 8 s (pausa com o mouse), pontos de navegação e saída animada. Fecham sozinhos quando a pessoa agradece ou dispensa ("obrigada", "pode fechar", "não preciso mais" — `src/lib/voice/dismiss.ts`). Painéis de confirmação e conversa do WhatsApp continuam em janela (`VoicePanel`, `WhatsChat`). Animações `hud-*` em `styles.css`.

## Avisos (toasts) e HUD
- Todo aviso (`sonner`) segue a identidade do Orion por CSS global (`[data-sonner-toast]` em `styles.css`): vidro escuro azul-violeta, borda e brilho na cor do tipo (ciano padrão, esmeralda sucesso, rosa erro, âmbar aviso, **verde WhatsApp** com `className: "orion-toast-wa"`), linha de luz animada e barra lateral. Nunca estilize um toast à mão: use `toast(...)`.
- Notificações do sistema (`new Notification`) levam o ícone da esfera (`/icons/icon-192.png`).
- O HUD da voz escurece e desfoca o fundo só um pouco (profundidade 3D) e some quando o Orion abre outra página.
