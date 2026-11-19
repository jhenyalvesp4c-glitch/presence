/**
 * Financeiro por voz: o que o Orion ALTERA. Tudo aqui é puro (estado entra, estado novo sai), para testar sem rede.
 * Quem grava no banco é `finance-tool.ts`. Excluir sempre pede confirmação (`confirmado: true` só depois que a pessoa disser sim).
 */
import {
  addMonths, brl, cardAvailable, cardUsed, accountBalance, dateBR, dayIn, dueYmOfClosing, firstFromPaid, invoiceFor, invoiceMonthOf, isoOf, isSubscription, monthName, nextCharge,
  pauseRecurring, planForInvoice, planInfo, resumeRecurring, round2, sharedPart, subscriptionForInvoice, withDeclaredTotal, ymOf, closingYmOf,
} from "../finance/calc";
import { catOf, guessCategory } from "../finance/categories";
import type { Account, Card, FinanceState, Goal, Plan, Recurring, Shared, Transaction } from "../finance/types";
import { normalize } from "../orion";
import type { Panel, PanelItem } from "./agent";

export type Outcome = { state?: FinanceState; result: Record<string, unknown>; panel?: Panel; navegar?: string };
export const WRITE_ACTIONS = new Set(["pausar", "reativar", "fatura_total", "detalhar", "editar", "excluir", "cadastrar_parcelada", "cadastrar_fixa", "dividir"]);
export const READ_ACTIONS_V2 = new Set(["fixas", "parcela_detalhe", "metas", "abrir"]);

const num = (v: unknown): number | undefined => { if (v === undefined || v === null || v === "") return undefined; const n = typeof v === "number" ? v : Number(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : undefined; };
const str = (v: unknown): string => String(v ?? "").trim();
const fail = (erro: string, extra: Record<string, unknown> = {}): Outcome => ({ result: { ok: false, erro, ...extra } });
const item = (rotulo: string, detalhe?: string): PanelItem => ({ rotulo, ...(detalhe ? { detalhe } : {}) });
const panel = (titulo: string, itens: PanelItem[], para = "/financeiro", rotulo = "Abrir o Financeiro"): Panel => ({ titulo, secoes: [{ titulo, itens }], abrir: { rotulo, para } });
/** "Dividir com alguém" dito pela pessoa: dividir_com (nome) + percentual_dela (1–100, padrão 50). */
export const shareProp = (args: Record<string, unknown>): { shared?: Shared } => {
  const person = str(args["dividir_com"]);
  if (!person) return {};
  const pct = num(args["percentual_dela"]) ?? 50;
  return { shared: { person: person.slice(0, 80), percent: Math.min(100, Math.max(1, Math.round(pct))) } };
};
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ───────────── achar o item pelo nome ───────────── */
type Found<T> = { item: T } | { erro: Outcome };
export function find<T>(list: T[], q: string, name: (x: T) => string, what: string): Found<T> {
  const n = normalize(q);
  if (!n) return { erro: fail(`Qual ${what}? Diga o nome.`, { opcoes: list.slice(0, 12).map(name) }) };
  const exact = list.filter((x) => normalize(name(x)) === n);
  if (exact.length === 1) return { item: exact[0]! };
  const part = list.filter((x) => { const m = normalize(name(x)); return m.includes(n) || n.includes(m); });
  if (part.length === 1) return { item: part[0]! };
  if (part.length > 1) return { erro: fail(`Mais de um ${what} parecido. Pergunte qual.`, { opcoes: part.slice(0, 8).map(name) }) };
  return { erro: fail(`Não achei ${what} "${q}".`, { opcoes: list.slice(0, 12).map(name) }) };
}
const card = (s: FinanceState, q: string): Found<Card> => find(s.cards, q, (c) => c.name, "cartão");
const account = (s: FinanceState, q: string): Found<Account> => find(s.accounts, q, (a) => a.name, "conta");

/** Mês de FECHAMENTO falado ("novembro", AAAA-MM, vazio = fatura aberta) → mês de vencimento que o sistema usa. */
export function dueYmFor(c: Card, mes: unknown, today: Date): string {
  const t = normalize(str(mes));
  if (!t) return invoiceMonthOf(c, isoOf(today));
  const cur = ymOf(today);
  let closeYm = cur;
  if (/^\d{4}-\d{2}$/.test(t)) closeYm = t;
  else if (/passado|anterior/.test(t)) closeYm = addMonths(cur, -1);
  else if (/proximo|que vem/.test(t)) closeYm = addMonths(cur, 1);
  else { const names = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"], i = names.findIndex((x) => t.includes(x)); if (i >= 0) closeYm = `${today.getFullYear()}-${String(i + 1).padStart(2, "0")}`; }
  return dueYmOfClosing(c, closeYm);
}

const KIND_LABEL: Record<string, string> = { movimentacao: "movimentação", fixa: "conta fixa", assinatura: "assinatura", parcelada: "compra parcelada", conta: "conta", cartao: "cartão", meta: "meta" };
const tipoOf = (args: Record<string, unknown>): string => { const t = normalize(str(args["tipo_alvo"])); return /assin/.test(t) ? "assinatura" : /fix|recorr/.test(t) ? "fixa" : /parcel/.test(t) ? "parcelada" : /cart/.test(t) ? "cartao" : /conta|banco|carteira/.test(t) ? "conta" : /meta/.test(t) ? "meta" : /mov|gasto|compra|lanc|despesa|receita/.test(t) ? "movimentacao" : ""; };

/** Procura o alvo em todos os tipos quando a pessoa não disse qual é ("a Netflix", "o notebook"). */
function locate(s: FinanceState, args: Record<string, unknown>): { tipo: string; id: string; nome: string } | { erro: Outcome } {
  const q = str(args["alvo"]), want = tipoOf(args);
  const pools: { tipo: string; id: string; nome: string; extra?: string }[] = [];
  const add = (tipo: string, list: { id: string }[], name: (x: never) => string) => { for (const x of list) pools.push({ tipo, id: x.id, nome: (name as (x: unknown) => string)(x) }); };
  if (!want || want === "assinatura") add("assinatura", s.recurring.filter(isSubscription), (r: Recurring) => r.desc as never);
  if (!want || want === "fixa") add("fixa", s.recurring.filter((r) => !isSubscription(r)), (r: Recurring) => r.desc as never);
  if (!want || want === "parcelada") add("parcelada", s.plans, (p: Plan) => p.desc as never);
  if (!want || want === "movimentacao") add("movimentacao", s.transactions, (t: Transaction) => t.desc as never);
  if (!want || want === "conta") add("conta", s.accounts, (a: Account) => a.name as never);
  if (!want || want === "cartao") add("cartao", s.cards, (c: Card) => c.name as never);
  if (!want || want === "meta") add("meta", s.goals, (g: Goal) => g.title as never);
  const f = find(pools, q, (x) => x.nome, want ? KIND_LABEL[want]! : "item");
  if ("erro" in f) return f;
  // vários lançamentos com o mesmo nome: usa valor/data para desempatar
  if (f.item.tipo === "movimentacao") {
    const same = s.transactions.filter((t) => normalize(t.desc) === normalize(f.item.nome));
    const v = num(args["valor_atual"]), d = str(args["data_atual"]);
    const narrowed = same.filter((t) => (v === undefined || Math.abs(t.amount - v) < 0.005) && (!d || t.date === d));
    const pickFrom = narrowed.length ? narrowed : same;
    if (pickFrom.length > 1) return { erro: fail("Mais de um lançamento com esse nome. Pergunte qual (valor ou data).", { opcoes: pickFrom.slice(0, 8).map((t) => `${t.desc} ${brl(t.amount)} em ${dateBR(t.date)}`) }) };
    return { tipo: "movimentacao", id: pickFrom[0]!.id, nome: f.item.nome };
  }
  return { tipo: f.item.tipo, id: f.item.id, nome: f.item.nome };
}

const upsertList = <T extends { id: string }>(list: T[], x: T): T[] => (list.some((y) => y.id === x.id) ? list.map((y) => (y.id === x.id ? x : y)) : [...list, x]);

/* ───────────── consultas novas ───────────── */
export function readMore(s: FinanceState, args: Record<string, unknown>, today: Date): Outcome {
  const acao = str(args["acao"]);
  if (acao === "fixas") {
    const subs = (r: Recurring) => isSubscription(r), list = s.recurring.filter((r) => !subs(r));
    const ent = list.filter((r) => r.kind === "receita"), sai = list.filter((r) => r.kind === "despesa");
    const where = (r: Recurring) => (r.cardId ? s.cards.find((c) => c.id === r.cardId)?.name : s.accounts.find((a) => a.id === r.accountId)?.name) ?? "—";
    const row = (r: Recurring) => ({ nome: r.desc, valor: r.amount, dia: r.day, onde: where(r), categoria: catOf(r.category).name });
    const total = round2(sai.reduce((n, r) => n + r.amount, 0));
    return { result: { ok: true, total_fixas_mensal: total, saidas: sai.map(row), entradas: ent.map(row), dica: "Contas fixas não incluem assinaturas (use a ação assinaturas)." },
      panel: { titulo: "Contas fixas", secoes: [{ titulo: `Saem todo mês · ${brl(total)}`, itens: sai.map((r) => item(r.desc, `${brl(r.amount)} · dia ${r.day} · ${where(r)}`)) }, ...(ent.length ? [{ titulo: "Entram todo mês", itens: ent.map((r) => item(r.desc, `${brl(r.amount)} · dia ${r.day} · ${where(r)}`)) }] : [])], abrir: { rotulo: "Ver movimentações", para: "/financeiro?aba=movimentacoes" } } };
  }
  if (acao === "parcela_detalhe") {
    const f = find(s.plans, str(args["alvo"] ?? args["compra"]), (p) => p.desc, "compra parcelada");
    if ("erro" in f) return f.erro;
    const p = f.item, c = s.cards.find((x) => x.id === p.cardId), info = planInfo(p, c, today);
    return { result: { ok: true, compra: p.desc, cartao: c?.name, total: p.total, parcela: p.per, parcelas: p.count, pagas: info.paid, faltam: info.remaining, falta_pagar: info.remainingAmount, termina_em: monthName(info.lastYm), proxima: info.nextDue ? dateBR(info.nextDue) : null },
      panel: { titulo: p.desc, secoes: [{ titulo: `${info.paid} de ${p.count} pagas · faltam ${brl(info.remainingAmount)}`, itens: info.schedule.map((x) => ({ rotulo: `Parcela ${x.n}/${p.count} · vence ${dateBR(x.due)}`, detalhe: brl(x.amount), feita: x.paid })) }], abrir: { rotulo: "Abrir parcelas", para: "/financeiro?aba=parcelas" } } };
  }
  if (acao === "metas") {
    const gs = s.goals;
    const pct = (g: Goal) => (g.target > 0 ? Math.round((g.current / g.target) * 100) : 0);
    return { result: { ok: true, metas: gs.map((g) => ({ meta: g.title, tipo: g.kind, guardado: g.current, objetivo: g.target, percentual: pct(g), prazo: g.deadline ? dateBR(g.deadline) : null })) },
      panel: { titulo: "Metas", secoes: [{ titulo: "Suas metas", itens: gs.length ? gs.map((g) => item(g.title, `${brl(g.current)} de ${brl(g.target)} · ${pct(g)}%${g.deadline ? ` · até ${dateBR(g.deadline)}` : ""}`)) : [item("Você ainda não tem metas.")] }], abrir: { rotulo: "Abrir metas", para: "/financeiro?aba=metas" } } };
  }
  if (acao === "abrir") {
    const tabs: Record<string, string> = { acerto: "acerto", acertodecontas: "acerto", visao: "visao", geral: "visao", inicio: "visao", contas: "contas", cartoes: "contas", parcelas: "parcelas", meses: "meses", proximos: "meses", movimentacoes: "movimentacoes", gastos: "movimentacoes", assinaturas: "assinaturas", metas: "metas" };
    const raw = normalize(str(args["aba"])).replace(/\s+/g, ""), key = Object.keys(tabs).find((k) => raw.includes(k));
    const q = str(args["cartao"] ?? args["conta"]);
    let para = "/financeiro" + (key && tabs[key] !== "visao" ? `?aba=${tabs[key]}` : "");
    if (q) { const c = s.cards.find((x) => normalize(x.name) === normalize(q)) ?? s.cards.find((x) => normalize(x.name).includes(normalize(q))); const a = c ? undefined : s.accounts.find((x) => normalize(x.name).includes(normalize(q))); if (c) para = `/financeiro?aba=contas&item=card:${c.id}`; else if (a) para = `/financeiro?aba=contas&item=acc:${a.id}`; }
    return { result: { ok: true, abrindo: para }, navegar: para };
  }
  return fail("Ação desconhecida.");
}

/* ───────────── alterações ───────────── */
export function applyWrite(s: FinanceState, args: Record<string, unknown>, today: Date): Outcome {
  const acao = str(args["acao"]), todayIso = isoOf(today), cur = ymOf(today);

  if (acao === "pausar" || acao === "reativar") {
    const loc = locate(s, { ...args, tipo_alvo: str(args["tipo_alvo"]) || "assinatura" });
    const target = "erro" in loc ? locate(s, { alvo: args["alvo"], tipo_alvo: "fixa" }) : loc;
    if ("erro" in target) return target.erro;
    const r = s.recurring.find((x) => x.id === target.id);
    if (!r) return fail("Não achei essa cobrança.");
    const next = acao === "pausar" ? pauseRecurring(r, today) : resumeRecurring(r, today);
    if (next === r) return fail(acao === "pausar" ? `${r.desc} já está pausada.` : `${r.desc} não está pausada.`);
    const quando = nextCharge(next, today);
    return { state: { ...s, recurring: upsertList(s.recurring, next) }, result: { ok: true, acao: acao === "pausar" ? "pausada" : "reativada", nome: r.desc, valor: r.amount, proxima_cobranca: acao === "reativar" && quando ? dateBR(quando) : null, dica: acao === "pausar" ? "Ela some das faturas e das projeções a partir da próxima cobrança." : undefined },
      panel: panel(acao === "pausar" ? "Assinatura pausada" : "Assinatura reativada", [item(r.desc, brl(r.amount))], "/financeiro?aba=assinaturas", "Abrir assinaturas") };
  }

  if (acao === "fatura_total") {
    const c = card(s, str(args["cartao"])); if ("erro" in c) return c.erro;
    const v = num(args["valor"]); if (v === undefined || v < 0) return fail("Qual é o total da fatura?");
    const due = dueYmFor(c.item, args["mes"], today), before = invoiceFor(s, c.item, due), next = withDeclaredTotal(c.item, due, v);
    const after = invoiceFor({ ...s, cards: upsertList(s.cards, next) }, next, due);
    return { state: { ...s, cards: upsertList(s.cards, next) }, result: { ok: true, cartao: c.item.name, fatura: `fecha em ${monthName(closingYmOf(c.item, due))}`, vence: dateBR(after.due), total_anterior: before.total, total_agora: after.total, ainda_a_detalhar: after.adjustment, itens_passam_do_total: after.over > 0 ? after.over : undefined },
      panel: panel(`Fatura ${c.item.name}`, [item("Total do banco", brl(after.total)), item("Já detalhado", brl(round2(after.total - after.adjustment))), item("Ainda a detalhar", brl(after.adjustment))], `/financeiro?aba=contas&item=card:${c.item.id}`, "Abrir o cartão") };
  }

  if (acao === "detalhar") {
    const c = card(s, str(args["cartao"])); if ("erro" in c) return c.erro;
    const desc = str(args["descricao"]), v = num(args["valor"]);
    if (!desc || v === undefined || v <= 0) return fail("Faltou a descrição e o valor da compra.");
    const due = dueYmFor(c.item, args["mes"], today), tipo = normalize(str(args["forma"]));
    const cat = str(args["categoria"]) || guessCategory(desc);
    if (/assin|mensal|fixa/.test(tipo) || cat === "assinaturas") {
      const day = num(args["dia"]) ?? today.getDate(), sub = { ...subscriptionForInvoice(c.item, due, { id: uid("rec-"), desc, amount: v, day }), ...shareProp(args) };
      return { state: { ...s, recurring: [...s.recurring, sub] }, result: { ok: true, acao: "assinatura_cadastrada", nome: desc, valor: v, dia: sub.day, aviso: "Entra todo mês nesta fatura e nas próximas até pausar.", total_da_fatura_continua: invoiceFor({ ...s, recurring: [...s.recurring, sub] }, c.item, due).total },
        panel: panel("Assinatura cadastrada", [item(desc, `${brl(v)} todo dia ${sub.day} · ${c.item.name}`)], "/financeiro?aba=assinaturas", "Abrir assinaturas") };
    }
    if (/vista/.test(tipo)) {
      const tx: Transaction = { id: uid("tx-"), kind: "despesa", desc, amount: v, date: todayIso, method: "credito", cardId: c.item.id, category: cat, inLimit: true, ...shareProp(args) };
      return { state: { ...s, transactions: [...s.transactions, tx] }, result: { ok: true, acao: "compra_detalhada", nome: desc, valor: v }, panel: panel("Compra detalhada", [item(desc, `${brl(v)} · ${c.item.name}`)], `/financeiro?aba=contas&item=card:${c.item.id}`, "Abrir o cartão") };
    }
    const n = Math.max(1, Math.min(60, Math.round(num(args["parcelas_total"]) ?? 1))), x = Math.max(1, Math.min(n, Math.round(num(args["parcela_atual"]) ?? 1)));
    const plan = { ...planForInvoice(c.item, due, { id: uid("plan-"), desc, per: v, n, x, category: cat, todayIso }), ...shareProp(args) }, next = { ...s, plans: [...s.plans, plan] }, inv = invoiceFor(next, c.item, due);
    return { state: next, result: { ok: true, acao: "parcelada_detalhada", nome: desc, parcela: v, parcelas: n, esta_fatura_e_a_parcela: x, restantes: n - x, total_da_fatura: inv.total, ainda_a_detalhar: inv.adjustment, itens_passam_do_total: inv.over > 0 ? inv.over : undefined },
      panel: panel("Compra detalhada na fatura", [item(desc, `parcela ${x}/${n} de ${brl(v)}`), item("Total da fatura", brl(inv.total)), item("Ainda a detalhar", brl(inv.adjustment))], `/financeiro?aba=contas&item=card:${c.item.id}`, "Abrir o cartão") };
  }

  if (acao === "cadastrar_parcelada") {
    const c = card(s, str(args["cartao"])); if ("erro" in c) return c.erro;
    const desc = str(args["descricao"]), per = num(args["valor"]), n = Math.round(num(args["parcelas_total"]) ?? 0);
    if (!desc || per === undefined || per <= 0 || n < 1) return fail("Faltou a descrição, o valor da parcela e o número de parcelas.");
    const pagas = Math.max(0, Math.min(n - 1, Math.round(num(args["parcelas_pagas"]) ?? 0)));
    const first = pagas > 0 ? firstFromPaid(c.item, today, pagas) : invoiceMonthOf(c.item, todayIso);
    // já pagou parcelas = compra antiga, que já está dentro do limite informado pelo banco; compra de hoje consome o limite
    const plan: Plan = { ...shareProp(args), id: uid("plan-"), desc, cardId: c.item.id, total: round2(per * n), count: n, per, purchaseYm: addMonths(cur, -pagas), first, category: str(args["categoria"]) || guessCategory(desc), createdAt: todayIso, ...(pagas > 0 ? { inLimit: true } : {}) };
    const info = planInfo(plan, c.item, today);
    return { state: { ...s, plans: [...s.plans, plan] }, result: { ok: true, acao: "parcelada_cadastrada", compra: desc, cartao: c.item.name, parcela: per, parcelas: n, pagas: info.paid, falta_pagar: info.remainingAmount, termina_em: monthName(info.lastYm) },
      panel: panel("Compra parcelada cadastrada", [item(desc, `${n}x de ${brl(per)} · ${c.item.name}`), item("Falta pagar", brl(info.remainingAmount)), item("Termina em", monthName(info.lastYm))], "/financeiro?aba=parcelas", "Abrir parcelas") };
  }

  if (acao === "cadastrar_fixa") {
    const desc = str(args["descricao"]), v = num(args["valor"]), day = Math.round(num(args["dia"]) ?? 0);
    if (!desc || v === undefined || v <= 0 || day < 1 || day > 31) return fail("Faltou a descrição, o valor ou o dia do mês.");
    const income = /receita|entrada|salario|ganho/.test(normalize(str(args["forma"]))) || /receita|entrada/.test(normalize(str(args["tipo"])));
    const sub = !income && (/assin/.test(normalize(str(args["forma"]))) || str(args["categoria"]) === "assinaturas");
    const cc = str(args["cartao"]) ? card(s, str(args["cartao"])) : null, aa = str(args["conta"]) ? account(s, str(args["conta"])) : null;
    if (cc && "erro" in cc) return cc.erro;
    if (aa && "erro" in aa) return aa.erro;
    if (!cc && !aa) return fail("Em qual conta ou cartão?", { contas: s.accounts.map((a) => a.name), cartoes: s.cards.map((x) => x.name) });
    const startYm = dayIn(cur, day) >= todayIso ? cur : addMonths(cur, 1);
    const r: Recurring = { ...(income ? {} : shareProp(args)), id: uid("rec-"), kind: income ? "receita" : "despesa", desc, amount: v, day, category: str(args["categoria"]) || (sub ? "assinaturas" : guessCategory(desc, income)), method: cc ? "credito" : income ? "pix" : "debito", ...(cc && !("erro" in cc) ? { cardId: cc.item.id } : {}), ...(aa && !("erro" in aa) ? { accountId: aa.item.id } : {}), startYm, ...(sub ? { subscription: true } : {}) };
    return { state: { ...s, recurring: [...s.recurring, r] }, result: { ok: true, acao: "fixa_cadastrada", nome: desc, valor: v, dia: day, tipo: income ? "entrada fixa" : sub ? "assinatura" : "conta fixa", comeca_em: monthName(startYm) },
      panel: panel(income ? "Entrada fixa cadastrada" : sub ? "Assinatura cadastrada" : "Conta fixa cadastrada", [item(desc, `${brl(v)} todo dia ${day}`), item("Começa em", monthName(startYm))], sub ? "/financeiro?aba=assinaturas" : "/financeiro?aba=meses", sub ? "Abrir assinaturas" : "Ver próximos meses") };
  }

  if (acao === "dividir") {
    const loc = locate(s, args); if ("erro" in loc) return loc.erro;
    const pessoa = str(args["pessoa"] ?? args["dividir_com"]), tirar = !pessoa || /^(remover|tirar|nenhum|ninguem|sem divisao)/.test(normalize(pessoa));
    const sh: Shared | undefined = tirar ? undefined : { person: pessoa.slice(0, 80), percent: Math.min(100, Math.max(1, Math.round(num(args["percentual_dela"]) ?? 50))) };
    let state: FinanceState, valor = 0, link = "/financeiro";
    if (loc.tipo === "movimentacao") { const t = s.transactions.find((x) => x.id === loc.id)!; if (t.kind !== "despesa") return fail("Só despesas podem ser divididas."); valor = t.amount; state = { ...s, transactions: upsertList(s.transactions, { ...t, shared: sh }) }; }
    else if (loc.tipo === "parcelada") { const p = s.plans.find((x) => x.id === loc.id)!; valor = p.per; link = "/financeiro?aba=parcelas"; state = { ...s, plans: upsertList(s.plans, { ...p, shared: sh }) }; }
    else if (loc.tipo === "fixa" || loc.tipo === "assinatura") { const r = s.recurring.find((x) => x.id === loc.id)!; if (r.kind !== "despesa") return fail("Só despesas podem ser divididas."); valor = r.amount; state = { ...s, recurring: upsertList(s.recurring, { ...r, shared: sh }) }; }
    else return fail("Só compras, parcelas e contas fixas podem ser divididas.");
    const parte = sharedPart(valor, sh);
    return { state, result: { ok: true, acao: sh ? "dividida" : "divisao_removida", item: loc.nome, pessoa: sh?.person ?? null, percentual_dela: sh?.percent ?? null, valor_da_parcela_ou_compra: valor, parte_dela: parte, sua_parte: round2(valor - parte), dica: sh ? "O total do banco não muda; a parte dela entra como receita a receber." : undefined },
      panel: panel(sh ? "Dividido" : "Divisão removida", sh ? [item(loc.nome, `${sh.person} fica com ${sh.percent}% = ${brl(parte)}`), item("Sua parte", brl(round2(valor - parte)))] : [item(loc.nome)], link) };
  }

  if (acao === "editar") return edit(s, args, today);
  if (acao === "excluir") return remove(s, args);
  return fail("Ação desconhecida.");
}

function edit(s: FinanceState, args: Record<string, unknown>, today: Date): Outcome {
  const loc = locate(s, args); if ("erro" in loc) return loc.erro;
  const v = num(args["valor"]), desc = str(args["descricao"]), date = str(args["data"]), day = num(args["dia"]), cat = str(args["categoria"]);
  const done = (state: FinanceState, nome: string, mudancas: Record<string, unknown>, link = "/financeiro"): Outcome => ({ state, result: { ok: true, acao: "alterado", item: nome, ...mudancas }, panel: panel("Alterado", [item(nome), ...Object.entries(mudancas).filter(([, x]) => x !== undefined).map(([k, x]) => item(k.replace(/_/g, " "), String(x)))], link) });

  if (loc.tipo === "movimentacao") {
    const t = s.transactions.find((x) => x.id === loc.id)!, n = { ...t, ...(v !== undefined ? { amount: v } : {}), ...(desc ? { desc } : {}), ...(/^\d{4}-\d{2}-\d{2}$/.test(date) ? { date } : {}), ...(cat ? { category: cat } : {}) };
    if (n === t || JSON.stringify(n) === JSON.stringify(t)) return fail("Não entendi o que mudar. Diga o novo valor, descrição, data ou categoria.");
    return done({ ...s, transactions: upsertList(s.transactions, n) }, t.desc, { valor_anterior: v !== undefined ? brl(t.amount) : undefined, valor_agora: brl(n.amount), data: dateBR(n.date) } as Record<string, unknown>, "/financeiro?aba=movimentacoes");
  }
  if (loc.tipo === "fixa" || loc.tipo === "assinatura") {
    const r = s.recurring.find((x) => x.id === loc.id)!, n: Recurring = { ...r, ...(v !== undefined ? { amount: v } : {}), ...(desc ? { desc } : {}), ...(day !== undefined && day >= 1 && day <= 31 ? { day: Math.round(day) } : {}), ...(cat ? { category: cat } : {}) };
    if (JSON.stringify(n) === JSON.stringify(r)) return fail("Não entendi o que mudar. Diga o novo valor, dia ou nome.");
    return done({ ...s, recurring: upsertList(s.recurring, n) }, r.desc, { valor_anterior: v !== undefined ? brl(r.amount) : undefined, valor_agora: brl(n.amount), dia: n.day } as Record<string, unknown>, loc.tipo === "assinatura" ? "/financeiro?aba=assinaturas" : "/financeiro?aba=meses");
  }
  if (loc.tipo === "parcelada") {
    const p = s.plans.find((x) => x.id === loc.id)!, count = num(args["parcelas_total"]) !== undefined ? Math.max(1, Math.min(60, Math.round(num(args["parcelas_total"])!))) : p.count, per = v ?? p.per;
    const n: Plan = { ...p, ...(desc ? { desc } : {}), count, per, total: round2(per * count), ...(cat ? { category: cat } : {}) };
    if (JSON.stringify(n) === JSON.stringify(p)) return fail("Não entendi o que mudar. Diga o novo valor da parcela ou o número de parcelas.");
    return done({ ...s, plans: upsertList(s.plans, n) }, p.desc, { parcela_anterior: brl(p.per), parcela_agora: brl(n.per), parcelas: n.count, total: brl(n.total) }, "/financeiro?aba=parcelas");
  }
  if (loc.tipo === "conta") {
    const a = s.accounts.find((x) => x.id === loc.id)!, saldo = v ?? num(args["saldo"]);
    if (saldo === undefined && !desc) return fail("Diga o saldo certo da conta ou o novo nome.");
    const base = saldo !== undefined ? round2(a.balanceBase + (saldo - accountBalance(s, a, today))) : a.balanceBase;
    return done({ ...s, accounts: upsertList(s.accounts, { ...a, balanceBase: base, ...(desc ? { name: desc } : {}) }) }, a.name, { saldo_anterior: brl(accountBalance(s, a, today)), saldo_agora: saldo !== undefined ? brl(saldo) : undefined } as Record<string, unknown>, "/financeiro?aba=contas");
  }
  if (loc.tipo === "cartao") {
    const c = s.cards.find((x) => x.id === loc.id)!, disp = num(args["disponivel"]) ?? v, lim = num(args["limite"]), fe = num(args["fechamento"]), ve = num(args["vencimento"]);
    const n: Card = { ...c, ...(desc ? { name: desc } : {}), ...(lim !== undefined ? { limit: lim } : {}), ...(fe !== undefined && fe >= 1 && fe <= 31 ? { closingDay: Math.round(fe) } : {}), ...(ve !== undefined && ve >= 1 && ve <= 31 ? { dueDay: Math.round(ve) } : {}) };
    const withBase = disp !== undefined ? { ...n, availableBase: round2(disp + cardUsed(s, n)) } : n;
    if (JSON.stringify(withBase) === JSON.stringify(c)) return fail("Diga o que mudar: limite disponível, limite total, fechamento ou vencimento.");
    return done({ ...s, cards: upsertList(s.cards, withBase) }, c.name, { disponivel_anterior: brl(cardAvailable(s, c)), disponivel_agora: brl(cardAvailable({ ...s, cards: upsertList(s.cards, withBase) }, withBase)), fecha_dia: withBase.closingDay, vence_dia: withBase.dueDay }, `/financeiro?aba=contas&item=card:${c.id}`);
  }
  if (loc.tipo === "meta") {
    const g = s.goals.find((x) => x.id === loc.id)!, alvo = num(args["objetivo"]);
    const n: Goal = { ...g, ...(v !== undefined ? { current: v } : {}), ...(alvo !== undefined ? { target: alvo } : {}), ...(desc ? { title: desc } : {}) };
    if (JSON.stringify(n) === JSON.stringify(g)) return fail("Diga quanto você já guardou ou o novo objetivo.");
    return done({ ...s, goals: upsertList(s.goals, n) }, g.title, { guardado_anterior: brl(g.current), guardado_agora: brl(n.current), objetivo: brl(n.target) }, "/financeiro?aba=metas");
  }
  return fail("Não sei alterar isso.");
}

function remove(s: FinanceState, args: Record<string, unknown>): Outcome {
  const loc = locate(s, args); if ("erro" in loc) return loc.erro;
  const label = KIND_LABEL[loc.tipo] ?? "item";
  if (args["confirmado"] !== true) return { result: { ok: false, precisa_confirmar: true, o_que: `${label} "${loc.nome}"`, dica: loc.tipo === "cartao" ? "Excluir o cartão também apaga as compras parceladas dele." : undefined } };
  const done = (state: FinanceState): Outcome => ({ state, result: { ok: true, acao: "excluido", item: loc.nome, tipo: label }, panel: panel("Excluído", [item(loc.nome, label)]) });
  switch (loc.tipo) {
    case "movimentacao": return done({ ...s, transactions: s.transactions.filter((t) => t.id !== loc.id) });
    case "fixa": case "assinatura": return done({ ...s, recurring: s.recurring.filter((r) => r.id !== loc.id) });
    case "parcelada": return done({ ...s, plans: s.plans.filter((p) => p.id !== loc.id) });
    case "meta": return done({ ...s, goals: s.goals.filter((g) => g.id !== loc.id) });
    case "conta": return done({ ...s, accounts: s.accounts.filter((a) => a.id !== loc.id), transactions: s.transactions.map((t) => (t.accountId === loc.id ? { ...t, accountId: undefined } : t)), recurring: s.recurring.map((r) => (r.accountId === loc.id ? { ...r, accountId: undefined } : r)) });
    case "cartao": return done({ ...s, cards: s.cards.filter((c) => c.id !== loc.id), plans: s.plans.filter((p) => p.cardId !== loc.id), transactions: s.transactions.map((t) => (t.cardId === loc.id ? { ...t, cardId: undefined } : t)), recurring: s.recurring.map((r) => (r.cardId === loc.id ? { ...r, cardId: undefined } : r)) });
    default: return fail("Não sei excluir isso.");
  }
}
