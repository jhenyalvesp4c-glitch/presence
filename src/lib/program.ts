/**
 * Programa de treino (ex.: recomposição corporal de 12 semanas): tipos, o programa como documento, a regra de progressão dupla,
 * recordes, volume por músculo, aderência e prazos de medidas/fotos. Funções puras (sem rede), para testar à parte.
 */
export type Equip = "maquina" | "halter" | "polia" | "livre" | "corpo";
export type ExKind = "forca" | "cardio" | "tempo";
export type ProgExercise = {
  id: string; nome: string; grupo: string; tipo: ExKind;
  series: number; repsMin: number; repsMax: number; repsNota: string; descansoS: number;
  /** Para cardio e exercícios por tempo/lado ("15–20 min", "2 × 15–25 s"). */
  prescricao: string;
  rir: string; equip: Equip; incrementoKg: number; progressao: "dupla" | "nenhuma";
  instrucoes: string; cargaInicial: number | null;
};
export type ProgDay = {
  id: string; dia: number; titulo: string; foco: string; tipo: "forca" | "cardio" | "descanso";
  aquecimento: string[]; cardio: string; nota: string; meta: string; exercicios: ProgExercise[];
};
export type Program = {
  nome: string; objetivos: string[]; semanas: number;
  perfil: { pesoKg: number | null; alturaM: number | null; frequencia: string; duracao: string };
  estrategia: string;
  dias: ProgDay[];
  fases: { semana: number; objetivo: string; orientacao: string }[];
  regras: { situacao: string; acao: string }[];
  incrementos: string[];
  rirEscala: { rir: number; significado: string }[];
  rirNota: string;
  cargaInicial: string[];
  acompanhamento: string[];
  medidas: string[];
  metas: { texto: string; feita: boolean }[];
  orientacoes: string[];
  observacoes: string[];
};

export type SetLog = { id?: string; exerciseId: string; exerciseName: string; date: string; week: number; set: number; load: number | null; reps: number | null; rir: number | null; warmup: boolean; flags: string[] };
export type Weekly = { week: number; date: string; weight: number | null; daysTrained: number | null; energy: number | null; recovery: number | null; notes: string };

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const dayName = (d: number) => DAY_NAMES[((d % 7) + 7) % 7]!;
const pad = (n: number) => String(n).padStart(2, "0");
const parse = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y!, (m ?? 1) - 1, d ?? 1); };
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (iso: string, n: number) => { const d = parse(iso); d.setDate(d.getDate() + n); return isoOf(d); };
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Semana do programa (1 = a semana em que começou). Antes do início = 0; depois do fim passa de `semanas`. */
export const weekOf = (startIso: string, dateIso: string): number => (dateIso < startIso ? 0 : Math.floor(daysBetween(startIso, dateIso) / 7) + 1);
export const faseDaSemana = (p: Program, week: number) => p.fases.find((f) => f.semana === week) ?? null;
/** Primeiro dia (segunda-feira) da semana `week` contando do início. */
export const weekStart = (startIso: string, week: number) => addDays(startIso, (week - 1) * 7);

/* ───────────── limpeza (ficha vinda da IA ou do banco) ───────────── */
const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const num = (v: unknown): number | null => { if (v === null || v === undefined || (typeof v === "string" && !v.trim())) return null; const n = typeof v === "number" ? v : Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
const strs = (v: unknown, n: number, max = 400) => (Array.isArray(v) ? v : []).map((x) => str(x, max)).filter(Boolean).slice(0, n);
const uid = (p: string, i: number) => `${p}${i}-${Math.random().toString(36).slice(2, 7)}`;
/** Identificador estável pelo nome: o mesmo exercício em dois dias (leg press na segunda e na quinta) divide o histórico e a progressão. */
export const slugOf = (nome: string) => nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "exercicio";

function cleanExercise(raw: unknown, i: number): ProgExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>, nome = str(o["nome"], 120);
  if (!nome) return null;
  const tipo: ExKind = o["tipo"] === "cardio" || o["tipo"] === "tempo" ? o["tipo"] : "forca";
  const min = Math.max(0, Math.round(num(o["repsMin"]) ?? 0)), max = Math.max(min, Math.round(num(o["repsMax"]) ?? min));
  const equip = (["maquina", "halter", "polia", "livre", "corpo"] as const).find((e) => e === o["equip"]) ?? "maquina";
  return {
    id: str(o["id"], 40) || slugOf(nome), nome, grupo: str(o["grupo"], 80), tipo,
    series: Math.max(1, Math.min(12, Math.round(num(o["series"]) ?? 2))), repsMin: min, repsMax: max, repsNota: str(o["repsNota"], 40),
    descansoS: Math.max(0, Math.min(600, Math.round(num(o["descansoS"]) ?? 60))), prescricao: str(o["prescricao"], 120),
    rir: str(o["rir"], 20), equip, incrementoKg: Math.max(0, Math.min(20, num(o["incrementoKg"]) ?? (equip === "halter" ? 1 : equip === "maquina" ? 2.5 : 1))),
    progressao: tipo === "forca" && o["progressao"] !== "nenhuma" ? "dupla" : "nenhuma", instrucoes: str(o["instrucoes"], 600), cargaInicial: num(o["cargaInicial"]),
  };
}
export function cleanProgram(raw: unknown): Program | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>, nome = str(o["nome"], 160);
  const dias: ProgDay[] = (Array.isArray(o["dias"]) ? (o["dias"] as unknown[]) : []).flatMap((d, i): ProgDay[] => {
    if (!d || typeof d !== "object") return [];
    const x = d as Record<string, unknown>, dia = Math.round(num(x["dia"]) ?? -1);
    if (dia < 0 || dia > 6) return [];
    const exercicios = (Array.isArray(x["exercicios"]) ? (x["exercicios"] as unknown[]) : []).map((e, k) => cleanExercise(e, k)).filter((e): e is ProgExercise => !!e).slice(0, 20);
    const tipo = x["tipo"] === "cardio" || x["tipo"] === "descanso" ? x["tipo"] : exercicios.length ? "forca" : "descanso";
    return [{ id: str(x["id"], 40) || uid("d", i), dia, titulo: str(x["titulo"], 120) || dayName(dia), foco: str(x["foco"], 160), tipo, aquecimento: strs(x["aquecimento"], 8), cardio: str(x["cardio"], 200), nota: str(x["nota"], 600), meta: str(x["meta"], 400), exercicios }];
  }).slice(0, 7);
  if (!dias.length) return null;
  const perfil = (o["perfil"] && typeof o["perfil"] === "object" ? o["perfil"] : {}) as Record<string, unknown>;
  const semanas = Math.max(1, Math.min(52, Math.round(num(o["semanas"]) ?? 12)));
  return {
    nome: nome || "Meu programa de treino", objetivos: strs(o["objetivos"], 10), semanas,
    perfil: { pesoKg: num(perfil["pesoKg"]), alturaM: num(perfil["alturaM"]), frequencia: str(perfil["frequencia"], 60), duracao: str(perfil["duracao"], 60) },
    estrategia: str(o["estrategia"], 1200), dias: dias.sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7)),
    fases: (Array.isArray(o["fases"]) ? (o["fases"] as unknown[]) : []).flatMap((f) => { const x = f as Record<string, unknown> | null; const s = Math.round(num(x?.["semana"]) ?? 0); return s >= 1 ? [{ semana: s, objetivo: str(x?.["objetivo"], 80), orientacao: str(x?.["orientacao"], 200) }] : []; }).slice(0, 52),
    regras: (Array.isArray(o["regras"]) ? (o["regras"] as unknown[]) : []).flatMap((r) => { const x = r as Record<string, unknown> | null; const s = str(x?.["situacao"], 160), a = str(x?.["acao"], 160); return s && a ? [{ situacao: s, acao: a }] : []; }).slice(0, 12),
    incrementos: strs(o["incrementos"], 8), rirEscala: (Array.isArray(o["rirEscala"]) ? (o["rirEscala"] as unknown[]) : []).flatMap((r) => { const x = r as Record<string, unknown> | null; const n = num(x?.["rir"]); return n !== null && x?.["significado"] ? [{ rir: Math.round(n), significado: str(x["significado"], 120) }] : []; }).slice(0, 8),
    rirNota: str(o["rirNota"], 400), cargaInicial: strs(o["cargaInicial"], 12), acompanhamento: strs(o["acompanhamento"], 12), medidas: strs(o["medidas"], 16, 80),
    metas: (Array.isArray(o["metas"]) ? (o["metas"] as unknown[]) : []).flatMap((m) => { const x = m as Record<string, unknown> | string | null; const t = typeof x === "string" ? x : str(x?.["texto"], 200); return t ? [{ texto: t.slice(0, 200), feita: typeof x === "object" && x?.["feita"] === true }] : []; }).slice(0, 12),
    orientacoes: strs(o["orientacoes"], 10, 500), observacoes: strs(o["observacoes"], 10, 500),
  };
}

/* ───────────── progressão dupla ───────────── */
export type Session = { date: string; week: number; sets: SetLog[] };
/** Séries de trabalho (sem aquecimento) agrupadas por dia, do mais antigo ao mais novo. */
export function sessionsOf(logs: SetLog[], exerciseId: string): Session[] {
  const by = new Map<string, SetLog[]>();
  for (const l of logs) if (l.exerciseId === exerciseId && !l.warmup && l.reps !== null) by.set(l.date, [...(by.get(l.date) ?? []), l]);
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, sets]) => ({ date, week: sets[0]!.week, sets: sets.sort((x, y) => x.set - y.set) }));
}
const topLoad = (s: Session) => Math.max(0, ...s.sets.map((x) => x.load ?? 0));
const repsAtTop = (s: Session) => s.sets.filter((x) => (x.load ?? 0) === topLoad(s)).map((x) => x.reps ?? 0);

export type Action = "aferir" | "manter" | "subir_reps" | "aumentar" | "reduzir" | "interromper" | "fixo";
export type Suggestion = { acao: Action; titulo: string; motivo: string; cargaAlvo: number | null; ultima: { date: string; load: number | null; reps: number[] } | null };
const kg = (n: number) => `${String(round1(n)).replace(".", ",")} kg`;

/** Regra da ficha (progressão dupla): o que fazer na PRÓXIMA sessão deste exercício, com o motivo. */
export function suggest(ex: ProgExercise, sessions: Session[]): Suggestion {
  if (ex.tipo !== "forca") return { acao: "fixo", titulo: "Seguir a prescrição", motivo: ex.prescricao || "Sem carga para progredir.", cargaAlvo: null, ultima: null };
  const last = sessions.at(-1), prev = sessions.at(-2);
  if (!last) {
    if (ex.cargaInicial) return { acao: "manter", titulo: `Começar com ${kg(ex.cargaInicial)}`, motivo: "Carga inicial informada. Na primeira série, vá mais leve se não conhece a máquina.", cargaAlvo: ex.cargaInicial, ultima: null };
    return { acao: "aferir", titulo: "Encontrar a carga inicial", motivo: `Comece leve, faça 10 repetições controladas e suba um pouco até achar um peso com a faixa de ${ex.repsMin}–${ex.repsMax} e 3–4 repetições sobrando. Registre esse peso.`, cargaAlvo: null, ultima: null };
  }
  const load = topLoad(last), reps = repsAtTop(last), flags = new Set(last.sets.flatMap((s) => s.flags));
  const ultima = { date: last.date, load: load || null, reps: last.sets.map((s) => s.reps ?? 0) };
  if (flags.has("dor")) return { acao: "interromper", titulo: "Interromper e avaliar", motivo: "Você marcou dor articular na última vez. Não insista: converse com seu profissional antes de seguir.", cargaAlvo: null, ultima };
  if (flags.has("postura") || flags.has("impulso")) return { acao: "reduzir", titulo: `Reduzir a carga (${kg(Math.max(0, load - ex.incrementoKg))})`, motivo: "Você marcou perda de postura ou impulso. Técnica vem antes de carga.", cargaAlvo: Math.max(0, load - ex.incrementoKg), ultima };
  const allReps = last.sets.map((s) => s.reps ?? 0);
  if (allReps.some((r) => r < ex.repsMin)) return { acao: "reduzir", titulo: `Reduzir a carga (${kg(Math.max(0, load - ex.incrementoKg))})`, motivo: `Alguma série ficou abaixo do mínimo de ${ex.repsMin} repetições.`, cargaAlvo: Math.max(0, load - ex.incrementoKg), ultima };
  const rirs = last.sets.map((s) => s.rir).filter((r): r is number => r !== null);
  const allMax = last.sets.length >= ex.series && allReps.every((r) => r >= ex.repsMax);
  if (allMax) {
    const easy = rirs.length ? Math.min(...rirs) >= 2 : null;
    if (easy === false) return { acao: "manter", titulo: "Manter a carga", motivo: `Você bateu ${ex.repsMax} repetições, mas sobrou menos de 2 de reserva. Repita até ficar mais leve.`, cargaAlvo: load, ultima };
    return { acao: "aumentar", titulo: `Aumentar para ${kg(load + ex.incrementoKg)}`, motivo: easy ? `Todas as séries no máximo (${ex.repsMax}) com 2 ou mais repetições de reserva.` : `Todas as séries no máximo (${ex.repsMax}). Se sobraram 2 repetições e a técnica estava boa, é hora de subir.`, cargaAlvo: round1(load + ex.incrementoKg), ultima };
  }
  if (prev && topLoad(prev) === load && sum(repsAtTop(last)) > sum(repsAtTop(prev))) return { acao: "subir_reps", titulo: "Manter a carga e subir as repetições", motivo: `Você melhorou as repetições (${sum(repsAtTop(prev))} → ${sum(repsAtTop(last))}). Continue até chegar a ${ex.repsMax} em todas as séries.`, cargaAlvo: load, ultima };
  if (prev && topLoad(prev) < load) return { acao: "manter", titulo: "Reconstruir as repetições", motivo: `Você subiu a carga para ${kg(load)}. Agora construa as repetições de novo até ${ex.repsMax}.`, cargaAlvo: load, ultima };
  return { acao: "manter", titulo: "Manter a carga", motivo: `Ainda não bateu ${ex.repsMax} em todas as séries. Mantenha ${kg(load)} e tente mais repetições.`, cargaAlvo: load, ultima };
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/* ───────────── análises ───────────── */
/** Carga máxima estimada para 1 repetição (Epley). */
export const e1rm = (load: number, reps: number) => (reps <= 0 ? 0 : reps === 1 ? load : round1(load * (1 + reps / 30)));
export type Pr = { exerciseId: string; nome: string; load: number; reps: number; e1rm: number; date: string };
/** Melhor série de trabalho de cada exercício (pela carga estimada de 1 repetição). */
export function personalRecords(logs: SetLog[]): Pr[] {
  const best = new Map<string, Pr>();
  for (const l of logs) {
    if (l.warmup || !l.load || !l.reps) continue;
    const v = e1rm(l.load, l.reps), cur = best.get(l.exerciseId);
    if (!cur || v > cur.e1rm) best.set(l.exerciseId, { exerciseId: l.exerciseId, nome: l.exerciseName, load: l.load, reps: l.reps, e1rm: v, date: l.date });
  }
  return [...best.values()].sort((a, b) => b.e1rm - a.e1rm);
}
/** Evolução da carga de um exercício (maior carga de cada sessão, com as repetições). */
export const loadSeries = (logs: SetLog[], exerciseId: string) => sessionsOf(logs, exerciseId).map((s) => ({ date: s.date, week: s.week, load: topLoad(s), reps: repsAtTop(s), tonnage: round1(sum(s.sets.map((x) => (x.load ?? 0) * (x.reps ?? 0)))) }));

export type MuscleWeek = { week: number; grupo: string; series: number; tonelagem: number };
/** Séries e tonelagem por grupo muscular em cada semana do programa. */
export function volumeByMuscle(logs: SetLog[], groupOf: (exerciseId: string) => string): MuscleWeek[] {
  const m = new Map<string, MuscleWeek>();
  for (const l of logs) {
    if (l.warmup || l.reps === null) continue;
    for (const g of groupOf(l.exerciseId).split(/\s+e\s+|,|\//i).map((x) => x.trim()).filter(Boolean).map((x) => x.charAt(0).toUpperCase() + x.slice(1))) {
      const k = `${l.week}|${g}`, cur = m.get(k) ?? { week: l.week, grupo: g, series: 0, tonelagem: 0 };
      cur.series += 1; cur.tonelagem = round1(cur.tonelagem + (l.load ?? 0) * l.reps); m.set(k, cur);
    }
  }
  return [...m.values()].sort((a, b) => a.week - b.week || b.series - a.series);
}

/** Dias de treino da semana (datas diferentes com séries registradas) e quantos o programa planejou. */
export function adherence(p: Program, logs: SetLog[], week: number): { feitos: number; planejados: number; dias: string[] } {
  const dias = [...new Set(logs.filter((l) => l.week === week && !l.warmup).map((l) => l.date))].sort();
  return { feitos: dias.length, planejados: p.dias.filter((d) => d.tipo !== "descanso").length, dias };
}
/** Treinos concluídos desde o início, por semana. */
export function adherenceByWeek(p: Program, logs: SetLog[], upTo: number) { return Array.from({ length: Math.max(0, upTo) }, (_, i) => ({ week: i + 1, ...adherence(p, logs, i + 1) })); }

/** Prazos: peso e medidas a cada 2 semanas e fotos a cada 4. O primeiro registro vale já no início do programa; os seguintes contam da última data registrada. */
export function checkinDue(startIso: string, todayIso: string, measuredDates: string[], photoDates: string[]): { medidas: { due: boolean; proxima: string }; fotos: { due: boolean; proxima: string } } {
  const nextAfter = (dates: string[], weeks: number) => { const last = [...dates].filter((d) => d >= startIso).sort().at(-1); return last ? addDays(last, weeks * 7) : startIso; };
  const m = nextAfter(measuredDates, 2), f = nextAfter(photoDates, 4);
  return { medidas: { due: m <= todayIso, proxima: m }, fotos: { due: f <= todayIso, proxima: f } };
}

/** Frases curtas sobre a evolução (o que subiu, o que estagnou). */
export function insights(p: Program, logs: SetLog[]): { tom: "bom" | "atencao" | "info"; texto: string }[] {
  const out: { tom: "bom" | "atencao" | "info"; texto: string }[] = [];
  for (const d of p.dias) for (const ex of d.exercicios) {
    if (ex.tipo !== "forca") continue;
    const s = loadSeries(logs, ex.id);
    if (s.length < 2) continue;
    const first = s[0]!, last = s.at(-1)!, gain = last.load - first.load;
    if (gain > 0) out.push({ tom: "bom", texto: `${ex.nome}: ${kg(first.load)} → ${kg(last.load)} (${gain > 0 ? "+" : ""}${kg(gain)} em ${s.length} treinos).` });
    else if (s.length >= 3 && s.slice(-3).every((x) => x.load === last.load && sum(x.reps) <= sum(s.at(-3)!.reps))) out.push({ tom: "atencao", texto: `${ex.nome}: sem avanço há ${Math.min(s.length, 3)} treinos. Vale checar técnica, descanso e recuperação.` });
  }
  return out.slice(0, 8);
}

export const MEASURE_FIELDS: { key: string; label: string }[] = [
  { key: "peito", label: "Peito" }, { key: "braco_d", label: "Braço direito" }, { key: "braco_e", label: "Braço esquerdo" }, { key: "cintura", label: "Cintura" },
  { key: "abdomen", label: "Abdômen" }, { key: "quadril", label: "Quadril / glúteos" }, { key: "coxa_d", label: "Coxa direita" }, { key: "coxa_e", label: "Coxa esquerda" },
  { key: "panturrilha_d", label: "Panturrilha direita" }, { key: "panturrilha_e", label: "Panturrilha esquerda" },
];
export const PHOTO_SLOTS = ["Frente", "Lado", "Costas"];
/** Chaves que a Análise de saúde já entende: braço e coxa viram a média dos dois lados. */
export function withLegacyKeys(v: Record<string, string>): Record<string, string> {
  const n = (k: string) => num(v[k]), mean = (a: string, b: string) => { const xs = [n(a), n(b)].filter((x): x is number => x !== null); return xs.length ? String(round1(avg(xs))).replace(".", ",") : ""; };
  return { ...v, ...(mean("braco_d", "braco_e") ? { braco: mean("braco_d", "braco_e") } : {}), ...(mean("coxa_d", "coxa_e") ? { coxa: mean("coxa_d", "coxa_e") } : {}) };
}
