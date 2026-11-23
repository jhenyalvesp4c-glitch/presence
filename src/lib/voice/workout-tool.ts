/** Ferramenta de voz "treino": fichas de treino, exercícios, divisão da semana e meta semanal (as mesmas telas de Saúde → Treino). */
import { must, ownerId, supabase } from "../data/db";
import { matchByName } from "./match";

type W = { id: string; name: string; duration_min: number; muscles: string[]; position: number };
type E = { id: string; workout_id: string; name: string; muscle: string; sets_reps: string; rest_seconds: number; position: number };
const s = (v: unknown) => String(v ?? "").trim();
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const weekdayOf = (v: unknown): number | null => {
  const t = norm(s(v)).replace(/-feira/g, "").trim();
  const i = DIAS.findIndex((d) => norm(d) === t || norm(d).startsWith(t.slice(0, 3)) && t.length >= 3);
  return i >= 0 ? i : null;
};

type ExIn = { nome?: unknown; musculo?: unknown; series_reps?: unknown; descanso_s?: unknown };
const exRow = (e: ExIn, position: number) => ({ name: s(e.nome).slice(0, 80), muscle: s(e.musculo).slice(0, 80), sets_reps: s(e.series_reps).slice(0, 40) || "3 x 12", rest_seconds: Math.min(600, Math.max(0, Number(e.descanso_s) || 60)), position });

export async function runWorkoutTool(args: Record<string, unknown>): Promise<{ result: Record<string, unknown> }> {
  const acao = s(args["acao"]) || "listar";
  const [ws, es] = await Promise.all([
    supabase.from("workouts").select("id, name, duration_min, muscles, position").order("position").then((r) => must(r) as W[]),
    supabase.from("workout_exercises").select("id, workout_id, name, muscle, sets_reps, rest_seconds, position").order("position").then((r) => must(r) as E[]),
  ]);
  const exOf = (id: string) => es.filter((e) => e.workout_id === id);

  if (acao === "listar") return { result: { ok: true, fichas: ws.map((w) => ({ ficha: w.name, duracao_min: w.duration_min, musculos: w.muscles, exercicios: exOf(w.id).map((e) => `${e.name} ${e.sets_reps}`) })) } };

  if (acao === "semana") {
    const split = must(await supabase.from("workout_split").select("weekday, title, workout_id")) as { weekday: number; title: string; workout_id: string | null }[];
    const goal = (must(await supabase.from("profiles").select("weekly_workout_goal").eq("id", ownerId()).maybeSingle()) as { weekly_workout_goal: number } | null)?.weekly_workout_goal ?? 5;
    return { result: { ok: true, meta_semanal: goal, divisao: DIAS.map((d, i) => { const x = split.find((y) => y.weekday === i); return { dia: d, treino: x?.title ?? "Livre", ficha: ws.find((w) => w.id === x?.workout_id)?.name ?? null }; }) } };
  }

  if (acao === "definir_dia") {
    const dia = weekdayOf(args["dia"]);
    if (dia === null) return { result: { ok: false, erro: "Qual dia da semana?" } };
    const f = s(args["alvo"] ?? args["ficha"]);
    let workout: W | undefined, title = s(args["titulo"]);
    if (f && !/^(livre|descanso|folga)$/i.test(f)) {
      const m = matchByName(ws, f, (w) => w.name);
      if (m.ambiguo) return { result: { ok: false, erro: "Mais de uma ficha parecida. Pergunte qual.", opcoes: m.ambiguo.map((w) => w.name) } };
      if (!m.item) return { result: { ok: false, erro: "Não achei essa ficha.", opcoes: ws.map((w) => w.name) } };
      workout = m.item; title = title || workout.name;
    }
    must(await supabase.from("workout_split").upsert({ weekday: dia, title: (title || "Livre").slice(0, 80), workout_id: workout?.id ?? null }, { onConflict: "user_id,weekday" }).select("id"));
    return { result: { ok: true, acao: "dia atualizado", dia: DIAS[dia], treino: title || "Livre" } };
  }

  if (acao === "meta_semanal") {
    const n = Math.round(Number(args["valor"]));
    if (!Number.isFinite(n) || n < 1 || n > 14) return { result: { ok: false, erro: "Quantos treinos por semana? (de 1 a 14)" } };
    must(await supabase.from("profiles").update({ weekly_workout_goal: n }).eq("id", ownerId()).select("id"));
    return { result: { ok: true, acao: "meta atualizada", treinos_por_semana: n } };
  }

  if (acao === "criar") {
    const nome = s(args["nome"]);
    if (!nome) return { result: { ok: false, erro: "Qual o nome da ficha?" } };
    if (ws.some((w) => w.name.toLowerCase() === nome.toLowerCase())) return { result: { ok: false, erro: `Já existe a ficha "${nome}".` } };
    const exs = (Array.isArray(args["exercicios"]) ? (args["exercicios"] as ExIn[]) : []).filter((e) => s(e.nome));
    const muscles = Array.isArray(args["musculos"]) ? (args["musculos"] as unknown[]).map(s).filter(Boolean) : [...new Set(exs.map((e) => s(e.musculo)).filter(Boolean))];
    const w = must(await supabase.from("workouts").insert({ name: nome.slice(0, 80), duration_min: Math.min(240, Math.max(10, Number(args["duracao_min"]) || 60)), muscles, position: (ws.at(-1)?.position ?? 0) + 1 }).select("id").single()) as { id: string };
    if (exs.length) must(await supabase.from("workout_exercises").insert(exs.map((e, i) => ({ ...exRow(e, i), workout_id: w.id }))).select("id"));
    return { result: { ok: true, acao: "ficha criada", ficha: nome, exercicios: exs.length } };
  }

  const m = matchByName(ws, s(args["alvo"] ?? args["ficha"]), (w) => w.name);
  if (m.ambiguo) return { result: { ok: false, erro: "Mais de uma ficha parecida. Pergunte qual.", opcoes: m.ambiguo.map((w) => w.name) } };
  if (!m.item) return { result: { ok: false, erro: "Não achei essa ficha.", opcoes: ws.map((w) => w.name) } };
  const w = m.item, mine = exOf(w.id);

  if (acao === "ver") return { result: { ok: true, ficha: w.name, duracao_min: w.duration_min, musculos: w.muscles, exercicios: mine.map((e) => ({ exercicio: e.name, musculo: e.muscle, series_reps: e.sets_reps, descanso_s: e.rest_seconds })) } };

  if (acao === "editar") {
    const patch: Record<string, unknown> = {};
    if (s(args["novo_nome"])) patch["name"] = s(args["novo_nome"]).slice(0, 80);
    if (args["duracao_min"] !== undefined) patch["duration_min"] = Math.min(240, Math.max(10, Number(args["duracao_min"]) || w.duration_min));
    if (Array.isArray(args["musculos"])) patch["muscles"] = (args["musculos"] as unknown[]).map(s).filter(Boolean);
    if (Object.keys(patch).length) must(await supabase.from("workouts").update(patch).eq("id", w.id).select("id"));
    const add = (Array.isArray(args["adicionar"]) ? (args["adicionar"] as ExIn[]) : []).filter((e) => s(e.nome));
    if (add.length) must(await supabase.from("workout_exercises").insert(add.map((e, i) => ({ ...exRow(e, (mine.at(-1)?.position ?? -1) + 1 + i), workout_id: w.id }))).select("id"));
    const rem = (Array.isArray(args["remover"]) ? (args["remover"] as unknown[]).map(s) : []).filter(Boolean);
    const removidos: string[] = [], faltou: string[] = [];
    for (const r of rem) { const x = matchByName(mine, r, (e) => e.name); if (x.item) { must(await supabase.from("workout_exercises").delete().eq("id", x.item.id).select("id")); removidos.push(x.item.name); } else faltou.push(r); }
    const alt = (Array.isArray(args["alterar"]) ? (args["alterar"] as (ExIn & { alvo?: unknown })[]) : []);
    const alterados: string[] = [];
    for (const a of alt) {
      const x = matchByName(mine, s(a.alvo ?? a.nome), (e) => e.name); if (!x.item) { faltou.push(s(a.alvo ?? a.nome)); continue; }
      const p: Record<string, unknown> = {};
      if (a.series_reps !== undefined) p["sets_reps"] = s(a.series_reps).slice(0, 40);
      if (a.descanso_s !== undefined) p["rest_seconds"] = Math.min(600, Math.max(0, Number(a.descanso_s) || 0));
      if (a.musculo !== undefined) p["muscle"] = s(a.musculo).slice(0, 80);
      if (Object.keys(p).length) { must(await supabase.from("workout_exercises").update(p).eq("id", x.item.id).select("id")); alterados.push(x.item.name); }
    }
    return { result: { ok: true, acao: "ficha atualizada", ficha: s(args["novo_nome"]) || w.name, adicionados: add.map((e) => s(e.nome)), removidos, alterados, nao_encontrados: faltou } };
  }

  if (acao === "excluir") {
    if (args["confirmado"] !== true) return { result: { ok: true, precisa_confirmar: true, pergunta: `Quer mesmo excluir a ficha ${w.name} com ${mine.length} exercícios?` } };
    must(await supabase.from("workouts").delete().eq("id", w.id).select("id"));
    return { result: { ok: true, acao: "ficha excluída", ficha: w.name } };
  }
  return { result: { ok: false, erro: "Ação desconhecida (listar, ver, criar, editar, excluir, semana, definir_dia, meta_semanal)." } };
}
