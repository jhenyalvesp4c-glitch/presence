/** Propostas pendentes e histórico de operações do MCP (tabelas mcp_proposals e mcp_operations). */
import { must, supabase } from "../data/db";
import { randomInt } from "node:crypto";
import type { Resolved } from "./plan";

const makeCode = () => String(randomInt(1000, 10000));

export type Created = {
  tipo: string; modulo: string; id: string; rotulo: string; projeto_id?: string;
  /** Como desfazer: o que apagar ou restaurar. */
  undo: { kind: "demanda"; projectId: string; code: string } | { kind: "task"; id: string } | { kind: "nota"; projectId: string; noteId: number }
    | { kind: "exemplo"; projectId: string; exampleId: string } | { kind: "rotina"; id: string }
    | { kind: "evidencia"; projectId: string; code: string; fileId?: string; bodyBefore: string };
};

export type Proposal = {
  id: string; code: string; status: string; records: Resolved[]; summary: string; warnings: string[]; client: string; expires_at: string;
};

export async function saveProposal(p: { records: Resolved[]; summary: string; warnings: string[]; client: string }): Promise<Proposal> {
  const row = must(await supabase.from("mcp_proposals").insert({ code: makeCode(), records: p.records, summary: p.summary, warnings: p.warnings, client: p.client.slice(0, 120) })
    .select("id, code, status, records, summary, warnings, client, expires_at").single()) as Proposal;
  return row;
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const rows = must(await supabase.from("mcp_proposals").select("id, code, status, records, summary, warnings, client, expires_at").eq("id", id).limit(1)) as Proposal[];
  return rows[0] ?? null;
}

/** Marca como confirmada só se ainda estiver pendente (duas chamadas simultâneas não gravam duas vezes). */
export async function claimProposal(id: string): Promise<boolean> {
  const rows = must(await supabase.from("mcp_proposals").update({ status: "confirmada", confirmed_at: new Date().toISOString() }).eq("id", id).eq("status", "pendente").select("id")) as { id: string }[];
  return rows.length === 1;
}
export async function expireProposal(id: string) {
  must(await supabase.from("mcp_proposals").update({ status: "expirada" }).eq("id", id).eq("status", "pendente").select("id"));
}

export type Operation = { id: string; proposal_id: string | null; kind: string; status: string; client: string; summary: string; created: Created[]; error: string | null; created_at: string };

export async function logOperation(o: { proposalId?: string | undefined; kind: "criacao" | "desfazer"; status: "ok" | "parcial" | "erro" | "desfeita"; client: string; summary: string; created: Created[]; error?: string | undefined }): Promise<Operation> {
  return must(await supabase.from("mcp_operations").insert({
    proposal_id: o.proposalId ?? null, kind: o.kind, status: o.status, client: o.client.slice(0, 120), summary: o.summary, created: o.created, error: o.error ?? null,
  }).select("id, proposal_id, kind, status, client, summary, created, error, created_at").single()) as Operation;
}

export async function getOperation(id: string): Promise<Operation | null> {
  const rows = must(await supabase.from("mcp_operations").select("id, proposal_id, kind, status, client, summary, created, error, created_at").eq("id", id).limit(1)) as Operation[];
  return rows[0] ?? null;
}
export async function markUndone(id: string) {
  must(await supabase.from("mcp_operations").update({ status: "desfeita" }).eq("id", id).select("id"));
}
export async function recentOperations(limit: number): Promise<Operation[]> {
  return must(await supabase.from("mcp_operations").select("id, proposal_id, kind, status, client, summary, created, error, created_at").order("created_at", { ascending: false }).limit(limit)) as Operation[];
}
