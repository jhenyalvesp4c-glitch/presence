// Regras da tela Saúde → Análise: transforma o histórico de medições em números, indicadores e frases.
// Tudo puro (sem React) para poder testar. As estimativas de gordura usam a fórmula RFM
// (Relative Fat Mass: altura e cintura), que não substitui bioimpedância nem avaliação profissional.

import { measurementLabels, toNumber, type MeasurementSheet } from "./health-preview";

export type Sexo = "feminino" | "masculino";
export type PeriodKey = "30" | "90" | "180" | "365" | "all";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "30", label: "Último mês" },
  { key: "90", label: "Últimos 3 meses" },
  { key: "180", label: "Últimos 6 meses" },
  { key: "365", label: "Último ano" },
  { key: "all", label: "Todo o período" },
];

const DAY = 86_400_000;
const t = (iso: string) => new Date(`${iso}T12:00:00`).getTime();
export const daysBetween = (a: string, b: string) => Math.round((t(b) - t(a)) / DAY);
export function addDays(iso: string, n: number) {
  const d = new Date(t(iso) + n * DAY);
  return d.toISOString().slice(0, 10);
}
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Altura em centímetros (a ficha aceita "1,68" ou "168"). */
export function heightCm(altura: string | undefined): number | null {
  const a = toNumber(altura);
  if (!a || a <= 0) return null;
  return a > 3 ? a : a * 100;
}

export function bmi(weightKg: number | null, hCm: number | null): number | null {
  if (!weightKg || !hCm) return null;
  return weightKg / (hCm / 100) ** 2;
}

/** % de gordura estimada (RFM): mulheres 76 − 20 × altura/cintura; homens 64 − 20 × altura/cintura. */
export function rfm(sexo: Sexo, hCm: number | null, waistCm: number | null): number | null {
  if (!hCm || !waistCm) return null;
  const v = (sexo === "feminino" ? 76 : 64) - 20 * (hCm / waistCm);
  return Math.min(70, Math.max(3, v));
}

/**
 * Recorte do período: medições a partir de (hoje − N dias). Se houver uma medição anterior ao início,
 * ela entra como ponto de partida, para a variação ser "desde 3 meses atrás" mesmo com registros espaçados.
 */
export function periodSlice(history: MeasurementSheet[], period: PeriodKey, today: string): MeasurementSheet[] {
  const sorted = [...history].filter((h) => h.data).sort((a, b) => a.data.localeCompare(b.data));
  if (period === "all") return sorted;
  const start = addDays(today, -Number(period));
  const inside = sorted.filter((h) => h.data >= start);
  const before = sorted.filter((h) => h.data < start).at(-1);
  return before ? [before, ...inside] : inside;
}

export type Snapshot = {
  date: string; weight: number | null; heightCm: number | null; waist: number | null; hip: number | null;
  fatPct: number | null; fatKg: number | null; leanKg: number | null; bmi: number | null;
  whtr: number | null; whr: number | null; values: Record<string, number | null>;
};

export function snapshot(sheet: MeasurementSheet, sexo: Sexo, fallbackHeight: number | null = null): Snapshot {
  const weight = toNumber(sheet.peso);
  const h = heightCm(sheet.altura) ?? fallbackHeight;
  const values = Object.fromEntries(Object.keys(measurementLabels).map((k) => [k, toNumber(sheet.valores[k])]));
  const waist = values["cintura"] ?? null, hip = values["quadril"] ?? null;
  const fatPct = rfm(sexo, h, waist);
  const fatKg = fatPct !== null && weight ? (weight * fatPct) / 100 : null;
  return {
    date: sheet.data, weight, heightCm: h, waist, hip, fatPct, fatKg,
    leanKg: fatKg !== null && weight ? weight - fatKg : null,
    bmi: bmi(weight, h), whtr: waist && h ? waist / h : null, whr: waist && hip ? waist / hip : null, values,
  };
}

export type Status = "ideal" | "atencao" | "alerta";
export type Indicator = {
  key: "imc" | "rca" | "rcq" | "gordura"; label: string; hint: string; value: number; display: string;
  score: number; status: Status; statusLabel: string; scale: [number, number]; ideal: [number, number];
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const statusOf = (score: number): Status => (score >= 85 ? "ideal" : score >= 55 ? "atencao" : "alerta");
const STATUS_LABEL: Record<Status, string> = { ideal: "Saudável", atencao: "Atenção", alerta: "Alerta" };

export function bmiClass(v: number) {
  if (v < 18.5) return "Abaixo do peso";
  if (v < 25) return "Peso adequado";
  if (v < 30) return "Sobrepeso";
  return "Obesidade";
}

/** Indicadores de saúde com faixa ideal e nota de 0 a 100 (100 = dentro da faixa). */
export function indicators(s: Snapshot, sexo: Sexo): Indicator[] {
  const out: Indicator[] = [];
  const mk = (i: Omit<Indicator, "status" | "statusLabel">, label?: string) => {
    const status = statusOf(i.score);
    out.push({ ...i, score: Math.round(i.score), status, statusLabel: label ?? STATUS_LABEL[status] });
  };
  if (s.bmi !== null) {
    const v = s.bmi, dist = v < 18.5 ? 18.5 - v : v > 24.9 ? v - 24.9 : 0;
    mk({ key: "imc", label: "IMC", hint: "Peso ÷ altura². Faixa adequada: 18,5 a 24,9.", value: v, display: v.toFixed(1).replace(".", ","), score: clamp(100 - dist * 12), scale: [15, 40], ideal: [18.5, 24.9] }, bmiClass(v));
  }
  if (s.whtr !== null) {
    const v = s.whtr;
    mk({ key: "rca", label: "Cintura ÷ altura", hint: "Ideal: cintura menor que metade da altura (abaixo de 0,50).", value: v, display: v.toFixed(2).replace(".", ","), score: clamp(v <= 0.5 ? 100 : 100 - (v - 0.5) * 400), scale: [0.35, 0.75], ideal: [0.4, 0.5] });
  }
  if (s.whr !== null) {
    const v = s.whr, lim = sexo === "feminino" ? 0.85 : 0.9;
    mk({ key: "rcq", label: "Cintura ÷ quadril", hint: `Risco menor abaixo de ${lim.toFixed(2).replace(".", ",")}.`, value: v, display: v.toFixed(2).replace(".", ","), score: clamp(v <= lim ? 100 : 100 - (v - lim) * 500), scale: [0.6, 1.1], ideal: [0.65, lim] });
  }
  if (s.fatPct !== null) {
    const v = s.fatPct, [lo, hi] = sexo === "feminino" ? [21, 32] : [8, 24];
    const dist = v < lo ? lo - v : v > hi ? v - hi : 0;
    mk({ key: "gordura", label: "Gordura estimada", hint: `Faixa saudável aproximada: ${lo}% a ${hi}%.`, value: v, display: `${v.toFixed(1).replace(".", ",")}%`, score: clamp(100 - dist * 5), scale: [5, 50], ideal: [lo, hi] });
  }
  return out;
}

/** Inclinação (por dia) da reta que melhor passa pelos pontos. */
export function slopePerDay(points: { date: string; value: number | null }[]): number | null {
  const pts = points.filter((p): p is { date: string; value: number } => p.value !== null);
  if (pts.length < 2) return null;
  const base = pts[0]!.date;
  const xs = pts.map((p) => daysBetween(base, p.date)), ys = pts.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (den === 0) return null;
  return xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0) / den;
}

export type Insight = { tone: "good" | "warn" | "info"; text: string };
export type MeasureDelta = { key: string; label: string; first: number | null; last: number | null; delta: number | null };

export type Analysis = {
  entries: Snapshot[]; first: Snapshot; last: Snapshot; days: number;
  delta: { weight: number | null; weightPct: number | null; waist: number | null; lean: number | null; fatPct: number | null };
  measures: MeasureDelta[]; paceKgWeek: number | null; projection30: number | null;
  indicators: Indicator[]; score: number | null; insights: Insight[]; sinceLast: number;
};

const diff = (a: number | null, b: number | null) => (a !== null && b !== null ? b - a : null);
const fmt = (n: number, d = 1) => Math.abs(n).toFixed(d).replace(".", ",");

export function analyze(history: MeasurementSheet[], sexo: Sexo, today: string): Analysis | null {
  if (!history.length) return null;
  // Altura costuma ser preenchida só uma vez: usa a última informada para as medições sem altura.
  const knownHeight = [...history].reverse().map((h) => heightCm(h.altura)).find((v) => v !== null) ?? null;
  const entries = history.map((h) => snapshot(h, sexo, knownHeight));
  const first = entries[0]!, last = entries.at(-1)!;
  const dW = diff(first.weight, last.weight);
  const measures = Object.entries(measurementLabels).map(([key, label]) => {
    const a = first.values[key] ?? null, b = last.values[key] ?? null;
    return { key, label, first: a, last: b, delta: diff(a, b) };
  });
  const slope = slopePerDay(entries.map((e) => ({ date: e.date, value: e.weight })));
  const inds = indicators(last, sexo);
  const score = inds.length ? Math.round(inds.reduce((s, i) => s + i.score, 0) / inds.length) : null;
  const a: Analysis = {
    entries, first, last, days: daysBetween(first.date, last.date),
    delta: { weight: dW, weightPct: dW !== null && first.weight ? (dW / first.weight) * 100 : null, waist: diff(first.waist, last.waist), lean: diff(first.leanKg, last.leanKg), fatPct: diff(first.fatPct, last.fatPct) },
    measures, paceKgWeek: slope !== null ? slope * 7 : null,
    projection30: slope !== null && last.weight !== null ? round(last.weight + slope * 30) : null,
    indicators: inds, score, insights: [], sinceLast: Math.max(0, daysBetween(last.date, today)),
  };
  a.insights = buildInsights(a);
  return a;
}

export function buildInsights(a: Analysis): Insight[] {
  const out: Insight[] = [];
  const multi = a.entries.length > 1;
  const { weight, weightPct, waist, lean, fatPct } = a.delta;
  if (multi && weight !== null) {
    if (Math.abs(weight) < 0.3) out.push({ tone: "info", text: `Seu peso ficou estável no período (${weight >= 0 ? "+" : "−"}${fmt(weight)} kg).` });
    else out.push({ tone: weight < 0 ? "good" : "warn", text: `Você ${weight < 0 ? "perdeu" : "ganhou"} ${fmt(weight)} kg (${fmt(weightPct ?? 0)}%) em ${a.days} dias.` });
  }
  if (multi && waist !== null && Math.abs(waist) >= 0.5) out.push({ tone: waist < 0 ? "good" : "warn", text: `${waist < 0 ? "Houve redução" : "Houve aumento"} de ${fmt(waist)} cm na cintura.` });
  if (multi && lean !== null && Math.abs(lean) >= 0.3) out.push({ tone: lean > 0 ? "good" : "info", text: `Sua massa magra estimada ${lean > 0 ? "aumentou" : "diminuiu"} ${fmt(lean)} kg.` });
  if (multi && fatPct !== null && Math.abs(fatPct) >= 0.3) out.push({ tone: fatPct < 0 ? "good" : "warn", text: `O percentual de gordura estimado ${fatPct < 0 ? "caiu" : "subiu"} ${fmt(fatPct)} pontos percentuais.` });
  if (a.paceKgWeek !== null && multi) {
    const p = a.paceKgWeek;
    if (p < -1) out.push({ tone: "warn", text: `Ritmo de −${fmt(p, 2)} kg por semana: acima do recomendado (até 1 kg). Vale conversar com quem te acompanha.` });
    else if (p <= -0.2) out.push({ tone: "good", text: `Ritmo médio de −${fmt(p, 2)} kg por semana — dentro da faixa saudável.` });
    if (a.projection30 !== null && Math.abs(p) >= 0.05) out.push({ tone: "info", text: `Mantendo esse ritmo, em 30 dias você deve estar perto de ${fmt(a.projection30)} kg.` });
  }
  const rca = a.indicators.find((i) => i.key === "rca");
  if (rca) out.push(rca.value <= 0.5
    ? { tone: "good", text: "Sua cintura está abaixo da metade da altura — ótimo sinal para o coração." }
    : { tone: "warn", text: `Sua cintura está em ${Math.round(rca.value * 100)}% da altura; o ideal é abaixo de 50%.` });
  if (a.sinceLast > 14) out.push({ tone: "info", text: `Sua última medição foi há ${a.sinceLast} dias. Registre uma nova para manter a análise em dia.` });
  if (!multi) out.push({ tone: "info", text: "Com a próxima medição eu passo a mostrar a sua evolução e o seu ritmo." });
  return out;
}

/** Histórico de exemplo (só para a demonstração quando ainda não há medições). */
export function demoHistory(today: string): MeasurementSheet[] {
  const rows: [number, number, Record<string, number>][] = [
    [90, 84.8, { peito: 107, braco: 35, cintura: 102, abdomen: 104, quadril: 119, gluteo: 112, coxa: 72 }],
    [75, 84.1, { peito: 106.6, braco: 34.9, cintura: 101, abdomen: 103, quadril: 118.6, gluteo: 111.8, coxa: 71.7 }],
    [60, 83.3, { peito: 106, braco: 34.8, cintura: 99.5, abdomen: 101.4, quadril: 118, gluteo: 111.2, coxa: 71.2 }],
    [45, 82.6, { peito: 105.8, braco: 34.6, cintura: 98.5, abdomen: 100.2, quadril: 117.5, gluteo: 110.9, coxa: 70.9 }],
    [30, 81.7, { peito: 105.4, braco: 34.3, cintura: 97, abdomen: 99, quadril: 117, gluteo: 110.5, coxa: 70.5 }],
    [15, 80.9, { peito: 105.1, braco: 34.1, cintura: 96, abdomen: 98, quadril: 116.4, gluteo: 110.2, coxa: 70.2 }],
    [0, 80.0, { peito: 105, braco: 34, cintura: 95, abdomen: 97, quadril: 116, gluteo: 110, coxa: 70 }],
  ];
  return rows.map(([ago, peso, v]) => ({
    nome: "Exemplo", data: addDays(today, -ago), altura: "1,68", peso: String(peso).replace(".", ","),
    valores: Object.fromEntries(Object.entries(v).map(([k, n]) => [k, String(n).replace(".", ",")])), obs: "", fotos: {},
  }));
}
