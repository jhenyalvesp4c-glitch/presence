# Módulo financeiro (frontend)

Rota `/financeiro` (`src/routes/financeiro.tsx`). Etapa 1: frontend. Etapa 2 (feita): **backend no Supabase**, com as mesmas telas. Sem login, continua funcionando só neste aparelho.

## Telas
- **Briefing inicial** (`components/finance/Briefing.tsx`): 10 etapas (início, contas e saldos, cartões, faturas atuais, fixas, compras no débito, compras no crédito, parcelas em andamento, metas, resumo). Aparece no primeiro acesso; dá para pular etapas, voltar, refazer (menu ⋯) ou "Explorar com dados de exemplo".
- **Visão geral** (`Dashboard.tsx`): saldo, receitas, despesas, faturas abertas, parcelas futuras, resultado do mês; rosca por categoria; "por que seus gastos subiram?"; evolução; receitas × despesas; comprometimento dos próximos 12 meses por cartão; próximos vencimentos; alertas; campo "Diga ao Orion".
- **Contas e cartões** (`Accounts.tsx`): cartões desenhados (limite, fatura atual, uso) e contas; área individual com fatura atual, próximas faturas, parceladas, histórico, compras no débito e despesas do mês.
- **Parcelas** (`Installments.tsx`): pagas/restantes/término por compra, linha do tempo, tabela de parcelas e projeção.
- **Movimentações** (`Transactions.tsx`): por mês, agrupadas por dia, com busca e filtros; editar e excluir.
- **Metas** (`Goals.tsx`): guardar, reserva, quitar cartão, economizar por mês, limite por categoria.
- **Adicionar movimentação** (`QuickAdd.tsx`): formulário rápido (débito, crédito, dinheiro, pix; parcelado vira compra parcelada) e **lançamento por frase** com tela de confirmação.

## Estrutura do código
- `src/lib/finance/types.ts`: formas dos dados (já no formato que irá para o banco).
- `calc.ts`: **toda a regra**, pura e testada (`src/test/finance.test.ts`): fatura em que uma compra cai (fechamento/vencimento), parcelas pagas/restantes/término, projeção, categorias, alertas, "por que aumentou", saldos e limites.
- `parse.ts`: interpreta frases ("Hoje comprei um livro de R$ 30 no débito pelo Nubank") e devolve um `Draft` + o que faltou. **É por regras, não IA**: para ligar o assistente, basta trocar `parseNatural` por uma chamada que devolva o mesmo `Draft`; a tela de confirmação não muda.
- `mock.ts`: dados de exemplo sempre relativos a "hoje".
- `repo.ts`: interface `FinanceRepo` (`load/save/reset`) e a implementação local (`localStorage`, chave `presence.financeiro.v1`). `store.tsx` usa só essa interface.

## Realizado × previsto
O painel separa **o que já aconteceu até hoje** do que ainda vai acontecer no mês (salário do dia 30 só conta no dia 30). Os indicadores mostram o realizado e, embaixo, "a receber" e "a pagar"; "Resultado até hoje" mostra também o previsto do fim do mês. O bloco **"Para onde vai o seu saldo"** (`cashflow` em `calc.ts`) projeta os próximos 60 dias: entradas e fixas pagas em conta que ainda vão acontecer e o vencimento de cada fatura, com o saldo depois de cada item, e avisa quando fica negativo. Compras no crédito, parcelas e fixas no cartão não entram à parte: já estão dentro da fatura. O saldo da conta também acompanha salário e fixas quando o dia passa (depois da data do saldo informado).

## Regras que valem saber
- Fatura de uma compra no crédito: compras até o dia de fechamento entram na fatura que vence no próximo vencimento depois do fechamento (`invoiceMonthOf`).
- Parcela conta como paga depois do dia de vencimento, ou pelo número informado ("já paguei N"). A última parcela absorve os centavos.
- Despesas do mês: compras na data da compra, parcelas no mês de vencimento, fixas todo mês.
- Saldo da conta = saldo informado no briefing ± movimentações feitas depois dele (crédito não mexe no saldo). Limite livre = limite livre informado − gastos no crédito depois dele.

## Backend (Supabase)
**Tabelas** (schema `presence_app`, migração `20261122000100_presence_app_financeiro.sql`): `fin_settings`, `fin_accounts`, `fin_cards`, `fin_plans`, `fin_recurring`, `fin_transactions`, `fin_goals`. Chave `(user_id, id)`, com `id` em texto (o mesmo do app, ex.: `card-nubank`). Valores em `numeric(14,2)`, datas em `date`, meses em `aaaa-mm`. `adjustments` (cartão) e `pauses` (fixas) são `jsonb`. **RLS só para logados, sem política nem permissão para `anon`** (dado sensível); cada pessoa vê só o que é seu (`owner_id()`). Não há chaves estrangeiras entre elas: o app já cuida da consistência (apagar um cartão tira as parcelas dele).

**Camadas**
- `db-map.ts` (puro, testado): `toRows`/`fromRows` e `diffRows` (só o que mudou vai para a rede).
- `cloud-repo.ts`: `CloudFinanceRepo` (`load/save/reset` + `status`/`subscribe`). Ao abrir lê tudo (paginado); grava em ordem, uma gravação por vez; se falhar guarda cópia no navegador e mostra "Não consegui salvar".
- **Migração automática**: se a nuvem está vazia e o navegador tem dados, sobem uma vez; a cópia local vira `presence.financeiro.v1.migrado` (reserva, nunca apagada sozinha).
- `store.tsx` expõe `sync` (`saving | saved | local | error`) e recarrega ao voltar para o app (traz o que foi lançado em outro aparelho).
- Indicador no topo do Financeiro (`SyncDot`): "Salvo na nuvem", "Salvando…", "Só neste aparelho · entre na conta" ou erro.

**Fatura com total do banco** (`Card.declared`, coluna `fin_cards.declared`): por mês de vencimento, a pessoa informa o total que o banco mostra. As compras e parcelas cadastradas abatem desse total e o que falta aparece como "Outros valores (ainda não detalhados)" (`Invoice.adjustment`); o total não muda ao detalhar, então não duplica. Se os itens passarem do total informado, `Invoice.over` avisa. `adjustments` (soma fixa) é o formato antigo: `migrateInvoiceTotals` converte para `declared` ao abrir, mantendo o total que já aparecia. Na tela do cartão, a aba "Faturas" navega mês a mês.

**Sobra de caixa** (`monthClose` / `cashBreakdown` em `calc.ts`): saldo de hoje + o que ainda entra no mês − contas que saem da conta − faturas abertas dos cartões (compras e parcelas no crédito já estão dentro das faturas). A bola da visão geral abre o detalhamento (`MonthBreakdown.tsx`, vindo do Lovable e adaptado para essa conta); a função `monthBreakdown` (resultado por competência, sem faturas) segue disponível, mas a tela usa a de caixa. Faturas são mostradas pelo **mês de fechamento** (`closingYmOf`); internamente continuam indexadas pelo mês de vencimento. Sem tabelas novas: tudo é calculado a partir dos dados já na nuvem.

**Próximos meses** (aba `meses`, `Months.tsx`, `monthPlan` em `calc.ts`): projeção de 6, 12 ou 18 meses a partir do saldo de hoje: entradas (salário e outras fixas), contas fixas e assinaturas pagas em conta, avulsos futuros e as faturas dos cartões **no mês em que vencem**; compras, parcelas e assinaturas no cartão aparecem dentro de cada fatura (e somam em "parcelas nas faturas" e "assinaturas no total" sem duplicar). Mês atual: só o que ainda falta. O saldo acumulado bate com `cashflow`. Pela voz: ferramenta `financeiro`, ação `meses`.

**Voz** (`src/lib/voice/finance-tool.ts`, ferramenta `financeiro`): `resumo`, `categorias`, `saldo`, `fatura`, `parcelas`, `assinaturas`, `ultimos` e `lancar` (frase → `parseNatural` → grava em `fin_transactions`; só grava se entendeu valor, forma de pagamento e conta/cartão; parcelado não). Usa `calc.ts` no servidor, então os números são os mesmos da tela.

**Próximo**: Open Finance (agregador) alimentando `fin_transactions`, com o mesmo `id` estável por lançamento do banco para não duplicar.
