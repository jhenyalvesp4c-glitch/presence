/** Tipos do módulo financeiro. Tudo é local por enquanto; a forma dos dados já é a que irá para o Supabase. */
export type AccountKind = "banco" | "carteira" | "dinheiro" | "investimento";
export type CardBrand = "visa" | "mastercard" | "elo" | "amex" | "outro";
export type Method = "debito" | "credito" | "dinheiro" | "pix";
export type TxKind = "despesa" | "receita";
export type GoalKind = "guardar" | "reserva" | "quitar_cartao" | "economizar_mensal" | "limite_categoria";

/** Paletas de cartão/conta (gradientes). */
export type Tone = "roxo" | "verde" | "azul" | "laranja" | "grafite" | "rosa" | "dourado" | "ciano";

export type Account = { id: string; name: string; kind: AccountKind; tone: Tone; balanceBase: number; baseDate: string };
export type Card = {
  id: string; name: string; brand: CardBrand; last4: string; tone: Tone;
  limit: number; availableBase: number; baseDate: string;
  closingDay: number; dueDay: number;
  /** Valores pendentes extras por fatura (mês de vencimento "aaaa-mm" → valor): fatura anterior em aberto, juros etc. */
  adjustments: Record<string, number>;
  /** Total da fatura como o banco mostra (mês de vencimento "aaaa-mm" → valor). Os itens cadastrados abatem desse total; o que falta aparece como "ainda não detalhado". */
  declared?: Record<string, number> | undefined;
};
export type Transaction = {
  id: string; kind: TxKind; desc: string; amount: number; date: string; method: Method;
  accountId?: string | undefined; cardId?: string | undefined; category: string;
};
/** Compra parcelada. A fatura de cada parcela é calculada a partir de `first` (mês de vencimento da 1ª parcela). */
export type Plan = {
  id: string; desc: string; cardId: string; total: number; count: number; per: number;
  purchaseYm: string; first: string; category: string;
  /** Se informado, vale no lugar do cálculo por datas ("já paguei N parcelas"). */
  paidManual?: number | undefined; createdAt: string;
};
/** Pausa de uma recorrente: não conta nos meses de `from` até `to` (inclusive). Sem `to` = continua pausada. */
export type RecurringPause = { from: string; to?: string | undefined };
export type Recurring = {
  id: string; kind: TxKind; desc: string; amount: number; day: number; category: string; method: Method; accountId?: string | undefined; cardId?: string | undefined; startYm: string;
  /** Marcada como assinatura (Netflix, Spotify, clubes…). Recorrentes da categoria "assinaturas" também contam. */
  subscription?: boolean | undefined;
  /** Períodos pausados: nesses meses a recorrente não aparece em movimentações, faturas, saldo nem projeções. */
  pauses?: RecurringPause[] | undefined;
};
export type Goal = {
  id: string; kind: GoalKind; title: string; target: number; current: number; deadline?: string | undefined;
  category?: string | undefined; cardId?: string | undefined; monthly?: number | undefined;
};

export type FinanceState = {
  version: 1; onboarded: boolean; mock: boolean;
  accounts: Account[]; cards: Card[]; plans: Plan[]; recurring: Recurring[]; transactions: Transaction[]; goals: Goal[];
};
export const EMPTY_STATE: FinanceState = { version: 1, onboarded: false, mock: false, accounts: [], cards: [], plans: [], recurring: [], transactions: [], goals: [] };

/** Um gasto ou ganho já "materializado" para um mês (compra, parcela ou recorrente). */
export type Entry = { id: string; kind: TxKind; desc: string; amount: number; date: string; category: string; method: Method; accountId?: string | undefined; cardId?: string | undefined; source: "tx" | "parcela" | "recorrente"; planId?: string | undefined; parcel?: string | undefined };
