/** Clientes: tipos e regras puras (situação do contrato, resumo da carteira, respostas rápidas). Sem rede. */
import type { Attachment } from "./data/brain";

export type ClientStatus = "ativo" | "neg" | "pausa" | "encerrado";
export type Client = {
  id: string; projectId: string; dossierId: string | null; name: string; segment: string; contactName: string; email: string; phone: string; docNumber: string;
  status: ClientStatus; plan: string; monthlyValue: number; contractEnd: string | null; notes: string;
};
export type ClientDoc = { id: string; clientId: string; title: string; kind: string; docDate: string | null; attachments: Attachment[]; summary: string };
export type ClientLog = { id: string; clientId: string; date: string; text: string };
export type ClientAccess = { id: string; clientId: string; label: string; username: string; note: string };
export type ClientDemand = { code: string; title: string; status: string; deadline: string };

export const STATUS_LABEL: Record<ClientStatus, string> = { ativo: "Ativo", neg: "Em negociação", pausa: "Pausado", encerrado: "Encerrado" };
export const STATUS_TONE: Record<ClientStatus, string> = { ativo: "emerald", neg: "cyan", pausa: "muted-foreground", encerrado: "muted-foreground" };
export const DOC_KINDS = ["Contrato", "Proposta", "Termo", "Briefing", "Relatório", "Planilha", "Jurídico", "Documento"] as const;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayBR = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
/** Dias de hoje até a data (negativo = já passou). */
export const daysUntil = (iso: string, today: string = todayBR()) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 864e5);
export const dateBR = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export type Due = { days: number | null; level: "none" | "ok" | "soon" | "late" };
/** Situação do fim do contrato: vence em até 30 dias = "soon"; já passou = "late". Pausado e encerrado não alertam. */
export function dueOf(c: Pick<Client, "contractEnd" | "status">, today?: string): Due {
  if (!c.contractEnd) return { days: null, level: "none" };
  const days = daysUntil(c.contractEnd, today);
  if (c.status === "pausa" || c.status === "encerrado") return { days, level: "ok" };
  return { days, level: days < 0 ? "late" : days <= 30 ? "soon" : "ok" };
}

export type Summary = { active: number; total: number; monthly: number; negotiating: number; expiring: number; openDemands: number };
export function summarize(clients: Client[], openDemands: number, today?: string): Summary {
  const active = clients.filter((c) => c.status === "ativo");
  return {
    active: active.length, total: clients.length, monthly: active.reduce((a, c) => a + c.monthlyValue, 0),
    negotiating: clients.filter((c) => c.status === "neg").reduce((a, c) => a + c.monthlyValue, 0),
    expiring: clients.filter((c) => { const l = dueOf(c, today).level; return l === "soon" || l === "late"; }).length, openDemands,
  };
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export type QuickAnswer = { title: string; lines: string[]; clientId?: string };
export type AnswerData = { clients: Client[]; docs: ClientDoc[]; demands: (ClientDemand & { clientId: string })[] };
/** Respostas rápidas com os dados reais: vencimentos, demandas abertas, receita, onde está um documento. `null` = não entendi. */
export function quickAnswer(q: string, d: AnswerData, today?: string): QuickAnswer | null {
  const n = norm(q), name = (c: Client) => c.name;
  const byName = d.clients.find((c) => c.name.split(/\s+/).some((w) => w.length > 3 && n.includes(norm(w))));
  if (/venc|renov|fim do contrato/.test(n)) {
    const L = d.clients.filter((c) => ["soon", "late"].includes(dueOf(c, today).level)).sort((a, b) => (a.contractEnd ?? "").localeCompare(b.contractEnd ?? ""));
    return { title: L.length ? `${L.length} contrato${L.length === 1 ? "" : "s"} para atenção (vencem em até 30 dias ou já venceram)` : "Nenhum contrato vence nos próximos 30 dias", lines: L.map((c) => `${name(c)} — ${dateBR(c.contractEnd)} (${(dueOf(c, today).days ?? 0) < 0 ? `venceu há ${-(dueOf(c, today).days ?? 0)} dias` : `em ${dueOf(c, today).days} dias`})${c.monthlyValue ? ` · ${brl(c.monthlyValue)}/mês` : ""}`) };
  }
  if (/demanda|pendente|aberta/.test(n)) {
    const L = d.demands.filter((x) => x.status !== "done" && (!byName || x.clientId === byName.id));
    const owner = (id: string) => d.clients.find((c) => c.id === id)?.name ?? "";
    return { title: `${L.length} demanda${L.length === 1 ? "" : "s"} aberta${L.length === 1 ? "" : "s"}${byName ? ` de ${byName.name}` : ""}`, lines: L.slice(0, 8).map((x) => `${x.title} — ${owner(x.clientId)}${x.deadline ? ` (até ${x.deadline})` : ""}`).concat(L.length > 8 ? [`… e mais ${L.length - 8}`] : []) };
  }
  if (/receb|mensal|faturamento|valor/.test(n)) {
    const s = summarize(d.clients, 0, today);
    return { title: `${brl(s.monthly)} por mês`, lines: [`${s.active} cliente${s.active === 1 ? "" : "s"} ativo${s.active === 1 ? "" : "s"}`, `Em negociação: ${brl(s.negotiating)}`] };
  }
  if (byName) {
    const want = /contrato/.test(n) ? "contrato" : /proposta/.test(n) ? "proposta" : "";
    const doc = want ? d.docs.find((x) => x.clientId === byName.id && norm(x.kind).includes(want)) : undefined;
    return doc ? { title: `${doc.title} está na ficha de ${byName.name}`, lines: [doc.docDate ? `Documento de ${dateBR(doc.docDate)}` : "Sem data registrada"], clientId: byName.id }
      : { title: `Encontrei ${byName.name}`, lines: [`${d.docs.filter((x) => x.clientId === byName.id).length} documentos · ${d.demands.filter((x) => x.clientId === byName.id && x.status !== "done").length} demandas abertas`], clientId: byName.id };
  }
  return null;
}

/** Texto pesquisável da ficha (usado pelo Orion para achar o cliente). */
export function clientCorpusText(c: Client, docs: ClientDoc[], log: ClientLog[]): string {
  return [
    `Cliente ${c.name}. Situação: ${STATUS_LABEL[c.status]}.`, c.segment && `Segmento: ${c.segment}.`, c.contactName && `Contato: ${c.contactName}.`, c.email && `E-mail: ${c.email}.`, c.phone && `Telefone: ${c.phone}.`,
    c.docNumber && `CNPJ/CPF: ${c.docNumber}.`, c.plan && `Plano: ${c.plan}.`, c.monthlyValue ? `Valor mensal: ${brl(c.monthlyValue)}.` : "", c.contractEnd ? `Fim do contrato: ${dateBR(c.contractEnd)}.` : "", c.notes,
    ...docs.map((d) => `Documento (${d.kind}): ${d.title}.${d.summary ? `\n${d.summary}` : ""}`), ...log.map((l) => `${dateBR(l.date)}: ${l.text}`),
  ].filter(Boolean).join("\n");
}
export { ymd };
