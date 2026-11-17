import { describe, expect, it } from "vitest";
import { createSegmenter } from "@/lib/voice/wake-listen";

const SR = 48000, BLOCK = 2048;
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5; };
/** Gera `s` segundos de sinal; `f(t)` devolve a amplitude no instante t (segundos). */
const sig = (s: number, f: (t: number) => number, t0 = 0) => Float32Array.from({ length: Math.round(s * SR) }, (_, i) => f(t0 + i / SR) * (0.6 + 0.8 * Math.abs(rnd() * 2)) * Math.sign(rnd() || 1));
const run = (parts: Float32Array[]) => {
  const seg = createSegmenter(SR), out: Float32Array[] = [];
  const all = new Float32Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
  for (let i = 0; i + BLOCK <= all.length; i += BLOCK) { const r = seg.push(all.subarray(i, i + BLOCK)); if (r.pcm) out.push(r.pcm); }
  return out;
};
const room = (s: number) => sig(s, () => 0.004);                      // sala quieta
const word = () => sig(0.9, (t) => (t % 0.3 < 0.2 ? 0.25 : 0.02));   // "O-ri-on": três sílabas com pausas curtas

describe("escuta da palavra de ativação: quando mandar um trecho para transcrever", () => {
  it("silêncio nunca gera trecho", () => { expect(run([room(30)])).toHaveLength(0); });
  it("uma batida rápida (palma, porta, tecla) não gera trecho", () => {
    const clap = sig(0.15, (t) => 0.9 * Math.exp(-t * 30));
    expect(run([room(3), clap, room(3), clap, room(3)])).toHaveLength(0);
  });
  it("uma palavra falada gera um trecho curto com o som antes e depois", () => {
    const out = run([room(3), word(), room(2)]);
    expect(out).toHaveLength(1);
    const s = out[0]!.length / 16000; expect(s).toBeGreaterThan(1.2); expect(s).toBeLessThan(3.5);
  });
  it("som que não para (ventilador, TV, música) não manda trechos sem parar e o nível de ruído sobe", () => {
    const hum = sig(40, () => 0.12);
    const out = run([room(2), hum]);
    expect(out.length).toBeLessThanOrEqual(1); // no máximo o começo, nunca um por poucos segundos
  });
  it("depois de um ruído constante, uma fala mais forte ainda é percebida", () => {
    const hum = sig(15, () => 0.06), talk = sig(0.9, (t) => (t % 0.3 < 0.2 ? 0.6 : 0.05)), hum2 = sig(3, () => 0.06);
    expect(run([room(2), hum, talk, hum2]).length).toBeGreaterThanOrEqual(1);
  });
  it("fala longa sem pausa (conversa, TV) é descartada: chamar é uma palavra curta", () => {
    const talk = sig(9, (t) => (t % 0.3 < 0.28 ? 0.25 : 0.1));
    expect(run([room(2), talk, room(2)])).toHaveLength(0);
  });
});
