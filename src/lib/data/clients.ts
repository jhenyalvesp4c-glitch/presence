/** Clientes na nuvem (clients, client_docs, client_log, client_access) + vínculos com dossiês, demandas e reuniões. Só as linhas do dono. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Client, ClientAccess, ClientDemand, ClientDoc, ClientLog, ClientStatus } from "../clients";
import { must, supabase } from "./db";
import { uploadFiles, type Attachment, type NewFile } from "./brain";

type CRow = { id: string; project_id: string; dossier_id: string | null; name: string; segment: string; contact_name: string; email: string; phone: string; doc_number: string; status: ClientStatus; plan: string; monthly_value: number | string; contract_end: string | null; notes: string };
const CCOLS = "id, project_id, dossier_id, name, segment, contact_name, email, phone, doc_number, status, plan, monthly_value, contract_end, notes";
const toClient = (r: CRow): Client => ({ id: r.id, projectId: r.project_id, dossierId: r.dossier_id, name: r.name, segment: r.segment, contactName: r.contact_name, email: r.email, phone: r.phone, docNumber: r.doc_number, status: r.status, plan: r.plan, monthlyValue: Number(r.monthly_value), contractEnd: r.contract_end, notes: r.notes });
const toRow = (c: Omit<Client, "id"> & { id?: string | undefined }) => ({
  ...(c.id ? { id: c.id } : {}), project_id: c.projectId, dossier_id: c.dossierId, name: c.name.trim().slice(0, 160), segment: c.segment.trim().slice(0, 80), contact_name: c.contactName.trim().slice(0, 120), email: c.email.trim().slice(0, 160),
  phone: c.phone.trim().slice(0, 40), doc_number: c.docNumber.trim().slice(0, 30), status: c.status, plan: c.plan.trim().slice(0, 120), monthly_value: Math.max(0, Math.round(c.monthlyValue * 100) / 100), contract_end: c.contractEnd || null, notes: c.notes.slice(0, 6000), updated_at: new Date().toISOString(),
});

const KEY = ["clients"] as const;
export const useClients = (projectId: string) => useQuery({ queryKey: [...KEY, projectId], queryFn: async () => (must(await supabase.from("clients").select(CCOLS).eq("project_id", projectId).order("name")) as CRow[]).map(toClient) });

/** Dossiês do projeto (para vincular o cliente). */
export const useProjectDossiers = (projectId: string) => useQuery({ queryKey: ["client-dossiers", projectId], queryFn: async () => must(await supabase.from("dossiers").select("id, name").eq("project_id", projectId).order("position")) as { id: string; name: string }[] });

export type ClientExtras = { docs: ClientDoc[]; log: ClientLog[]; access: ClientAccess[]; meetings: { id: string; clientId: string; title: string; happenedOn: string; summary: string }[]; demands: (ClientDemand & { clientId: string })[] };
/** Documentos, histórico, acessos, reuniões vinculadas e demandas dos dossiês de todos os clientes do projeto. */
export function useClientExtras(projectId: string, clients: Client[]) {
  const ids = clients.map((c) => c.id).join(","), dossiers = clients.map((c) => `${c.id}:${c.dossierId ?? ""}`).join(",");
  return useQuery({
    queryKey: [...KEY, "extras", projectId, ids, dossiers], enabled: clients.length > 0,
    queryFn: async (): Promise<ClientExtras> => {
      const idList = clients.map((c) => c.id), doss = clients.filter((c) => c.dossierId);
      const [docs, log, access, meets, dnames, dems] = await Promise.all([
        supabase.from("client_docs").select("id, client_id, title, kind, doc_date, attachments, ai_summary").in("client_id", idList).order("created_at", { ascending: false }),
        supabase.from("client_log").select("id, client_id, log_date, text").in("client_id", idList).order("log_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("client_access").select("id, client_id, label, username, note").in("client_id", idList).order("created_at"),
        supabase.from("meetings").select("id, client_id, title, happened_on, analysis").in("client_id", idList).order("happened_on", { ascending: false }),
        doss.length ? supabase.from("dossiers").select("id, name").eq("project_id", projectId).in("id", doss.map((c) => c.dossierId!)) : Promise.resolve({ data: [], error: null }),
        supabase.from("project_demands").select("code, title, status, deadline, dossier_name").eq("project_id", projectId),
      ]);
      const nameOf = new Map((must(dnames) as { id: string; name: string }[]).map((d) => [d.id, d.name.toLowerCase()]));
      const demandRows = must(dems) as { code: string; title: string; status: string; deadline: string; dossier_name: string }[];
      const out: ClientExtras["demands"] = [];
      for (const c of doss) { const n = nameOf.get(c.dossierId!); if (n) for (const d of demandRows) if ((d.dossier_name ?? "").toLowerCase() === n) out.push({ clientId: c.id, code: d.code, title: d.title, status: d.status, deadline: d.deadline ?? "" }); }
      return {
        docs: (must(docs) as { id: string; client_id: string; title: string; kind: string; doc_date: string | null; attachments: Attachment[] | null; ai_summary: string }[]).map((r) => ({ id: r.id, clientId: r.client_id, title: r.title, kind: r.kind, docDate: r.doc_date, attachments: Array.isArray(r.attachments) ? r.attachments : [], summary: r.ai_summary })),
        log: (must(log) as { id: string; client_id: string; log_date: string; text: string }[]).map((r) => ({ id: r.id, clientId: r.client_id, date: r.log_date, text: r.text })),
        access: (must(access) as { id: string; client_id: string; label: string; username: string; note: string }[]).map((r) => ({ id: r.id, clientId: r.client_id, label: r.label, username: r.username, note: r.note })),
        meetings: (must(meets) as { id: string; client_id: string; title: string; happened_on: string; analysis: { resumo?: string; summary?: string } | null }[]).map((r) => ({ id: r.id, clientId: r.client_id, title: r.title, happenedOn: r.happened_on, summary: r.analysis?.resumo ?? r.analysis?.summary ?? "" })),
        demands: out,
      };
    },
  });
}
/** Reuniões ainda sem cliente (para vincular). */
export const useFreeMeetings = () => useQuery({ queryKey: [...KEY, "free-meetings"], queryFn: async () => (must(await supabase.from("meetings").select("id, title, happened_on").is("client_id", null).order("happened_on", { ascending: false }).limit(30)) as { id: string; title: string; happened_on: string }[]) });

export function useClientActions(projectId: string) {
  const qc = useQueryClient(), refresh = () => qc.invalidateQueries({ queryKey: KEY });
  const m = <V,>(fn: (v: V) => Promise<unknown>) => useMutation({ mutationFn: fn, onSuccess: refresh });
  return {
    save: m(async (c: Omit<Client, "id" | "projectId"> & { id?: string | undefined }) => { const row = toRow({ ...c, projectId }); if (c.id) must(await supabase.from("clients").update(row).eq("id", c.id).select("id")); else return (must(await supabase.from("clients").insert(row).select("id")) as { id: string }[])[0]?.id; return c.id; }),
    remove: m(async (c: Client) => { const docs = must(await supabase.from("client_docs").select("attachments").eq("client_id", c.id)) as { attachments: Attachment[] | null }[]; const paths = docs.flatMap((d) => (Array.isArray(d.attachments) ? d.attachments.map((a) => a.path) : [])); must(await supabase.from("clients").delete().eq("id", c.id).select("id")); if (paths.length) await supabase.storage.from("presence-app-brain-files").remove(paths); }),
    addDoc: m(async (v: { clientId: string; title: string; kind: string; docDate: string | null; files: NewFile[]; summary: string }) => { const attachments = v.files.length ? await uploadFiles(`clientes/${v.clientId}`, v.files) : []; try { must(await supabase.from("client_docs").insert({ client_id: v.clientId, title: v.title.trim().slice(0, 200), kind: v.kind, doc_date: v.docDate || null, attachments, ai_summary: v.summary.slice(0, 20000) }).select("id")); } catch (e) { if (attachments.length) await supabase.storage.from("presence-app-brain-files").remove(attachments.map((a) => a.path)); throw e; } }),
    removeDoc: m(async (d: ClientDoc) => { must(await supabase.from("client_docs").delete().eq("id", d.id).select("id")); if (d.attachments.length) await supabase.storage.from("presence-app-brain-files").remove(d.attachments.map((a) => a.path)); }),
    addLog: m(async (v: { clientId: string; text: string; date?: string | undefined }) => { must(await supabase.from("client_log").insert({ client_id: v.clientId, text: v.text.trim().slice(0, 2000), ...(v.date ? { log_date: v.date } : {}) }).select("id")); }),
    removeLog: m(async (id: string) => { must(await supabase.from("client_log").delete().eq("id", id).select("id")); }),
    addAccess: m(async (v: { clientId: string; label: string; username: string; note: string }) => { must(await supabase.from("client_access").insert({ client_id: v.clientId, label: v.label.trim().slice(0, 160), username: v.username.trim().slice(0, 160), note: v.note.trim().slice(0, 400) }).select("id")); }),
    removeAccess: m(async (id: string) => { must(await supabase.from("client_access").delete().eq("id", id).select("id")); }),
    linkMeeting: m(async (v: { meetingId: string; clientId: string | null }) => { must(await supabase.from("meetings").update({ client_id: v.clientId }).eq("id", v.meetingId).select("id")); }),
    setDemand: m(async (v: { code: string; status: "todo" | "done" }) => { must(await supabase.from("project_demands").update({ status: v.status, updated_at: new Date().toISOString() }).eq("project_id", projectId).eq("code", v.code).select("code")); }),
  };
}
