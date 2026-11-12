# Orion — o segundo cérebro

Caixa disponível em **todas as páginas** (botão roxo no canto inferior direito, ou **Ctrl/⌘ + K**) e na aba Biblioteca da Documentação.

## Duas ações
- **Perguntar**: pesquisa em tudo o que o Presence guarda e responde com IA (OpenAI), citando as fontes numeradas. Entende "hoje", "ontem", "semana passada", "este mês", "mês passado".
- **Documentar**: grava uma anotação livre (com data do acontecimento, padrão = hoje). Os dossiês/polos citados no texto viram etiquetas. As últimas aparecem na lista, com apagar ao passar o mouse.

## Voz
Nos dois modos há um botão de microfone: grave, toque no ✓ para parar e o áudio vira texto no campo (editável) antes de enviar; o ✕ cancela. A transcrição é feita pela OpenAI (`whisper-1`; mude com `OPENAI_TRANSCRIBE_MODEL`), em português, com limite de 3 minutos por gravação. Precisa de permissão de microfone no navegador e de `OPENAI_API_KEY`.

## Página do segundo cérebro (`/cerebro`)
Ícone de cérebro no menu lateral. Tem **linha do tempo** (por dia, com miniaturas), **mapa de ligações** (dossiês, anotações, documentação e demandas citadas como `#P048`) e **grade de arquivos**, com filtro por texto, tipo e dossiê. Clique num cartão para abrir a gaveta (texto, arquivos, conteúdo lido, ligações, editar/excluir).

## Anexos (prints, documentos, arquivos)
Em **Documentar** (na caixa do Orion e na página): clipe, arrastar e soltar, ou **colar print com Ctrl+V**. Imagens são reduzidas (1600 px); PDFs até 3 MB e textos são lidos pela IA e o conteúdo fica salvo (`ai_summary`) para a pesquisa achar. Outros tipos (Office, áudio, zip, PDFs grandes) são guardados, só sem leitura. Limite: 8 arquivos e 25 MB por anotação, no bucket privado `presence-app-brain-files`.

## Documentação → segundo cérebro
Logins (sem a senha, que nunca sai do navegador) e documentos criados na aba Documentação são espelhados automaticamente em `brain_entries` (`source = documentacao`, `ref_id = login:<id>` ou `doc:<id>`). Editar ou apagar na Documentação atualiza ou remove o espelho. Os documentos de exemplo da tela não entram.

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
