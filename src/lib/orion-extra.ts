/**
 * Orion (segundo cérebro): o que mais o sistema sabe além das anotações e demandas — memórias, hábitos, saúde, listas,
 * plano do dia, financeiro e acertos de contas. Vira "documentos" pesquisáveis, para o Perguntar e o orbe (buscar_no_orion)
 * enxergarem o MESMO sistema. Funções puras: quem lê o banco é `orion.functions.ts`.
 */
import { accountBalance, brl, dateBR, isoOf, isPaused, isSubscription, monthName, monthSummary, openInvoice, recurringActiveIn, reservedBalance, round2, totalBalance, ymOf } from "./finance/calc";
import { balance, fromCents, type SettleItem } from "./finance/settle";
import type { FinanceState } from "./finance/types";
import { budgetLines, budgetTotals, cleanBudget } from "./ideas";
import type { OrionDoc } from "./orion";

const day = (ts: string | null | undefined) => (ts ? ts.slice(0, 10) : undefined);
const num = (v: unknown) => { const n = typeof v === "number" ? v : Number(v); return Number.isFinite(n) ? n : null; };
const kgs = (n: number | null) => (n === null ? "" : `${n.toFixed(1).replace(".", ",")} kg`);

export type ExtraRaw = {
  memories: { id: string; text: string; kind: string | null; created_at: string }[];
  habits: { id: string; name: string; active: boolean }[];
  completions: { habit_id: string; completed_on: string }[];
  measurements: { id: string; name: string; measured_on: string; height_m: number | string | null; weight_kg: number | string | null; values: Record<string, string> | null; notes: string | null }[];
  diet: { id: string; name: string; goal: string | null; calories: number | string | null; protein: number | string | null; carbs: number | string | null; fat: number | string | null; notes: string | null; active: boolean }[];
  meals: { sheet_id: string; name: string; meal_time: string | null; foods: unknown }[];
  workoutSplit: { weekday: number; title: string }[];
  lists: { id: string; title: string; updated_at: string }[];
  listItems: { list_id: string; section: string | null; label: string; done: boolean }[];
  schedule: { plan_date: string; time: string; title: string; done: boolean; kind: string | null }[];
  ideas: { id: string; title: string; body: string; kind: string; area: string; status: string; tags: string[] | null; links: string[] | null; plan: { resumo?: string; passos?: string[]; riscos?: string[]; perguntas?: { q: string; a?: string }[] } | null; budget?: unknown; touched_at: string }[];
  settlements: { id: string; person: string; closed: boolean; default_share: number | null }[];
  settleItems: { settlement_id: string; kind: "compra" | "pagamento"; item_date: string | null; description: string; amount: number | string; payer: "eu" | "outro"; other_share: number; installment: string }[];
};

const WEEK = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export function extraDocs(raw: ExtraRaw, finance: FinanceState | null, today: Date): OrionDoc[] {
  const docs: OrionDoc[] = [], todayIso = isoOf(today);

  for (const m of raw.memories) docs.push({ id: `memoria:${m.id}`, kind: "memoria", title: `Memória: ${m.text.replace(/\s+/g, " ").slice(0, 70)}`, text: `Algo que o Orion guardou sobre a pessoa${m.kind ? ` (${m.kind})` : ""}: ${m.text}`, date: day(m.created_at), link: "/configuracoes" });

  if (raw.habits.length) {
    const since = isoOf(new Date(today.getTime() - 30 * 86_400_000));
    const lines = raw.habits.filter((h) => h.active).map((h) => {
      const done = raw.completions.filter((c) => c.habit_id === h.id && c.completed_on >= since).map((c) => c.completed_on).sort();
      return `${h.name}: feito ${done.length} vez(es) nos últimos 30 dias${done.length ? `; último em ${dateBR(done.at(-1)!)}` : ""}${done.includes(todayIso) ? "; já feito hoje" : ""}`;
    });
    docs.push({ id: "habito:resumo", kind: "habito", title: "Hábitos: como estão, o que foi feito e a constância", text: lines.join("\n"), date: todayIso, link: "/habitos" });
  }

  const ms = [...raw.measurements].sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  ms.slice(-24).forEach((m) => {
    const vals = Object.entries(m.values ?? {}).filter(([, v]) => String(v).trim()).map(([k, v]) => `${k} ${v} cm`).join(", ");
    docs.push({ id: `saude:medida:${m.id}`, kind: "saude", title: `Saúde: peso e medidas de ${dateBR(m.measured_on)}`, text: [`Peso ${kgs(num(m.weight_kg))}.`, m.height_m ? `Altura ${m.height_m} m.` : "", vals ? `Medidas: ${vals}.` : "", m.notes ?? ""].filter(Boolean).join(" "), date: m.measured_on, link: "/analise" });
  });
  if (ms.length > 1) {
    const f = ms[0]!, l = ms.at(-1)!, a = num(f.weight_kg), b = num(l.weight_kg);
    if (a !== null && b !== null) docs.push({ id: "saude:evolucao", kind: "saude", title: "Saúde: evolução do peso e das medidas", text: `Peso foi de ${kgs(a)} (${dateBR(f.measured_on)}) para ${kgs(b)} (${dateBR(l.measured_on)}): ${b - a > 0 ? "+" : ""}${(b - a).toFixed(1).replace(".", ",")} kg em ${ms.length} registros.`, date: l.measured_on, link: "/analise" });
  }
  for (const d of raw.diet.filter((x) => x.active)) {
    const meals = raw.meals.filter((x) => x.sheet_id === d.id).map((x) => `${x.meal_time ?? ""} ${x.name}`.trim()).join("; ");
    docs.push({ id: `saude:dieta:${d.id}`, kind: "saude", title: `Saúde: dieta ${d.name}`, text: [d.goal ? `Objetivo: ${d.goal}.` : "", `Calorias ${d.calories ?? "—"}, proteína ${d.protein ?? "—"} g, carboidrato ${d.carbs ?? "—"} g, gordura ${d.fat ?? "—"} g.`, meals ? `Refeições: ${meals}.` : "", d.notes ?? ""].filter(Boolean).join(" "), date: todayIso, link: "/saude" });
  }
  if (raw.workoutSplit.length) docs.push({ id: "saude:treino", kind: "saude", title: "Saúde: treino da semana (divisão)", text: [...raw.workoutSplit].sort((a, b) => a.weekday - b.weekday).map((w) => `${WEEK[w.weekday] ?? w.weekday}: ${w.title}`).join("; "), date: todayIso, link: "/treino" });

  for (const l of raw.lists) {
    const items = raw.listItems.filter((i) => i.list_id === l.id);
    docs.push({ id: `lista:${l.id}`, kind: "lista", title: `Lista: ${l.title}`, text: `${items.filter((i) => i.done).length} de ${items.length} itens feitos.\n${items.slice(0, 80).map((i) => `${i.done ? "[x]" : "[ ]"} ${i.section ? `${i.section} · ` : ""}${i.label}`).join("\n")}`, date: day(l.updated_at), link: "/listas" });
  }

  const byDate = new Map<string, ExtraRaw["schedule"]>();
  for (const s of raw.schedule) (byDate.get(s.plan_date) ?? byDate.set(s.plan_date, []).get(s.plan_date)!).push(s);
  for (const [d, list] of byDate) docs.push({ id: `plano:${d}`, kind: "plano", title: `Plano do dia ${dateBR(d)}`, text: [...list].sort((a, b) => a.time.localeCompare(b.time)).map((s) => `${s.time.slice(0, 5)} ${s.title}${s.done ? " (feito)" : ""}`).join("\n"), date: d, link: "/planejamento/dia" });

  for (const i of raw.ideas ?? []) {
    const p = i.plan, ref = i.kind === "referencia";
    const text = [i.body, `${ref ? "Referência do mural" : "Ideia"} · estado ${i.status} · ${i.area === "negocios" ? "negócios" : "pessoal"}${(i.tags ?? []).length ? ` · #${(i.tags ?? []).join(" #")}` : ""}`, (i.links ?? []).join(" "), p?.resumo ? `Plano: ${p.resumo}` : "", p?.passos?.length ? `Passos: ${p.passos.join("; ")}` : "", p?.riscos?.length ? `Riscos: ${p.riscos.join("; ")}` : "", ...(p?.perguntas ?? []).filter((q) => q.a).map((q) => `${q.q} → ${q.a}`), ...(cleanBudget(i.budget).length ? [`Orçamento (total R$ ${budgetTotals(cleanBudget(i.budget)).total.toFixed(2).replace(".", ",")}):`, ...budgetLines(cleanBudget(i.budget))] : [])].filter(Boolean).join("\n");
    docs.push({ id: `ideia:${i.id}`, kind: "ideia", title: `${ref ? "Referência" : "Ideia"}: ${i.title}`, text, date: day(i.touched_at), link: "/ideias" });
  }

  for (const s of raw.settlements) {
    const items: SettleItem[] = raw.settleItems.filter((i) => i.settlement_id === s.id).map((i, n) => ({ id: String(n), kind: i.kind, date: i.item_date, description: i.description, amount: Number(i.amount), payer: i.payer, otherShare: i.other_share, installment: i.installment }));
    const b = balance(items);
    const final = b.direction === "quite" ? "ninguém deve nada" : b.direction === "outro_paga" ? `${s.person} paga ${brl(b.amount)} a você` : `você paga ${brl(b.amount)} a ${s.person}`;
    docs.push({ id: `financeiro:acerto:${s.id}`, kind: "financeiro", title: `Acerto de contas com ${s.person}`, text: [`Conta final: ${final}${s.closed ? " (quitado)" : ""}.`, `${s.person} deve a você ${brl(fromCents(b.owedToMe))}; você deve a ${s.person} ${brl(fromCents(b.owedByMe))}; pix já feitos: você ${brl(fromCents(b.paidByMe))}, ${s.person} ${brl(fromCents(b.paidByOther))}.`, ...items.slice(0, 40).map((i) => `${i.date ? dateBR(i.date) : ""} ${i.description || i.kind} ${brl(i.amount)} (${i.kind === "pagamento" ? "pix" : i.payer === "eu" ? "meu cartão" : `cartão de ${s.person}`}${i.kind === "compra" ? `, parte de ${s.person} ${i.otherShare}%` : ""})`.trim())].join("\n"), date: todayIso, link: "/financeiro?aba=acerto" });
  }

  if (finance && (finance.onboarded || finance.accounts.length)) {
    const ym = ymOf(today), sm = monthSummary(finance, ym, todayIso), subs = finance.recurring.filter(isSubscription);
    const ativas = subs.filter((r) => !isPaused(r) && recurringActiveIn(r, ym));
    docs.push({
      id: "financeiro:resumo", kind: "financeiro", title: "Financeiro: saldo das contas, faturas dos cartões, assinaturas e o mês", date: todayIso, link: "/financeiro",
      text: [
        `Saldo livre nas contas (sem os cofrinhos): ${brl(totalBalance(finance, today))}. Guardado nos cofrinhos (separado para pagar parcelas): ${brl(reservedBalance(finance, today))}. ${finance.accounts.map((a) => `${a.name}: ${brl(accountBalance(finance, a, today))}`).join("; ")}.`,
        finance.cards.length ? `Faturas abertas: ${finance.cards.map((c) => { const i = openInvoice(finance, c, today); return `${c.name} ${brl(i.total)} (vence ${dateBR(i.due)}${i.othersOwe > 0 ? `; ${brl(i.othersOwe)} a receber de outras pessoas, minha parte ${brl(i.mine)}` : ""})`; }).join("; ")}.` : "",
        `${monthName(ym)}: entrou ${brl(sm.receitas)}, saiu ${brl(sm.despesas)}, ainda a receber ${brl(sm.aReceber)} e a pagar ${brl(sm.aPagar)}; previsto ${brl(sm.previsto)}.`,
        `Assinaturas ativas (${ativas.length}): ${ativas.map((r) => `${r.desc} ${brl(r.amount)}`).join("; ") || "nenhuma"}; total ${brl(round2(ativas.reduce((n, r) => n + r.amount, 0)))} por mês.${subs.some(isPaused) ? ` Pausadas: ${subs.filter(isPaused).map((r) => r.desc).join(", ")}.` : ""}`,
      ].filter(Boolean).join("\n"),
    });
  }
  return docs;
}
