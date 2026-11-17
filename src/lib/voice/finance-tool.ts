/** Ferramenta de voz "financeiro": responde com os números reais do financeiro (nuvem) e lança gastos por frase. */
import { addMonths, alertsFor, brl, cashflow, categoryTotals, dateBR, invoiceLabel, isPaused, isSubscription, monthEntries, monthName, monthSummary, nextCharge, openInvoice, planInfo, recurringActiveIn, round2, sum, totalBalance, accountBalance, isoOf, ymOf } from "../finance/calc";
import { cloudFinanceRepo } from "../finance/cloud-repo";
import { catOf } from "../finance/categories";
import { parseNatural } from "../finance/parse";
import { supabase } from "../supabase";
import type { FinanceState } from "../finance/types";
import type { Panel, PanelItem } from "./agent";

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LINK = { rotulo: "Abrir o Financeiro", para: "/financeiro" };
const item = (rotulo: string, detalhe?: string, link?: string): PanelItem => ({ rotulo, ...(detalhe ? { detalhe } : {}), ...(link ? { link } : {}) });
const panel = (titulo: string, secoes: Panel["secoes"], link = "/financeiro"): Panel => ({ titulo, secoes, abrir: { ...LINK, para: link } });

/** "dezembro", "mês passado", "2026-12" → "aaaa-mm". Vazio = mês atual. */
export function resolveMonth(q: unknown, today: Date): string {
  const cur = ymOf(today), t = strip(String(q ?? "")).trim();
  if (!t || /\b(este|esse|atual)\b/.test(t)) return cur;
  if (/^\d{4}-\d{2}$/.test(t)) return t;
  if (/passado|anterior/.test(t)) return addMonths(cur, -1);
  if (/proximo|que vem/.test(t)) return addMonths(cur, 1);
  const names = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const i = names.findIndex((n) => t.includes(n));
  if (i < 0) return cur;
  const y = today.getFullYear(), ym = `${y}-${String(i + 1).padStart(2, "0")}`;
  return ym;
}

const find = <T extends { name: string }>(list: T[], q: string): T[] => { const t = strip(q); return t ? list.filter((x) => strip(x.name).includes(t) || t.includes(strip(x.name))) : []; };

export function answer(s: FinanceState, args: Record<string, unknown>, today: Date): { result: Record<string, unknown>; panel?: Panel } {
  const acao = String(args["acao"] ?? "resumo"), ym = resolveMonth(args["mes"], today), todayIso = isoOf(today);

  if (acao === "resumo") {
    const m = monthSummary(s, ym, todayIso), saldo = totalBalance(s, today), cf = cashflow(s, today, 60);
    const faturas = sum(s.cards.map((c) => openInvoice(s, c, today).total));
    const alertas = alertsFor(s, today).slice(0, 3);
    return { result: { ok: true, mes: monthName(ym), saldo_hoje: saldo, entrou: m.receitas, saiu: m.despesas, a_receber_ate_fim_do_mes: m.aReceber, a_pagar_ate_fim_do_mes: m.aPagar, resultado_previsto_do_mes: m.resultado, faturas_abertas: faturas, menor_saldo_nos_proximos_60_dias: cf.min, fica_negativo: cf.firstNegative ? { quando: dateBR(cf.firstNegative.date), motivo: cf.firstNegative.label } : null, alertas: alertas.map((a) => a.title), dica: "Fale poucos números: saldo, o que saiu e o que ainda vai pagar. Se o saldo ficar negativo, avise quando." },
      panel: panel(`Resumo · ${monthName(ym)}`, [{ titulo: "Agora", itens: [item("Saldo nas contas", brl(saldo)), item("Entrou no mês", brl(m.receitas)), item("Saiu no mês", brl(m.despesas)), item("Ainda a pagar no mês", brl(m.aPagar)), item("Faturas abertas", brl(faturas))] }, ...(alertas.length ? [{ titulo: "Atenção", itens: alertas.map((a) => item(a.title, a.detail)) }] : [])]) };
  }

  if (acao === "categorias") {
    const cats = categoryTotals(s, ym, ym === ymOf(today) ? todayIso : undefined).filter((c) => c.value > 0).slice(0, 8);
    return { result: { ok: true, mes: monthName(ym), categorias: cats.map((c) => ({ categoria: c.name, valor: c.value, percentual: Math.round(c.pct), mes_anterior: c.prev })) },
      panel: panel(`Gastos por categoria · ${monthName(ym)}`, [{ titulo: "Onde foi o dinheiro", itens: cats.length ? cats.map((c) => item(c.name, `${brl(c.value)} · ${Math.round(c.pct)}%`)) : [item("Sem gastos neste mês.")] }]) };
  }

  if (acao === "saldo") {
    const q = String(args["conta"] ?? "").trim(), accs = q ? find(s.accounts, q) : s.accounts;
    if (q && !accs.length) return { result: { ok: false, erro: `Não achei a conta "${q}".`, contas: s.accounts.map((a) => a.name) } };
    const rows = accs.map((a) => ({ conta: a.name, saldo: accountBalance(s, a, today) }));
    return { result: { ok: true, contas: rows, total: sum(rows.map((r) => r.saldo)) }, panel: panel("Saldos", [{ titulo: "Contas", itens: rows.map((r) => item(r.conta, brl(r.saldo))) }], "/financeiro?aba=contas") };
  }

  if (acao === "fatura") {
    const q = String(args["cartao"] ?? "").trim(), cards = q ? find(s.cards, q) : s.cards;
    if (q && !cards.length) return { result: { ok: false, erro: `Não achei o cartão "${q}".`, cartoes: s.cards.map((c) => c.name) } };
    const inv = cards.map((c) => { const i = openInvoice(s, c, today); return { cartao: c.name, total: i.total, periodo: invoiceLabel(c, i.ym), vence: dateBR(i.due), maiores: [...i.lines].sort((a, b) => b.amount - a.amount).slice(0, 3).map((l) => `${l.desc} ${brl(l.amount)}`) }; });
    return { result: { ok: true, faturas: inv }, panel: panel("Faturas abertas", inv.map((i) => ({ titulo: i.cartao, itens: [item(brl(i.total), `${i.periodo}`), ...i.maiores.map((m) => item(m))] })), "/financeiro?aba=contas") };
  }

  if (acao === "parcelas") {
    const infos = s.plans.map((p) => ({ p, i: planInfo(p, s.cards.find((c) => c.id === p.cardId), today) })).filter((x) => x.i.remaining > 0);
    const falta = sum(infos.map((x) => x.i.remainingAmount));
    return { result: { ok: true, ainda_falta_pagar: falta, compras: infos.map((x) => ({ compra: x.p.desc, parcela: x.p.per, faltam: x.i.remaining })) }, panel: panel("Compras parceladas", [{ titulo: `Ainda falta pagar ${brl(falta)}`, itens: infos.map((x) => item(x.p.desc, `${x.i.remaining} parcelas de ${brl(x.p.per)}`)) }], "/financeiro?aba=parcelas") };
  }

  if (acao === "assinaturas") {
    const subs = s.recurring.filter(isSubscription), ativas = subs.filter((r) => !isPaused(r) && recurringActiveIn(r, ymOf(today)));
    const mensal = sum(ativas.map((r) => r.amount));
    return { result: { ok: true, total_mensal: mensal, ativas: ativas.map((r) => ({ nome: r.desc, valor: r.amount })), pausadas: subs.filter(isPaused).map((r) => r.desc) }, panel: panel("Assinaturas", [{ titulo: `Ativas · ${brl(mensal)} por mês`, itens: ativas.map((r) => item(r.desc, `${brl(r.amount)} · próxima ${nextCharge(r, today) ? dateBR(nextCharge(r, today)!) : "—"}`)) }, ...(subs.some(isPaused) ? [{ titulo: "Pausadas", itens: subs.filter(isPaused).map((r) => item(r.desc, brl(r.amount))) }] : [])], "/financeiro?aba=assinaturas") };
  }

  if (acao === "ultimos") {
    const q = strip(String(args["busca"] ?? "")), n = Math.min(15, Math.max(1, Number(args["quantidade"]) || 8));
    const es = monthEntries(s, ym, ym === ymOf(today) ? todayIso : undefined).filter((e) => !q || strip(e.desc).includes(q) || strip(catOf(e.category).name).includes(q)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
    return { result: { ok: true, mes: monthName(ym), movimentacoes: es.map((e) => ({ data: dateBR(e.date), descricao: e.desc, valor: e.amount, tipo: e.kind, categoria: catOf(e.category).name })) }, panel: panel(`Últimas movimentações${q ? ` · "${q}"` : ""}`, [{ titulo: monthName(ym), itens: es.length ? es.map((e) => item(e.desc, `${dateBR(e.date)} · ${e.kind === "receita" ? "+" : "−"}${brl(e.amount)}`)) : [item("Nada encontrado.")] }], "/financeiro?aba=movimentacoes") };
  }

  return { result: { ok: false, erro: "Ação desconhecida." } };
}

/** Lança uma despesa/receita dita em uma frase. Só grava quando entendeu valor, forma de pagamento e conta/cartão. */
export async function launch(s: FinanceState, frase: string, today: Date): Promise<{ result: Record<string, unknown>; panel?: Panel }> {
  const d = parseNatural(frase, s, today);
  if (d.installments > 1) return { result: { ok: false, erro: "Compra parcelada eu não lanço por voz. Peça para ela cadastrar na aba Parcelas do Financeiro." } };
  if (d.missing.length) return { result: { ok: false, erro: `Faltou: ${d.missing.join(", ")}.`, perguntar: d.missing[0], contas: s.accounts.map((a) => a.name), cartoes: s.cards.map((c) => c.name) } };
  const id = `tx-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.from("fin_transactions").insert({ id, kind: d.kind, description: d.desc, amount: round2(d.amount), date: d.date, method: d.method, account_id: d.accountId ?? null, card_id: d.cardId ?? null, category: d.category });
  if (error) return { result: { ok: false, erro: "Não consegui salvar o lançamento." } };
  const onde = d.cardId ? s.cards.find((c) => c.id === d.cardId)?.name : s.accounts.find((a) => a.id === d.accountId)?.name;
  return { result: { ok: true, lancado: { tipo: d.kind, descricao: d.desc, valor: d.amount, data: dateBR(d.date), em: onde ?? "dinheiro", categoria: catOf(d.category).name } }, panel: panel("Lançado", [{ titulo: d.kind === "receita" ? "Receita" : "Despesa", itens: [item(d.desc, `${brl(d.amount)} · ${dateBR(d.date)} · ${onde ?? "dinheiro"}`)] }], "/financeiro?aba=movimentacoes") };
}

export async function runFinanceTool(args: Record<string, unknown>): Promise<{ result: Record<string, unknown>; panel?: Panel }> {
  const today = new Date();
  const s = await cloudFinanceRepo.readCloud();
  if (!s || !s.onboarded && !s.accounts.length) return { result: { ok: false, erro: "O financeiro ainda não tem dados na nuvem. Peça para ela abrir o Financeiro e responder ao briefing." } };
  if (String(args["acao"]) === "lancar") return launch(s, String(args["frase"] ?? ""), today);
  return answer(s, args, today);
}
