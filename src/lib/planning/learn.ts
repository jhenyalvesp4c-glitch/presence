/**
 * O Orion aprendendo com o seu dia. Puro: recebe o histórico (`plan_events`) e devolve sugestões; nada é aplicado sem você aceitar.
 * Eventos: 'feito' (com a hora em que você concluiu), 'adiado', 'removido', 'adicionado', 'movido', 'editado', 'desfeito'.
 */
import { fromMin, toMin } from "../dates";
import type { Learned } from "./engine";
export type { Learned } from "./engine";

export type PlanEvent = { plan_date: string; action: "feito" | "desfeito" | "adiado" | "removido" | "adicionado" | "movido" | "editado"; kind: string; title: string; planned_time: string | null; at_time: string | null; created_at: string };
export type SuggestionKind = "mover" | "adiado" | "limite" | "pico" | "financeiro" | "info";
export type Suggestion = { key: string; kind: SuggestionKind; title: string; detail: string; payload: Record<string, unknown> };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const daysAgo = (iso: string, today: string) => Math.round((Date.parse(today) - Date.parse(iso)) / 86400000);
const median = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m]! : Math.round((a[m - 1]! + a[m]!) / 2); };
const hm = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}`;
const group = <T,>(xs: T[], key: (x: T) => string): Map<string, T[]> => { const m = new Map<string, T[]>(); for (const x of xs) { const k = key(x); (m.get(k) ?? m.set(k, []).get(k)!).push(x); } return m; };

/** Sugestões novas a partir dos últimos dias. `known` = chaves já decididas ou já mostradas (não repete). */
export function suggestionsFrom(events: PlanEvent[], today: string, known: Set<string> = new Set()): Suggestion[] {
  const out: Suggestion[] = [];
  const recent = events.filter((e) => daysAgo(e.plan_date, today) >= 0 && daysAgo(e.plan_date, today) <= 21);
  const push = (s: Suggestion) => { if (!known.has(s.key) && !out.some((o) => o.key === s.key)) out.push(s); };

  // 1) horário em que você realmente faz: concluiu sempre bem longe do horário marcado
  for (const [, list] of group(recent.filter((e) => e.action === "feito" && e.planned_time && e.at_time && e.kind !== "tarefa"), (e) => norm(e.title))) {
    if (list.length < 3) continue;
    const planned = median(list.map((e) => toMin(e.planned_time!))), real = median(list.map((e) => toMin(e.at_time!)));
    if (Math.abs(real - planned) < 75) continue;
    const to = fromMin(Math.round(real / 15) * 15), t = list[0]!.title;
    push({ key: `mover:${norm(t)}:${to}`, kind: "mover", title: `Mudar “${t}” para ${to}?`, detail: `Nos últimos dias você fez isso por volta das ${fromMin(real)}, e não às ${fromMin(planned)}. Ajusto o horário para combinar com o seu ritmo.`, payload: { title: t, to, kind: list[0]!.kind } });
  }

  // 2) o que você sempre empurra
  for (const [, list] of group(recent.filter((e) => e.action === "adiado" && daysAgo(e.plan_date, today) <= 14), (e) => norm(e.title))) {
    if (list.length < 3) continue;
    const t = list[0]!.title;
    push({ key: `adiado:${norm(t)}`, kind: "adiado", title: `Você adiou “${t}” ${list.length} vezes`, detail: "Isso costuma ser sinal de tarefa grande demais ou no horário errado. Posso tirar do plano de hoje e te lembrar de repensar depois.", payload: { title: t, count: list.length } });
  }

  // 3) dias com tarefas demais: termina pouco do que planeja
  const tarefas = recent.filter((e) => e.kind === "tarefa" && ["feito", "adiado", "removido"].includes(e.action));
  const done = tarefas.filter((e) => e.action === "feito").length;
  if (tarefas.length >= 8 && done / tarefas.length < 0.5) push({ key: "limite:5", kind: "limite", title: "Limitar o dia a 5 tarefas?", detail: `Você concluiu ${done} de ${tarefas.length} tarefas planejadas nas últimas semanas. Com menos tarefas por dia, o plano fica mais realista e você termina mais.`, payload: { limit: 5 } });

  // 4) horário de pico: onde você mais conclui tarefas
  const hours = recent.filter((e) => e.action === "feito" && e.kind === "tarefa" && e.at_time).map((e) => Math.floor(toMin(e.at_time!) / 60));
  if (hours.length >= 8) {
    const count = new Map<number, number>(); for (const h of hours) for (const x of [h, h + 1]) count.set(x, (count.get(x) ?? 0) + 1);
    const [best, n] = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]!;
    if (n / hours.length >= 0.45) push({ key: `pico:${best}`, kind: "pico", title: `Seu melhor horário é entre ${best}h e ${best + 2}h`, detail: `Quase metade das tarefas que você conclui acontece nessa faixa. Coloco as mais importantes ali.`, payload: { peakStart: fromMin(best * 60) } });
  }
  return out;
}

/** Resume o histórico em frases simples ("o que o Orion já sabe sobre você") para mostrar na tela. */
export function insights(events: PlanEvent[], today: string): string[] {
  const recent = events.filter((e) => daysAgo(e.plan_date, today) >= 0 && daysAgo(e.plan_date, today) <= 21), out: string[] = [];
  const feitos = recent.filter((e) => e.action === "feito");
  if (feitos.length) out.push(`${feitos.length} ${feitos.length === 1 ? "atividade concluída" : "atividades concluídas"} nos últimos 21 dias.`);
  const byKind = group(feitos.filter((e) => e.at_time), (e) => e.kind);
  for (const [k, l] of byKind) if (l.length >= 4) out.push(`${({ habito: "Hábitos", treino: "Treino", tarefa: "Tarefas", autocuidado: "Autocuidado" } as Record<string, string>)[k] ?? k}: você costuma concluir por volta das ${fromMin(median(l.map((e) => toMin(e.at_time!))))}.`);
  const adi = recent.filter((e) => e.action === "adiado").length;
  if (adi >= 3) out.push(`${adi} atividades foram adiadas no período.`);
  return out;
}

/** Aplica o que foi aceito às preferências aprendidas. */
export function applyToLearned(l: Learned, s: Suggestion): Learned {
  const p = s.payload;
  if (s.kind === "limite" && typeof p["limit"] === "number") return { ...l, taskLimit: p["limit"] };
  if (s.kind === "pico" && typeof p["peakStart"] === "string") return { ...l, peakStart: p["peakStart"] };
  if (s.kind === "mover" && typeof p["title"] === "string" && typeof p["to"] === "string") return { ...l, habitTimes: { ...(l.habitTimes ?? {}), [norm(p["title"] as string)]: p["to"] as string } };
  return l;
}
