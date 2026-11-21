# Mapa de conexões (`/mapa`, e a aba "Mapa" do Segundo cérebro)

O segundo cérebro como uma rede viva: tudo o que o Orion guarda aparece como um nó e as ligações entre eles viram linhas com partículas correndo.

## O que vira nó e ligação
- **Nós:** projetos, dossiês (polos), demandas, anotações (notas do projeto e do segundo cérebro), documentação, tarefas, ideias, reuniões, pessoas (participantes de reuniões e quem pediu algo no WhatsApp), conversas do WhatsApp e pedidos do WhatsApp (`src/lib/map-graph.ts`, `buildMap`).
- **Ligações:** projeto ↔ dossiê; demanda ↔ projeto e dossiê (e as execuções por dossiê); anotação/tarefa ↔ projeto e dossiê; **menções**: um texto que cita o código de uma demanda (`#P055`) ou o nome de um dossiê liga a ela; ideia → projeto (quando virou projeto); reunião ↔ participantes; pedido ↔ conversa e pessoa; conversa ↔ dossiê cujo nome aparece no nome do grupo.
- O tamanho do nó cresce com o número de ligações. Demanda em aberto pulsa; **urgente** (prioridade alta e ainda aberta) tem anel vermelho expandindo; concluída fica mais apagada.

## Como usar
Roda do mouse = zoom no ponteiro · arrastar o fundo = mover · arrastar um nó = puxa a rede · passar o mouse = destaca o nó e quem está ligado · clique = painel com as conexões (clique numa conexão para voar até ela) e **Abrir no Orion** (leva ao módulo certo).
Barra: **busca** (apaga o que não combina), **tipos** (clique na legenda para esconder/mostrar), **Enquadrar**, **Reorganizar** (embaralha e a física arruma de novo), **Pausar** o movimento, **Só pendentes** (esconde demandas, tarefas e ideias já resolvidas) e **Ver exemplo** (rede inventada). Há um mini-mapa no canto.

## Por baixo
Canvas 2D (`ConnectionMap.tsx`) com um motor próprio (`engine.ts`): molas nas ligações, repulsão por grade (custo quase linear), gravidade e uma "respiração" leve para nunca ficar parado. Brilhos aditivos, partículas pelas curvas e animação de nascimento. `prefers-reduced-motion` desliga partículas e respiração. Os dados vêm de `src/lib/data/map.ts` (cada parte falha sozinha). Passo da física com 1.500 nós/3.000 ligações medido em teste (< 60 ms; no uso normal bem menos).

## Limites
Lê até 600 anotações, 500 tarefas, 2.500 demandas etc. (mais recentes). Não mostra finanças, saúde nem hábitos. Medido só com redes de até alguns milhares de nós em teste; com milhares o movimento pode ficar pesado em computador fraco (use "Pausar" ou filtre os tipos).
