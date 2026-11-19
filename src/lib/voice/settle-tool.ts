/**
 * Ferramenta "acerto": o Orion faz tudo que a tela "Acerto de contas" faz (criar acerto, lançar compras e pix, contas da casa,
 * editar, excluir, divisão padrão, quitar e gerar o extrato). Excluir sempre pede confirmação (`confirmado: true`).
 * Usa as mesmas tabelas e a mesma lógica pura da tela (`finance/settle.ts`).
 */
import { supabase } from "../supabase";
import { balance, brl, fromCents, parseMoney, split, statementText, type SettleItem } from "../finance/settle";
import { normalize } from "../orion";
import type { Panel, PanelItem } from "./agent";

type Out = { result: Record<string, unknown>; panel?: Panel; navegar?: string; mudou?: boolean };
type S = { id: string; person: string; closed: boolean; default_share: number | null };
type I = { id: string; kind: "compra" | "pagamento"; item_date: string | null; description: string; amount: number | string; payer: "eu" | "outro"; other_share: number; installment: string };

const LINK = "/financeiro?aba=acerto";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const str = (v: unknown) => String(v ?? "").trim();
const money = (v: unknown): number | null => (typeof v === "number" ? (Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null) : parseMoney(str(v)));
const pct = (v: unknown, dflt: number): number => { const n = typeof v === "number" ? v : Number(str(v).replace("%", "").replace(",", ".")); return Number.isFinite(n) && str(v) !== "" ? Math.min(100, Math.max(0, Math.round(n))) : dflt; };
const dmy = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const fail = (erro: string, extra: Record<string, unknown> = {}): Out => ({ result: { ok: false, erro, ...extra } });
const panel = (titulo: string, itens: PanelItem[], secao = titulo): Panel => ({ titulo, secoes: [{ titulo: secao, itens }], abrir: { rotulo: "Abrir o Acerto de contas", para: LINK } });
const toItem = (r: I): SettleItem => ({ id: r.id, kind: r.kind, date: r.item_date, description: r.description, amount: Number(r.amount), payer: r.payer, otherShare: r.other_share, installment: r.installment });
const asPayer = (v: unknown): "eu" | "outro" | null => { const t = normalize(str(v)); return /^(eu|meu|minha|mim)\b/.test(t) || t === "eu" ? "eu" : /^(outro|outra|dele|dela|ele|ela)\b/.test(t) || t === "outro" ? "outro" : null; };
const isoDate = (v: unknown): string => (/^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : today());

async function accounts(): Promise<S[]> {
  const { data, error } = await supabase.from("fin_settlements").select("id, person, closed, default_share").order("closed").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as S[];
}
async function itemsOf(id: string): Promise<I[]> {
  const { data, error } = await supabase.from("fin_settlement_items").select("id, kind, item_date, description, amount, payer, other_share, installment").eq("settlement_id", id).order("position").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as I[];
}

/** Acha o acerto pela pessoa. Sem nome: se só há um aberto, usa ele; senão pergunta. */
function pick(list: S[], q: string): { s: S } | { out: Out } {
  const n = normalize(q);
  if (!n) {
    const open = list.filter((x) => !x.closed);
    if (open.length === 1) return { s: open[0]! };
    return { out: fail(open.length ? "Com quem é o acerto?" : "Ainda não há acerto. Diga com quem quer criar.", { acertos: list.map((x) => x.person) }) };
  }
  const exact = list.filter((x) => normalize(x.person) === n), part = list.filter((x) => normalize(x.person).includes(n) || n.includes(normalize(x.person)));
  const hit = exact.length === 1 ? exact : part;
  if (hit.length === 1) return { s: hit[0]! };
  return { out: fail(hit.length ? "Mais de um acerto parecido. Pergunte qual." : `Não achei acerto com "${q}".`, { acertos: list.map((x) => x.person) }) };
}

function findItem(rows: I[], q: string): { r: I } | { out: Out } {
  const n = normalize(q);
  if (!n) return { out: fail("Qual lançamento?", { lancamentos: rows.slice(0, 12).map((r) => `${dmy(r.item_date)} ${r.description || r.kind} ${brl(Number(r.amount))}`) }) };
  const exact = rows.filter((r) => normalize(r.description) === n), part = rows.filter((r) => normalize(r.description).includes(n) || n.includes(normalize(r.description)));
  const hit = exact.length === 1 ? exact : part;
  if (hit.length === 1) return { r: hit[0]! };
  return { out: fail(hit.length ? "Mais de um lançamento parecido. Pergunte qual (valor ou data)." : `Não achei lançamento "${q}".`, { lancamentos: (hit.length ? hit : rows).slice(0, 10).map((r) => `${dmy(r.item_date)} ${r.description || r.kind} ${brl(Number(r.amount))}`) }) };
}

const summary = (person: string, rows: I[]) => {
  const b = balance(rows.map(toItem));
  return { saldo: b.direction === "quite" ? "ninguém deve nada" : b.direction === "outro_paga" ? `${person} paga ${brl(b.amount)} para você` : `você paga ${brl(b.amount)} para ${person}`, pessoa_deve_a_voce: fromCents(b.owedToMe), voce_deve_a_pessoa: fromCents(b.owedByMe), pix_que_voce_fez: fromCents(b.paidByMe), pix_que_ela_fez: fromCents(b.paidByOther), valor_final: b.amount, direcao: b.direction };
};

export async function runSettleTool(args: Record<string, unknown>, me = "Eu"): Promise<Out> {
  const acao = str(args["acao"]) || "listar";
  const list = await accounts();

  if (acao === "listar") {
    const rows = await Promise.all(list.map(async (s) => ({ s, sum: summary(s.person, await itemsOf(s.id)) })));
    return { result: { ok: true, acertos: rows.map((r) => ({ pessoa: r.s.person, quitado: r.s.closed, ...r.sum })) }, panel: panel("Acertos de contas", rows.length ? rows.map((r) => ({ rotulo: r.s.person + (r.s.closed ? " (quitado)" : ""), detalhe: r.sum.saldo })) : [{ rotulo: "Nenhum acerto ainda" }]), navegar: LINK };
  }

  if (acao === "criar") {
    const pessoa = str(args["pessoa"]).slice(0, 80);
    if (!pessoa) return fail("Com quem é o acerto?");
    if (list.some((x) => normalize(x.person) === normalize(pessoa))) return fail(`Já existe um acerto com ${pessoa}.`, { acertos: list.map((x) => x.person) });
    const dflt = args["divisao_padrao"] !== undefined ? pct(args["divisao_padrao"], 50) : null;
    const { error } = await supabase.from("fin_settlements").insert({ person: pessoa, ...(dflt !== null ? { default_share: dflt } : {}) });
    if (error) return fail("Não consegui criar o acerto.");
    return { result: { ok: true, acao: "acerto_criado", pessoa, divisao_padrao: dflt }, panel: panel("Acerto criado", [{ rotulo: pessoa }]), navegar: LINK, mudou: true };
  }

  const found = pick(list, str(args["pessoa"]));
  if ("out" in found) return found.out;
  const s = found.s, rows = await itemsOf(s.id);

  if (acao === "ver" || acao === "extrato") {
    const text = statementText({ me, person: s.person, items: rows.map(toItem), generatedOn: today() });
    return { result: { ok: true, pessoa: s.person, quitado: s.closed, divisao_padrao: s.default_share, ...summary(s.person, rows), lancamentos: rows.map((r) => ({ id_curto: r.id.slice(0, 8), data: dmy(r.item_date), tipo: r.kind, descricao: r.description, valor: Number(r.amount), no_cartao_de: r.payer === "eu" ? "eu" : s.person, parte_da_pessoa_pct: r.kind === "compra" ? r.other_share : undefined, parcela: r.installment || undefined })), ...(acao === "extrato" ? { texto_do_extrato: text } : {}) },
      panel: panel(`Acerto com ${s.person}`, [{ rotulo: summary(s.person, rows).saldo }, ...rows.slice(0, 15).map((r) => ({ rotulo: `${dmy(r.item_date)} ${r.description || (r.kind === "pagamento" ? "Pix" : "Compra")}`, detalhe: brl(Number(r.amount)) }))]), navegar: LINK };
  }

  const add = async (drafts: Omit<ReturnType<typeof draft>, never>[]) => {
    const start = rows.length;
    const { error } = await supabase.from("fin_settlement_items").insert(drafts.map((d, i) => ({ settlement_id: s.id, kind: d.kind, item_date: d.date, description: d.description.slice(0, 200), amount: d.amount, payer: d.payer, other_share: d.otherShare, installment: d.installment.slice(0, 20), position: start + i })));
    return error;
  };
  const draft = (o: { kind: "compra" | "pagamento"; date: string; description: string; amount: number; payer: "eu" | "outro"; otherShare: number; installment?: string }) => ({ installment: "", ...o });
  const after = async (titulo: string, extra: Record<string, unknown>, itens: PanelItem[]): Promise<Out> => ({ result: { ok: true, ...extra, ...summary(s.person, await itemsOf(s.id)) }, panel: panel(titulo, itens), navegar: LINK, mudou: true });
  const same = (a: { date: string | null; description: string; amount: number; payer: string }, b: SettleItem) => a.payer === b.payer && a.amount === b.amount && normalize(a.description) === normalize(b.description) && (a.date ?? "") === (b.date ?? "");

  if (acao === "lancar") {
    const lista = Array.isArray(args["itens"]) ? (args["itens"] as Record<string, unknown>[]) : [];
    if (!lista.length) return fail("Quais compras? Envie as linhas (descrição e valor).");
    const drafts: ReturnType<typeof draft>[] = [], problemas: string[] = [], jaTinha: string[] = [];
    const existing = rows.map(toItem);
    for (const it of lista) {
      const v = money(it["valor"]), desc = str(it["descricao"]), payer = asPayer(it["no_cartao_de"] ?? it["cartao"]);
      if (v === null || !desc) { problemas.push(`${desc || "linha sem nome"}: faltou o valor`); continue; }
      if (!payer) return fail(`A compra "${desc}" foi no cartão de quem? (meu ou de ${s.person})`);
      if (it["parte_da_outra"] === undefined || it["parte_da_outra"] === null || str(it["parte_da_outra"]) === "") return fail(`Quanto de "${desc}" é de ${s.person}? (tudo, metade ou uma porcentagem)`, { descricao: desc });
      const d = draft({ kind: "compra", date: isoDate(it["data"]), description: desc, amount: v, payer, otherShare: pct(it["parte_da_outra"], 100), installment: str(it["parcela"]) });
      if (existing.some((e) => e.kind === "compra" && same({ date: d.date, description: d.description, amount: d.amount, payer: d.payer }, e))) { jaTinha.push(desc); continue; }
      drafts.push(d);
    }
    if (!drafts.length) return fail(jaTinha.length ? "Essas compras já estavam lançadas." : "Nenhuma compra válida.", { ja_existiam: jaTinha, problemas });
    const err = await add(drafts); if (err) return fail("Não consegui salvar os lançamentos. Nada foi mudado.");
    return after("Compras lançadas", { acao: "lancadas", lancadas: drafts.length, ja_existiam: jaTinha, problemas, pessoa: s.person }, drafts.slice(0, 12).map((d) => ({ rotulo: d.description, detalhe: `${brl(d.amount)} · ${d.payer === "eu" ? "meu cartão" : `cartão de ${s.person}`} · ${s.person} ${d.otherShare}%` })));
  }

  if (acao === "contas_da_casa") {
    const lista = Array.isArray(args["itens"]) ? (args["itens"] as Record<string, unknown>[]) : [];
    const payer = asPayer(args["quem_pagou"]); if (!payer) return fail(`Quem pagou as contas cheias? (você ou ${s.person})`);
    const share = pct(args["divisao_da_pessoa"], s.default_share ?? 50);
    const drafts = lista.flatMap((it) => { const v = money(it["valor"]), desc = str(it["descricao"]); return v !== null && desc ? [draft({ kind: "compra", date: isoDate(it["data"] ?? args["data"]), description: desc, amount: v, payer, otherShare: share })] : []; });
    if (!drafts.length) return fail("Quais contas? Diga a descrição e o valor cheio de cada uma.");
    const err = await add(drafts); if (err) return fail("Não consegui salvar as contas.");
    const parts = drafts.map((d) => split({ amount: d.amount, otherShare: share })), mine = parts.reduce((n, p) => n + p.mine, 0), other = parts.reduce((n, p) => n + p.other, 0);
    return after("Contas da casa lançadas", { acao: "contas_lancadas", quantidade: drafts.length, quem_pagou: payer === "eu" ? "você" : s.person, divisao_da_pessoa_pct: share, parte_da_pessoa: fromCents(other), sua_parte: fromCents(mine), pessoa: s.person }, [...drafts.map((d, i) => ({ rotulo: d.description, detalhe: `${brl(d.amount)} · ${s.person}: ${brl(fromCents(parts[i]!.other))} · você: ${brl(fromCents(parts[i]!.mine))}` }))]);
  }

  if (acao === "pix") {
    const v = money(args["valor"]), payer = asPayer(args["quem_pagou"]);
    if (v === null) return fail("Qual foi o valor do pix?");
    if (!payer) return fail(`Quem fez o pix? (você ou ${s.person})`);
    const err = await add([draft({ kind: "pagamento", date: isoDate(args["data"]), description: str(args["descricao"]), amount: v, payer, otherShare: 100 })]); if (err) return fail("Não consegui registrar o pix.");
    return after("Pix registrado", { acao: "pix_registrado", valor: v, quem_fez: payer === "eu" ? "você" : s.person }, [{ rotulo: `Pix de ${payer === "eu" ? "você" : s.person}`, detalhe: brl(v) }]);
  }

  if (acao === "editar" || acao === "excluir") {
    const f = findItem(rows, str(args["item"]) || str(args["descricao_atual"])); if ("out" in f) return f.out;
    const r = f.r;
    if (acao === "excluir") {
      if (args["confirmado"] !== true) return { result: { ok: false, precisa_confirmar: true, o_que: `o lançamento "${r.description || r.kind}" de ${brl(Number(r.amount))} do acerto com ${s.person}` } };
      const { error } = await supabase.from("fin_settlement_items").delete().eq("id", r.id); if (error) return fail("Não consegui excluir.");
      return after("Lançamento excluído", { acao: "excluido", item: r.description || r.kind }, [{ rotulo: r.description || r.kind }]);
    }
    const patch: Record<string, unknown> = {};
    const v = args["valor"] !== undefined ? money(args["valor"]) : undefined, payer = args["no_cartao_de"] !== undefined ? asPayer(args["no_cartao_de"]) : undefined;
    if (v === null) return fail("Esse valor não parece válido.");
    if (v !== undefined) patch["amount"] = v;
    if (str(args["descricao"])) patch["description"] = str(args["descricao"]).slice(0, 200);
    if (str(args["data"])) patch["item_date"] = isoDate(args["data"]);
    if (payer === null) return fail(`No cartão de quem? (meu ou de ${s.person})`);
    if (payer) patch["payer"] = payer;
    if (args["parte_da_outra"] !== undefined) patch["other_share"] = pct(args["parte_da_outra"], r.other_share);
    if (args["parcela"] !== undefined) patch["installment"] = str(args["parcela"]).slice(0, 20);
    if (!Object.keys(patch).length) return fail("Não entendi o que mudar. Diga o novo valor, descrição, data, de quem é ou a parcela.");
    const { error } = await supabase.from("fin_settlement_items").update(patch).eq("id", r.id); if (error) return fail("Não consegui alterar.");
    return after("Lançamento alterado", { acao: "alterado", item: r.description || r.kind, mudancas: Object.keys(patch) }, [{ rotulo: r.description || r.kind, detalhe: "alterado" }]);
  }

  if (acao === "divisao_padrao") {
    const v = pct(args["valor"], -1); if (v < 0) return fail(`Quantos % das contas da casa ficam com ${s.person}?`);
    const { error } = await supabase.from("fin_settlements").update({ default_share: v, updated_at: new Date().toISOString() }).eq("id", s.id); if (error) return fail("Não consegui salvar a divisão.");
    return { result: { ok: true, acao: "divisao_definida", pessoa: s.person, da_pessoa_pct: v, sua_pct: 100 - v }, panel: panel("Divisão padrão", [{ rotulo: `${s.person} ${v}% · você ${100 - v}%` }]), navegar: LINK, mudou: true };
  }

  if (acao === "quitar" || acao === "reabrir") {
    const { error } = await supabase.from("fin_settlements").update({ closed: acao === "quitar", updated_at: new Date().toISOString() }).eq("id", s.id); if (error) return fail("Não consegui alterar o acerto.");
    return { result: { ok: true, acao: acao === "quitar" ? "quitado" : "reaberto", pessoa: s.person }, panel: panel(acao === "quitar" ? "Acerto quitado" : "Acerto reaberto", [{ rotulo: s.person }]), navegar: LINK, mudou: true };
  }

  if (acao === "excluir_acerto") {
    if (args["confirmado"] !== true) return { result: { ok: false, precisa_confirmar: true, o_que: `o acerto com ${s.person} e todos os ${rows.length} lançamentos dele` } };
    const { error } = await supabase.from("fin_settlements").delete().eq("id", s.id); if (error) return fail("Não consegui excluir o acerto.");
    return { result: { ok: true, acao: "acerto_excluido", pessoa: s.person }, panel: panel("Acerto excluído", [{ rotulo: s.person }]), navegar: LINK, mudou: true };
  }

  return fail("Ação desconhecida.");
}
