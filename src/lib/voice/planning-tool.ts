/** Ferramenta de voz "planejamento": ver, montar e ajustar o plano do dia por conversa. Mexe nos mesmos dados da tela. */
import { generateDay } from "../data/day";
import { buildPlan, loadSettings, logPlanEvent } from "../data/planning";
import { supabase } from "../supabase";
import { SOURCE_LABEL, type SourceId } from "../planning/engine";
import { insights, type PlanEvent } from "../planning/learn";
import { normalize } from "../orion";
import type { Panel, PanelItem } from "./agent";

type Row = { id: string; plan_date: string; time: string; title: string; description: string; kind: string; done: boolean; task_id: string | null; duration_min: number; tag: string; color: string; icon: string };
const hm = (t: string) => t.slice(0, 5);
const addMin = (t: string, m: number) => { const x = Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) + m; return `${String(Math.floor(x / 60) % 24).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
const nowSP = () => { const d = new Date(), f = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo", ...o }); return { date: f({ year: "numeric", month: "2-digit", day: "2-digit" }), time: f({ hour: "2-digit", minute: "2-digit", hour12: false }).slice(0, 5) }; };
const plusDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function resolveDate(q: unknown, today: string): string {
  const t = normalize(String(q ?? ""));
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(q ?? "").trim())) return String(q).trim();
  if (/amanha/.test(t) && !/depois/.test(t)) return plusDays(today, 1);
  if (/depois de amanha/.test(t)) return plusDays(today, 2);
  if (/ontem/.test(t)) return plusDays(today, -1);
  const days = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"], i = days.findIndex((d) => t.includes(d));
  if (i >= 0) { const cur = new Date(`${today}T12:00:00Z`).getUTCDay(); return plusDays(today, ((i - cur + 7) % 7) || 7); }
  return today;
}

const panel = (titulo: string, itens: PanelItem[], para = "/planejamento/dia"): Panel => ({ titulo, secoes: [{ titulo, itens }], abrir: { rotulo: "Abrir o plano", para } });

async function dayRows(date: string): Promise<Row[]> {
  const { data, error } = await supabase.from("schedule_items").select("id, plan_date, time, title, description, kind, done, task_id, duration_min, tag, color, icon").eq("plan_date", date).order("time");
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}
function findItem(rows: Row[], q: string): { row?: Row; erro?: Record<string, unknown> } {
  const n = normalize(q);
  if (!n) return { erro: { ok: false, erro: "Qual atividade?", opcoes: rows.slice(0, 10).map((r) => r.title) } };
  const exact = rows.filter((r) => normalize(r.title) === n), part = rows.filter((r) => normalize(r.title).includes(n) || n.includes(normalize(r.title)));
  const pick = exact.length === 1 ? exact : part;
  if (pick.length === 1) return { row: pick[0]! };
  if (pick.length > 1) return { erro: { ok: false, erro: "Mais de uma atividade parecida. Pergunte qual.", opcoes: pick.slice(0, 8).map((r) => `${hm(r.time)} ${r.title}`) } };
  return { erro: { ok: false, erro: `Não achei "${q}" nesse dia.`, opcoes: rows.slice(0, 10).map((r) => r.title) } };
}

export async function runPlanningTool(args: Record<string, unknown>): Promise<{ result: Record<string, unknown>; panel?: Panel; navegar?: string }> {
  const acao = String(args["acao"] ?? "ver"), now = nowSP(), date = resolveDate(args["data"], now.date), str = (k: string) => String(args[k] ?? "").trim();
  const dia = date === now.date ? "hoje" : date === plusDays(now.date, 1) ? "amanhã" : date.split("-").reverse().join("/");

  if (acao === "ver") {
    const rows = await dayRows(date);
    if (rows.length) {
      const feitos = rows.filter((r) => r.done).length;
      return { result: { ok: true, dia, salvo: true, atividades: rows.map((r) => ({ hora: hm(r.time), ate: addMin(r.time, r.duration_min), nome: r.title, feito: r.done })), feitas: feitos, total: rows.length }, panel: { ...panel(`Plano de ${dia}`, rows.map((r): PanelItem => ({ rotulo: `${hm(r.time)}–${addMin(r.time, r.duration_min)}  ${r.title}`, detalhe: r.description || r.tag, feita: r.done }))) } };
    }
    const p = await buildPlan(date, { disposicao: "normal", tempo: "completo", prioridade: "", pausas: false }, undefined, now);
    return { result: { ok: true, dia, salvo: false, aviso: "Ainda não foi gerado; esta é a prévia com os dados reais. Ofereça gerar.", atividades: p.blocks.map((b) => ({ hora: b.time, nome: b.title })), avisos: p.warnings }, panel: panel(`Prévia de ${dia}`, p.blocks.length ? p.blocks.map((b): PanelItem => ({ rotulo: `${b.time}–${addMin(b.time, b.durationMin)}  ${b.title}`, detalhe: b.description })) : [{ rotulo: "Nada previsto para esse dia." }]) };
  }

  if (acao === "gerar") {
    const r = await generateDay({ mode: "planejamento", date, disposicao: (["alta", "baixa"].includes(str("disposicao")) ? str("disposicao") : "normal") as "alta" | "normal" | "baixa", tempo: (["manha", "tarde", "pouco"].includes(str("tempo")) ? str("tempo") : "completo") as "completo" | "manha" | "tarde" | "pouco", prioridade: str("prioridade"), pausas: args["pausas"] !== false }, now);
    const rows = await dayRows(date);
    return { result: { ok: true, dia, montado: r.count, avisos: r.warnings ?? [], ficaram_de_fora: (r.unplaced ?? []).map((u) => u.title) }, panel: panel(`Plano de ${dia}`, rows.map((x): PanelItem => ({ rotulo: `${hm(x.time)}–${addMin(x.time, x.duration_min)}  ${x.title}`, detalhe: x.description || x.tag, feita: x.done }))) };
  }

  if (acao === "adicionar") {
    const title = str("titulo"), time = /^\d{1,2}:\d{2}$/.test(str("hora")) ? str("hora").padStart(5, "0") : "";
    if (!title) return { result: { ok: false, erro: "Qual atividade?" } };
    if (!time) return { result: { ok: false, erro: "Em que horário? (ex.: 15:30)" } };
    const dur = Math.max(5, Math.min(720, Math.round(Number(args["duracao_min"]) || 30)));
    const { error } = await supabase.from("schedule_items").insert({ plan_date: date, time, title: title.slice(0, 120), description: "Adicionada por voz", tag: "Nova", color: "cyan", icon: "star", kind: "extra", duration_min: dur, source: "manual", position: 99 });
    if (error) return { result: { ok: false, erro: "Não consegui adicionar." } };
    void logPlanEvent({ plan_date: date, action: "adicionado", kind: "extra", title, planned_time: time });
    return { result: { ok: true, acao: "adicionada", dia, atividade: title, hora: time, ate: addMin(time, dur) }, panel: panel("Adicionado ao plano", [{ rotulo: `${time}–${addMin(time, dur)}  ${title}`, detalhe: dia }]) };
  }

  const rows = await dayRows(date), f = findItem(rows, str("titulo"));
  if (f.erro) return { result: f.erro };
  const r = f.row!;
  if (acao === "mover") {
    const time = /^\d{1,2}:\d{2}$/.test(str("hora")) ? str("hora").padStart(5, "0") : "";
    if (!time) return { result: { ok: false, erro: "Para qual horário?" } };
    const { error } = await supabase.from("schedule_items").update({ time }).eq("id", r.id);
    if (error) return { result: { ok: false, erro: "Não consegui mover." } };
    void logPlanEvent({ plan_date: date, action: "movido", kind: r.kind, title: r.title, planned_time: hm(r.time), at_time: time });
    return { result: { ok: true, acao: "movida", atividade: r.title, de: hm(r.time), para: time }, panel: panel("Horário alterado", [{ rotulo: r.title, detalhe: `${hm(r.time)} → ${time}` }]) };
  }
  if (acao === "concluir") {
    const { error } = await supabase.from("schedule_items").update({ done: true }).eq("id", r.id);
    if (error) return { result: { ok: false, erro: "Não consegui concluir." } };
    if (r.task_id) await supabase.from("tasks").update({ done: true, done_at: new Date().toISOString() }).eq("id", r.task_id);
    void logPlanEvent({ plan_date: date, action: "feito", kind: r.kind, title: r.title, planned_time: hm(r.time), at_time: now.time });
    const left = rows.filter((x) => !x.done && x.id !== r.id).length;
    return { result: { ok: true, acao: "concluida", atividade: r.title, faltam: left }, panel: panel("Concluído", [{ rotulo: r.title, feita: true }, { rotulo: `Faltam ${left} hoje` }]) };
  }
  if (acao === "adiar") {
    const to = plusDays(date, 1);
    await supabase.from("schedule_items").delete().eq("id", r.id);
    const { error } = await supabase.from("schedule_items").insert({ plan_date: to, time: r.time, title: r.title, description: r.description, tag: r.tag, color: r.color, icon: r.icon, kind: r.kind, task_id: r.task_id, duration_min: r.duration_min, source: "manual", position: 99 });
    if (error) return { result: { ok: false, erro: "Não consegui adiar." } };
    if (r.task_id) await supabase.from("tasks").update({ due_date: to }).eq("id", r.task_id);
    void logPlanEvent({ plan_date: date, action: "adiado", kind: r.kind, title: r.title, planned_time: hm(r.time) });
    return { result: { ok: true, acao: "adiada", atividade: r.title, para: to.split("-").reverse().join("/") }, panel: panel("Passou para amanhã", [{ rotulo: r.title, detalhe: `${hm(r.time)} · ${to.split("-").reverse().join("/")}` }]) };
  }
  if (acao === "remover") {
    if (args["confirmado"] !== true) return { result: { ok: false, precisa_confirmar: true, o_que: `a atividade "${r.title}" do plano de ${dia}` } };
    await supabase.from("schedule_items").delete().eq("id", r.id);
    void logPlanEvent({ plan_date: date, action: "removido", kind: r.kind, title: r.title, planned_time: hm(r.time) });
    return { result: { ok: true, acao: "removida", atividade: r.title }, panel: panel("Removido do plano", [{ rotulo: r.title }]) };
  }
  return { result: { ok: false, erro: "Ação desconhecida." } };
}

/** Ligar/desligar fontes e ver o que o Orion aprendeu (não dependem de um item do dia). */
export async function runPlanningSettings(args: Record<string, unknown>): Promise<{ result: Record<string, unknown>; panel?: Panel }> {
  const acao = String(args["acao"] ?? ""), st = await loadSettings();
  if (acao === "fontes") {
    const q = normalize(String(args["fonte"] ?? "")), id = (Object.keys(SOURCE_LABEL) as SourceId[]).find((k) => normalize(SOURCE_LABEL[k]).includes(q) || normalize(k) === q);
    if (q && !id) return { result: { ok: false, erro: "Não conheci essa fonte.", fontes: Object.values(SOURCE_LABEL) } };
    if (id && typeof args["ligada"] === "boolean") {
      const { error } = await supabase.from("plan_settings").upsert({ sources: { ...st.sources, [id]: args["ligada"] }, day_start: st.dayStart, day_end: st.dayEnd, travel_min: st.travelMin, learn: st.learn, prefs: st.prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) return { result: { ok: false, erro: "Não consegui salvar." } };
      st.sources[id] = args["ligada"];
    }
    return { result: { ok: true, fontes: Object.fromEntries((Object.keys(SOURCE_LABEL) as SourceId[]).map((k) => [SOURCE_LABEL[k], st.sources[k]])) }, panel: panel("Fontes do plano", (Object.keys(SOURCE_LABEL) as SourceId[]).map((k): PanelItem => ({ rotulo: SOURCE_LABEL[k], detalhe: st.sources[k] ? "ligada" : "desligada", feita: st.sources[k] })), "/planejamento") };
  }
  if (acao === "aprendizado") {
    const { data } = await supabase.from("plan_events").select("plan_date, action, kind, title, planned_time, at_time, created_at").order("created_at", { ascending: false }).limit(1000);
    const frases = insights((data ?? []) as PlanEvent[], nowSP().date), { data: sug } = await supabase.from("plan_suggestions").select("title, detail").eq("status", "nova").limit(5);
    return { result: { ok: true, aprendizado_ligado: st.learn, percebi: frases, sugestoes: (sug ?? []).map((x: { title: string }) => x.title) }, panel: panel("O que o Orion percebeu", [...frases.map((t): PanelItem => ({ rotulo: t })), ...(sug ?? []).map((x: { title: string; detail: string }): PanelItem => ({ rotulo: x.title, detalhe: x.detail })), ...(frases.length || sug?.length ? [] : [{ rotulo: "Ainda estou conhecendo o seu ritmo." }])], "/planejamento") };
  }
  return { result: { ok: false, erro: "Ação desconhecida." } };
}
