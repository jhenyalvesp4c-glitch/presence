/** Mapa do corpo: pontos de medida, valor atual, variação desde o início e a direção "boa" de cada um (para a cor). */
import type { MeasurementSheet } from "./health-preview";

export type SpotKey = "peito" | "braco_d" | "braco_e" | "cintura" | "abdomen" | "quadril" | "gluteo" | "coxa_d" | "coxa_e" | "panturrilha_d" | "panturrilha_e";
export type Spot = { key: SpotKey; label: string; short: string; /** posição na imagem do corpo (768 × 1024) */ x: number; y: number; side: "l" | "r"; labelY: number; /** +1: subir é bom · −1: descer é bom · 0: neutro */ good: -1 | 0 | 1 };

export const SPOTS: Spot[] = [
  { key: "peito", label: "Peito", short: "Peito", x: 384, y: 262, side: "r", labelY: 238, good: 0 },
  { key: "braco_d", label: "Braço direito", short: "Braço D", x: 283, y: 318, side: "l", labelY: 300, good: 1 },
  { key: "braco_e", label: "Braço esquerdo", short: "Braço E", x: 485, y: 318, side: "r", labelY: 318, good: 1 },
  { key: "cintura", label: "Cintura", short: "Cintura", x: 384, y: 352, side: "r", labelY: 398, good: -1 },
  { key: "abdomen", label: "Abdômen", short: "Abdômen", x: 384, y: 404, side: "l", labelY: 410, good: -1 },
  { key: "quadril", label: "Quadril", short: "Quadril", x: 384, y: 462, side: "r", labelY: 500, good: 0 },
  { key: "gluteo", label: "Glúteos", short: "Glúteos", x: 318, y: 496, side: "l", labelY: 526, good: 1 },
  { key: "coxa_d", label: "Coxa direita", short: "Coxa D", x: 338, y: 600, side: "l", labelY: 636, good: 1 },
  { key: "coxa_e", label: "Coxa esquerda", short: "Coxa E", x: 432, y: 600, side: "r", labelY: 636, good: 1 },
  { key: "panturrilha_d", label: "Panturrilha direita", short: "Pant. D", x: 340, y: 790, side: "l", labelY: 800, good: 1 },
  { key: "panturrilha_e", label: "Panturrilha esquerda", short: "Pant. E", x: 428, y: 790, side: "r", labelY: 800, good: 1 },
];
const LEGACY: Partial<Record<SpotKey, string>> = { braco_d: "braco", braco_e: "braco", coxa_d: "coxa", coxa_e: "coxa" };

const num = (v: string | undefined): number | null => { if (!v || !v.trim()) return null; const n = Number(v.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };
const raw = (h: MeasurementSheet, k: SpotKey): number | null => num(h.valores[k]) ?? (LEGACY[k] ? num(h.valores[LEGACY[k]!]) : null);

export type SpotData = { key: SpotKey; current: number | null; first: number | null; delta: number | null; series: { date: string; value: number }[]; tone: "good" | "bad" | "neutral" | "none" };
/** Para cada ponto: última medida, primeira, variação e a série ao longo do tempo (uma medida isolada não tem variação). */
export function bodyData(history: MeasurementSheet[], live: Record<string, string> = {}): Record<SpotKey, SpotData> {
  const out = {} as Record<SpotKey, SpotData>;
  for (const s of SPOTS) {
    const series = history.flatMap((h) => { const v = raw(h, s.key); return v === null ? [] : [{ date: h.data, value: v }]; });
    const liveV = num(live[s.key]), cur = liveV ?? series.at(-1)?.value ?? null, first = series[0]?.value ?? null;
    const hasHist = series.length > 0, delta = cur !== null && first !== null && (series.length > 1 || liveV !== null) ? Math.round((cur - first) * 10) / 10 : null;
    const tone = delta === null || delta === 0 ? (cur === null ? "none" : "neutral") : s.good === 0 ? "neutral" : delta * s.good > 0 ? "good" : "bad";
    out[s.key] = { key: s.key, current: cur, first: hasHist || liveV !== null ? first ?? liveV : null, delta, series: liveV !== null && series.at(-1)?.value !== liveV ? [...series, { date: "agora", value: liveV }] : series, tone };
  }
  return out;
}
export const fmtCm = (n: number | null) => (n === null ? "—" : String(Math.round(n * 10) / 10).replace(".", ","));
export const fmtDelta = (d: number | null) => (d === null || d === 0 ? "" : `${d > 0 ? "+" : "−"}${String(Math.abs(d)).replace(".", ",")}`);
/** Soma da variação das medidas que têm histórico (resumo geral). */
export function totalChange(data: Record<SpotKey, SpotData>) { const ds = Object.values(data).map((d) => d.delta).filter((d): d is number => d !== null); return { n: ds.length, cm: Math.round(ds.reduce((a, b) => a + b, 0) * 10) / 10 }; }
