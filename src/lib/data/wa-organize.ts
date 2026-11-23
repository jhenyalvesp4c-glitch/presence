/** Organizar pedidos do WhatsApp nas demandas: lê as demandas abertas de todos os projetos, decide onde cada pedido entra e grava (atualiza o checklist ou cria). */
import { listProjects } from "../mcp/lookup";
import { applyOrganize, planOrganize, type OrgAction, type OrgCtx, type Req } from "../wa-requests";
import { loadDemands, loadProjectState, saveDemands } from "./project-data";

/** Demandas e dossiês de cada projeto (o padrão primeiro). */
export async function loadOrgContext(): Promise<OrgCtx[]> {
  const projects = await listProjects();
  return Promise.all(projects.map(async (p) => ({ pid: p.id, name: p.nome ?? p.id, demands: await loadDemands(p.id), dossiers: (await loadProjectState(p.id)).ds.dossiers.map((d) => d.name) })));
}

export const planFor = (reqs: Req[], ctx: OrgCtx[]): OrgAction[] => planOrganize(reqs, ctx);

/** Grava o plano: uma gravação por projeto. Devolve quantas demandas foram atualizadas e criadas. */
export async function runOrganize(actions: OrgAction[], ctx: OrgCtx[]): Promise<{ updated: number; created: number; steps: number }> {
  let updated = 0, created = 0, steps = 0;
  for (const c of ctx) {
    const mine = actions.filter((a) => a.pid === c.pid);
    if (!mine.length) continue;
    await saveDemands(c.pid, c.demands, applyOrganize(c.demands, mine));
    for (const a of mine) { if (a.kind === "update") updated++; else created++; steps += a.add.length; }
  }
  return { updated, created, steps };
}
