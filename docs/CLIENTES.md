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
