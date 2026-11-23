/** Ferramenta de voz "dieta": plano de hoje, marcar refeições, água, opção do dia e metas (as mesmas telas de Saúde → Dieta). */
import { cleanDietPlan, daySummary, optionOf, type DietPlan } from "../diet-plan";
import { must, supabase } from "../data/db";
import { matchByName } from "./match";

const s = (v: unknown) => String(v ?? "").trim();
type LogRow = { meals_done: string[] | null; water_ml: number | null; option_id: string | null };

export async function runDietTool(args: Record<string, unknown>, today: string): Promise<{ result: Record<string, unknown> }> {
  const acao = s(args["acao"]) || "hoje";
  const rows = must(await supabase.from("diet_plans").select("id, name, data").eq("active", true).order("created_at", { ascending: false }).limit(1)) as { id: string; name: string; data: unknown }[];
  const row = rows[0], plan: DietPlan | null = row ? cleanDietPlan(row.data) : null;
  if (!row || !plan) return { result: { ok: false, erro: "Você ainda não tem um plano alimentar ativo. Ofereça abrir a tela de Dieta para criar um." } };
  const logRows = must(await supabase.from("diet_day_logs").select("meals_done, water_ml, option_id").eq("plan_id", row.id).eq("log_date", today).limit(1)) as LogRow[];
  const cur = logRows[0] ?? null;
  const opt = optionOf(plan, cur?.option_id);
  const done = cur?.meals_done ?? [], water = cur?.water_ml ?? 0;

  const save = async (patch: Partial<{ meals_done: string[]; water_ml: number; option_id: string | null }>) => {
    if (cur) must(await supabase.from("diet_day_logs").update({ ...patch, updated_at: new Date().toISOString() }).eq("plan_id", row.id).eq("log_date", today).select("id"));
    else must(await supabase.from("diet_day_logs").insert({ plan_id: row.id, log_date: today, custom_meals: [], swaps: {}, extras: [], option_id: opt.id, meals_done: [], extra_protein_g: null, water_ml: null, notes: "", ...patch }).select("id"));
  };

  if (acao === "hoje") {
    const sum = daySummary(plan, { customMeals: [], swaps: {}, extras: [], date: today, optionId: cur?.option_id ?? null, mealsDone: done, extraProteinG: null, waterMl: water, energy: null, fullness: null, difficulty: null, training: null, discomfort: null, bowel: null, notes: "" });
    return { result: { ok: true, plano: row.name, opcao_do_dia: opt.nome, refeicoes: opt.refeicoes.map((m) => ({ refeicao: m.nome, hora: m.hora, feita: done.includes(m.id) })), feitas: sum.done, total: sum.total, proteina_g: sum.protein, kcal: Math.round(sum.macros.kcal), agua_ml: water, meta_agua_ml: plan.hidratacao.atualMl, metas: plan.metas } };
  }
  if (acao === "marcar_refeicao" || acao === "desmarcar_refeicao") {
    const q = s(args["alvo"]);
    const targets = /^(todas|tudo)$/i.test(q) ? opt.refeicoes : (() => { const m = matchByName(opt.refeicoes, q, (x) => x.nome); return m.item ? [m.item] : m.ambiguo ?? []; })();
    if (!targets.length) return { result: { ok: false, erro: "Não achei essa refeição.", opcoes: opt.refeicoes.map((m) => m.nome) } };
    if (targets.length > 1 && !/^(todas|tudo)$/i.test(q)) return { result: { ok: false, erro: "Mais de uma refeição parecida. Pergunte qual.", opcoes: targets.map((m) => m.nome) } };
    const ids = new Set(targets.map((m) => m.id));
    const next = acao === "marcar_refeicao" ? [...new Set([...done, ...ids])] : done.filter((x) => !ids.has(x));
    await save({ meals_done: next });
    return { result: { ok: true, acao: acao === "marcar_refeicao" ? "refeição marcada" : "marcação removida", refeicoes: targets.map((m) => m.nome), feitas: opt.refeicoes.filter((m) => next.includes(m.id)).length, total: opt.refeicoes.length } };
  }
  if (acao === "agua") {
    const ml = Math.round(Number(args["ml"]));
    if (!Number.isFinite(ml) || ml === 0 || Math.abs(ml) > 5000) return { result: { ok: false, erro: "Quantos mililitros de água?" } };
    const total = Math.max(0, water + ml);
    await save({ water_ml: total });
    return { result: { ok: true, acao: "água registrada", adicionou_ml: ml, total_hoje_ml: total, meta_ml: plan.hidratacao.atualMl } };
  }
  if (acao === "escolher_opcao") {
    const m = matchByName(plan.opcoes, s(args["alvo"]), (o) => o.nome);
    if (m.ambiguo) return { result: { ok: false, erro: "Mais de uma opção parecida. Pergunte qual.", opcoes: m.ambiguo.map((o) => o.nome) } };
    if (!m.item) return { result: { ok: false, erro: "Não achei essa opção.", opcoes: plan.opcoes.map((o) => o.nome) } };
    await save({ option_id: m.item.id, meals_done: [] });
    return { result: { ok: true, acao: "opção do dia escolhida", opcao: m.item.nome } };
  }
  if (acao === "metas") {
    const n = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Math.max(0, Math.round(Number(v))));
    const patch = { kcal: n(args["kcal"]), p: n(args["proteina_g"]), c: n(args["carbo_g"]), f: n(args["gordura_g"]) };
    if (Object.values(patch).every((v) => v === undefined)) return { result: { ok: true, metas: plan.metas } };
    if (Object.values(patch).some((v) => v !== undefined && !Number.isFinite(v))) return { result: { ok: false, erro: "Valor de meta inválido." } };
    const metas = { ...plan.metas, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
    must(await supabase.from("diet_plans").update({ data: { ...plan, metas }, updated_at: new Date().toISOString() }).eq("id", row.id).select("id"));
    return { result: { ok: true, acao: "metas atualizadas", metas } };
  }
  return { result: { ok: false, erro: "Ação desconhecida (hoje, marcar_refeicao, desmarcar_refeicao, agua, escolher_opcao, metas)." } };
}
