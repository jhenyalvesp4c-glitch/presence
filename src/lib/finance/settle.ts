/**
 * Acerto de contas entre duas pessoas que compram uma para a outra nos próprios cartões.
 * Tudo em centavos (inteiros) para a soma nunca "escapar" um centavo. Funções puras, sem rede.
 *
 * Convenção do saldo (do meu ponto de vista): positivo = a outra pessoa me deve; negativo = eu devo a ela.
 *  - compra paga por mim:      ela me deve a parte DELA (other_share %).
 *  - compra paga por ela:      eu devo a minha parte (100 − other_share %).
 *  - pagamento (pix) que eu fiz:   ela passa a me dever mais (eu já a paguei) → saldo sobe.
 *  - pagamento (pix) que ela fez:  saldo desce.
 */

export type Payer = "eu" | "outro";
export type SettleItem = {
  id: string; kind: "compra" | "pagamento"; date: string | null; description: string;
  amount: number; payer: Payer;
  /** compra: % do valor que é DA OUTRA PESSOA (0 = tudo meu, 100 = tudo dela, 50 = dividido). */
  otherShare: number; installment: string;
  /** Veio de uma compra dividida do financeiro: só muda editando a compra. */
  linked?: boolean | undefined;
  /** Pix combinado que ainda não aconteceu: não entra na conta até ser confirmado. */
  pending?: boolean | undefined;
};

export const toCents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);
export const fromCents = (c: number) => c / 100;
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const clampShare = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** Parte da compra que é da outra pessoa / minha, em centavos (a minha é o que sobra, para somar sempre o total). */
export function split(it: Pick<SettleItem, "amount" | "otherShare">): { other: number; mine: number } {
  const total = toCents(it.amount), other = Math.round((total * clampShare(it.otherShare)) / 100);
  return { other, mine: total - other };
}

/** Efeito do item no saldo (centavos). */
export function effect(it: SettleItem): number {
  if (it.kind === "pagamento") return it.payer === "eu" ? toCents(it.amount) : -toCents(it.amount);
  const s = split(it);
  return it.payer === "eu" ? s.other : -s.mine;
}

export type Balance = {
  /** Compras no MEU cartão: o que é da outra pessoa. */
  owedToMe: number;
  /** Compras no cartão DELA: o que é meu. */
  owedByMe: number;
  /** Pix que eu já fiz para ela / que ela já fez para mim. */
  paidByMe: number; paidByOther: number;
  /** owedToMe − owedByMe + paidByMe − paidByOther (centavos). */
  net: number;
  /** Quem faz o pix no final. */
  direction: "outro_paga" | "eu_pago" | "quite";
  amount: number;
};

export function balance(items: SettleItem[]): Balance {
  let owedToMe = 0, owedByMe = 0, paidByMe = 0, paidByOther = 0;
  for (const it of items) {
    if (it.kind === "pagamento" && it.pending) continue;
    if (it.kind === "pagamento") { if (it.payer === "eu") paidByMe += toCents(it.amount); else paidByOther += toCents(it.amount); continue; }
    const s = split(it);
    if (it.payer === "eu") owedToMe += s.other; else owedByMe += s.mine;
  }
  const net = owedToMe - owedByMe + paidByMe - paidByOther;
  return { owedToMe, owedByMe, paidByMe, paidByOther, net, direction: net > 0 ? "outro_paga" : net < 0 ? "eu_pago" : "quite", amount: Math.abs(net) / 100 };
}

const dm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const pct = (n: number) => `${clampShare(n)}%`;

/** Texto pronto para colar no WhatsApp: cada compra, os totais, os pix já feitos e o valor final. */
export function statementText(opts: { me: string; person: string; items: SettleItem[]; generatedOn: string }): string {
  const { me, person, items } = opts, b = balance(items);
  const compras = items.filter((i) => i.kind === "compra"), pix = items.filter((i) => i.kind === "pagamento" && !i.pending);
  const mine = compras.filter((i) => i.payer === "eu"), theirs = compras.filter((i) => i.payer === "outro");
  const line = (i: SettleItem, share: number) => `• ${dm(i.date)} ${i.description || "Compra"}${i.installment ? ` (${i.installment})` : ""} — ${brl(i.amount)}${share === 100 ? "" : ` · ${pct(share)} = ${brl(fromCents(Math.round((toCents(i.amount) * share) / 100)))}`}`;
  const out: string[] = [`*Acerto de contas — ${me} e ${person}*`, `Gerado em ${opts.generatedOn.split("-").reverse().join("/")}`, ""];
  if (mine.length) out.push(`*Compras no cartão de ${me} (parte de ${person})*`, ...mine.map((i) => line(i, i.otherShare)), `Total: ${brl(fromCents(b.owedToMe))}`, "");
  if (theirs.length) out.push(`*Compras no cartão de ${person} (parte de ${me})*`, ...theirs.map((i) => line(i, 100 - i.otherShare)), `Total: ${brl(fromCents(b.owedByMe))}`, "");
  if (pix.length) out.push("*Pix já feitos*", ...pix.map((i) => `• ${dm(i.date)} ${i.payer === "eu" ? me : person} → ${i.payer === "eu" ? person : me} — ${brl(i.amount)}`), "");
  out.push("*Conta final*", `${person} deve a ${me}: ${brl(fromCents(b.owedToMe))}`, `${me} deve a ${person}: ${brl(fromCents(b.owedByMe))}`);
  if (b.paidByMe || b.paidByOther) out.push(`Pix já feitos: ${me} → ${person} ${brl(fromCents(b.paidByMe))} · ${person} → ${me} ${brl(fromCents(b.paidByOther))}`);
  out.push("", b.direction === "quite" ? "*Tudo certo: ninguém deve nada.*" : b.direction === "outro_paga" ? `*${person} faz um pix de ${brl(b.amount)} para ${me}.*` : `*${me} faz um pix de ${brl(b.amount)} para ${person}.*`);
  return out.join("\n");
}

/** Aceita "1.234,56", "R$ 89,90", "89.90", "-45,00". Devolve null se não for número. */
export function parseMoney(s: string): number | null {
  const t = s.replace(/[^\d,.\-]/g, "");
  if (!/\d/.test(t)) return null;
  // "1.200" e "1.234.567" (sem vírgula, grupos de 3) são milhares; "89.90" é decimal
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /^-?\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, "") : t);
  return Number.isFinite(n) ? Math.abs(n) : null;
}

/** Várias contas coladas de uma vez ("Luz 312,40", "Internet - R$ 120,00", "Condomínio: 1.200"): descrição + valor (o último número da linha). */
export function parseBills(text: string): { description: string; amount: number }[] {
  const out: { description: string; amount: number }[] = [];
  for (const raw of text.split(/\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*$/.exec(line);
    if (!m) continue;
    const amount = parseMoney(m[1]!);
    if (amount === null || amount <= 0) continue;
    const description = line.slice(0, m.index).replace(/[\s:\-–—=R$]+$/g, "").trim();
    out.push({ description: description || "Conta", amount });
  }
  return out;
}
