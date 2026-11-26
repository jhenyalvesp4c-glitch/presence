# Clientes (Demandas → Documentação → Clientes)

Carteira de clientes com ficha própria, ligada aos dossiês do projeto.

- **Ficha:** nome, contato, segmento, e-mail, telefone, CNPJ/CPF, plano, valor mensal, situação (ativo, em negociação, pausado, encerrado), fim do contrato e observações.
- **Vínculo com o dossiê:** no cadastro, escolha o dossiê do projeto. As demandas daquele dossiê aparecem na ficha e podem ser marcadas como feitas dali.
- **Documentos:** anexos reais (Storage); o Orion lê o texto dos arquivos para achar depois.
- **Reuniões:** vincule atas existentes (`meetings.client_id`).
- **Acessos:** só onde fica e o usuário. Senhas não são guardadas.
- **Histórico:** anotações com data.
- **Vencimentos:** contrato que vence em até 30 dias fica em destaque (radar, resumo, ficha); pausado e encerrado não alertam.
- **Orion:** cada cliente (ficha + documentos + histórico) entra no `loadCorpus`, então a busca e as perguntas do Orion o encontram.

Tabelas: `clients`, `client_docs`, `client_log`, `client_access` (RLS só do dono) e `meetings.client_id`. Regras puras em `src/lib/clients.ts`.

## Pasta ligada a um dossiê (Documentação → Biblioteca)

- Ao criar uma pasta (ou pelo seletor no topo da pasta) dá para escolher o **dossiê**. A pasta mostra a **página do dossiê**: visão geral, documentos da pasta, demandas, logins, reuniões, registros/notas e o cliente.
- Demandas: pelo nome do dossiê (podem ser marcadas como feitas ali). Logins: os logins do dossiê (senhas só neste navegador). Reuniões: vincule atas existentes (`meetings.dossier_id`). Registros: anotações do Orion marcadas com o dossiê e notas do projeto.
- Novos tipos de documento em "Clientes": Contrato, Proposta, Ficha do cliente e Termo.

## Importar dos dossiês e tudo ligado ao dossiê
- **Importar dos dossiês** (botão em Clientes): lista os dossiês do projeto que ainda não têm cliente, com busca e marcação; cada marcado vira um cliente já ligado ao dossiê (`importDossiersAsClients`).
- **A ficha puxa tudo do dossiê vinculado:** documentos das pastas da Biblioteca ligadas a ele, reuniões vinculadas ao dossiê, demandas (inclusive de vários dossiês, via `demand_executions`), registros e notas, e os logins da Documentação (só usuário/responsável; senhas ficam no navegador). Consulta em `useClientLinks` (`src/lib/data/clients.ts`).

## Painel do topo
Por padrão mostra a **Saúde da carteira** (`PortfolioHealth`): implantação média dos clientes ativos (anel), lista "quem precisa de você" (menos andado primeiro, com travados e dias sem contato) e três cartões (sem implantação iniciada, demandas abertas, sem contato há 30 dias). O seletor alterna para **Receita e vencimentos**, que fica guardado até a pessoa cadastrar valores e datas. Regras em `src/lib/portfolio.ts` (testadas em `src/test/portfolio.test.ts`).


## Logins e senhas: senha visível e acessos da ficha
- **Logins e senhas** (Documentação → Logins dos Dossiês): a senha aparece por padrão (o olho esconde; botão para copiar). Autorizado pela usuária.
- **Ficha do cliente → Acessos:** campo **Senha** além do usuário. O acesso (onde, usuário, observação) vai para o banco como antes (`client_access`); a **senha fica só neste navegador** (`src/lib/login-store.ts`, `presence.logins.v1`), nunca no banco, na IA, no MCP nem no segundo cérebro. O acesso também entra em **Logins e senhas** ligado ao dossiê do cliente (id `a-<acesso>`), e apagar o acesso apaga o login. Mostra a senha na ficha com olho e copiar.
- Consequência: as senhas não aparecem em outro aparelho nem para outra pessoa; limpar os dados do navegador as apaga. (Guardar no banco, criptografado, é uma decisão à parte — peça antes.)

## Onde fica a página de Clientes
**Demandas → botão "Clientes"** (no lugar do botão "Notas"), em `/demandas?aba=clientes`. Saiu da aba Documentação (que ficou com Biblioteca, Treinamentos e Playbooks); os vínculos com dossiês, reuniões e demandas não mudaram. As **notas** continuam na Visão geral (faixa "Notas", "ver mais"). Links antigos `?secao=cli` abrem a página nova.

O botão de copiar de cada acesso (ficha do cliente → Acessos) copia **usuário e senha** prontos para enviar:
```
Usuário: fulano@empresa.com
Senha: ********
```
(sem senha cadastrada, copia só o usuário).

### Tarefas de clientes

Uma tarefa criada dentro da ficha do cliente (aba Tarefas) fica ligada a ele (`tasks.client_id`) e vai para a categoria **Clientes** das Tarefas (criada na primeira vez), não para "Demandas". Na página Tarefas, o nome do cliente aparece ao lado da tarefa (qualquer projeto: `useAllClients`) e a categoria Clientes separa tudo o que é para os clientes. Ao escolher um cliente ao criar a tarefa por lá, a categoria também vira Clientes (se você não escolheu outra).

Na página Tarefas, ao filtrar a categoria **Clientes**, a lista fica **separada por polo**: um bloco para cada um (ordem alfabética, "Sem polo" no fim), com o nome, quantas tarefas pendentes e, dentro, as tarefas por data (`groupByPolo` em `src/lib/task-polo.ts`).

A lista de Tarefas é **dividida por categoria** (Clientes, Demandas, Autocuidado…, na ordem das categorias), cada uma com o seu título e quantas tarefas pendentes. Dentro de "Clientes", cada polo tem o seu bloco. Em semana, mês e todas, dentro de cada categoria as tarefas ficam separadas por dia.

### Imagens e arquivos nas tarefas

Ao criar ou editar uma tarefa (na ficha do cliente, em Tarefas ou na janela de editar) dá para **anexar imagens e arquivos**: botão "Anexar imagem ou arquivo", **colar um print (Ctrl+V)** ou **arrastar** para a área. Os arquivos vão para o Storage (pasta `tarefas`, até 8 por vez e 25 MB cada) e ficam em `tasks.attachments`. Na lista aparecem as miniaturas (até 4); tocar abre em tela cheia (`TaskFiles.tsx`).

Na aba **Tarefas** da ficha do cliente, cada tarefa tem **editar** (a mesma janela da página Tarefas: título, categoria, data, hora, lembrete, cliente, anexos) e **excluir** (com confirmação).

O anel de cada cartão de cliente mostra a **porcentagem das tarefas criadas para ele que já foram feitas** (`clientTaskProgress`); sem tarefas aparece "—".

### Clientes: quem precisa de você pelas tarefas

- **Filtro "Quem precisa de você (tarefas)"** na lista de clientes: Atrasadas (data já passou), Para hoje, Com pendentes, Sem tarefas e Em dia, cada um com a contagem. Ao filtrar, os clientes com mais atrasadas vêm primeiro (`clientTaskStats`, `matchesAttention`, `byAttention`).
- **Caixa de etapa em cada cartão:** as tarefas do cliente são as etapas, na ordem em que foram criadas. O cartão mostra "Etapa atual · 3 de 4", o nome da etapa, uma barrinha com as etapas feitas e "Depois: …" com o que falta. Fica vermelha se há atrasada, azul se está andando e verde quando tudo foi feito (`clientSteps`).

### Tarefas padrão dos clientes

O botão **Tarefas padrão** (na lista de clientes) abre o modelo: as tarefas que **todo cliente novo ganha**, na ordem (a ordem de criação é a ordem das etapas). Dá para editar o texto, mudar a ordem, apagar, acrescentar e ligar/desligar "criar automaticamente". Depois de criadas, são tarefas normais do cliente: cada uma se edita ou se exclui na ficha. Sem nada salvo, vale o modelo que já vem com o Orion. O botão **"Criar nos clientes que ainda não têm tarefas"** aplica nos clientes que já existem (só os que não têm nenhuma); na ficha de um cliente sem tarefas há **"Criar as tarefas padrão"**. Não repete tarefa que o cliente já tem. Tabela `client_default_tasks` (RLS por dono).
