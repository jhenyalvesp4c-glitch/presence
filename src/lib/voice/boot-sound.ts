/**
 * Toque de "sistema iniciando" (estilo painel de IA futurista), gerado na hora: sem arquivo de áudio e sem melodia.
 * Camadas: zumbido grave que cresce, varredura de energia (ruído filtrado), batida grave discreta e pulsos digitais com eco.
 * Toca até `stop()` (com fade); nunca passa de BOOT_SECONDS.
 */
export const bootEnabled = (): boolean => { try { return localStorage.getItem("presence.voz.abertura") !== "0"; } catch { return true; } };
export const setBootEnabled = (v: boolean) => { try { localStorage.setItem("presence.voz.abertura", v ? "1" : "0"); } catch { /* sem armazenamento */ } };

export const BOOT_SECONDS = 20;
/** Frequências "de máquina" (propositalmente fora de escala musical) e a cadência irregular dos pulsos. */
const BLIPS = [1480, 2093, 2960, 1245, 3520, 1865];
const GAPS = [0.42, 0.31, 0.58, 0.37, 0.71, 0.33, 0.49];

/** Monta o som inteiro (agendado de antemão) em `ctx`, ligado a `out`. Serve para tocar de verdade e para testar offline. */
export function scheduleBoot(ctx: BaseAudioContext, out: AudioNode, t0: number, seconds = BOOT_SECONDS): void {
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(out);

  // eco curto e escuro, que dá o ar de "ambiente de controle"
  const echoIn = ctx.createGain();
  const delay = ctx.createDelay(1); delay.delayTime.value = 0.23;
  const fb = ctx.createGain(); fb.gain.value = 0.38;
  const dl = ctx.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 2600;
  echoIn.connect(delay); delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(master);

  // 1) zumbido grave: sobe de ~45 Hz para ~70 Hz e fica, com leve tremolo lento
  const hum = ctx.createGain(); hum.gain.setValueAtTime(0, t0); hum.gain.linearRampToValueAtTime(0.2, t0 + 2.2);
  for (const [f, g] of [[1, 1], [2, 0.5], [3, 0.22]] as const) {
    const o = ctx.createOscillator(); o.type = f === 1 ? "sawtooth" : "sine";
    o.frequency.setValueAtTime(45 * f, t0); o.frequency.exponentialRampToValueAtTime(70 * f, t0 + 2.4);
    const og = ctx.createGain(); og.gain.value = g * (f === 1 ? 0.5 : 1);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 420;
    o.connect(lp); lp.connect(og); og.connect(hum); o.start(t0); o.stop(t0 + seconds);
  }
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35;
  const lfoG = ctx.createGain(); lfoG.gain.value = 0.035; lfo.connect(lfoG); lfoG.connect(hum.gain); lfo.start(t0); lfo.stop(t0 + seconds);
  hum.connect(master);

  // 2) varredura de energia: ruído que sobe de grave para agudo, termina num "estalo" limpo
  const n = Math.floor(ctx.sampleRate * 2.4), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
  let seed = 7; for (let i = 0; i < n; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 4294967296) * 2 - 1; }
  const noise = ctx.createBufferSource(); noise.buffer = buf;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 2.2;
  bp.frequency.setValueAtTime(180, t0); bp.frequency.exponentialRampToValueAtTime(7000, t0 + 1.7);
  const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t0); ng.gain.exponentialRampToValueAtTime(0.32, t0 + 1.5); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.1);
  noise.connect(bp); bp.connect(ng); ng.connect(master); ng.connect(echoIn); noise.start(t0); noise.stop(t0 + 2.4);

  // 3) "travou": um golpe grave limpo + um ping metálico único com eco (sem melodia)
  const hit = ctx.createOscillator(); hit.type = "sine"; hit.frequency.setValueAtTime(110, t0 + 1.7); hit.frequency.exponentialRampToValueAtTime(38, t0 + 2.2);
  const hg = ctx.createGain(); hg.gain.setValueAtTime(0.0001, t0 + 1.7); hg.gain.exponentialRampToValueAtTime(0.7, t0 + 1.72); hg.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
  hit.connect(hg); hg.connect(master); hit.start(t0 + 1.7); hit.stop(t0 + 2.5);
  blip(ctx, master, echoIn, 2093, t0 + 1.74, 0.14, 0.9);

  // 4) batida grave discreta (como um núcleo em funcionamento), a cada 1,2 s
  for (let t = t0 + 2.6; t < t0 + seconds; t += 1.2) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(74, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.22);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
  }

  // 5) pulsos digitais discretos, em cadência irregular, com eco
  let t = t0 + 2.3, i = 0;
  while (t < t0 + seconds) { blip(ctx, master, echoIn, BLIPS[i % BLIPS.length]!, t, 0.05, 0.32); t += GAPS[i % GAPS.length]!; i++; }
}

/** Um pulso curto "de máquina": seno modulado em frequência, rápido e seco. */
function blip(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, f: number, at: number, len: number, vol: number) {
  const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
  const m = ctx.createOscillator(); m.type = "sine"; m.frequency.value = f * 1.5;
  const mg = ctx.createGain(); mg.gain.value = f * 0.35; m.connect(mg); mg.connect(o.frequency);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.06 * vol, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.05);
  o.connect(g); g.connect(dry); g.connect(wet);
  o.start(at); m.start(at); o.stop(at + len + 0.1); m.stop(at + len + 0.1);
}

export function startBootSound(): () => void {
  if (typeof window === "undefined" || !bootEnabled()) return () => {};
  let ctx: AudioContext;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return () => {};
    ctx = new AC();
  } catch { return () => {}; }
  void ctx.resume().catch(() => {});

  const fade = ctx.createGain(); fade.gain.value = 1; fade.connect(ctx.destination);
  let stopped = false;
  try { scheduleBoot(ctx, fade, ctx.currentTime + 0.03); } catch { return () => { try { void ctx.close(); } catch { /* já fechado */ } }; }

  const stop = () => {
    if (stopped) return; stopped = true;
    try {
      const t = ctx.currentTime;
      fade.gain.cancelScheduledValues(t); fade.gain.setValueAtTime(fade.gain.value, t); fade.gain.linearRampToValueAtTime(0, t + 0.4);
    } catch { /* já parado */ }
    setTimeout(() => { try { void ctx.close(); } catch { /* já fechado */ } }, 600);
  };
  setTimeout(stop, BOOT_SECONDS * 1000);
  return stop;
}

/** Toque curto e discreto de "estou ouvindo", quando o Presence é chamado pela palavra de ativação. */
export function playWakeChime(): void {
  if (typeof window === "undefined" || !bootEnabled()) return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC(); void ctx.resume().catch(() => {});
    const t = ctx.currentTime + 0.02, out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
    for (const [f, at, v] of [[784, 0, 0.12], [1175, 0.09, 0.09]] as const) {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
      const m = ctx.createOscillator(); m.type = "sine"; m.frequency.value = f * 2; const mg = ctx.createGain(); mg.gain.value = f * 0.5; m.connect(mg); mg.connect(o.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(v, t + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.5);
      o.connect(g); g.connect(out); o.start(t + at); m.start(t + at); o.stop(t + at + 0.55); m.stop(t + at + 0.55);
    }
    setTimeout(() => { try { void ctx.close(); } catch { /* já fechado */ } }, 900);
  } catch { /* sem áudio */ }
}
