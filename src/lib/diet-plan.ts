/**
 * Plano alimentar (ex.: ficha de recomposição corporal): tipos, o plano como documento, estimativa de proteína pelas porções,
 * resumo do dia, comparação entre as opções de refeições e sugestão de trocas. Funções puras (sem rede), para testar à parte.
 */
export type DietItem = { alimento: string; qtd: string; /** gramas, se a porção é em gramas */ g?: number | null; /** proteína em gramas, se a ficha informar */ protG?: number | null };
export type DietMeal = { id: string; nome: string; hora: string; itens: DietItem[]; objetivo: string; orientacoes: string[] };
export type DietOption = { id: string; nome: string; tag: string; recomendada: boolean; resumo: string; refeicoes: DietMeal[] };
export type Substitution = { alimento: string; porcao: string };
export type FoodGroup = { id: string; nome: string; referencia: string; itens: Substitution[]; nota: string; destaque: string };
export type DietPlan = {
  nome: string; objetivo: string;
  perfil: { idade: number | null; sexo: string; pesoKg: number | null; alturaM: number | null; imc: number | null; treino: string; duracaoTreino: string; medicacao: string; preferencia: string; horarios: string; hidratacao: string };
  atencao: string; estrategia: string[];
  proteina: { min: number | null; max: number | null; nota: string };
  tmb: number | null; semMeta: string;
  opcoes: DietOption[];
  trocasProteina: Substitution[]; trocasProteinaNota: string; trocasCarbo: Substitution[]; trocasCarboNota: string; frutas: string[]; frutasNota: string;
  whey: { dose: string; notas: string[] };
  treinoNota: string[];
  hidratacao: { atualMl: number | null; orientacoes: string[]; estrategia: string[]; aviso: string };
  intestino: { texto: string; estrategias: string[]; aviso: string };
  aceitos: string[]; rejeitados: string[]; preferenciasNota: string;
  comparar: { registrar: string[]; nota: string };
  semanal: string[]; revisar: string[]; seguranca: string[]; objetivoFinal: string;
  grupos: FoodGroup[];
  trocas: { se: string; escolha: string }[]; trocasNota: string;
  versaoPratica: { refeicao: string; principal: string; alternativas: string }[];
};

export type DayLog = { date: string; optionId: string | null; mealsDone: string[]; extraProteinG: number | null; waterMl: number | null; energy: number | null; fullness: number | null; difficulty: number | null; training: number | null; discomfort: number | null; bowel: boolean | null; notes: string };
export type DietWeekly = { week: number; date: string; weight: number | null; waist: number | null; abdomen: number | null; hip: number | null; bowelCount: number | null; waterL: number | null; energy: number | null; training: number | null; difficulty: number | null; digestive: number | null; satiety: number | null; notes: string };

/* ───────────── limpeza (plano vindo da IA ou do banco) ───────────── */
const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const num = (v: unknown): number | null => { if (v === null || v === undefined || (typeof v === "string" && !v.trim())) return null; const n = typeof v === "number" ? v : Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
const strs = (v: unknown, n: number, max = 400) => (Array.isArray(v) ? v : []).map((x) => str(x, max)).filter(Boolean).slice(0, n);
export const slug = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x";
const pairs = (v: unknown, a: string, b: string, n: number): { [k: string]: string }[] => (Array.isArray(v) ? v : []).flatMap((x) => { const o = x as Record<string, unknown> | null; const p = str(o?.[a], 160), q = str(o?.[b], 200); return p ? [{ [a]: p, [b]: q }] : []; }).slice(0, n);

export function cleanDietPlan(raw: unknown): DietPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>, obj = (k: string) => (o[k] && typeof o[k] === "object" ? (o[k] as Record<string, unknown>) : {});
  const opcoes: DietOption[] = (Array.isArray(o["opcoes"]) ? (o["opcoes"] as unknown[]) : []).flatMap((x, oi): DietOption[] => {
    if (!x || typeof x !== "object") return [];
    const op = x as Record<string, unknown>, nome = str(op["nome"], 120);
    const refeicoes = (Array.isArray(op["refeicoes"]) ? (op["refeicoes"] as unknown[]) : []).flatMap((m, mi): DietMeal[] => {
      const me = m as Record<string, unknown> | null, mn = str(me?.["nome"], 120);
      if (!me || !mn) return [];
      const itens = (Array.isArray(me["itens"]) ? (me["itens"] as unknown[]) : []).flatMap((i): DietItem[] => { const it = i as Record<string, unknown> | null, a = str(it?.["alimento"], 160); return it && a ? [{ alimento: a, qtd: str(it["qtd"], 120), g: num(it["g"]), protG: num(it["protG"]) }] : []; }).slice(0, 20);
      return [{ id: str(me["id"], 40) || slug(`${str(op["id"], 8) || oi}-${mn}`), nome: mn, hora: str(me["hora"], 40), itens, objetivo: str(me["objetivo"], 300), orientacoes: strs(me["orientacoes"], 10) }];
    }).slice(0, 8);
    return nome && refeicoes.length ? [{ id: str(op["id"], 20) || String.fromCharCode(65 + oi), nome, tag: str(op["tag"], 80), recomendada: op["recomendada"] === true, resumo: str(op["resumo"], 300), refeicoes }] : [];
  }).slice(0, 4);
  if (!opcoes.length) return null;
  const perfil = obj("perfil"), prot = obj("proteina"), hid = obj("hidratacao"), intes = obj("intestino"), whey = obj("whey"), comp = obj("comparar");
  return {
    nome: str(o["nome"], 160) || "Meu plano alimentar", objetivo: str(o["objetivo"], 300),
    perfil: { idade: num(perfil["idade"]), sexo: str(perfil["sexo"], 30), pesoKg: num(perfil["pesoKg"]), alturaM: num(perfil["alturaM"]), imc: num(perfil["imc"]), treino: str(perfil["treino"], 160), duracaoTreino: str(perfil["duracaoTreino"], 80), medicacao: str(perfil["medicacao"], 200), preferencia: str(perfil["preferencia"], 200), horarios: str(perfil["horarios"], 200), hidratacao: str(perfil["hidratacao"], 120) },
    atencao: str(o["atencao"], 800), estrategia: strs(o["estrategia"], 12), proteina: { min: num(prot["min"]), max: num(prot["max"]), nota: str(prot["nota"], 600) },
    tmb: num(o["tmb"]), semMeta: str(o["semMeta"], 500), opcoes,
    trocasProteina: pairs(o["trocasProteina"], "alimento", "porcao", 20) as unknown as Substitution[], trocasProteinaNota: str(o["trocasProteinaNota"], 500), trocasCarbo: pairs(o["trocasCarbo"], "alimento", "porcao", 20) as unknown as Substitution[], trocasCarboNota: str(o["trocasCarboNota"], 400),
    frutas: strs(o["frutas"], 30, 60), frutasNota: str(o["frutasNota"], 500), whey: { dose: str(whey["dose"], 200), notas: strs(whey["notas"], 12) }, treinoNota: strs(o["treinoNota"], 12),
    hidratacao: { atualMl: num(hid["atualMl"]), orientacoes: strs(hid["orientacoes"], 10), estrategia: strs(hid["estrategia"], 10), aviso: str(hid["aviso"], 500) },
    intestino: { texto: str(intes["texto"], 600), estrategias: strs(intes["estrategias"], 14), aviso: str(intes["aviso"], 600) },
    aceitos: strs(o["aceitos"], 40, 60), rejeitados: strs(o["rejeitados"], 40, 60), preferenciasNota: str(o["preferenciasNota"], 300), comparar: { registrar: strs(comp["registrar"], 12), nota: str(comp["nota"], 500) },
    semanal: strs(o["semanal"], 14), revisar: strs(o["revisar"], 12), seguranca: strs(o["seguranca"], 12, 600), objetivoFinal: str(o["objetivoFinal"], 400),
    grupos: (Array.isArray(o["grupos"]) ? (o["grupos"] as unknown[]) : []).flatMap((g, i): FoodGroup[] => { const x = g as Record<string, unknown> | null, nome = str(x?.["nome"], 120); return x && nome ? [{ id: str(x["id"], 20) || String(i + 1), nome, referencia: str(x["referencia"], 160), itens: pairs(x["itens"], "alimento", "porcao", 40) as unknown as Substitution[], nota: str(x["nota"], 600), destaque: str(x["destaque"], 300) }] : []; }).slice(0, 16),
    trocas: pairs(o["trocas"], "se", "escolha", 20) as unknown as { se: string; escolha: string }[], trocasNota: str(o["trocasNota"], 400),
    versaoPratica: (Array.isArray(o["versaoPratica"]) ? (o["versaoPratica"] as unknown[]) : []).flatMap((v) => { const x = v as Record<string, unknown> | null, r = str(x?.["refeicao"], 80); return x && r ? [{ refeicao: r, principal: str(x["principal"], 200), alternativas: str(x["alternativas"], 300) }] : []; }).slice(0, 8),
  };
}

/* ───────────── proteína estimada pelas porções ───────────── */
/** Gramas de proteína por 100 g (cozido/preparado): estimativa para planejar; o rótulo e o nutricionista mandam. */
const PER100: [RegExp, number][] = [
  [/whey/i, 0], [/frango|peito|sobrecoxa|peru/i, 31], [/carne|bife|bisteca|lombo|su[ií]na|hamb[uú]rguer/i, 26], [/peixe|til[aá]pia|salm[aã]o|atum/i, 25], [/ovo|omelete/i, 12.5],
  [/feij[aã]o|lentilha|gr[aã]o-de-bico/i, 5.5], [/soja/i, 12], [/arroz/i, 2.5], [/batata|mandioca|macarr[aã]o|milho|polenta/i, 2], [/iogurte|cottage|ricota|queijo/i, 8], [/leite/i, 3.4],
  [/banana|mam[aã]o|morango|fruta|laranja|mexerica|goiaba|manga|uva|abacaxi/i, 0.8], [/salada|alface|tomate|pepino|repolho|cenoura/i, 1],
];
/** Proteína aproximada de um item (g). Usa o valor da ficha, depois "X g de proteína" no texto, depois a tabela por 100 g. */
export function itemProtein(it: DietItem): number {
  if (it.protG !== null && it.protG !== undefined) return it.protG;
  const txt = `${it.alimento} ${it.qtd}`, m = txt.match(/(\d+(?:[.,]\d+)?)\s*(?:[–-]\s*(\d+(?:[.,]\d+)?))?\s*g\s+de\s+prote[ií]na/i);
  if (m) { const a = Number(m[1]!.replace(",", ".")), b = m[2] ? Number(m[2].replace(",", ".")) : a; return (a + b) / 2; }
  if (/whey/i.test(it.alimento)) return 24.5;
  const g = it.g ?? (it.qtd.match(/(\d+(?:[.,]\d+)?)\s*g\b/i) ? Number(it.qtd.match(/(\d+(?:[.,]\d+)?)\s*g\b/i)![1]!.replace(",", ".")) : null);
  const per = PER100.find(([re]) => re.test(it.alimento))?.[1];
  return g !== null && per !== undefined ? (g * per) / 100 : 0;
}
export const mealProtein = (m: DietMeal) => Math.round(m.itens.reduce((a, i) => a + itemProtein(i), 0) * 10) / 10;
export const optionProtein = (o: DietOption) => Math.round(o.refeicoes.reduce((a, m) => a + mealProtein(m), 0));

/* ───────────── resumo do dia e comparação ───────────── */
export const optionOf = (p: DietPlan, id: string | null | undefined): DietOption => p.opcoes.find((o) => o.id === id) ?? p.opcoes.find((o) => o.recomendada) ?? p.opcoes[0]!;
export function daySummary(p: DietPlan, log: DayLog | null) {
  const opt = optionOf(p, log?.optionId), done = log?.mealsDone ?? [], eaten = opt.refeicoes.filter((m) => done.includes(m.id));
  const protein = Math.round(eaten.reduce((a, m) => a + mealProtein(m), 0) + (log?.extraProteinG ?? 0));
  return { opt, done: eaten.length, total: opt.refeicoes.length, protein, plannedProtein: optionProtein(opt), pct: opt.refeicoes.length ? eaten.length / opt.refeicoes.length : 0 };
}
export type OptionStats = { id: string; nome: string; dias: number; fullness: number | null; difficulty: number | null; energy: number | null; training: number | null; discomfort: number | null; adherence: number; protein: number | null };
const avg = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };
/** Médias por opção (só dias com a opção marcada): a base para "qual opção provoca menos estômago cheio, é mais fácil de cumprir…". */
export function compareOptions(p: DietPlan, logs: DayLog[]): OptionStats[] {
  return p.opcoes.map((o) => {
    const ds = logs.filter((l) => l.optionId === o.id);
    return { id: o.id, nome: o.nome, dias: ds.length, fullness: avg(ds.map((l) => l.fullness)), difficulty: avg(ds.map((l) => l.difficulty)), energy: avg(ds.map((l) => l.energy)), training: avg(ds.map((l) => l.training)), discomfort: avg(ds.map((l) => l.discomfort)),
      adherence: ds.length ? Math.round((ds.reduce((a, l) => a + l.mealsDone.filter((id) => o.refeicoes.some((m) => m.id === id)).length / o.refeicoes.length, 0) / ds.length) * 100) : 0, protein: ds.length ? Math.round(avg(ds.map((l) => daySummary(p, l).protein)) ?? 0) : null };
  });
}
/** Média de água (ml) e quantos dias foram registrados, nos últimos `days` dias. */
export function waterTrend(logs: DayLog[], todayIso: string, days = 7) {
  const from = new Date(todayIso + "T12:00:00"); from.setDate(from.getDate() - days + 1);
  const f = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-${String(from.getDate()).padStart(2, "0")}`;
  const ds = logs.filter((l) => l.date >= f && l.date <= todayIso && l.waterMl !== null);
  return { avg: ds.length ? Math.round(ds.reduce((a, l) => a + (l.waterMl ?? 0), 0) / ds.length) : null, days: ds.length };
}
/** Semana do plano (1 = a semana do início). */
export const weekOfPlan = (startIso: string, dateIso: string) => (dateIso < startIso ? 0 : Math.floor((new Date(dateIso + "T12:00:00").getTime() - new Date(startIso + "T12:00:00").getTime()) / (7 * 86_400_000)) + 1);

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Trocas possíveis para um alimento do prato: a tabela prática da ficha e o grupo em que ele aparece. */
export function swapsFor(p: DietPlan, alimento: string): { tabela: string[]; grupo: { nome: string; opcoes: Substitution[] } | null } {
  const a = norm(alimento), words = a.split(/\s+/).filter((w) => w.length > 3);
  const tabela = p.trocas.filter((t) => { const s = norm(t.se); return words.some((w) => s.includes(w)) || a.includes(s); }).map((t) => t.escolha);
  const grupo = p.grupos.find((g) => g.itens.some((i) => { const n = norm(i.alimento); return words.some((w) => n.includes(w)); })) ?? null;
  return { tabela, grupo: grupo ? { nome: grupo.nome, opcoes: grupo.itens } : null };
}
