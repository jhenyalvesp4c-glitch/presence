/**
 * Grava um conjunto de registros já validados (saída de `prepare`) e registra a operação no histórico.
 * Usado pelo MCP (`confirmar_registros`) e pela Central de entrada da tela inicial: a mesma gravação,
 * os mesmos serviços, o mesmo histórico e o mesmo "desfazer".
 */
import { executeRecord, makeCtx } from "./execute";
import { logOperation, type Created, type Operation } from "./ops";
import { RANK, TIPO_LABEL } from "./records";
import type { Resolved } from "./plan";

export type CommitResult = { op: Operation; created: Created[]; failed: string[]; skipped: number; status: "ok" | "parcial" | "erro" };

export async function commitRecords(resolved: Resolved[], o: { client: string; proposalId?: string; summary: string }): Promise<CommitResult> {
  const ctx = await makeCtx();
  const created: Created[] = [];
  const failed: string[] = [];
  const order = resolved.map((r, i) => ({ r, i })).filter((x) => !x.r._ignorar).sort((x, y) => RANK[x.r.tipo] - RANK[y.r.tipo] || x.i - y.i);
  for (const { r, i } of order) {
    try { created.push(...(await executeRecord(r, ctx))); } catch (e) { failed.push(`#${i + 1} ${TIPO_LABEL[r.tipo]}: ${e instanceof Error ? e.message : "erro"}`); }
  }
  const status = failed.length ? (created.length ? "parcial" : "erro") : "ok";
  const op = await logOperation({
    ...(o.proposalId ? { proposalId: o.proposalId } : {}), kind: "criacao", status, client: o.client, summary: o.summary, created,
    ...(failed.length ? { error: failed.join(" | ") } : {}),
  });
  return { op, created, failed, skipped: resolved.filter((r) => r._ignorar).length, status };
}
