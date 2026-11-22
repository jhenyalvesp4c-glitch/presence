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
