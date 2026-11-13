/** Toque de "sistema iniciando" (estilo painel futurista), gerado na hora: sem arquivo de áudio. Toca até `stop()`. */
export const bootEnabled = (): boolean => { try { return localStorage.getItem("presence.voz.abertura") !== "0"; } catch { return true; } };
export const setBootEnabled = (v: boolean) => { try { localStorage.setItem("presence.voz.abertura", v ? "1" : "0"); } catch { /* sem armazenamento */ } };

const NOTES = [392, 523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 783.99]; // sol, dó, mi, sol, mi, dó, ré, sol

export function startBootSound(): () => void {
  if (typeof window === "undefined" || !bootEnabled()) return () => {};
  let ctx: AudioContext;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return () => {};
    ctx = new AC();
  } catch { return () => {}; }
  void ctx.resume().catch(() => {});

  const t0 = ctx.currentTime + 0.03;
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  master.gain.setValueAtTime(0, t0); master.gain.linearRampToValueAtTime(0.5, t0 + 0.25);
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200; lp.connect(master);

  // 1) "ligando": varredura que sobe, com brilho no fim
  const sweep = ctx.createOscillator(); sweep.type = "sawtooth";
  sweep.frequency.setValueAtTime(70, t0); sweep.frequency.exponentialRampToValueAtTime(880, t0 + 1.1);
  const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t0); sg.gain.linearRampToValueAtTime(0.11, t0 + 0.9); sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
  const sf = ctx.createBiquadFilter(); sf.type = "lowpass"; sf.frequency.setValueAtTime(300, t0); sf.frequency.exponentialRampToValueAtTime(5000, t0 + 1.1);
  sweep.connect(sf); sf.connect(sg); sg.connect(master); sweep.start(t0); sweep.stop(t0 + 1.5);

  // 2) base grave suave que sustenta
  const pad = ctx.createOscillator(); pad.type = "sine"; pad.frequency.value = 98;
  const pad2 = ctx.createOscillator(); pad2.type = "sine"; pad2.frequency.value = 147;
  const pg = ctx.createGain(); pg.gain.setValueAtTime(0, t0 + 0.4); pg.gain.linearRampToValueAtTime(0.07, t0 + 1.6);
  pad.connect(pg); pad2.connect(pg); pg.connect(master); pad.start(t0); pad2.start(t0);

  // 3) notinhas cintilantes que se repetem enquanto carrega
  const STEP = 0.2;
  let next = t0 + 0.9, i = 0, stopped = false;
  const note = (f: number, at: number) => {
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.09, at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.38);
    o.connect(g); g.connect(lp); o.start(at); o.stop(at + 0.4);
  };
  const timer = setInterval(() => {
    if (stopped) return;
    while (next < ctx.currentTime + 0.6) { note(NOTES[i % NOTES.length]!, next); if (i % 4 === 0) note((NOTES[i % NOTES.length]!) * 2, next + 0.02); next += STEP; i++; }
  }, 120);

  const stop = () => {
    if (stopped) return; stopped = true; clearInterval(timer);
    try {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + 0.35);
    } catch { /* já parado */ }
    setTimeout(() => { try { void ctx.close(); } catch { /* já fechado */ } }, 500);
  };
  setTimeout(stop, 20_000); // nunca fica tocando para sempre
  return stop;
}
