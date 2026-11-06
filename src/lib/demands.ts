/**
 * Demandas do Kanban (página /demandas): tipos e funções puras para levar uma demanda ao banco e de volta.
 * Uma demanda é guardada em 4 tabelas: project_demands (a demanda), demand_executions (andamento de cada
 * dossiê nas demandas para vários), demand_history (histórico) e demand_notes (observações).
 */
export type Status = "todo" | "doing" | "done";
export type Priority = "alta" | "media" | "baixa";
export type DType = "geral" | "polo" | "multi";
export type PoloExec = { name: string; status: Status; date?: string | undefined; note?: string | undefined };
export type Hist = { d: string; text: string; s: Status };
export type Demand = {
  id: string; type: DType; title: string; desc: string; priority: Priority; status: Status;
  deadline: string; polo?: string | undefined; polos?: PoloExec[] | undefined; history: Hist[]; notes: string[];
};

const PREFIX: Record<DType, string> = { geral: "G", polo: "P", multi: "M" };

/** Próximo código livre do tipo (ex.: #G025). Usa o maior número já existente, então nunca repete após excluir. */
export function nextCode(items: Pick<Demand, "id" | "type">[], type: DType, base = 40): string {
  const p = PREFIX[type];
  const max = items
    .filter((i) => i.type === type)
    .reduce((m, i) => Math.max(m, Number(i.id.replace(/\D/g, "")) || 0), base - 1);
  return `#${p}0${max + 1}`;
}

export type DemandRows = {
  demand: {
    project_id: string; code: string; type: DType; title: string; description: string; priority: Priority;
    status: Status; deadline: string; dossier_name: string | null;
  };
  executions: { project_id: string; code: string; dossier_name: string; status: Status; done_on: string | null; note: string; position: number }[];
  history: { project_id: string; code: string; label: string; text: string; status: Status; position: number }[];
  notes: { project_id: string; code: string; text: string; position: number }[];
};

/** Uma demanda da tela -> linhas das 4 tabelas. */
export function demandToRows(projectId: string, d: Demand): DemandRows {
  const key = { project_id: projectId, code: d.id };
  return {
    demand: {
      ...key, type: d.type, title: d.title.trim().slice(0, 300) || "Sem título", description: d.desc.slice(0, 5000),
      priority: d.priority, status: d.status, deadline: d.deadline.slice(0, 20), dossier_name: d.polo ?? null,
    },
    executions: (d.polos ?? []).map((p, i) => ({
      ...key, dossier_name: p.name, status: p.status, done_on: p.date ?? null, note: (p.note ?? "").slice(0, 2000), position: i,
    })),
    history: d.history.map((h, i) => ({ ...key, label: h.d.slice(0, 20), text: h.text.slice(0, 500), status: h.s, position: i })),
    notes: d.notes.map((text, i) => ({ ...key, text: text.slice(0, 2000), position: i })),
  };
}

type DemandRow = DemandRows["demand"];

/** Linhas das tabelas -> demandas da tela (na ordem recebida). */
export function rowsToDemands(
  demands: DemandRow[], executions: DemandRows["executions"], history: DemandRows["history"], notes: DemandRows["notes"],
): Demand[] {
  const by = <T extends { code: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of list) (m.get(r.code) ?? m.set(r.code, []).get(r.code)!).push(r);
    return m;
  };
  const ex = by(executions), hi = by(history), no = by(notes);
  const sorted = <T extends { position: number }>(l: T[] | undefined) => [...(l ?? [])].sort((a, b) => a.position - b.position);
  return demands.map((r): Demand => {
    const e = sorted(ex.get(r.code));
    return {
      id: r.code, type: r.type, title: r.title, desc: r.description, priority: r.priority, status: r.status, deadline: r.deadline,
      polo: r.dossier_name ?? undefined,
      polos: r.type === "multi" ? e.map((x) => ({ name: x.dossier_name, status: x.status, date: x.done_on ?? undefined, note: x.note || undefined })) : undefined,
      history: sorted(hi.get(r.code)).map((h) => ({ d: h.label, text: h.text, s: h.status })),
      notes: sorted(no.get(r.code)).map((n) => n.text),
    };
  });
}

/** O que mudou entre duas listas: demandas novas ou alteradas (a lista inteira da demanda) e códigos excluídos. */
export function diffDemands(prev: Demand[], next: Demand[]): { upserts: Demand[]; deletes: string[] } {
  const before = new Map(prev.map((d) => [d.id, JSON.stringify(d)]));
  const ids = new Set(next.map((d) => d.id));
  return {
    upserts: next.filter((d) => before.get(d.id) !== JSON.stringify(d)),
    deletes: prev.filter((d) => !ids.has(d.id)).map((d) => d.id),
  };
}
