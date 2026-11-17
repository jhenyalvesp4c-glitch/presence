/** Medidor da velocidade da conversa: quanto cada etapa demorou nas últimas respostas (fica só neste navegador). */
export type PerfSample = { em: number; transcricao: number; primeiroTexto: number; comecouFalar: number; total: number; ferramentas: boolean };
const KEY = "presence.voz.perf", EVT = "presence:perf", MAX = 8;

export const perfSamples = (): PerfSample[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") as PerfSample[]; } catch { return []; } };
export function recordPerf(s: PerfSample): void {
  try { localStorage.setItem(KEY, JSON.stringify([s, ...perfSamples()].slice(0, MAX))); window.dispatchEvent(new Event(EVT)); } catch { /* sem armazenamento */ }
}
export const onPerf = (f: () => void) => { window.addEventListener(EVT, f); return () => window.removeEventListener(EVT, f); };

/** Tempo entre o fim da fala e a transcrição pronta (modo gravação); o navegador não informa no outro modo. */
let lastStt = 0;
export const markStt = (ms: number) => { lastStt = Math.max(0, Math.round(ms)); };
export const takeStt = () => { const v = lastStt; lastStt = 0; return v; };

export const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
