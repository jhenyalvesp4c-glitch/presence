/** Dados fictícios para demonstrar o módulo. Sempre relativos a "hoje", para a demonstração nunca ficar velha. */
import { addMonths, dayIn, isoOf, ymOf } from "./calc";
import { guessCategory } from "./categories";
import type { Account, Card, FinanceState, Goal, Method, Plan, Recurring, Transaction } from "./types";

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function makeMock(today: Date = new Date()): FinanceState {
  const ym0 = ymOf(today), base = isoOf(today), todayDay = today.getDate();
  const accounts: Account[] = [
    { id: "acc-nubank", name: "Nubank", kind: "banco", tone: "roxo", balanceBase: 4280.5, baseDate: base },
    { id: "acc-picpay", name: "PicPay", kind: "carteira", tone: "verde", balanceBase: 612.3, baseDate: base },
    { id: "acc-mp", name: "Mercado Pago", kind: "carteira", tone: "azul", balanceBase: 1150, baseDate: base },
    { id: "acc-cash", name: "Dinheiro na carteira", kind: "dinheiro", tone: "grafite", balanceBase: 180, baseDate: base },
  ];
  const cards: Card[] = [
    { id: "card-nubank", name: "Nubank", brand: "mastercard", last4: "4821", tone: "roxo", limit: 12000, availableBase: 7350, baseDate: base, closingDay: 25, dueDay: 5, adjustments: {} },
    { id: "card-picpay", name: "PicPay", brand: "visa", last4: "7730", tone: "verde", limit: 5000, availableBase: 3100, baseDate: base, closingDay: 20, dueDay: 28, adjustments: {} },
    { id: "card-mp", name: "Mercado Pago", brand: "mastercard", last4: "1209", tone: "azul", limit: 3500, availableBase: 2600, baseDate: base, closingDay: 10, dueDay: 17, adjustments: {} },
  ];
  const recurring: Recurring[] = [
    { id: "rec-salario", kind: "receita", desc: "Salário", amount: 6200, day: 5, category: "salario", method: "pix", accountId: "acc-nubank", startYm: addMonths(ym0, -9) },
    { id: "rec-freela", kind: "receita", desc: "Freela mensal", amount: 800, day: 20, category: "extra", method: "pix", accountId: "acc-picpay", startYm: addMonths(ym0, -6) },
    { id: "rec-aluguel", kind: "despesa", desc: "Aluguel", amount: 1650, day: 5, category: "moradia", method: "debito", accountId: "acc-nubank", startYm: addMonths(ym0, -9) },
    { id: "rec-condo", kind: "despesa", desc: "Condomínio", amount: 480, day: 10, category: "moradia", method: "debito", accountId: "acc-nubank", startYm: addMonths(ym0, -9) },
    { id: "rec-internet", kind: "despesa", desc: "Internet fibra", amount: 119.9, day: 12, category: "moradia", method: "credito", cardId: "card-picpay", startYm: addMonths(ym0, -9) },
    { id: "rec-netflix", kind: "despesa", desc: "Netflix", amount: 55.9, day: 8, category: "assinaturas", method: "credito", cardId: "card-nubank", startYm: addMonths(ym0, -9) },
    { id: "rec-spotify", kind: "despesa", desc: "Spotify", amount: 21.9, day: 14, category: "assinaturas", method: "credito", cardId: "card-nubank", startYm: addMonths(ym0, -9) },
    { id: "rec-fortnite", kind: "despesa", desc: "Fortnite Crew", amount: 44.9, day: 18, category: "assinaturas", method: "credito", cardId: "card-picpay", startYm: addMonths(ym0, -5), subscription: true },
    { id: "rec-ifood", kind: "despesa", desc: "iFood Club", amount: 12.9, day: 3, category: "assinaturas", method: "credito", cardId: "card-nubank", startYm: addMonths(ym0, -7), subscription: true },
    { id: "rec-disney", kind: "despesa", desc: "Disney+", amount: 43.9, day: 22, category: "assinaturas", method: "credito", cardId: "card-nubank", startYm: addMonths(ym0, -9), subscription: true, pauses: [{ from: addMonths(ym0, -2) }] },
    { id: "rec-academia", kind: "despesa", desc: "Academia", amount: 129.9, day: 10, category: "saude", method: "credito", cardId: "card-mp", startYm: addMonths(ym0, -9) },
  ];
  const plans: Plan[] = [
    { id: "plan-notebook", desc: "Notebook Dell Inspiron", cardId: "card-nubank", total: 5400, count: 10, per: 540, purchaseYm: addMonths(ym0, -4), first: addMonths(ym0, -3), category: "compras", createdAt: `${addMonths(ym0, -4)}-12` },
    { id: "plan-sofa", desc: "Sofá retrátil", cardId: "card-picpay", total: 2500, count: 8, per: 312.5, purchaseYm: addMonths(ym0, -2), first: addMonths(ym0, -1), category: "moradia", createdAt: `${addMonths(ym0, -2)}-22` },
    { id: "plan-ingles", desc: "Curso de inglês", cardId: "card-mp", total: 1798.8, count: 12, per: 149.9, purchaseYm: addMonths(ym0, -6), first: addMonths(ym0, -5), category: "educacao", createdAt: `${addMonths(ym0, -6)}-05` },
    { id: "plan-tenis", desc: "Tênis de corrida", cardId: "card-mp", total: 759.6, count: 4, per: 189.9, purchaseYm: addMonths(ym0, -2), first: addMonths(ym0, -1), category: "compras", createdAt: `${addMonths(ym0, -2)}-18` },
    { id: "plan-lisboa", desc: "Passagens Lisboa", cardId: "card-nubank", total: 2460, count: 6, per: 410, purchaseYm: ym0, first: addMonths(ym0, 1), category: "lazer", createdAt: base },
  ];

  // Compras do dia a dia dos últimos 6 meses. O mês atual tem Restaurantes e Lazer em alta, para o painel ter uma história para contar.
  const txs: Transaction[] = [];
  const shops: { cat: string; names: string[]; min: number; max: number; per: [number, number] }[] = [
    { cat: "mercado", names: ["Supermercado Pão de Açúcar", "Feira livre", "Atacadão", "Padaria Estrela"], min: 55, max: 270, per: [4, 5] },
    { cat: "restaurantes", names: ["iFood", "Almoço executivo", "Pizzaria Bella", "Café Colombo", "Hambúrguer artesanal"], min: 26, max: 92, per: [4, 6] },
    { cat: "transporte", names: ["Uber", "99 Pop", "Posto Shell", "Estacionamento"], min: 14, max: 56, per: [6, 8] },
    { cat: "saude", names: ["Farmácia Drogasil", "Consulta dentista", "Exame de sangue"], min: 38, max: 140, per: [1, 2] },
    { cat: "lazer", names: ["Cinema", "Ingresso show", "Parque", "Bar com amigos"], min: 35, max: 130, per: [1, 3] },
    { cat: "compras", names: ["Camisa", "Presente aniversário", "Shopee"], min: 70, max: 240, per: [0, 2] },
    { cat: "educacao", names: ["Livro", "Curso Udemy"], min: 28, max: 95, per: [0, 1] },
  ];
  const mix: { m: Method; acc?: string; card?: string }[] = [
    { m: "debito", acc: "acc-nubank" }, { m: "credito", card: "card-nubank" }, { m: "credito", card: "card-nubank" }, { m: "pix", acc: "acc-picpay" },
    { m: "debito", acc: "acc-mp" }, { m: "dinheiro", acc: "acc-cash" }, { m: "credito", card: "card-picpay" }, { m: "credito", card: "card-mp" },
  ];
  for (let back = 5; back >= 0; back--) {
    const ym = addMonths(ym0, -back), r = rng(20261117 + back * 977), last = back === 0 ? todayDay : 28;
    for (const sh of shops) {
      const spike = back === 0 ? (sh.cat === "restaurantes" ? 3.4 : sh.cat === "lazer" ? 2.8 : sh.cat === "transporte" ? 1.15 : 1) : 1;
      const n = Math.round((sh.per[0] + r() * (sh.per[1] - sh.per[0])) * (back === 0 ? Math.min(1, todayDay / 26) * spike : 1));
      for (let i = 0; i < n; i++) {
        const name = sh.names[Math.floor(r() * sh.names.length)]!, amount = Math.round((sh.min + r() * (sh.max - sh.min)) * (back === 0 && spike > 1.5 ? 1.25 : 1) * 100) / 100;
        const day = 1 + Math.floor(r() * Math.max(1, last - 1)), how = mix[Math.floor(r() * mix.length)]!;
        // não deixa compras "do futuro" no mês atual
        txs.push({ id: `tx-${ym}-${sh.cat}-${i}`, kind: "despesa", desc: name, amount, date: dayIn(ym, Math.min(day, back === 0 ? todayDay : 28)), method: how.m, accountId: how.acc, cardId: how.card, category: sh.cat });
      }
    }
  }
  txs.push({ id: "tx-livro", kind: "despesa", desc: "Livro Hábitos Atômicos", amount: 30, date: isoOf(today), method: "debito", accountId: "acc-nubank", category: guessCategory("livro") });
  txs.push({ id: "tx-extra", kind: "receita", desc: "Venda de bicicleta usada", amount: 450, date: dayIn(ym0, Math.max(1, todayDay - 6)), method: "pix", accountId: "acc-picpay", category: "extra" });

  const goals: Goal[] = [
    { id: "goal-reserva", kind: "reserva", title: "Reserva de emergência", target: 18000, current: 6400, deadline: `${addMonths(ym0, 10)}-28` },
    { id: "goal-lisboa", kind: "guardar", title: "Viagem para Lisboa", target: 9000, current: 2150, deadline: `${addMonths(ym0, 8)}-15` },
    { id: "goal-poupar", kind: "economizar_mensal", title: "Economizar todo mês", target: 500, current: 320, monthly: 500 },
    { id: "goal-rest", kind: "limite_categoria", title: "Limite de Restaurantes", target: 600, current: 0, category: "restaurantes" },
    { id: "goal-cartao", kind: "quitar_cartao", title: "Quitar o cartão Nubank", target: 3000, current: 1200, cardId: "card-nubank", deadline: `${addMonths(ym0, 4)}-05` },
  ];
  return { version: 1, onboarded: true, mock: true, accounts, cards, plans, recurring, transactions: txs, goals };
}
