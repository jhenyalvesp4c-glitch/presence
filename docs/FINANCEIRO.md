# Módulo financeiro (frontend)

Rota `/financeiro` (`src/routes/financeiro.tsx`). Etapa 1: **só frontend**, com dados fictícios e gravação local. O backend (Supabase) entra na etapa 2 sem mexer nas telas.

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

## Regras que valem saber
- Fatura de uma compra no crédito: compras até o dia de fechamento entram na fatura que vence no próximo vencimento depois do fechamento (`invoiceMonthOf`).
- Parcela conta como paga depois do dia de vencimento, ou pelo número informado ("já paguei N"). A última parcela absorve os centavos.
- Despesas do mês: compras na data da compra, parcelas no mês de vencimento, fixas todo mês.
- Saldo da conta = saldo informado no briefing ± movimentações feitas depois dele (crédito não mexe no saldo). Limite livre = limite livre informado − gastos no crédito depois dele.

## Ligar ao Supabase (etapa 2)
Criar tabelas no schema `presence_app`, todas com `user_id uuid default presence_app.owner_id()` e RLS por dono (sem política para `anon`): `fin_accounts`, `fin_cards`, `fin_transactions`, `fin_plans`, `fin_recurring`, `fin_goals` e `fin_settings` (onboarded). Implementar `SupabaseFinanceRepo implements FinanceRepo` e trocar o `financeRepo` exportado em `repo.ts`. A ferramenta de voz poderá reutilizar `parse.ts`/`calc.ts` no servidor.
