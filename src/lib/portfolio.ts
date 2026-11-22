/** Saúde da carteira: andamento da implantação, clientes parados e sem contato recente. */
import { daysUntil, todayBR, type Client } from "./clients";

export type PortfolioInput = {
  clients: Client[];
  setups: { clientId: string; total: number; finished: number; blocked: number }[];
  /** última data de contato (histórico ou reunião) por cliente, "AAAA-MM-DD" */
  lastContact: Record<string, string | undefined>;
  openDemands: Record<string, number>;
};
export type PortfolioRow = { id: string; name: string; pct: number; started: boolean; blocked: number; openDemands: number; silentDays: number | null; level: "ok" | "warn" | "late" };
export type Portfolio = { avgPct: number; rows: PortfolioRow[]; notStarted: number; openDemands: number; silent: number; active: number };

export const SILENT_AFTER = 30;

export function portfolioHealth(i: PortfolioInput, today: string = todayBR()): Portfolio {
  const active = i.clients.filter((c) => c.status === "ativo");
  const rows: PortfolioRow[] = active.map((c) => {
    const s = i.setups.find((x) => x.clientId === c.id);
    const pct = s && s.total ? Math.round((s.finished / s.total) * 100) : 0;
    const started = !!s && s.finished > 0;
    const last = i.lastContact[c.id];
    const silentDays = last ? Math.max(0, -daysUntil(last, today)) : null;
    const blocked = s?.blocked ?? 0, openDemands = i.openDemands[c.id] ?? 0;
    const level: PortfolioRow["level"] = blocked > 0 || (silentDays !== null && silentDays > 60) ? "late" : !started || silentDays === null || silentDays > SILENT_AFTER ? "warn" : "ok";
    return { id: c.id, name: c.name, pct, started, blocked, openDemands, silentDays, level };
  }).sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name));
  return {
    active: active.length,
    avgPct: rows.length ? Math.round(rows.reduce((n, r) => n + r.pct, 0) / rows.length) : 0,
    rows,
    notStarted: rows.filter((r) => !r.started).length,
    openDemands: rows.reduce((n, r) => n + r.openDemands, 0),
    silent: rows.filter((r) => r.silentDays === null || r.silentDays > SILENT_AFTER).length,
  };
}
