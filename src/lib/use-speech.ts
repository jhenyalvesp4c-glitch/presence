import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { transcribeAudio } from "./audio.functions";
import { silenceForSpeech } from "./voice/endpoint";

// Web Speech API (Chrome, Edge, Safari). Não existe nos tipos do TS, então tipamos o mínimo.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => Recognition) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
const canRecord = () => typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
const STT_KEY = "presence.stt"; // "gravado" = o navegador não consegue reconhecer voz: usa a gravação + transcrição (igual à conversa com o Orion)
const getStt = () => { try { return localStorage.getItem(STT_KEY) === "gravado"; } catch { return false; } };
const setStt = () => { try { localStorage.setItem(STT_KEY, "gravado"); } catch { /* sem armazenamento */ } };

const dictation = (on: boolean) => { try { window.dispatchEvent(new CustomEvent("orion:ditado", { detail: on })); } catch { /* sem window */ } };
const WHY: Record<string, string> = {
  "not-allowed": "O navegador bloqueou o microfone. Libere o microfone para este site (cadeado ao lado do endereço) e tente de novo.",
  "audio-capture": "Não encontrei um microfone funcionando. Confira se ele está conectado e liberado.",
  "no-speech": "Não ouvi nada. Fale perto do microfone logo depois de tocar em Ditar.",
};
/** Erros em que o reconhecimento do navegador não funciona neste app/computador (app instalado, sem serviço do Google, sem internet para ele): troca para a gravação. */
const SWITCH = new Set(["network", "service-not-allowed", "language-not-supported"]);

const mimeOf = () => ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
const toBase64 = (blob: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = () => rej(new Error("Não consegui ler o áudio.")); r.readAsDataURL(blob); });

/** Fala → texto em pt-BR. `onFinal` recebe a frase completa quando ela termina de falar.
 *  Usa o reconhecimento do navegador; se ele não funcionar (erro de rede, app instalado), grava o áudio e transcreve no servidor. */
export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const stopRec = useRef<(() => void) | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => setSupported(!!getRecognitionCtor() || canRecord()), []);

  const stop = useCallback(() => { recRef.current?.stop(); stopRec.current?.(); }, []);

  /** Grava o microfone até a pessoa parar de falar (ou tocar para parar) e transcreve no servidor. */
  const startRecorded = useCallback(async () => {
    if (!canRecord() || stopRec.current) return false;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { dictation(false); setListening(false); toast.error((e as DOMException).name === "NotFoundError" ? WHY["audio-capture"]! : WHY["not-allowed"]!, { duration: 7000 }); return false; }
    setListening(true); setInterim("Ouvindo…"); dictation(true);
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ac = new AC!(); void ac.resume();
    const an = ac.createAnalyser(); an.fftSize = 1024; ac.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize), mime = mimeOf(), mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined), chunks: Blob[] = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.start(200);
    const t0 = performance.now();
    let noise = 0.01, loud = 0, quiet = 0, started = false, finished = false;
    const finish = async (kind: "enviar" | "cancelar") => {
      if (finished) return; finished = true; clearInterval(timer); stopRec.current = null;
      const stopped = new Promise<void>((res) => { mr.onstop = () => res(); });
      try { mr.stop(); } catch { /* já parou */ }
      await stopped; stream.getTracks().forEach((t) => t.stop()); try { void ac.close(); } catch { /* já fechou */ }
      try {
        if (kind === "cancelar" || !started) { if (kind !== "cancelar") toast.error(WHY["no-speech"]!); return; }
        setInterim("Transcrevendo…");
        const blob = new Blob(chunks, { type: mr.mimeType || mime || "audio/webm" });
        const r = await transcribeAudio({ data: { data: await toBase64(blob), mime: blob.type } });
        if (!r.ok) { toast.error(r.error, { duration: 7000 }); return; }
        const text = r.text.trim();
        if (text) onFinalRef.current(text);
      } catch (e) { toast.error(`Não consegui transcrever: ${e instanceof Error ? e.message : "erro"}`); }
      finally { setListening(false); setInterim(""); dictation(false); }
    };
    const timer = setInterval(() => {
      an.getByteTimeDomainData(buf);
      let sum = 0; for (const v of buf) { const x = (v - 128) / 128; sum += x * x; }
      const rms = Math.sqrt(sum / buf.length), now = performance.now();
      if (now - t0 < 400) { noise = Math.max(noise, rms); return; }
      if (rms > Math.max(0.025, noise * 2.5)) { loud += 50; quiet = 0; if (!started && loud >= 150) { started = true; setInterim("Ouvindo você…"); } } else if (started) quiet += 50;
      if (started && quiet >= silenceForSpeech(loud)) void finish("enviar"); // parou de falar (espera mais se falou muito)
      else if (!started && now - t0 > 10_000) void finish("enviar");   // ninguém falou
      else if (now - t0 > 120_000) void finish("enviar");             // limite
    }, 50);
    stopRec.current = () => { void finish(started ? "enviar" : "cancelar"); };
    return true;
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (recRef.current || stopRec.current) return false;
    // já descobrimos que o reconhecimento do navegador não funciona aqui (ou ele nem existe): grava e transcreve
    if (!Ctor || getStt()) { if (!canRecord()) return false; void startRecorded(); return true; }
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "", switchTo = false;
    rec.onresult = (e) => {
      let partial = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText += r[0]!.transcript;
        else partial += r[0]!.transcript;
      }
      setInterim(finalText + partial);
    };
    rec.onerror = (e) => {
      if (SWITCH.has(e.error) && canRecord() && !finalText.trim()) { switchTo = true; return; }
      const m = WHY[e.error]; if (m && !finalText.trim()) toast.error(m, { duration: 7000 });
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim("");
      const text = finalText.trim();
      if (switchTo) { setStt(); toast.message("Usando o reconhecimento de voz do Orion", { description: "O do navegador não funciona neste app. Fale de novo." }); void startRecorded(); return; }
      dictation(false); // devolve o microfone para a escuta de "Orion"
      if (text) onFinalRef.current(text);
    };
    recRef.current = rec;
    setListening(true);
    // pede para o Orion (palavra de chamada / conversa) soltar o microfone e dá um instante: dois reconhecimentos ao mesmo tempo se cancelam
    dictation(true);
    setTimeout(() => {
      if (recRef.current !== rec) return;
      try { rec.start(); } catch { recRef.current = null; setListening(false); dictation(false); toast.error("Não consegui abrir o microfone agora. Tente de novo."); }
    }, 450);
    return true;
  }, [startRecorded]);

  return { listening, interim, supported, start, stop };
}
