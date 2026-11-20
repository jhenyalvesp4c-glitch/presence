/** Mapa do corpo: pontos de medida, valor atual, variação desde o início e a direção "boa" de cada um (para a cor). */
import type { MeasurementSheet } from "./health-preview";

export type SpotKey = "peito" | "braco_d" | "braco_e" | "cintura" | "abdomen" | "quadril" | "gluteo" | "coxa_d" | "coxa_e" | "panturrilha_d" | "panturrilha_e";
export type Spot = { key: SpotKey; label: string; short: string; /** posição no desenho (viewBox 400 × 480) */ x: number; y: number; side: "l" | "r"; labelY: number; /** +1: subir é bom · −1: descer é bom · 0: neutro */ good: -1 | 0 | 1 };

export const SPOTS: Spot[] = [
  { key: "peito", label: "Peito", short: "Peito", x: 200, y: 108, side: "r", labelY: 96, good: 0 },
  { key: "braco_d", label: "Braço direito", short: "Braço D", x: 143, y: 142, side: "l", labelY: 140, good: 1 },
  { key: "braco_e", label: "Braço esquerdo", short: "Braço E", x: 257, y: 142, side: "r", labelY: 140, good: 1 },
  { key: "cintura", label: "Cintura", short: "Cintura", x: 200, y: 166, side: "r", labelY: 184, good: -1 },
  { key: "abdomen", label: "Abdômen", short: "Abdômen", x: 200, y: 188, side: "l", labelY: 192, good: -1 },
  { key: "quadril", label: "Quadril", short: "Quadril", x: 200, y: 212, side: "r", labelY: 228, good: 0 },
  { key: "gluteo", label: "Glúteos", short: "Glúteos", x: 176, y: 232, side: "l", labelY: 240, good: 1 },
  { key: "coxa_d", label: "Coxa direita", short: "Coxa D", x: 182, y: 300, side: "l", labelY: 304, good: 1 },
  { key: "coxa_e", label: "Coxa esquerda", short: "Coxa E", x: 218, y: 300, side: "r", labelY: 304, good: 1 },
  { key: "panturrilha_d", label: "Panturrilha direita", short: "Pant. D", x: 184, y: 402, side: "l", labelY: 404, good: 1 },
  { key: "panturrilha_e", label: "Panturrilha esquerda", short: "Pant. E", x: 216, y: 402, side: "r", labelY: 404, good: 1 },
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
