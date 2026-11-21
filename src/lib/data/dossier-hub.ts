/** Página do dossiê: tudo que está ligado a um dossiê (demandas, reuniões, registros, notas e clientes). Só as linhas do dono. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { must, supabase } from "./db";
import type { Client, ClientStatus } from "../clients";

export type HubDemand = { code: string; title: string; status: string; deadline: string; priority: string };
export type HubMeeting = { id: string; title: string; happenedOn: string };
export type HubRecord = { id: string; kind: "registro" | "nota"; title: string; text: string; date: string };
export type HubClient = Pick<Client, "id" | "name" | "status" | "monthlyValue" | "contractEnd" | "contactName">;
export type Hub = { demands: HubDemand[]; meetings: HubMeeting[]; records: HubRecord[]; clients: HubClient[] };

const KEY = ["dossier-hub"] as const;
export function useDossierHub(projectId: string, dossier: { id: string; name: string }) {
  return useQuery({
    queryKey: [...KEY, projectId, dossier.id, dossier.name],
    queryFn: async (): Promise<Hub> => {
      const [dem, meet, brain, notes, cls] = await Promise.all([
        supabase.from("project_demands").select("code, title, status, deadline, priority").eq("project_id", projectId).ilike("dossier_name", dossier.name.replace(/[%_]/g, "\\$&")).order("created_at", { ascending: false }),
        supabase.from("meetings").select("id, title, happened_on").eq("dossier_project", projectId).eq("dossier_id", dossier.id).order("happened_on", { ascending: false }),
        supabase.from("brain_entries").select("id, title, text, entry_date").contains("dossier_names", [dossier.name]).order("entry_date", { ascending: false }).limit(30),
        supabase.from("project_notes").select("id, text, date_label").eq("project_id", projectId).eq("dossier_id", dossier.id).limit(30),
        supabase.from("clients").select("id, name, status, monthly_value, contract_end, contact_name").eq("project_id", projectId).eq("dossier_id", dossier.id),
      ]);
      return {
        demands: (must(dem) as { code: string; title: string; status: string; deadline: string | null; priority: string }[]).map((d) => ({ code: d.code, title: d.title, status: d.status, deadline: d.deadline ?? "", priority: d.priority })),
        meetings: (must(meet) as { id: string; title: string; happened_on: string }[]).map((m) => ({ id: m.id, title: m.title, happenedOn: m.happened_on })),
        records: [
          ...(must(brain) as { id: string; title: string; text: string; entry_date: string }[]).map((b): HubRecord => ({ id: `b${b.id}`, kind: "registro", title: b.title || b.text.slice(0, 70), text: b.text, date: b.entry_date })),
          ...(must(notes) as { id: number; text: string; date_label: string }[]).map((n): HubRecord => ({ id: `n${n.id}`, kind: "nota", title: n.text.slice(0, 70), text: n.text, date: n.date_label })),
        ],
        clients: (must(cls) as { id: string; name: string; status: ClientStatus; monthly_value: number | string; contract_end: string | null; contact_name: string }[]).map((c) => ({ id: c.id, name: c.name, status: c.status, monthlyValue: Number(c.monthly_value), contractEnd: c.contract_end, contactName: c.contact_name })),
      };
    },
  });
}
export const useFreeMeetingsForHub = () => useQuery({ queryKey: [...KEY, "free"], queryFn: async () => must(await supabase.from("meetings").select("id, title, happened_on").is("dossier_id", null).order("happened_on", { ascending: false }).limit(30)) as { id: string; title: string; happened_on: string }[] });

export function useHubActions(projectId: string, dossierId: string) {
  const qc = useQueryClient(), refresh = () => qc.invalidateQueries({ queryKey: KEY });
  return {
    setDemand: useMutation({ mutationFn: async (v: { code: string; status: "todo" | "done" }) => { must(await supabase.from("project_demands").update({ status: v.status, updated_at: new Date().toISOString() }).eq("project_id", projectId).eq("code", v.code).select("code")); }, onSuccess: refresh }),
    linkMeeting: useMutation({ mutationFn: async (v: { meetingId: string; link: boolean }) => { must(await supabase.from("meetings").update(v.link ? { dossier_id: dossierId, dossier_project: projectId } : { dossier_id: null, dossier_project: null }).eq("id", v.meetingId).select("id")); }, onSuccess: refresh }),
  };
}
