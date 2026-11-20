/** "Conte o que você comeu": resultado da IA (refeições e alimentos com macros) limpo, ligado às refeições do dia e convertido em registros do diário. */
import { FOODS } from "./diet-foods";
import { customMealName, type DietMeal, type Extra } from "./diet-plan";

export type AiItem = { nome: string; qtd: string; gramas: number | null; kcal: number; p: number; c: number; f: number; estimado: boolean };
export type AiMeal = { refeicao: string; itens: AiItem[] };
export type AiResult = { refeicoes: AiMeal[]; aviso: string };

const num = (v: unknown, max: number) => { const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0; };
const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

export function cleanInterpretation(raw: unknown): AiResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const refeicoes = (Array.isArray(o["refeicoes"]) ? (o["refeicoes"] as unknown[]) : []).flatMap((m): AiMeal[] => {
    const x = m as Record<string, unknown> | null;
    const itens = (Array.isArray(x?.["itens"]) ? (x!["itens"] as unknown[]) : []).flatMap((i): AiItem[] => {
      const it = i as Record<string, unknown> | null, nome = str(it?.["nome"], 80);
      if (!it || !nome) return [];
      const p = num(it["p"], 300), c = num(it["c"], 500), f = num(it["f"], 300), kcal = num(it["kcal"], 5000) || p * 4 + c * 4 + f * 9;
      return [{ nome, qtd: str(it["qtd"], 60), gramas: num(it["gramas"], 5000) || null, kcal, p, c, f, estimado: it["estimado"] === true }];
    }).slice(0, 30);
    return itens.length ? [{ refeicao: str(x?.["refeicao"], 40) || "Refeição", itens }] : [];
  }).slice(0, 8);
  return refeicoes.length ? { refeicoes, aviso: str(o["aviso"], 400) } : null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
/** Liga o nome dito pela IA a uma refeição do plano ("Lanche" → "Lanche proteico"), a uma criada por mim ou a uma nova. */
export function mealTarget(name: string, plan: DietMeal[], customNames: string[]): { id: string; nome: string; novo: boolean } {
  const n = norm(name), first = n.split(/\s+/)[0] ?? "";
  const p = plan.find((m) => { const pn = norm(m.nome); return pn === n || pn.includes(n) || n.includes(pn) || (first.length > 3 && pn.split(/\s+/)[0] === first); });
  if (p) return { id: p.id, nome: p.nome, novo: false };
  const c = customNames.find((x) => norm(x) === n);
  return c ? { id: `c:${c}`, nome: c, novo: false } : { id: `c:${name}`, nome: name, novo: true };
}
/** Registros prontos para o diário + nomes de refeições novas. */
export function toEntries(r: AiResult, plan: DietMeal[], customNames: string[], uid: () => string): { extras: Extra[]; novas: string[] } {
  const extras: Extra[] = [], novas: string[] = [];
  for (const m of r.refeicoes) { const t = mealTarget(m.refeicao, plan, [...customNames, ...novas]); if (t.novo) novas.push(t.nome); for (const i of m.itens) extras.push({ id: uid(), nome: i.nome, qtd: i.qtd, kcal: i.kcal, p: i.p, c: i.c, f: i.f, meal: t.id }); }
  return { extras, novas };
}
export const totalOf = (r: AiResult) => r.refeicoes.flatMap((m) => m.itens).reduce((a, i) => ({ kcal: a.kcal + i.kcal, p: a.p + i.p, c: a.c + i.c, f: a.f + i.f }), { kcal: 0, p: 0, c: 0, f: 0 });
export { customMealName };

/** Base de alimentos em texto compacto para o prompt da IA (macros por 100 g e medidas caseiras em gramas). */
export const foodsPrompt = (extra: { nome: string; kcal: number; p: number; c: number; f: number; medidas: { nome: string; g: number }[] }[] = []) =>
  [...extra.map((e) => ({ ...e, meu: true })), ...FOODS.map((f) => ({ nome: f.nome, kcal: f.per100.kcal, p: f.per100.p, c: f.per100.c, f: f.per100.f, medidas: f.medidas, meu: false }))]
    .map((f) => `${f.meu ? "[MEU] " : ""}${f.nome}: ${Math.round(f.kcal)} kcal P${f.p} C${f.c} G${f.f} /100 g${f.medidas.length ? ` · ${f.medidas.map((m) => `${m.nome}=${m.g} g`).join(", ")}` : ""}`).join("\n");
