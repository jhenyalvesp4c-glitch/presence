/** Dados extras da Central do dia (cada consulta é independente: se uma falhar, só aquela seção avisa). */
import { useQuery } from "@tanstack/react-query";

import { cloudFinanceRepo } from "../finance/cloud-repo";
import { invoiceAlerts, parseDeadline, deadlineBucket, addDays, subscriptionRenewals, type Bucket, type InvoiceAlert, type Renewal } from "../central";
import { openInvoice, round2 } from "../finance/calc";
import { must, supabase } from "./db";

export type CentralDemand = { projectId: string; code: string; title: string; status: string; priority: string; dossier: string; deadline: string | null; bucket: Bucket };
export const useCentralDemands = (today: string) => useQuery({
  queryKey: ["central", "demands", today],
  queryFn: async (): Promise<CentralDemand[]> => (must(await supabase.from("project_demands").select("project_id, code, title, status, priority, deadline, dossier_name").neq("status", "done").limit(500)) as { project_id: string; code: string; title: string; status: string; priority: string; deadline: string | null; dossier_name: string | null }[])
    .map((d) => { const deadline = parseDeadline(d.deadline, today); return { projectId: d.project_id, code: d.code, title: d.title, status: d.status, priority: d.priority, dossier: d.dossier_name ?? "", deadline, bucket: deadlineBucket(deadline, today) }; }),
});

export const useCentralMeetings = (today: string) => useQuery({
  queryKey: ["central", "meetings", today],
  queryFn: async () => must(await supabase.from("meetings").select("id, title").eq("happened_on", today).order("created_at")) as { id: string; title: string }[],
});

export const useCentralDiet = (today: string) => useQuery({
  queryKey: ["central", "diet", today],
  queryFn: async () => { const r = must(await supabase.from("diet_day_logs").select("meals_done, water_ml").eq("log_date", today).limit(1)) as { meals_done: string[] | null; water_ml: number | null }[]; return r[0] ? { meals: (r[0].meals_done ?? []).length, water: r[0].water_ml ?? 0 } : null; },
});

export type CentralMoney = { alerts: InvoiceAlert[]; renewals: Renewal[]; open: { card: string; total: number; due: string }[] };
export const useCentralMoney = (today: string) => useQuery({
  queryKey: ["central", "money", today],
  queryFn: async (): Promise<CentralMoney | null> => {
    const s = await cloudFinanceRepo.readCloud(); if (!s) return null;
    const now = new Date(`${today}T12:00:00`);
    return { renewals: subscriptionRenewals(s, today, 30), alerts: invoiceAlerts(s.cards.map((c) => ({ name: c.name, closingDay: c.closingDay, dueDay: c.dueDay })), today, 7), open: s.cards.map((c) => { const i = openInvoice(s, c, now); return { card: c.name, total: round2(i.mine), due: i.due }; }).filter((x) => x.total > 0) };
  },
});

export type ExpiringClient = { id: string; name: string; contractEnd: string; status: string; monthlyValue: number };
export const useCentralContracts = (today: string) => useQuery({
  queryKey: ["central", "contracts", today],
  queryFn: async (): Promise<ExpiringClient[]> => (must(await supabase.from("clients").select("id, name, contract_end, status, monthly_value").in("status", ["ativo", "neg"]).not("contract_end", "is", null).lte("contract_end", addDays(today, 30)).order("contract_end")) as { id: string; name: string; contract_end: string; status: string; monthly_value: number | string }[]).map((c) => ({ id: c.id, name: c.name, contractEnd: c.contract_end, status: c.status, monthlyValue: Number(c.monthly_value) })),
});
