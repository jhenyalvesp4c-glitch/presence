/**
 * Escuta da palavra "Presence" SEM depender do reconhecimento de voz do navegador (que não existe ou não funciona em vários apps instalados).
 * Fica com o microfone aberto, percebe quando alguém fala, pega só esse trecho curto e manda transcrever (OpenAI); quem decide se
 * a palavra apareceu é quem chama (`onText`). Silêncio não gera envio. Há limite de envios por minuto.
 */
import { transcribeAudio } from "@/lib/audio.functions";

const TARGET_SR = 16000;
const MAX_SEG_S = 8, MIN_LOUD_S = 0.25, PREROLL_S = 0.45, END_QUIET_S = 0.7, MAX_PER_MIN = 20;
const GHOST = /^(obrigad[oa]\.?|legendas? .*|tchau\.?|\.+|\s*)$|amara\.org|inscreva-se/i;

export function pcmToWavBase64(pcm: Float32Array, sr = TARGET_SR): string {
  const v = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i]!)) * 32767, true);
  const u = new Uint8Array(v.buffer); let bin = "";
  for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(bin);
}

export type WakeListen = { onText: (text: string) => void; onStatus: (s: string) => void; onFail: (msg: string) => void };

export function startRecordedWake(o: WakeListen): () => void {
  let stopped = false, stream: MediaStream | null = null, ctx: AudioContext | null = null, node: ScriptProcessorNode | null = null;
  const sent: number[] = [];
  let busy = false;

  const send = async (pcm: Float32Array) => {
    const now = Date.now();
    while (sent.length && now - sent[0]! > 60_000) sent.shift();
    if (busy || sent.length >= MAX_PER_MIN) return;
    busy = true; sent.push(now);
    try {
      o.onStatus("Entendendo…");
      const r = await transcribeAudio({ data: { data: pcmToWavBase64(pcm), mime: "audio/wav" } });
      if (stopped) return;
      if (!r.ok) {
        if (/OPENAI_API_KEY|cr[eé]ditos|inv[aá]lida/i.test(r.error)) { o.onFail(r.error); return; }
        o.onStatus("Ouvindo…"); return;
      }
      const text = r.text.trim();
      o.onStatus("Ouvindo…");
      if (text && !GHOST.test(text)) o.onText(text);
    } catch { o.onStatus("Ouvindo…"); } finally { busy = false; }
  };

  void (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      const n = (e as DOMException).name;
      o.onFail(n === "NotAllowedError" ? "O microfone está bloqueado para este site. Libere o microfone e ligue de novo." : n === "NotFoundError" ? "Não encontrei nenhum microfone." : "Não consegui abrir o microfone.");
      return;
    }
    if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) { o.onFail("Este navegador não consegue processar o microfone."); return; }
    ctx = new AC(); void ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(stream);
    node = ctx.createScriptProcessor(2048, 1, 1);
    const mute = ctx.createGain(); mute.gain.value = 0;
    src.connect(node); node.connect(mute); mute.connect(ctx.destination);
    const ratio = ctx.sampleRate / TARGET_SR;
    const preMax = Math.round(PREROLL_S * TARGET_SR);

    let noise = 0.008, loudRun = 0, quiet = 0, speaking = false, loudSamples = 0;
    let pre: number[] = [], seg: number[] = [];
    o.onStatus("Ouvindo…");

    node.onaudioprocess = (ev) => {
      if (stopped) return;
      const inp = ev.inputBuffer.getChannelData(0);
      let sum = 0; for (let i = 0; i < inp.length; i++) sum += inp[i]! * inp[i]!;
      const rms = Math.sqrt(sum / inp.length);
      // reduz para 16 kHz (média por janela)
      const out: number[] = [];
      for (let p = 0; p < inp.length; p += ratio) { let a = 0, c = 0; for (let k = Math.floor(p); k < Math.min(inp.length, Math.floor(p + ratio)); k++) { a += inp[k]!; c++; } out.push(c ? a / c : 0); }
      const thr = Math.max(0.02, noise * 3);
      const loud = rms > thr;
      if (!speaking) {
        pre.push(...out); if (pre.length > preMax) pre = pre.slice(pre.length - preMax);
        if (!loud) noise = noise * 0.97 + rms * 0.03;
        loudRun = loud ? loudRun + 1 : 0;
        if (loudRun >= 3) { speaking = true; seg = [...pre]; loudSamples = 0; quiet = 0; o.onStatus("Ouvindo você…"); }
        return;
      }
      seg.push(...out);
      if (loud) { quiet = 0; loudSamples += out.length; } else quiet += out.length;
      const segS = seg.length / TARGET_SR;
      if (quiet / TARGET_SR >= END_QUIET_S || segS >= MAX_SEG_S) {
        const enough = loudSamples / TARGET_SR >= MIN_LOUD_S;
        const pcm = Float32Array.from(seg);
        speaking = false; loudRun = 0; pre = []; seg = []; loudSamples = 0; quiet = 0;
        if (enough) void send(pcm); else o.onStatus("Ouvindo…");
      }
    };
  })();

  return () => {
    stopped = true;
    try { if (node) { node.onaudioprocess = null; node.disconnect(); } } catch { /* já solto */ }
    try { void ctx?.close(); } catch { /* já fechado */ }
    stream?.getTracks().forEach((t) => t.stop());
  };
}
