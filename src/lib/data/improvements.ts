/** Pedidos de melhoria que o Orion monta quando não consegue fazer algo; ficam na fila para o Claude implementar. */
import { must, supabase } from "./db";

export type ImprovementStatus = "na_fila" | "em_andamento" | "feito" | "cancelado";
export type Improvement = { id: string; title: string; request: string; details: string; area: string; status: ImprovementStatus; claude_note: string; created_at: string };
export type ImprovementDraft = { title: string; request: string; details: string; area: string };

const clip = (s: string, n: number) => s.replace(/\s+\n/g, "\n").trim().slice(0, n);

export async function sendImprovement(d: ImprovementDraft): Promise<string> {
  const title = clip(d.title, 140);
  if (!title) throw new Error("O pedido precisa de um título.");
  const rows = must(await supabase.from("improvement_requests").insert({ title, request: clip(d.request, 2000), details: clip(d.details, 6000), area: clip(d.area, 120) }).select("id")) as { id: string }[];
  return rows[0]!.id;
}

export async function listImprovements(limit = 30): Promise<Improvement[]> {
  return must(await supabase.from("improvement_requests").select("id, title, request, details, area, status, claude_note, created_at").order("created_at", { ascending: false }).limit(limit)) as Improvement[];
}

export const STATUS_LABEL: Record<ImprovementStatus, string> = { na_fila: "Na fila para o Claude", em_andamento: "O Claude está fazendo", feito: "Pronto", cancelado: "Cancelado" };
