/** Gravação contínua com transcrição quase em tempo real: o microfone fica aberto, o áudio é cortado em trechos (~25 s) que vão sendo transcritos (OpenAI) enquanto a gravação segue; ao finalizar, devolve o texto inteiro. Sem limite de duração. */
import { useCallback, useEffect, useRef, useState } from "react";

import { transcribeAudio } from "./audio.functions";

type Rec = { stop: () => void; start: (ms: number) => void; state: string; mimeType: string; ondataavailable: ((e: { data: Blob }) => void) | null; onstop: (() => void) | null };
const pickMime = () => (typeof MediaRecorder === "undefined" ? "" : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "");
const toBase64 = (blob: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = () => rej(new Error("Não consegui ler o áudio.")); r.readAsDataURL(blob); });

// Reconhecimento do navegador só para mostrar as palavras na hora (o texto de verdade vem da transcrição por trecho).
type SR = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
const srCtor = (): (new () => SR) | undefined => { if (typeof window === "undefined") return undefined; const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }; return w.SpeechRecognition ?? w.webkitSpeechRecognition; };

export type LiveChunk = { idx: number; text: string | null; status: "pendente" | "ok" | "erro" | "vazio"; erro?: string };

export function useLiveRecorder(chunkMs = 25_000) {
  const [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0), [chunks, setChunks] = useState<LiveChunk[]>([]), [live, setLive] = useState(""), [finishing, setFinishing] = useState(false), [supported, setSupported] = useState(false);
  const stream = useRef<MediaStream | null>(null), rec = useRef<Rec | null>(null), timer = useRef<ReturnType<typeof setInterval> | null>(null), cut = useRef<ReturnType<typeof setTimeout> | null>(null), recog = useRef<SR | null>(null);
  const running = useRef(false), idx = useRef(0), queue = useRef<Promise<void>>(Promise.resolve()), failed = useRef(new Map<number, { data: string; mime: string }>()), results = useRef(new Map<number, string>()), wake = useRef<{ release: () => Promise<void> } | null>(null);
  useEffect(() => setSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined"), []);

  const patch = (i: number, p: Partial<LiveChunk>) => setChunks((c) => c.map((x) => (x.idx === i ? { ...x, ...p } : x)));
  const transcribeChunk = useCallback((i: number, data: string, mime: string) => {
    // um trecho de cada vez, na ordem; o fim do trecho anterior ajuda a manter o contexto
    queue.current = queue.current.then(async () => {
      const before = [...results.current.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]).join(" ").slice(-240);
      try {
        const t = await transcribeAudio({ data: { data, mime, ...(before ? { prompt: before } : {}) } });
        if (t.ok) { results.current.set(i, t.text); failed.current.delete(i); patch(i, { text: t.text, status: "ok" }); }
        else if (/ouvir nada/i.test(t.error)) { patch(i, { text: "", status: "vazio" }); failed.current.delete(i); }
        else { failed.current.set(i, { data, mime }); patch(i, { status: "erro", erro: t.error }); }
      } catch (e) { failed.current.set(i, { data, mime }); patch(i, { status: "erro", erro: (e as Error).message }); }
    });
    return queue.current;
  }, []);

  const startChunk = useCallback(() => {
    const s = stream.current; if (!s || !running.current) return;
    const mime = pickMime(), r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined) as unknown as Rec, parts: Blob[] = [], i = idx.current++;
    r.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
    r.onstop = () => {
      const type = r.mimeType || mime || "audio/webm", blob = new Blob(parts, { type });
      if (running.current) startChunk(); // o próximo trecho já começa, sem perder áudio
      if (blob.size < 1500) return; // trecho praticamente vazio
      setChunks((c) => [...c, { idx: i, text: null, status: "pendente" }]);
      void toBase64(blob).then((d) => transcribeChunk(i, d, type)).catch(() => patch(i, { status: "erro", erro: "Não consegui ler o áudio." }));
    };
    rec.current = r; r.start(250);
    cut.current = setTimeout(() => { if (r.state === "recording") r.stop(); }, chunkMs);
  }, [chunkMs, transcribeChunk]);

  const startRecognition = useCallback(() => {
    const C = srCtor(); if (!C) return;
    const r = new C(); r.lang = "pt-BR"; r.interimResults = true; r.continuous = true;
    r.onresult = (e) => { let t = ""; for (let k = e.resultIndex; k < e.results.length; k++) t += e.results[k]![0]!.transcript; setLive(t.trim()); };
    r.onend = () => { if (running.current) { try { r.start(); } catch { /* já iniciou */ } } };
    r.onerror = () => undefined;
    recog.current = r; try { r.start(); } catch { /* sem reconhecimento */ }
  }, []);

  const start = useCallback(async () => {
    if (running.current) return;
    let s: MediaStream;
    try { s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { const n = (e as DOMException).name; throw new Error(n === "NotAllowedError" ? "O navegador bloqueou o microfone. Permita o acesso ao microfone nesta página e tente de novo." : n === "NotFoundError" ? "Não encontrei nenhum microfone." : "Não consegui abrir o microfone."); }
    stream.current = s; running.current = true; idx.current = 0; results.current = new Map(); failed.current = new Map(); queue.current = Promise.resolve();
    setChunks([]); setLive(""); setSeconds(0); setRecording(true);
    try { wake.current = (await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen")) ?? null; } catch { wake.current = null; }
    timer.current = setInterval(() => setSeconds((n) => n + 1), 1000);
    startChunk(); startRecognition();
  }, [startChunk, startRecognition]);

  const teardown = useCallback(() => {
    running.current = false;
    if (timer.current) clearInterval(timer.current); timer.current = null;
    if (cut.current) clearTimeout(cut.current); cut.current = null;
    try { recog.current?.stop(); } catch { /* já parou */ } recog.current = null;
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null;
    void wake.current?.release().catch(() => undefined); wake.current = null;
    setRecording(false); setLive("");
  }, []);

  /** Para, espera os últimos trechos serem transcritos e devolve o texto inteiro. */
  const finish = useCallback(async (): Promise<{ text: string; failed: number }> => {
    if (!running.current) return { text: "", failed: 0 };
    setFinishing(true);
    const r = rec.current;
    running.current = false; // o último trecho não reinicia
    if (cut.current) clearTimeout(cut.current);
    if (r && r.state === "recording") await new Promise<void>((ok) => { const prev = r.onstop; r.onstop = () => { prev?.(); ok(); }; r.stop(); });
    teardown();
    await new Promise((ok) => setTimeout(ok, 100)); await queue.current;
    for (const [i, v] of [...failed.current.entries()]) { patch(i, { status: "pendente" }); await transcribeChunk(i, v.data, v.mime); } // uma segunda chance para o que falhou
    setFinishing(false);
    return { text: [...results.current.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]).filter(Boolean).join(" ").replace(/\s+/g, " ").trim(), failed: failed.current.size };
  }, [teardown, transcribeChunk]);

  const cancel = useCallback(() => { const r = rec.current; running.current = false; if (r && r.state === "recording") { r.onstop = null; r.stop(); } teardown(); setChunks([]); results.current = new Map(); }, [teardown]);
  /** Tenta de novo os trechos que falharam (rede, limite de uso…). */
  const retry = useCallback(async () => { const f = [...failed.current.entries()]; for (const [i, v] of f) { patch(i, { status: "pendente" }); await transcribeChunk(i, v.data, v.mime); } }, [transcribeChunk]);

  useEffect(() => () => { running.current = false; teardown(); }, [teardown]);
  useEffect(() => { if (!recording) return; const h = (e: BeforeUnloadEvent) => { e.preventDefault(); }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [recording]);

  const text = [...chunks].sort((a, b) => a.idx - b.idx).map((c) => c.text).filter(Boolean).join(" ");
  return { recording, finishing, seconds, supported, chunks, text, live, hasLive: !!srCtor(), start, finish, cancel, retry, failedCount: chunks.filter((c) => c.status === "erro").length, pending: chunks.filter((c) => c.status === "pendente").length };
}
