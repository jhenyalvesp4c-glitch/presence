/**
 * Lançamento por linguagem natural ("Hoje comprei um livro de R$ 30 no débito pelo Nubank").
 * Nesta etapa é uma interpretação por regras (sem IA), pronta para ser trocada pelo assistente: a tela só depende da forma do `Draft`.
 */
import { addMonths, isoOf, parseIso } from "./calc";
import { guessCategory } from "./categories";
import type { FinanceState, Method, TxKind } from "./types";

export type Draft = {
  kind: TxKind; desc: string; amount: number; date: string; method: Method | null;
  accountId?: string | undefined; cardId?: string | undefined; category: string; installments: number;
  /** 0 a 1: quanto da frase foi entendido. */
  confidence: number; missing: string[];
};

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const num = (s: string) => { const t = s.trim(); return t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : /^\d{1,3}(\.\d{3})+$/.test(t) ? Number(t.replace(/\./g, "")) : Number(t); };

export function parseAmount(text: string): number | null {
  const a = /R\$\s*([\d.]+(?:,\d{1,2})?)/i.exec(text) ?? /([\d.]+(?:,\d{1,2})?)\s*(?:reais|real|conto|pila)/i.exec(text);
  if (a) { const v = num(a[1]!); return Number.isFinite(v) && v > 0 ? v : null; }
  // número solto, desconsiderando o das parcelas e de datas
  const cleaned = text.replace(/\d{1,2}\s*(?:x|vezes|parcelas?)/gi, " ").replace(/\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/g, " ").replace(/dia\s+\d{1,2}/gi, " ");
  const m = /(?:^|\s)(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)(?=\s|$|[.,!?])/.exec(cleaned);
  if (m) { const v = num(m[1]!); return Number.isFinite(v) && v > 0 ? v : null; }
  return null;
}

export function parseDate(text: string, today: Date): { iso: string; found: boolean } {
  const t = strip(text), d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (/\banteontem\b/.test(t)) { d0.setDate(d0.getDate() - 2); return { iso: isoOf(d0), found: true }; }
  if (/\bontem\b/.test(t)) { d0.setDate(d0.getDate() - 1); return { iso: isoOf(d0), found: true }; }
  const full = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(t);
  if (full) {
    const y = full[3] ? (full[3].length === 2 ? 2000 + Number(full[3]) : Number(full[3])) : today.getFullYear();
    const d = new Date(y, Number(full[2]) - 1, Number(full[1]));
    if (!Number.isNaN(d.getTime()) && d.getMonth() === Number(full[2]) - 1) return { iso: isoOf(d), found: true };
  }
  const dia = /\bdia\s+(\d{1,2})\b/.exec(t);
  if (dia) { const day = Number(dia[1]); let ym = isoOf(today).slice(0, 7); if (day > today.getDate()) ym = addMonths(ym, -1); return { iso: `${ym}-${String(day).padStart(2, "0")}`, found: true }; }
  return { iso: isoOf(today), found: /\bhoje\b/.test(t) };
}

export function parseNatural(text: string, s: FinanceState, today: Date = new Date()): Draft {
  const raw = text.trim(), t = strip(raw);
  const income = /\b(recebi|ganhei|caiu|entrou|vendi|salario|deposito|reembolso)\b/.test(t) && !/\b(comprei|paguei|gastei|parcelei)\b/.test(t);
  const amount = parseAmount(raw) ?? 0;
  const inst = /(\d{1,2})\s*(?:x\b|vezes|parcelas?)/.exec(t);
  const installments = inst ? Math.max(1, Math.min(60, Number(inst[1]))) : 1;
  const { iso, found: dateFound } = parseDate(raw, today);

  let method: Method | null = null;
  if (/credito|cartao|parcel/.test(t) || installments > 1) method = "credito";
  else if (/debito/.test(t)) method = "debito";
  else if (/dinheiro|especie/.test(t)) method = "dinheiro";
  else if (/\bpix\b/.test(t)) method = "pix";

  const byName = <T extends { id: string; name: string }>(list: T[]) => list.filter((x) => new RegExp(`(?<![a-z0-9])${strip(x.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t)).sort((a, b) => b.name.length - a.name.length)[0];
  const card = byName(s.cards), account = byName(s.accounts);
  let cardId: string | undefined, accountId: string | undefined;
  if (method === "credito") cardId = card?.id ?? (account ? s.cards.find((c) => strip(c.name) === strip(account.name))?.id : undefined);
  else if (method) accountId = account?.id ?? (method === "dinheiro" ? s.accounts.find((a) => a.kind === "dinheiro")?.id : card ? s.accounts.find((a) => strip(a.name) === strip(card.name))?.id : undefined);
  else if (income && account) { method = "pix"; accountId = account.id; }
  else if (card) { method = "credito"; cardId = card.id; }
  else if (account) { method = income ? "pix" : "debito"; accountId = account.id; }

  // descrição: o que veio depois de "comprei/paguei/gastei" até o valor ou a forma de pagamento
  let desc = "";
  const head = /(?:comprei|paguei|gastei|pedi|assinei|parcelei|recebi|ganhei|vendi)\s+(?:(?:um|uma|uns|umas|o|a)\s+)?([A-Za-zÀ-ú].*?)(?=\s+(?:de|por|no|na|em|pelo|pela|com|r\$|\d)|[.,!?]|$)/i.exec(raw);
  if (head) desc = head[1]!.trim();
  if (!desc || desc.length < 2) {
    desc = raw.replace(/R\$\s*[\d.,]+/gi, " ").replace(/\b(hoje|ontem|anteontem)\b/gi, " ")
      .replace(/\b(?:no|na|pelo|pela|em|com|via)\s+(?:o\s+|a\s+)?(?:d[eé]bito|cr[eé]dito|pix|dinheiro|cart[aã]o)\b/gi, " ")
      .replace(/\b(?:no|na|pelo|pela|em|com|via)\s+[A-Za-zÀ-ú ]+$/i, " ").replace(/\s+/g, " ").trim();
    desc = desc.replace(/^(?:recebi|ganhei|vendi|comprei|paguei|gastei|parcelei)\s+(?:(?:de|um|uma)\s+)*/i, "").replace(/(?:\s+(?:de|por|no|na|em|pelo|pela|com|um|uma))+$/i, "").trim();
  }
  desc = desc.replace(/^(uma?|o|a)\s+/i, "");
  desc = desc ? desc[0]!.toUpperCase() + desc.slice(1) : income ? "Receita" : "Compra";

  const missing: string[] = [];
  if (!amount) missing.push("valor");
  if (!method) missing.push("forma de pagamento");
  else if (method === "credito" && !cardId) missing.push("cartão");
  else if (method !== "credito" && !accountId && method !== "dinheiro") missing.push("conta");
  const got = [amount > 0, !!method, !!(cardId || accountId || method === "dinheiro"), desc.length > 2, dateFound].filter(Boolean).length;
  return { kind: income ? "receita" : "despesa", desc, amount, date: iso, method, accountId, cardId, category: guessCategory(desc, income), installments, confidence: got / 5, missing };
}

export const examplePhrases = [
  "Hoje comprei um livro de R$ 30 no débito pelo Nubank",
  "Parcelei uma compra de R$ 600 em 6 vezes no PicPay",
  "Ontem almocei por R$ 42,90 no pix",
  "Recebi R$ 800 de um freela no PicPay",
];
export { parseIso };
