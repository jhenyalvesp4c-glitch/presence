/** Ferramenta de voz "financeiro": responde com os números reais do financeiro (nuvem) e lança gastos por frase. */
import { addMonths, alertsFor, brl, cashBreakdown, cashflow, categoryTotals, dateBR, dueYmOfClosing, invoiceFor, invoiceLabel, isPaused, isSubscription, monthEntries, monthName, monthClose, monthPlan, monthSummary, nextCharge, openInvoice, planInfo, recurringActiveIn, round2, sum, totalBalance, accountBalance, isoOf, ymOf } from "../finance/calc";
import { closingYmOf, dayIn, dueDateOf, invoiceMonthOf, monthsBetween, payDateOf, simulatePurchase } from "../finance/calc";
import { cloudFinanceRepo, persistChange } from "../finance/cloud-repo";
import { READ_ACTIONS_V2, WRITE_ACTIONS, applyWrite, readMore, shareProp } from "./finance-write";
import { catOf } from "../finance/categories";
import { parseNatural } from "../finance/parse";
import { supabase } from "../supabase";
import type { FinanceState } from "../finance/types";
import type { Panel, PanelItem } from "./agent";

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LINK = { rotulo: "Abrir o Financeiro", para: "/financeiro" };
/** Quanto cada pessoa deve numa fatura (gastos divididos). */
const owedBy = (lines: { shared?: { person: string; part: number } | undefined }[]): { pessoa: string; valor: number }[] => {
  const m = new Map<string, number>();
  for (const l of lines) if (l.shared) m.set(l.shared.person, round2((m.get(l.shared.person) ?? 0) + l.shared.part));
  return [...m].map(([pessoa, valor]) => ({ pessoa, valor }));
};
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
    const close = monthClose(s, today), m = monthSummary(s, ym, todayIso), saldo = totalBalance(s, today), cf = cashflow(s, today, 60);
    const faturas = sum(s.cards.map((c) => openInvoice(s, c, today).total)), faturasMinha = sum(s.cards.map((c) => openInvoice(s, c, today).mine));
    const alertas = alertsFor(s, today).slice(0, 3);
    return { result: { ok: true, mes: monthName(ym), saldo_hoje: saldo, entrou: m.receitas, saiu: m.despesas, a_receber_ate_fim_do_mes: m.aReceber, a_pagar_ate_fim_do_mes: m.aPagar, sobra_de_caixa_depois_de_pagar_as_faturas: close.sobra, faturas_abertas: faturas, faturas_abertas_so_minha_parte: faturasMinha, menor_saldo_nos_proximos_60_dias: cf.min, fica_negativo: cf.firstNegative ? { quando: dateBR(cf.firstNegative.date), motivo: cf.firstNegative.label } : null, alertas: alertas.map((a) => a.title), dica: "Fale poucos números: saldo, o que saiu e a sobra (ou falta) de caixa depois de pagar as faturas; nunca chame de sobra o resultado do mês sem as faturas. Se o saldo ficar negativo, avise quando." },
      panel: panel(`Resumo · ${monthName(ym)}`, [{ titulo: "Agora", itens: [item("Saldo nas contas", brl(saldo)), item("Entrou no mês", brl(m.receitas)), item("Saiu no mês", brl(m.despesas)), item("Ainda a pagar no mês", brl(m.aPagar)), item("Faturas abertas", brl(faturas))] }, ...(alertas.length ? [{ titulo: "Atenção", itens: alertas.map((a) => item(a.title, a.detail)) }] : [])]) };
  }

  if (acao === "detalhe") {
    const b = cashBreakdown(s, today), c = monthClose(s, today);
    return { result: { ok: true, resultado: c.sobra, situacao: c.sobra >= 0 ? "sobra" : "falta", tem_na_conta: c.saldo, ainda_entra: c.aReceber, ainda_sai: b.expenses, onde_vai: b.groups.map((g) => ({ grupo: g.label, valor: g.total })), maiores: b.biggest.map((e) => ({ item: e.desc, valor: e.amount })), dica: "Explique em 2 ou 3 frases: o que tem, o que entra, o que mais pesa (normalmente as faturas) e quanto falta ou sobra." },
      panel: panel(c.sobra >= 0 ? "Por que sobra" : "Por que falta", [{ titulo: "A conta", itens: [item("Tem hoje", brl(c.saldo)), item("Ainda entra", brl(c.aReceber)), ...b.groups.map((g) => item(g.label, `− ${brl(g.total)}`)), item(c.sobra >= 0 ? "Sobra" : "Falta", brl(Math.abs(c.sobra)))] }]) };
  }

  /** "Quanto preciso pegar (Pix no crédito) para fechar o mês, e como fica a fatura?" — a conta de caixa de sempre (salário, contas, faturas), sem gravar nada. */
  if (acao === "cobrir_falta") {
    const q = String(args["cartao"] ?? "nubank").trim(), cards = find(s.cards, q);
    if (!cards.length) return { result: { ok: false, erro: `Não achei o cartão "${q}".`, cartoes: s.cards.map((c) => c.name) } };
    if (cards.length > 1) return { result: { ok: false, erro: "Em qual cartão seria o Pix no crédito?", cartoes: cards.map((c) => c.name) } };
    const card = cards[0]!;
    const toEnd = Math.max(7, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1);
    const dias = Math.min(120, Math.max(7, Math.round(Number(args["dias"]) || toEnd)));
    const cf = cashflow(s, today, dias), folga = Math.max(0, Number(args["folga"]) || 0), taxa = Math.max(0, Number(args["taxa_percent"]) || 0) / 100;
    const falta = round2(Math.max(0, -cf.min)), preciso = round2(falta + (falta > 0 || folga > 0 ? folga : 0));
    // Pix no crédito costuma vir em múltiplos redondos: arredonda para cima de R$ 10 em R$ 10
    const pegar = preciso > 0 ? Math.ceil(preciso / 10) * 10 : 0, n = Math.max(1, Math.round(Number(args["parcelas_total"]) || 1));
    const mp = monthPlan(s, today, 2)[0]!;
    const peso = mp.items.filter((x) => x.group === "faturas" || x.group === "fixas" || x.group === "avulsas").sort((a, b) => b.amount - a.amount).slice(0, 6).map((x) => ({ item: x.label, valor: x.amount, data: dateBR(x.date) }));
    const faturasMinhaParte = round2(mp.items.filter((x) => x.group === "faturas" && x.cardId).reduce((n, x) => { const c = s.cards.find((k) => k.id === x.cardId); const m = /^fat:[^:]+:(\d{4}-\d{2})$/.exec(x.id); return n + (c && m ? invoiceFor(s, c, m[1]!).mine : x.amount); }, 0));
    const base = { tem_hoje: cf.start, faturas_so_minha_parte: faturasMinhaParte, ate: dateBR(cf.until), menor_saldo: cf.min, fica_negativo: cf.firstNegative ? { quando: dateBR(cf.firstNegative.date), por_causa_de: cf.firstNegative.label } : null, entradas_do_mes: mp.entradas, faturas_que_pagam_no_mes: mp.faturas, contas_e_fixas: round2(mp.fixas + mp.assinaturas + mp.avulsas), o_que_mais_pesa: peso };
    if (pegar <= 0) return { result: { ok: true, precisa_pegar: 0, ...base, dica: "Não precisa pegar nada: o saldo não fica negativo até essa data. Diga quanto sobra (menor_saldo) em uma frase." } };
    // o Pix cai na fatura aberta do cartão (a que fecha logo): o crédito vira compra nela; se for taxa, o valor lançado é maior que o que entra
    const dueYm = invoiceMonthOf(card, isoOf(today)), closeYm = closingYmOf(card, dueYm), lancado = round2(pegar * (1 + taxa));
    const sim = simulatePurchase(s, today, { cardId: card.id, amount: lancado, closeYm, parcelas: n, desc: "Pix no crédito" }, Math.max(6, n + 3));
    if (!sim) return { result: { ok: false, erro: "Não consegui simular o Pix no crédito." } };
    // o dinheiro do Pix entra na conta hoje: soma ao saldo "depois" (a simulação só conta a compra no cartão)
    const meses = sim.rows.slice(0, Math.max(3, Math.min(6, n + 1))).map((r) => ({ mes: monthName(r.ym), fatura_que_sai: { antes: r.fatura, depois: r.faturaDepois }, saldo_no_fim: { sem_o_pix: r.saldoFim, com_o_pix: round2(r.saldoFimDepois + pegar) } }));
    const result = { ok: true, precisa_pegar: pegar, falta_exata: falta, ...(folga ? { folga } : {}), ...base, cartao: card.name, parcelas: n, por_parcela: sim.porParcela, ...(taxa ? { taxa_percent: round2(taxa * 100), valor_lancado_no_cartao: lancado } : { aviso_taxas: "Sem juros nem IOF na conta: o Pix no crédito costuma ter taxa. Peça para ela olhar o total que o Nubank mostra antes de confirmar, ou dizer a taxa para recalcular." }),
      fatura_que_recebe: { fecha_em: dateBR(dayIn(closeYm, card.closingDay)), vence_em: dateBR(dueDateOf(card, dueYm)), voce_paga_em: dateBR(sim.pagaEm), antes: sim.faturaAntes, depois: sim.faturaDepois }, meses,
      dica: "Responda em poucas frases: quanto falta, quanto pegar de Pix no crédito, e como fica a fatura (antes e depois) e o saldo do fim do mês com o Pix. Avise das taxas se não foram consideradas." };
    return { result, panel: panel(`Pix no crédito: pegar ${brl(pegar)}`, [
      { titulo: "A conta do mês", itens: [item("Você tem hoje", brl(cf.start)), item("Entra até lá", brl(mp.entradas)), item("Sai (faturas, contas e fixas)", brl(round2(mp.faturas + mp.fixas + mp.assinaturas + mp.avulsas))), item("Menor saldo no período", brl(cf.min), cf.firstNegative ? `fica negativo em ${dateBR(cf.firstNegative.date)}` : undefined)] },
      { titulo: `Pegar no ${card.name}`, itens: [item("Valor do Pix no crédito", brl(pegar), n > 1 ? `${n}x de ${brl(sim.porParcela)}` : "paga na próxima fatura"), item("Fatura sem o Pix", brl(sim.faturaAntes)), item("Fatura com o Pix", brl(sim.faturaDepois), `você paga em ${dateBR(sim.pagaEm)}`)] },
      ...meses.map((m) => ({ titulo: m.mes, itens: [item("Fatura que sai", `${brl(m.fatura_que_sai.antes)} → ${brl(m.fatura_que_sai.depois)}`), item("Saldo no fim do mês", `${brl(m.saldo_no_fim.sem_o_pix)} → ${brl(m.saldo_no_fim.com_o_pix)}`)] })),
    ]) };
  }

  if (acao === "simular") {
    const valor = Number(args["valor"]), q = String(args["cartao"] ?? "").trim(), cards = q ? find(s.cards, q) : s.cards;
    if (!(valor > 0)) return { result: { ok: false, erro: "Qual é o valor da compra?" } };
    if (!cards.length) return { result: { ok: false, erro: q ? `Não achei o cartão "${q}".` : "Nenhum cartão cadastrado.", cartoes: s.cards.map((c) => c.name) } };
    if (cards.length > 1) return { result: { ok: false, erro: "Em qual cartão seria a compra?", cartoes: cards.map((c) => c.name) } };
    // "janeiro" dito agora, em novembro, é o próximo janeiro; mês pedido é o do FECHAMENTO da fatura
    let closeYm = resolveMonth(args["mes"], today);
    if (closeYm < ymOf(today) && !/\d{4}/.test(String(args["mes"] ?? ""))) closeYm = addMonths(closeYm, 12);
    const n = Math.max(1, Math.round(Number(args["parcelas_total"]) || 1)), card = cards[0]!, dueYm = dueYmOfClosing(card, closeYm);
    const span = Math.max(8, Math.min(30, monthsBetween(ymOf(today), ymOf(payDateOf(card, dueYm))) + n + 2));
    const sim = simulatePurchase(s, today, { cardId: card.id, amount: valor, closeYm, parcelas: n, desc: String(args["descricao"] ?? "") || "Compra simulada" }, span);
    if (!sim) return { result: { ok: false, erro: "Não consegui simular essa compra." } };
    const payYm = ymOf(sim.pagaEm), rows = sim.rows.filter((r) => r.ym >= payYm).slice(0, Math.max(2, Math.min(6, n)));
    const entradas = s.recurring.filter((r) => r.kind === "receita").map((r) => ({ descricao: r.desc, valor: r.amount, dia: r.day }));
    const meses = rows.map((r) => ({ mes: monthName(r.ym), fatura_que_sai_nesse_mes: { antes: r.fatura, depois: r.faturaDepois }, sobra_do_mes: { antes: r.sobra, depois: r.sobraDepois }, saldo_no_fim_do_mes: { antes: r.saldoFim, depois: r.saldoFimDepois } }));
    return { result: { ok: true, compra: { valor, parcelas: n, por_parcela: sim.porParcela, cartao: card.name }, fatura_que_fecha_em: monthName(closeYm), fecha_em: dateBR(dayIn(closeYm, card.closingDay)), vence_em: dateBR(dueDateOf(card, dueYm)), voce_paga_em: dateBR(sim.pagaEm), paga_no: card.payAfterClose === undefined ? "vencimento" : "fechamento", fatura_antes: sim.faturaAntes, fatura_depois: sim.faturaDepois, meses, entradas_fixas: entradas, fica_negativo: sim.primeiroNegativo ? { mes: monthName(sim.primeiroNegativo.ym), saldo: sim.primeiroNegativo.saldo } : null, dica: "Diga em 2 ou 3 frases: a fatura daquele mês (antes e depois), quanto sobra do dinheiro daquele mês e o saldo no fim; avise se o saldo fica negativo. Nada foi gravado: é só uma simulação. Se o cartão paga no vencimento e ela costuma pagar no fechamento, ofereça mudar (editar o cartão com pagamento=fechamento)." },
      panel: panel(`E se eu comprar ${brl(valor)}${n > 1 ? ` em ${n}x` : ""}?`, [{ titulo: `${card.name} · você paga ${dateBR(sim.pagaEm)}`, itens: [item("Fatura sem a compra", brl(sim.faturaAntes)), item("Fatura com a compra", brl(sim.faturaDepois))] }, ...rows.map((r) => ({ titulo: monthName(r.ym), itens: [item("Faturas que saem", `${brl(r.fatura)} → ${brl(r.faturaDepois)}`), item(r.sobraDepois >= 0 ? "Sobra do mês" : "Falta no mês", `${brl(r.sobra)} → ${brl(r.sobraDepois)}`), item("Saldo no fim", `${brl(r.saldoFim)} → ${brl(r.saldoFimDepois)}`)] }))], "/financeiro?aba=meses") };
  }

  if (acao === "meses") {
    const n = Math.min(12, Math.max(1, Number(args["quantidade"]) || 6)), plan = monthPlan(s, today, n);
    return { result: { ok: true, meses: plan.map((m) => ({ mes: monthName(m.ym), entra: m.entradas, sai: m.saidas, resultado: m.resultado, faturas: m.faturas, parcelas_nas_faturas: m.parcelas, assinaturas: round2(m.assinaturas + m.assinaturasCartao), saldo_no_fim: m.saldoFinal })), dica: "Resuma em poucas frases: os meses que sobram, os que faltam e quando o saldo fica negativo. Faturas contam no mês em que vencem." },
      panel: panel(`Próximos ${n} meses`, [{ titulo: "Sobra ou falta por mês", itens: plan.map((m) => item(monthName(m.ym), `${m.resultado >= 0 ? "sobra" : "falta"} ${brl(Math.abs(m.resultado))} · saldo ${brl(m.saldoFinal)}`)) }], "/financeiro?aba=meses") };
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
    const byMonth = !!String(args["mes"] ?? "").trim();
    // "minha parte" = o total do banco menos o que é da outra pessoa nos gastos divididos (o total do banco não muda)
    const inv = cards.map((c) => { const i = byMonth ? invoiceFor(s, c, dueYmOfClosing(c, ym)) : openInvoice(s, c, today); return { cartao: c.name, total: i.total, minha_parte: i.mine, parte_dos_outros: i.othersOwe, quem_deve: owedBy(i.lines), periodo: invoiceLabel(c, i.ym), vence: dateBR(i.due), maiores: [...i.lines].sort((a, b) => b.amount - a.amount).slice(0, 3).map((l) => `${l.desc} ${brl(l.amount)}${l.shared ? ` (sua parte ${brl(round2(l.amount - l.shared.part))}, ${l.shared.person} ${brl(l.shared.part)})` : ""}`) }; });
    const tot = round2(inv.reduce((n, i) => n + i.total, 0)), minha = round2(inv.reduce((n, i) => n + i.minha_parte, 0));
    return { result: { ok: true, faturas: inv, total_todas: tot, minha_parte_todas: minha, parte_dos_outros_todas: round2(tot - minha), dica: "Se ela pedir 'só a minha parte', use minha_parte (total do banco menos a parte das outras pessoas nos gastos divididos). Diga os dois valores quando houver divisão." }, panel: panel("Faturas abertas", inv.map((i) => ({ titulo: i.cartao, itens: [item(brl(i.total), `${i.periodo}`), ...(i.parte_dos_outros > 0 ? [item(`Só a sua parte: ${brl(i.minha_parte)}`, `${i.quem_deve.map((q) => `${q.pessoa} ${brl(q.valor)}`).join(" · ")}`)] : []), ...i.maiores.map((m) => item(m))] })), "/financeiro?aba=contas") };
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
export async function launch(s: FinanceState, frase: string, today: Date, args: Record<string, unknown> = {}): Promise<{ result: Record<string, unknown>; panel?: Panel }> {
  const d = parseNatural(frase, s, today);
  if (d.installments > 1) return { result: { ok: false, erro: "Compra parcelada eu não lanço por voz. Peça para ela cadastrar na aba Parcelas do Financeiro." } };
  if (d.missing.length) return { result: { ok: false, erro: `Faltou: ${d.missing.join(", ")}.`, perguntar: d.missing[0], contas: s.accounts.map((a) => a.name), cartoes: s.cards.map((c) => c.name) } };
  const id = `tx-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const { error } = await supabase.from("fin_transactions").insert({ id, kind: d.kind, description: d.desc, amount: round2(d.amount), date: d.date, method: d.method, account_id: d.accountId ?? null, card_id: d.cardId ?? null, category: d.category, shared: d.kind === "despesa" ? (shareProp(args).shared ?? null) : null });
  if (error) return { result: { ok: false, erro: "Não consegui salvar o lançamento." } };
  const onde = d.cardId ? s.cards.find((c) => c.id === d.cardId)?.name : s.accounts.find((a) => a.id === d.accountId)?.name;
  return { result: { ok: true, lancado: { tipo: d.kind, descricao: d.desc, valor: d.amount, data: dateBR(d.date), em: onde ?? "dinheiro", categoria: catOf(d.category).name } }, panel: panel("Lançado", [{ titulo: d.kind === "receita" ? "Receita" : "Despesa", itens: [item(d.desc, `${brl(d.amount)} · ${dateBR(d.date)} · ${onde ?? "dinheiro"}`)] }], "/financeiro?aba=movimentacoes") };
}

export async function runFinanceTool(args: Record<string, unknown>): Promise<{ result: Record<string, unknown>; panel?: Panel; navegar?: string; mudou?: boolean }> {
  const today = new Date();
  const s = await cloudFinanceRepo.readCloud();
  if (!s || !s.onboarded && !s.accounts.length) return { result: { ok: false, erro: "O financeiro ainda não tem dados na nuvem. Peça para ela abrir o Financeiro e responder ao briefing." } };
  const acao = String(args["acao"]);
  if (acao === "lancar") return launch(s, String(args["frase"] ?? ""), today, args);
  if (READ_ACTIONS_V2.has(acao)) return readMore(s, args, today);
  if (WRITE_ACTIONS.has(acao)) {
    const out = applyWrite(s, args, today);
    if (!out.state) return out;
    try { await persistChange(s, out.state); } catch { return { result: { ok: false, erro: "Não consegui salvar a alteração. Nada foi mudado." } }; }
    return { ...out, mudou: true };
  }
  return answer(s, args, today);
}
