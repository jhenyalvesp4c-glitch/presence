/** Banco do briefing e da memória do Presence (cada pessoa vê só o seu, pela regra de acesso). */
import { sanitize, EMPTY_BRIEFING, isDuplicateMemory, MAX_MEMORIES, type Briefing, type Memory, type MemoryKind } from "../briefing";
import { supabase, ownerId } from "./db";

const COLS = "call_name, tone, greeting, greeting_note, work, biggest_demand, routine, goals, preferences, completed_at";
/** A tabela ainda não existe no banco (migração não aplicada): o recurso fica desligado, o app segue normal. */
const missing = (e: { message?: string; code?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|schema cache|Could not find the table/i.test(e.message ?? ""));

export type BriefingState = { available: boolean; briefing: Briefing | null; memories: Memory[] };

export async function loadBriefingState(): Promise<BriefingState> {
  const [b, m] = await Promise.all([
    supabase.from("user_briefing").select(COLS).maybeSingle(),
    supabase.from("user_memories").select("id, text, kind, source, created_at").order("created_at", { ascending: false }).limit(MAX_MEMORIES),
  ]);
  if (missing(b.error) || missing(m.error)) return { available: false, briefing: null, memories: [] };
  if (b.error) throw new Error(b.error.message);
  return { available: true, briefing: (b.data as Briefing | null) ?? null, memories: (m.data ?? []) as Memory[] };
}

/** Grava o briefing; mantém o nome do perfil (usado na saudação da tela) em sincronia com "como te chamar". */
export async function saveBriefing(input: Briefing, finish: boolean): Promise<Briefing> {
  const b = sanitize({ ...EMPTY_BRIEFING, ...input, completed_at: finish ? (input.completed_at ?? new Date().toISOString()) : input.completed_at });
  const { error } = await supabase.from("user_briefing").upsert({ user_id: ownerId(), ...b }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  if (b.call_name) await supabase.from("profiles").update({ display_name: b.call_name }).eq("id", ownerId());
  return b;
}

export async function addMemory(text: string, kind: MemoryKind, source: Memory["source"] = "conversa"): Promise<{ ok: boolean; motivo?: string }> {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!t) return { ok: false, motivo: "vazio" };
  const { data, error } = await supabase.from("user_memories").select("id, text").order("created_at", { ascending: false }).limit(MAX_MEMORIES);
  if (missing(error)) return { ok: false, motivo: "indisponivel" };
  if (error) throw new Error(error.message);
  if (isDuplicateMemory(t, (data ?? []) as { text: string }[])) return { ok: false, motivo: "ja_sei" };
  if ((data ?? []).length >= MAX_MEMORIES) return { ok: false, motivo: "cheia" };
  const ins = await supabase.from("user_memories").insert({ user_id: ownerId(), text: t, kind, source }).select("id");
  if (ins.error) throw new Error(ins.error.message);
  return { ok: true };
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from("user_memories").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
}

/** Esquece o que combina com o texto (a pedido da pessoa, por voz). */
export async function forgetMemories(query: string): Promise<number> {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(query).trim();
  if (!q) return 0;
  const { data } = await supabase.from("user_memories").select("id, text").limit(MAX_MEMORIES);
  const ids = ((data ?? []) as { id: string; text: string }[]).filter((m) => norm(m.text).includes(q)).map((m) => m.id);
  if (!ids.length) return 0;
  const { error } = await supabase.from("user_memories").delete().in("id", ids).select("id");
  if (error) throw new Error(error.message);
  return ids.length;
}
