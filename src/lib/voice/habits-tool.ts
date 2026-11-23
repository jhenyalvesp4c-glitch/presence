/** Ferramenta de voz "habitos": listar com sequência, criar, marcar/desmarcar (hoje ou outro dia) e arquivar. */
import { format, subDays } from "date-fns";
import { must, supabase } from "../data/db";
import { matchByName } from "./match";

type H = { id: string; name: string; icon: string; color: string };
const s = (v: unknown) => String(v ?? "").trim();
const COLORS = ["cyan", "violet", "emerald", "amber", "rose"];
const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Dias seguidos até hoje (ou até ontem, se hoje ainda não foi marcado). Pura, testada. */
export function streakOf(days: Set<string>, today: string): number {
  let d = new Date(`${today}T12:00:00`); let n = 0;
  if (!days.has(iso(d))) d = subDays(d, 1);
  while (days.has(iso(d))) { n++; d = subDays(d, 1); }
  return n;
}

export async function runHabitTool(args: Record<string, unknown>, today: string): Promise<{ result: Record<string, unknown> }> {
  const acao = s(args["acao"]) || "listar";
  const habits = must(await supabase.from("habits").select("id, name, icon, color").eq("active", true).order("position").order("created_at")) as H[];
  const comps = must(await supabase.from("habit_completions").select("habit_id, completed_on").gte("completed_on", iso(subDays(new Date(`${today}T12:00:00`), 90)))) as { habit_id: string; completed_on: string }[];
  const byHabit = new Map<string, Set<string>>();
  for (const c of comps) { if (!byHabit.has(c.habit_id)) byHabit.set(c.habit_id, new Set()); byHabit.get(c.habit_id)!.add(c.completed_on); }

  if (acao === "listar") return { result: { ok: true, hoje: today, habitos: habits.map((h) => ({ habito: h.name, feito_hoje: byHabit.get(h.id)?.has(today) ?? false, sequencia: streakOf(byHabit.get(h.id) ?? new Set(), today) })) } };

  if (acao === "criar") {
    const nome = s(args["nome"]);
    if (!nome) return { result: { ok: false, erro: "Qual o nome do hábito?" } };
    if (habits.some((h) => h.name.toLowerCase() === nome.toLowerCase())) return { result: { ok: false, erro: `Você já tem o hábito "${nome}".` } };
    const { data: last } = await supabase.from("habits").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    must(await supabase.from("habits").insert({ name: nome.slice(0, 80), icon: s(args["icone"]) || "sparkles", color: COLORS[habits.length % COLORS.length], position: ((last as { position?: number } | null)?.position ?? 0) + 1 }).select("id"));
    return { result: { ok: true, acao: "hábito criado", habito: nome } };
  }

  const m = matchByName(habits, s(args["alvo"] ?? args["nome"]), (h) => h.name);
  if (m.ambiguo) return { result: { ok: false, erro: "Mais de um hábito parecido. Pergunte qual.", opcoes: m.ambiguo.map((h) => h.name) } };
  if (!m.item) return { result: { ok: false, erro: "Não achei esse hábito.", opcoes: habits.map((h) => h.name) } };
  const h = m.item;
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(s(args["data"])) ? s(args["data"]) : today;

  if (acao === "marcar") {
    must(await supabase.from("habit_completions").upsert({ habit_id: h.id, completed_on: dia }, { onConflict: "habit_id,completed_on" }).select("id"));
    const set = new Set(byHabit.get(h.id) ?? []); set.add(dia);
    return { result: { ok: true, acao: "hábito marcado", habito: h.name, dia, sequencia: streakOf(set, today) } };
  }
  if (acao === "desmarcar") {
    must(await supabase.from("habit_completions").delete().eq("habit_id", h.id).eq("completed_on", dia).select("id"));
    return { result: { ok: true, acao: "marcação removida", habito: h.name, dia } };
  }
  if (acao === "arquivar") {
    if (args["confirmado"] !== true) return { result: { ok: true, precisa_confirmar: true, pergunta: `Quer mesmo arquivar o hábito ${h.name}? Ele some da lista, mas o histórico fica guardado.` } };
    must(await supabase.from("habits").update({ active: false }).eq("id", h.id).select("id"));
    return { result: { ok: true, acao: "hábito arquivado", habito: h.name } };
  }
  if (acao === "renomear") {
    const novo = s(args["novo_nome"]);
    if (!novo) return { result: { ok: false, erro: "Qual o novo nome?" } };
    must(await supabase.from("habits").update({ name: novo.slice(0, 80) }).eq("id", h.id).select("id"));
    return { result: { ok: true, acao: "hábito renomeado", de: h.name, para: novo } };
  }
  return { result: { ok: false, erro: "Ação desconhecida (listar, criar, marcar, desmarcar, renomear, arquivar)." } };
}
