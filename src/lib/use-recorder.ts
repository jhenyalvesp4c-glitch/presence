import { useCallback, useEffect, useRef, useState } from "react";

export type RecState = "idle" | "recording";
export const MAX_SECONDS = 180;

const pickMime = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
};

const toBase64 = (blob: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] ?? "");
  r.onerror = () => rej(new Error("Não consegui ler o áudio gravado."));
  r.readAsDataURL(blob);
});

/** Grava áudio do microfone. `stop()` devolve o áudio em base64 (ou null se cancelado). */
export function useRecorder() {
  const [state, setState] = useState<RecState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [supported, setSupported] = useState(false);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const done = useRef<((r: { data: string; mime: string } | null) => void) | null>(null);
  const cancelled = useRef(false);

  useEffect(() => setSupported(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined"), []);

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null; rec.current = null;
    setState("idle"); setSeconds(0);
  }, []);
  useEffect(() => () => { cancelled.current = true; if (rec.current?.state === "recording") rec.current.stop(); release(); }, [release]);

  /** Começa a gravar. Lança erro em português se o microfone não estiver disponível. */
  const start = useCallback(async () => {
    if (rec.current) return;
    let s: MediaStream;
    try { s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) {
      const n = (e as DOMException).name;
      throw new Error(n === "NotAllowedError" ? "O navegador bloqueou o microfone. Permita o acesso ao microfone nesta página e tente de novo." : n === "NotFoundError" ? "Não encontrei nenhum microfone." : "Não consegui acessar o microfone.");
    }
    stream.current = s; chunks.current = []; cancelled.current = false;
    const mime = pickMime();
    const r = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = async () => {
      const type = r.mimeType || mime || "audio/webm";
      const blob = new Blob(chunks.current, { type });
      const resolve = done.current; done.current = null;
      release();
      if (cancelled.current || !blob.size) return resolve?.(null);
      try { resolve?.({ data: await toBase64(blob), mime: type }); } catch { resolve?.(null); }
    };
    rec.current = r; r.start(250);
    setState("recording"); setSeconds(0);
    timer.current = setInterval(() => setSeconds((n) => n + 1), 1000);
  }, [release]);

  const stop = useCallback(() => new Promise<{ data: string; mime: string } | null>((resolve) => {
    if (!rec.current || rec.current.state !== "recording") return resolve(null);
    done.current = resolve; rec.current.stop();
  }), []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    if (rec.current?.state === "recording") rec.current.stop(); else release();
  }, [release]);

  return { state, seconds, supported, start, stop, cancel };
}
