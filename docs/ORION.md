# Orion — o segundo cérebro

Caixa disponível em **todas as páginas** (botão roxo no canto inferior direito, ou **Ctrl/⌘ + K**) e na aba Biblioteca da Documentação.

## Duas ações
- **Perguntar**: pesquisa em tudo o que o Presence guarda e responde com IA (OpenAI), citando as fontes numeradas. Entende "hoje", "ontem", "semana passada", "este mês", "mês passado".
- **Documentar**: grava uma anotação livre (com data do acontecimento, padrão = hoje). Os dossiês/polos citados no texto viram etiquetas. As últimas aparecem na lista, com apagar ao passar o mouse.

## O que é pesquisado
Anotações do Orion (`brain_entries`), demandas + histórico + observações + execuções por polo, tarefas e compromissos, notas de projeto, conversas com a assistente e turmas de treinamento. Nada é copiado: a pesquisa lê as tabelas na hora, então tudo o que entra no sistema já é "lembrado".

## Como funciona
1. `src/lib/orion.functions.ts` (`orionAsk`) reúne os documentos e `src/lib/orion.ts` ordena por relevância (palavras-chave com tolerância a plural, filtro de período, bônus para anotações).
2. As ~40 melhores fontes vão para a OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL` opcional) com a regra "responda só com as fontes, cite [n], mostre a conta".
3. Sem chave (ou se a OpenAI falhar) a busca continua: mostra as fontes encontradas e avisa o motivo.

## Limites
- Contagens e médias dependem de o que aconteceu ter sido documentado ou estar nas demandas; o Orion avisa quando pode faltar registro.
- O Orion não grava nada sozinho a partir de perguntas; só "Documentar" grava.
- A conversa da assistente só entra na busca quando salva em `assistant_messages`.

Arquivos: `src/components/orion/`, `src/lib/orion.ts`, `src/lib/orion.functions.ts`, `src/lib/data/brain.ts`, migração `20261113000100`.
