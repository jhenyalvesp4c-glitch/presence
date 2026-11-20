/**
 * Projetos e ideias: tipos e regras puras da caixa de ideias (sem rede, para testar à parte).
 * Uma ideia pode virar projeto, tarefa, lembrete ou documentação; referências (prints, links) ficam no mural.
 */
import type { Demand } from "./demands";

export type IdeaKind = "ideia" | "referencia";
export type IdeaArea = "pessoal" | "negocios";
export type IdeaStatus = "solta" | "explorando" | "validando" | "fazendo" | "arquivada";
export type IdeaSource = "texto" | "voz" | "print" | "orion";
export type IdeaFile = { path: string; name: string; mime: string; size: number };
export type IdeaPlan = {
  resumo: string;
  perguntas: { q: string; a: string }[];
  riscos: string[];
  passos: string[];
  precisa: { tempo: string; dinheiro: string; pessoas: string };
  proximoPasso: string;
  geradoEm: string;
};
export type Conversion = { tipo: "projeto" | "tarefa" | "lembrete" | "documentacao"; id: string; label: string; em: string };
export type BudgetStatus = "comprar" | "comprado" | "tenho";
/** Um item do orçamento da ideia. `valor` é o preço de UMA unidade; `estimado` = chute do Orion (a pessoa ainda não confirmou). */
export type BudgetItem = { id: string; nome: string; qtd: number; valor: number | null; link: string; status: BudgetStatus; nota: string; estimado: boolean };
export type Idea = {
  id: string; title: string; body: string; kind: IdeaKind; area: IdeaArea; status: IdeaStatus; tags: string[]; links: string[];
  attachments: IdeaFile[]; plan: IdeaPlan | null; budget: BudgetItem[]; converted: Conversion[]; source: IdeaSource; touchedAt: string; createdAt: string;
};

export const STATUSES: { id: IdeaStatus; label: string; hint: string; color: string }[] = [
  { id: "solta", label: "Solta", hint: "Acabou de chegar", color: "cyan" },
  { id: "explorando", label: "Explorando", hint: "Pensando nela", color: "violet" },
  { id: "validando", label: "Validando", hint: "Testando se vale a pena", color: "amber" },
  { id: "fazendo", label: "Fazendo", hint: "Virou ação", color: "emerald" },
  { id: "arquivada", label: "Arquivada", hint: "Guardada para depois", color: "pink" },
];
export const AREAS: { id: IdeaArea; label: string }[] = [{ id: "pessoal", label: "Pessoal" }, { id: "negocios", label: "Negócios" }];
export const statusLabel = (s: IdeaStatus) => STATUSES.find((x) => x.id === s)?.label ?? s;

const DAY = 86_400_000;
export const daysSince = (iso: string, now: Date): number => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY));

/** Ideias "paradas": ainda em aberto (nem fazendo, nem arquivadas) e sem mexer há `days` dias ou mais. */
export function staleIdeas(ideas: Idea[], now: Date, days = 30): Idea[] {
  return ideas.filter((i) => i.kind === "ideia" && i.status !== "fazendo" && i.status !== "arquivada" && daysSince(i.touchedAt, now) >= days).sort((a, b) => a.touchedAt.localeCompare(b.touchedAt));
}

export type Digest = { total: number; abertas: number; novasNaSemana: number; paradas: Idea[]; porStatus: Record<IdeaStatus, number>; texto: string };
/** Resumo semanal: quantas ideias há, quantas chegaram nesta semana e quais estão paradas (com a pergunta "continuar, arquivar ou virar projeto?"). */
export function digest(ideas: Idea[], now: Date, staleDays = 30): Digest {
  const only = ideas.filter((i) => i.kind === "ideia"), porStatus = Object.fromEntries(STATUSES.map((s) => [s.id, 0])) as Record<IdeaStatus, number>;
  for (const i of only) porStatus[i.status]++;
  const paradas = staleIdeas(ideas, now, staleDays), novas = only.filter((i) => daysSince(i.createdAt, now) < 7).length, abertas = only.length - porStatus.arquivada - porStatus.fazendo;
  const parts = [`${only.length} ideia${only.length === 1 ? "" : "s"} na caixa (${abertas} em aberto)`, novas ? `${novas} nova${novas === 1 ? "" : "s"} nesta semana` : "nenhuma nova nesta semana"];
  if (paradas.length) parts.push(`${paradas.length} parada${paradas.length === 1 ? "" : "s"} há mais de ${staleDays} dias: continuar, arquivar ou virar projeto?`);
  return { total: only.length, abertas, novasNaSemana: novas, paradas, porStatus, texto: `${parts.join(" · ")}.` };
}

/** Texto limpo para tags: minúsculas, sem #, sem repetição, até 8. */
export const cleanTags = (tags: unknown): string[] => [...new Set((Array.isArray(tags) ? tags : []).map((t) => String(t).trim().toLowerCase().replace(/^#/, "").slice(0, 30)).filter(Boolean))].slice(0, 8);
export const cleanLinks = (links: unknown): string[] => [...new Set((Array.isArray(links) ? links : []).map((l) => String(l).trim()).filter((l) => /^https?:\/\/\S+$/i.test(l)))].slice(0, 12);
/** Links soltos no texto. */
export const linksIn = (text: string): string[] => cleanLinks(text.match(/https?:\/\/[^\s)]+/gi) ?? []);

/** Plano vindo da IA (ou do banco): aceita só o formato certo, com limites, sem quebrar se faltar campo. */
export function cleanPlan(raw: unknown, now = new Date()): IdeaPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>, strs = (v: unknown, n: number, max = 300) => (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim().slice(0, max)).filter(Boolean).slice(0, n);
  const perg = (Array.isArray(o["perguntas"]) ? (o["perguntas"] as unknown[]) : []).flatMap((p) => {
    const q = typeof p === "string" ? p : String((p as { q?: unknown } | null)?.q ?? ""), a = typeof p === "object" && p ? String((p as { a?: unknown }).a ?? "") : "";
    return q.trim() ? [{ q: q.trim().slice(0, 300), a: a.trim().slice(0, 1200) }] : [];
  }).slice(0, 8);
  const pre = (o["precisa"] && typeof o["precisa"] === "object" ? o["precisa"] : {}) as Record<string, unknown>;
  const resumo = String(o["resumo"] ?? "").trim().slice(0, 800), passos = strs(o["passos"], 10);
  if (!resumo && !perg.length && !passos.length) return null;
  return { resumo, perguntas: perg, riscos: strs(o["riscos"], 8), passos, precisa: { tempo: String(pre["tempo"] ?? "").trim().slice(0, 300), dinheiro: String(pre["dinheiro"] ?? "").trim().slice(0, 300), pessoas: String(pre["pessoas"] ?? "").trim().slice(0, 300) }, proximoPasso: String(o["proximoPasso"] ?? o["proximo_passo"] ?? "").trim().slice(0, 300), geradoEm: typeof o["geradoEm"] === "string" ? o["geradoEm"] : now.toISOString() };
}

/** O que a IA recebe sobre a ideia (e o que a busca do Orion indexa). */
export function ideaText(i: Pick<Idea, "title" | "body" | "area" | "status" | "tags" | "links" | "plan" | "kind"> & { budget?: BudgetItem[] }): string {
  const p = i.plan;
  return [
    `${i.kind === "referencia" ? "Referência" : "Ideia"} (${i.area === "negocios" ? "negócios" : "pessoal"}, ${statusLabel(i.status)}): ${i.title}`, i.body,
    i.tags.length ? `Etiquetas: ${i.tags.join(", ")}.` : "", i.links.length ? `Links: ${i.links.join(" ")}` : "",
    p ? [p.resumo, p.perguntas.length ? `Perguntas: ${p.perguntas.map((x) => `${x.q}${x.a ? ` → ${x.a}` : ""}`).join(" | ")}` : "", p.riscos.length ? `Riscos: ${p.riscos.join("; ")}` : "", p.passos.length ? `Primeiros passos: ${p.passos.join("; ")}` : "", `Precisa — tempo: ${p.precisa.tempo || "—"}; dinheiro: ${p.precisa.dinheiro || "—"}; pessoas: ${p.precisa.pessoas || "—"}.`].filter(Boolean).join("\n") : "",
    i.budget?.length ? `Orçamento:\n${budgetLines(i.budget).join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

/** Primeiros passos do plano → demandas do novo projeto (a primeira em andamento; as outras a fazer). */
export function demandsFromPlan(idea: Pick<Idea, "title" | "plan">, nextCode: (n: number) => string): Demand[] {
  const steps = (idea.plan?.passos.length ? idea.plan.passos : [`Começar: ${idea.title}`]).slice(0, 8);
  return steps.map((s, i) => ({ id: nextCode(i), type: "geral" as const, title: s.slice(0, 120), desc: i === 0 && idea.plan?.proximoPasso ? `Próximo passo sugerido: ${idea.plan.proximoPasso}` : "", priority: i === 0 ? ("alta" as const) : ("media" as const), status: "todo" as const, deadline: "", history: [{ d: "hoje", text: "Criada a partir de uma ideia", s: "todo" as const }], notes: [] }));
}

const cents = (n: number) => Math.round(n * 100) / 100;
/** Itens do orçamento vindos da IA, do banco ou da tela: só o formato certo, com limites. */
export function cleanBudget(raw: unknown): BudgetItem[] {
  return (Array.isArray(raw) ? raw : []).flatMap((r, n): BudgetItem[] => {
    if (!r || typeof r !== "object") return [];
    const o = r as Record<string, unknown>, nome = String(o["nome"] ?? "").trim().slice(0, 120);
    if (!nome) return [];
    const v = o["valor"] === null || o["valor"] === undefined || o["valor"] === "" ? null : Number(o["valor"]), q = Math.round(Number(o["qtd"] ?? 1));
    const link = String(o["link"] ?? "").trim(), st = o["status"] === "comprado" || o["status"] === "tenho" ? o["status"] : "comprar";
    return [{ id: String(o["id"] ?? "").slice(0, 40) || `i${n}-${nome.toLowerCase().replace(/\W+/g, "").slice(0, 12)}`, nome, qtd: Number.isFinite(q) && q >= 1 ? Math.min(q, 999) : 1, valor: v !== null && Number.isFinite(v) && v >= 0 ? cents(Math.min(v, 1e7)) : null, link: /^https?:\/\/\S+$/i.test(link) ? link.slice(0, 500) : "", status: st as BudgetStatus, nota: String(o["nota"] ?? "").trim().slice(0, 200), estimado: o["estimado"] === true }];
  }).slice(0, 80);
}
/** Totais do orçamento. O que a pessoa já tem não entra na conta; o que está sem valor é contado à parte. */
export function budgetTotals(items: BudgetItem[]): { total: number; comprado: number; falta: number; semValor: number; estimados: number; itens: number } {
  let comprado = 0, falta = 0, semValor = 0, estimados = 0, itens = 0;
  for (const i of items) {
    if (i.status === "tenho") continue;
    itens++;
    if (i.valor === null) { semValor++; continue; }
    const t = cents(i.valor * i.qtd);
    if (i.status === "comprado") comprado += t; else falta += t;
    if (i.estimado) estimados++;
  }
  return { total: cents(comprado + falta), comprado: cents(comprado), falta: cents(falta), semValor, estimados, itens };
}
/** Linhas do orçamento em texto (para a IA, a busca e a documentação). */
export function budgetLines(items: BudgetItem[]): string[] {
  const money = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;
  return items.map((i) => `${i.status === "tenho" ? "já tenho" : i.status === "comprado" ? "comprado" : "comprar"} · ${i.nome}${i.qtd > 1 ? ` x${i.qtd}` : ""} · ${i.valor === null ? "sem valor" : `${i.estimado ? "~" : ""}${money(i.valor)}${i.qtd > 1 ? ` cada (${money(cents(i.valor * i.qtd))})` : ""}`}${i.link ? ` · ${i.link}` : ""}${i.nota ? ` · ${i.nota}` : ""}`);
}
