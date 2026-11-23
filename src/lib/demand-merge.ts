/** Juntar demandas do mesmo dossiê (polo) numa só, com um checklist dos passos. Funções puras, testadas. */
import { normalize } from "./orion";
import type { CheckItem, Demand, Hist, Priority, Status } from "./demands";

const RANK: Record<Priority, number> = { alta: 3, media: 2, baixa: 1 };
const dd = (n: number) => String(n).padStart(2, "0");
/** "20/11" → número comparável (mês*100+dia); prazo vazio ou estranho vai para o fim. */
const dayKey = (v: string) => { const m = /^(\d{1,2})\/(\d{1,2})/.exec(v.trim()); return m ? Number(m[2]) * 100 + Number(m[1]) : 9999; };

export type MergeGroup = { dossier: string; items: Demand[] };

/** Grupos de demandas ABERTAS (a fazer/em andamento) do tipo "por dossiê" que são do mesmo dossiê e aparecem mais de uma vez. */
export function findMergeGroups(all: Demand[], only?: string): MergeGroup[] {
  const by = new Map<string, MergeGroup>();
  for (const d of all) {
    if (d.type !== "polo" || !d.polo || d.status === "done") continue;
    const k = normalize(d.polo);
    if (only && k !== normalize(only)) continue;
    (by.get(k) ?? by.set(k, { dossier: d.polo, items: [] }).get(k)!).items.push(d);
  }
  return [...by.values()].filter((g) => g.items.length > 1).map((g) => ({ ...g, items: [...g.items].sort((a, b) => a.id.localeCompare(b.id)) }));
}

/** O texto de cada passo do checklist: o título e, quando houver, a primeira frase da descrição. */
const stepText = (d: Demand) => {
  const first = d.desc.split(/\n|\. /)[0]?.trim() ?? "";
  return first && normalize(first) !== normalize(d.title) ? `${d.title} — ${first}`.slice(0, 480) : d.title.slice(0, 480);
};

/** Junta o grupo numa demanda só (fica com o código da primeira) e devolve os códigos que somem. */
export function mergeGroup(g: MergeGroup, opts: { title?: string | undefined; today?: Date } = {}): { merged: Demand; removed: string[] } {
  const keep = g.items[0]!;
  const now = opts.today ?? new Date();
  const label = `${dd(now.getDate())}/${dd(now.getMonth() + 1)}`;
  const checklist: CheckItem[] = [];
  for (const d of g.items) {
    checklist.push({ text: `${d.id.replace(/^#/, "")} · ${stepText(d)}`.slice(0, 500), done: false });
    for (const c of d.checklist ?? []) checklist.push({ text: `   ${c.text}`.slice(0, 500), done: c.done });
  }
  const desc = [`Juntada de ${g.items.length} demandas de ${g.dossier}:`, ...g.items.map((d) => `• ${d.id} ${d.title}${d.desc.trim() ? `\n  ${d.desc.trim().replace(/\n+/g, "\n  ")}` : ""}`)].join("\n").slice(0, 5000);
  const priority = g.items.reduce<Priority>((best, d) => (RANK[d.priority] > RANK[best] ? d.priority : best), "baixa");
  const deadline = g.items.map((d) => d.deadline).filter((x) => x && x !== "—").sort((a, b) => dayKey(a) - dayKey(b))[0] ?? "";
  const status: Status = g.items.some((d) => d.status === "doing") ? "doing" : "todo";
  const history: Hist[] = [
    ...g.items.flatMap((d) => d.history.map((h) => ({ ...h, text: `${d.id}: ${h.text}`.slice(0, 500) }))),
    { d: label, text: `Unificada a partir de ${g.items.map((d) => d.id).join(", ")}`, s: status },
  ];
  const merged: Demand = {
    id: keep.id, type: "polo", polo: g.dossier, title: (opts.title?.trim() || `${g.dossier}: ${g.items.length} pendências`).slice(0, 300),
    desc, priority, status, deadline, history, notes: g.items.flatMap((d) => d.notes), checklist,
  };
  return { merged, removed: g.items.slice(1).map((d) => d.id) };
}

/** A lista de demandas depois de juntar os grupos escolhidos. */
export function applyMerges(all: Demand[], groups: MergeGroup[], titles: Record<string, string> = {}): Demand[] {
  const removed = new Set<string>(), swap = new Map<string, Demand>();
  for (const g of groups) { const r = mergeGroup(g, { title: titles[normalize(g.dossier)] }); r.removed.forEach((c) => removed.add(c)); swap.set(g.items[0]!.id, r.merged); }
  return all.filter((d) => !removed.has(d.id)).map((d) => swap.get(d.id) ?? d);
}
