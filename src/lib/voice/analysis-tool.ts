/** Ferramenta de voz "analise_corporal": resumo da evolução do corpo, metas e gordura medida. Usa as mesmas contas da tela Saúde → Análise. */
import { prefsFromRow } from "../data/analysis";
import { ownerId, supabase } from "../data/db";
import { measurementFromRow } from "../health-db";
import { FAT_KEY, analyze, goalProgress, periodSlice, slopePerDay, type PeriodKey } from "../health-analysis";
import type { Panel, PanelItem } from "./agent";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const kg = (n: number | null, d = 1) => (n === null ? "—" : `${n.toFixed(d).replace(".", ",")}`);
const PERIOD_FROM_WORDS: [RegExp, PeriodKey][] = [[/m[eê]s|30/, "30"], [/(3|tr[eê]s) meses|trimestre|90/, "90"], [/(6|seis) meses|semestre|180/, "180"], [/ano|365/, "365"], [/tudo|todo|desde o in[ií]cio|geral/, "all"]];

type Row = { name: string; measured_on: string; height_m: number | string | null; weight_kg: number | string | null; values: Record<string, string>; notes: string };
const profileCols = "analysis_sex, analysis_period, analysis_hidden, goal_weight_kg, goal_waist_cm";

export async function runAnalysisTool(args: Record<string, unknown>): Promise<{ result: Record<string, unknown>; panel?: Panel; navegar?: string }> {
  const acao = String(args["acao"] ?? "resumo");
  const rows = ((await supabase.from("body_measurements").select("name, measured_on, height_m, weight_kg, values, notes").order("measured_on", { ascending: true }).limit(1000)).data ?? []) as Row[];
  const prof = (await supabase.from("profiles").select(profileCols).eq("id", ownerId()).maybeSingle()).data as Parameters<typeof prefsFromRow>[0];
  const prefs = prefsFromRow(prof);
  const nav = { navegar: "/analise" };

  if (acao === "meta") {
    const quando = String(args["tipo"] ?? "peso").toLowerCase().includes("cintura") ? "cintura" : "peso";
    const v = Number(args["valor"]);
    if (args["valor"] === null || args["valor"] === undefined || args["valor"] === "") return { result: { ok: true, metas: { peso_kg: prefs.goalWeight, cintura_cm: prefs.goalWaist } } };
    if (!Number.isFinite(v) || v <= 0) return { result: { ok: false, erro: "Qual é o valor da meta?" } };
    const col = quando === "peso" ? { goal_weight_kg: Math.round(v * 10) / 10 } : { goal_waist_cm: Math.round(v * 10) / 10 };
    const { error } = await supabase.from("profiles").update(col).eq("id", ownerId());
    if (error) return { result: { ok: false, erro: quando === "peso" ? "Esse peso não parece válido para uma meta." : "Essa cintura não parece válida para uma meta." } };
    return { result: { ok: true, acao: "meta_definida", tipo: quando, valor: v, unidade: quando === "peso" ? "kg" : "cm" }, panel: { titulo: "Meta definida", secoes: [{ titulo: "Meta", itens: [{ rotulo: quando === "peso" ? `Peso: ${kg(v)} kg` : `Cintura: ${kg(v)} cm` }] }], abrir: { rotulo: "Abrir a análise", para: "/analise" } }, ...nav };
  }

  if (acao === "gordura") {
    const v = Number(String(args["valor"] ?? "").replace(",", "."));
    if (!Number.isFinite(v) || v < 3 || v > 70) return { result: { ok: false, erro: "Qual é o percentual de gordura medido? (entre 3 e 70)" } };
    const last = rows.at(-1);
    if (!last) return { result: { ok: false, erro: "Ainda não há nenhuma medição. Registre o peso e as medidas primeiro." } };
    const values = { ...(last.values ?? {}), [FAT_KEY]: String(v).replace(".", ",") };
    const { error } = await supabase.from("body_measurements").update({ values }).eq("measured_on", last.measured_on);
    if (error) return { result: { ok: false, erro: "Não consegui salvar a gordura." } };
    return { result: { ok: true, acao: "gordura_registrada", percentual: v, na_medicao_de: last.measured_on }, panel: { titulo: "Gordura registrada", secoes: [{ titulo: "Medição", itens: [{ rotulo: `${kg(v)}% de gordura`, detalhe: `na medição de ${last.measured_on.split("-").reverse().join("/")}` }] }], abrir: { rotulo: "Abrir a análise", para: "/analise" } }, ...nav };
  }

  // resumo
  if (!rows.length) return { result: { ok: true, sem_medicoes: true, aviso: "A pessoa ainda não registrou peso e medidas. Ofereça registrar." }, ...nav };
  const words = String(args["periodo"] ?? "").toLowerCase();
  const period: PeriodKey = PERIOD_FROM_WORDS.find(([re]) => re.test(words))?.[1] ?? prefs.period;
  const all = rows.map((r) => measurementFromRow(r, {}));
  const day = today();
  const a = analyze(periodSlice(all, period, day), prefs.sexo, day) ?? analyze(all, prefs.sexo, day)!;
  const first = all[0]!, wStart = Number(String(first.peso).replace(",", ".")) || null;
  const gw = goalProgress(wStart, a.last.weight, prefs.goalWeight, a.paceKgWeek);
  const sl = slopePerDay(a.entries.map((e) => ({ date: e.date, value: e.waist })));
  const gc = goalProgress(Number(String(first.valores["cintura"] ?? "").replace(",", ".")) || null, a.last.waist, prefs.goalWaist, sl === null ? null : sl * 7);
  const out = {
    ok: true, periodo: period, medicoes: a.entries.length, ultima_medicao: a.last.date, dias_desde_a_ultima: a.sinceLast,
    peso_atual_kg: a.last.weight, variacao_peso_kg: a.delta.weight, ritmo_kg_por_semana: a.paceKgWeek, projecao_30_dias_kg: a.projection30,
    cintura_cm: a.last.waist, variacao_cintura_cm: a.delta.waist,
    gordura_pct: a.last.fatPct, gordura_origem: a.last.fatManual ? "medida pela pessoa" : "estimativa pela altura e cintura (não é exame)", massa_magra_kg: a.last.leanKg,
    pontuacao_de_saude: a.score, indicadores: a.indicators.map((i) => ({ nome: i.label, valor: i.display, situacao: i.statusLabel })),
    meta_peso: prefs.goalWeight === null ? null : { alvo_kg: prefs.goalWeight, faltam_kg: gw?.remaining ?? null, andamento_pct: gw ? Math.round(gw.pct) : null, atingida: gw?.reached ?? false, dias_no_ritmo_atual: gw?.etaDays ?? null },
    meta_cintura: prefs.goalWaist === null ? null : { alvo_cm: prefs.goalWaist, faltam_cm: gc?.remaining ?? null, andamento_pct: gc ? Math.round(gc.pct) : null, atingida: gc?.reached ?? false },
    frases: a.insights.map((i) => i.text),
  };
  const items: PanelItem[] = [
    { rotulo: `Peso: ${kg(a.last.weight)} kg`, detalhe: a.delta.weight === null ? undefined : `${a.delta.weight > 0 ? "+" : ""}${kg(a.delta.weight)} kg no período` },
    ...(a.last.waist !== null ? [{ rotulo: `Cintura: ${kg(a.last.waist)} cm`, detalhe: a.delta.waist === null ? undefined : `${a.delta.waist > 0 ? "+" : ""}${kg(a.delta.waist)} cm` }] : []),
    ...(a.last.fatPct !== null ? [{ rotulo: `Gordura ${a.last.fatManual ? "medida" : "estimada"}: ${kg(a.last.fatPct)}%` }] : []),
    ...(a.score !== null ? [{ rotulo: `Pontuação de saúde: ${a.score}` }] : []),
    ...(gw ? [{ rotulo: gw.reached ? "Meta de peso atingida" : `Meta de peso: faltam ${kg(gw.remaining)} kg`, detalhe: `${Math.round(gw.pct)}% do caminho` }] : []),
  ];
  return { result: out, panel: { titulo: "Sua evolução", secoes: [{ titulo: "Resumo", itens: items }, { titulo: "Percebi", itens: a.insights.slice(0, 4).map((i): PanelItem => ({ rotulo: i.text })) }], abrir: { rotulo: "Abrir a análise", para: "/analise" } }, ...nav };
}
