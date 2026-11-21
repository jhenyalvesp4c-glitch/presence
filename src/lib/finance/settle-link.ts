/**
 * Vínculo entre compras divididas (financeiro) e o acerto de contas: cada compra dividida com uma pessoa vira itens no acerto dela,
 * sempre os mesmos (chave `source_ref`), então editar ou apagar a compra atualiza o acerto sem duplicar.
 * A parte pura (quais itens devem existir) fica aqui; a gravação, em `syncSettlementLinks`.
 */
import { addMonths, closingDateOf, dayIn, invoiceMonthOf, parcelAmount, planShare, recurringActiveIn, round2, ymOf } from "./calc";
import type { FinanceState } from "./types";
import type { ItemDraft } from "./settle-data";

export type LinkedItem = { ref: string; person: string; draft: ItemDraft };

export const personKey = (s: string) => s.trim().toLocaleLowerCase("pt-BR");

/** Data que conta no acerto: compra no crédito vale pelo FECHAMENTO da fatura em que cai (não pelo vencimento), para o mês bater com o que você paga. */
const countDate = (card: { closingDay: number; dueDay: number } | undefined, dateIso: string, credit: boolean) => (card && credit ? closingDateOf(card, invoiceMonthOf(card, dateIso)) : dateIso);

/** Itens do acerto que devem existir hoje, a partir das parcelas e movimentações divididas. */
export function desiredItems(s: FinanceState, today: Date = new Date()): LinkedItem[] {
  const out: LinkedItem[] = [];
  for (const p of s.plans) {
    const person = p.shared?.person.trim();
    const card = s.cards.find((c) => c.id === p.cardId);
    if (!person || !card) continue;
    for (let n = 1; n <= p.count; n++) {
      const sh = planShare(p, n);
      if (!sh) continue;
      const amount = parcelAmount(p, n), fixed = !!p.shared?.fixed;
      // ajuda fixa: o valor exato que a pessoa cobre (pode ser só parte da parcela); fatia: parcela inteira e a %
      const part = fixed ? round2((amount * sh.percent) / 100) : amount;
      if (part <= 0) continue;
      out.push({ ref: `plan:${p.id}:${n}`, person, draft: { kind: "compra", date: closingDateOf(card, addMonths(p.first, n - 1)), description: p.desc, amount: part, payer: "eu", otherShare: fixed ? 100 : Math.round(sh.percent), installment: `${n}/${p.count}` } });
    }
  }
  for (const t of s.transactions) {
    const person = t.shared?.person.trim();
    if (!person || t.kind !== "despesa" || !t.shared || t.amount <= 0) continue;
    out.push({ ref: `tx:${t.id}`, person, draft: { kind: "compra", date: countDate(s.cards.find((c) => c.id === t.cardId), t.date, t.method === "credito"), description: t.desc, amount: t.amount, payer: "eu", otherShare: Math.round(t.shared.percent), installment: "" } });
  }
  // assinaturas e contas fixas divididas: um item por mês ativo (até 24 meses atrás e 12 à frente), respeitando as pausas
  const nowYm = ymOf(today), from = addMonths(nowYm, -24), to = addMonths(nowYm, 12);
  for (const r of s.recurring) {
    const person = r.shared?.person.trim();
    if (!person || !r.shared || r.kind !== "despesa" || r.amount <= 0) continue;
    for (let ym = r.startYm > from ? r.startYm : from; ym <= to; ym = addMonths(ym, 1)) {
      if (!recurringActiveIn(r, ym)) continue;
      out.push({ ref: `rec:${r.id}:${ym}`, person, draft: { kind: "compra", date: countDate(s.cards.find((c) => c.id === r.cardId), dayIn(ym, r.day), r.method === "credito"), description: r.desc, amount: r.amount, payer: "eu", otherShare: Math.round(r.shared.percent), installment: "" } });
    }
  }
  return out;
}

type DbItem = { id: string; settlement_id: string; source_ref: string; item_date: string | null; description: string; amount: number | string; other_share: number; installment: string };
type DbSettlement = { id: string; person: string; closed: boolean };

export type SyncPlan = { create: LinkedItem[]; update: { id: string; settlementId: string; item: LinkedItem }[]; remove: string[]; newPeople: string[] };

/** Compara o que deve existir com o que já está no acerto. Acertos encerrados nunca são alterados. */
export function planSync(desired: LinkedItem[], settlements: DbSettlement[], existing: DbItem[]): SyncPlan {
  const open = new Map<string, string>(), closedIds = new Set(settlements.filter((x) => x.closed).map((x) => x.id));
  for (const x of settlements) if (!x.closed && !open.has(personKey(x.person))) open.set(personKey(x.person), x.id);
  const byRef = new Map(existing.map((e) => [e.source_ref, e]));
  const create: LinkedItem[] = [], update: SyncPlan["update"] = [], newPeople = new Set<string>();
  for (const d of desired) {
    const cur = byRef.get(d.ref), target = open.get(personKey(d.person));
    if (cur) {
      if (closedIds.has(cur.settlement_id)) continue;
      const same = (cur.item_date ?? null) === (d.draft.date ?? null) && cur.description === d.draft.description.trim().slice(0, 200) && Number(cur.amount) === round2(d.draft.amount) && cur.other_share === d.draft.otherShare && cur.installment === d.draft.installment;
      const sameOwner = !target || target === cur.settlement_id;
      if (same && sameOwner) continue;
      if (!target) newPeople.add(d.person);
      update.push({ id: cur.id, settlementId: target ?? "", item: d });
    } else { create.push(d); if (!target) newPeople.add(d.person); }
  }
  const wanted = new Set(desired.map((d) => d.ref));
  const remove = existing.filter((e) => !wanted.has(e.source_ref) && !closedIds.has(e.settlement_id)).map((e) => e.id);
  const seen = new Set<string>(), people: string[] = [];
  for (const n of newPeople) if (!seen.has(personKey(n))) { seen.add(personKey(n)); people.push(n); }
  return { create, update, remove, newPeople: people };
}

const cols = (it: LinkedItem) => ({ kind: "compra" as const, item_date: it.draft.date || null, description: it.draft.description.trim().slice(0, 200), amount: round2(it.draft.amount), payer: "eu" as const, other_share: Math.min(100, Math.max(0, it.draft.otherShare)), installment: it.draft.installment.trim().slice(0, 20), source_ref: it.ref });

/** Grava o que falta no acerto (cria o acerto da pessoa nova). Devolve true se algo mudou. */
export async function syncSettlementLinks(state: FinanceState): Promise<boolean> {
  const { must, supabase } = await import("../data/db");
  const desired = desiredItems(state);
  const settlements = must(await supabase.from("fin_settlements").select("id, person, closed")) as DbSettlement[];
  const existing = must(await supabase.from("fin_settlement_items").select("id, settlement_id, source_ref, item_date, description, amount, other_share, installment").not("source_ref", "is", null)) as DbItem[];
  const plan = planSync(desired, settlements, existing);
  if (!plan.create.length && !plan.update.length && !plan.remove.length) return false;
  const open = new Map<string, string>();
  for (const x of settlements) if (!x.closed && !open.has(personKey(x.person))) open.set(personKey(x.person), x.id);
  for (const person of plan.newPeople) {
    const rows = must(await supabase.from("fin_settlements").insert({ person: person.trim().slice(0, 80) }).select("id, person")) as { id: string; person: string }[];
    if (rows[0]) open.set(personKey(person), rows[0].id);
  }
  const counts = new Map<string, number>();
  const nextPos = async (sid: string) => { if (!counts.has(sid)) { const r = must(await supabase.from("fin_settlement_items").select("id", { count: "exact", head: false }).eq("settlement_id", sid)) as unknown[]; counts.set(sid, r.length); } const v = counts.get(sid)!; counts.set(sid, v + 1); return v; };
  if (plan.remove.length) must(await supabase.from("fin_settlement_items").delete().in("id", plan.remove).select("id"));
  for (const u of plan.update) { const sid = open.get(personKey(u.item.person)) ?? u.settlementId; must(await supabase.from("fin_settlement_items").update({ ...cols(u.item), settlement_id: sid }).eq("id", u.id).select("id")); }
  if (plan.create.length) {
    const rows = [];
    for (const it of plan.create) { const sid = open.get(personKey(it.person)); if (sid) rows.push({ ...cols(it), settlement_id: sid, position: await nextPos(sid) }); }
    if (rows.length) must(await supabase.from("fin_settlement_items").insert(rows).select("id"));
  }
  return true;
}
