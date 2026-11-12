import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";

import { SINGLE_USER_ID, supabase } from "@/lib/supabase";
import type { Panel, Turn, VoiceEvent } from "./agent";
import { takeSentences } from "./sentences";

export type Phase = "idle" | "listening" | "thinking" | "speaking";
export type Voice = {
  active: boolean; phase: Phase; userText: string; botText: string; interim: string; panel: Panel | null; canListen: boolean; note: string | null;
  testVoice: () => void; toggle: () => void; stop: () => void; sendText: (t: string) => void; closePanel: () => void;
};
const Ctx = createContext<Voice | null>(null);
export const useVoice = (): Voice => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVoice fora do VoiceProvider");
  return v;
};

/* ───────────── reconhecimento de fala do navegador ───────────── */
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null };
const recCtor = (): (new () => Rec) | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

/* ───────────── fila de fala: cada frase vira áudio (ElevenLabs) e toca na ordem ───────────── */
class Speaker {
  private items: { text: string; blob: Promise<Blob | null> }[] = [];
  private playing = false;
  private cancelled = false;
  private ctrl = new AbortController();
  private audio: HTMLAudioElement | null = null;
  private ctx: AudioContext | null = null;
  private node: AudioBufferSourceNode | null = null;
  private waiters: (() => void)[] = [];
  private fallback = false;
  constructor(private onStart: () => void, private onNote: (n: string | null) => void) {}

  /** Chamar dentro de um clique: libera o áudio do navegador (Chrome, Safari e celular) para os toques seguintes. */
  unlock() {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC && !this.ctx) this.ctx = new AC();
      if (this.ctx) {
        void this.ctx.resume();
        const s = this.ctx.createBufferSource(); s.buffer = this.ctx.createBuffer(1, 1, 22050); s.connect(this.ctx.destination); s.start(0);
      }
    } catch { /* sem Web Audio: usa o elemento de áudio */ }
    if (!this.audio) this.audio = new Audio();
    this.audio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
    void this.audio.play().catch(() => undefined);
    try { if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices(); } catch { /* sem síntese */ }
  }

  private fetchAudio(text: string): Promise<Blob | null> {
    if (this.fallback) return Promise.resolve(null);
    return fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }), signal: this.ctrl.signal })
      .then(async (r) => {
        if (!r.ok) {
          this.fallback = r.status === 501 || r.status === 401 || r.status === 403;
          this.onNote(r.status === 501 ? "A voz do ElevenLabs não está configurada: usando a voz do navegador." : `A voz do ElevenLabs falhou (erro ${r.status}): usando a voz do navegador.`);
          return null;
        }
        const b = await r.blob();
        if (b.size < 200) { this.onNote("A voz do ElevenLabs veio vazia: usando a voz do navegador."); return null; }
        return b;
      })
      .catch((e) => { if (!this.cancelled) this.onNote(`Não consegui falar com o servidor de voz (${e instanceof Error ? e.message : "erro"}).`); return null; });
  }

  enqueue(text: string) {
    if (this.cancelled) return;
    this.items.push({ text, blob: this.fetchAudio(text) }); // já começa a gerar o áudio enquanto a anterior toca
    void this.run();
  }

  private async run() {
    if (this.playing) return;
    this.playing = true;
    let started = false;
    while (this.items.length && !this.cancelled) {
      const it = this.items.shift()!;
      const blob = await it.blob;
      if (this.cancelled) break;
      if (!started) { started = true; this.onStart(); }
      let played = false;
      if (blob) played = await this.playBlob(blob);
      if (!played && !this.cancelled) await this.playBrowser(it.text);
    }
    this.playing = false;
    if (!this.items.length) { const w = this.waiters; this.waiters = []; w.forEach((f) => f()); }
  }

  /** Toca o mp3: primeiro por Web Audio (mais confiável), depois pelo elemento de áudio. Devolve false se não conseguiu. */
  private async playBlob(blob: Blob): Promise<boolean> {
    if (this.ctx) {
      try {
        if (this.ctx.state === "suspended") await this.ctx.resume();
        const buf = await this.ctx.decodeAudioData(await blob.arrayBuffer());
        await new Promise<void>((res) => { const s = this.ctx!.createBufferSource(); s.buffer = buf; s.connect(this.ctx!.destination); this.node = s; s.onended = () => res(); s.start(); });
        this.node = null;
        return true;
      } catch { /* tenta pelo elemento de áudio */ }
    }
    return new Promise<boolean>((resolve) => {
      const a = this.audio ?? (this.audio = new Audio());
      const url = URL.createObjectURL(blob);
      const end = (ok: boolean) => { URL.revokeObjectURL(url); a.onended = null; a.onerror = null; resolve(ok); };
      a.onended = () => end(true); a.onerror = () => end(false);
      a.src = url;
      a.play().catch(() => { this.onNote("O navegador bloqueou o som. Toque na esfera de novo ou confira se o site não está silenciado."); end(false); });
    });
  }

  private playBrowser(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === "undefined") { this.onNote("Este navegador não consegue falar."); return resolve(); }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-BR"; u.rate = 1.05;
      const v = speechSynthesis.getVoices().find((x) => /^pt(-|_)BR/i.test(x.lang)) ?? speechSynthesis.getVoices().find((x) => /^pt/i.test(x.lang));
      if (v) u.voice = v;
      u.onend = () => resolve(); u.onerror = () => resolve();
      speechSynthesis.speak(u);
      setTimeout(resolve, Math.max(4000, text.length * 120)); // não trava se o navegador não terminar o evento
    });
  }

  /** Resolve quando tudo o que estava na fila terminou de tocar. */
  drained(): Promise<void> { return !this.playing && !this.items.length ? Promise.resolve() : new Promise((r) => this.waiters.push(r)); }

  cancel() {
    this.cancelled = true;
    this.ctrl.abort();
    this.items = [];
    try { this.node?.stop(); } catch { /* já parou */ }
    this.node = null;
    if (this.audio) { this.audio.onended = null; this.audio.pause(); }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    const w = this.waiters; this.waiters = []; w.forEach((f) => f());
    this.playing = false;
  }

  reset() { this.cancelled = false; this.ctrl = new AbortController(); this.fallback = this.fallback && false; }
}

const MAX_IDLE = 3;

export function VoiceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [userText, setUserText] = useState("");
  const [botText, setBotText] = useState("");
  const [interim, setInterim] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [canListen, setCanListen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const activeRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");
  const history = useRef<Turn[]>([]);
  const rec = useRef<Rec | null>(null);
  const idle = useRef(0);
  const abort = useRef<AbortController | null>(null);
  const endAfter = useRef(false);
  const speaker = useRef<Speaker | null>(null);
  const turn = useRef(0);

  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };
  useEffect(() => { setCanListen(!!recCtor()); }, []);
  const spk = () => (speaker.current ??= new Speaker(() => { if (activeRef.current) setP("speaking"); }, (n) => setNote(n)));

  const stopListening = useCallback(() => { const r = rec.current; rec.current = null; if (r) { r.onend = null; r.onresult = null; try { r.abort(); } catch { /* já parado */ } } setInterim(""); }, []);

  const endSession = useCallback(() => {
    activeRef.current = false; setActive(false);
    stopListening(); abort.current?.abort(); speaker.current?.cancel();
    setP("idle"); setInterim("");
    setTimeout(() => { if (!activeRef.current) { setUserText(""); setBotText(""); } }, 6000);
  }, [stopListening]);

  const listen = useCallback(() => {
    if (!activeRef.current) return;
    const C = recCtor();
    if (!C) { setP("idle"); return; }
    stopListening();
    const r = new C();
    r.lang = "pt-BR"; r.interimResults = true; r.continuous = false;
    let finalText = "";
    r.onresult = (e) => {
      let partial = "";
      for (let i = 0; i < e.results.length; i++) { const x = e.results[i]!; if (x.isFinal) finalText += x[0]!.transcript; else partial += x[0]!.transcript; }
      setInterim(finalText + partial);
    };
    r.onerror = (e) => {
      const m: Record<string, string> = {
        "not-allowed": "O navegador bloqueou o microfone. Clique no cadeado ao lado do endereço e permita o microfone para este site.",
        "service-not-allowed": "O navegador bloqueou o reconhecimento de voz. Permita o microfone para este site.",
        "audio-capture": "Não encontrei nenhum microfone.",
        network: "O reconhecimento de voz do navegador está sem conexão com o serviço dele. Você pode digitar abaixo.",
      };
      if (m[e.error]) { setNote(m[e.error]!); if (e.error !== "network") idle.current = MAX_IDLE; }
    };
    r.onend = () => {
      if (rec.current !== r) return;
      rec.current = null; setInterim("");
      const text = finalText.trim();
      if (text) { idle.current = 0; void ask(text); return; }
      if (!activeRef.current) return;
      if (++idle.current >= MAX_IDLE) { endSession(); return; }
      setTimeout(() => { if (activeRef.current && phaseRef.current === "listening") listen(); }, 200);
    };
    rec.current = r;
    try { r.start(); setP("listening"); } catch { setTimeout(() => listen(), 300); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endSession, stopListening]);

  /** Uma rodada: manda a fala, recebe a resposta em streaming e fala cada frase assim que fica pronta. */
  const ask = useCallback(async (text: string) => {
    const my = ++turn.current;
    stopListening();
    const sp = spk(); sp.reset();
    setUserText(text); setBotText(""); setP("thinking");
    history.current = [...history.current, { role: "user" as const, content: text }].slice(-16);
    const ctrl = new AbortController(); abort.current = ctrl;
    let said = "", buffer = "", first = true;
    endAfter.current = false;
    const say = (chunks: string[]) => chunks.forEach((c) => sp.enqueue(c));
    try {
      const res = await fetch("/api/voz", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history.current }), signal: ctrl.signal });
      if (!res.ok || !res.body) throw new Error(res.status === 429 ? "Calma, estou recebendo pedidos demais. Tente em instantes." : "Não consegui falar com o servidor.");
      const reader = res.body.getReader(), dec = new TextDecoder();
      let carry = "";
      const handle = (e: VoiceEvent) => {
        if (turn.current !== my) return;
        if (e.t === "texto") {
          said += e.d; buffer += e.d; setBotText(said);
          const t = takeSentences(buffer, { first });
          buffer = t.rest; first = t.first; say(t.chunks);
        } else if (e.t === "acao") {
          if (e.a.tipo === "navegar") router.history.push(e.a.para); else endAfter.current = true;
        } else if (e.t === "painel") setPanel(e.p);
        else if (e.t === "erro") { said = said || e.m; setBotText(said); say([e.m]); }
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = carry.indexOf("\n")) >= 0) { const line = carry.slice(0, nl).trim(); carry = carry.slice(nl + 1); if (line) { try { handle(JSON.parse(line) as VoiceEvent); } catch { /* linha incompleta */ } } }
      }
      if (turn.current !== my) return;
      say(takeSentences(buffer, { first, flush: true }).chunks);
      if (said.trim()) {
        history.current = [...history.current, { role: "assistant" as const, content: said.trim() }].slice(-16);
        void supabase.from("assistant_messages").insert([{ user_id: SINGLE_USER_ID, role: "user", content: text }, { user_id: SINGLE_USER_ID, role: "assistant", content: said.trim() }]).then(() => undefined);
      }
    } catch (e) {
      if (ctrl.signal.aborted || turn.current !== my) return;
      const m = e instanceof Error ? e.message : "Tive um problema agora.";
      setBotText(m); sp.enqueue(m);
    }
    if (turn.current !== my) return;
    await sp.drained();
    if (turn.current !== my || !activeRef.current) return;
    if (endAfter.current) { endSession(); return; }
    if (recCtor()) listen(); else setP("idle");
  }, [endSession, listen, router, stopListening]);

  const start = useCallback(() => {
    activeRef.current = true; setActive(true); idle.current = 0; setUserText(""); setBotText(""); setNote(null);
    spk().unlock();
    if (recCtor()) listen(); else setP("idle");
  }, [listen]);

  const stop = useCallback(() => { turn.current++; endSession(); }, [endSession]);

  /** Fala uma frase de teste para o usuário conferir se o som está chegando. */
  const testVoice = useCallback(() => {
    if (!activeRef.current) { activeRef.current = true; setActive(true); }
    stopListening(); const sp = spk(); sp.unlock(); sp.cancel(); sp.reset(); setNote(null);
    setBotText("Olá! Se você está me ouvindo, a voz está funcionando."); setP("thinking");
    sp.enqueue("Olá! Se você está me ouvindo, a voz está funcionando.");
    void sp.drained().then(() => { if (activeRef.current && phaseRef.current !== "listening") { if (recCtor()) listen(); else setP("idle"); } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listen, stopListening]);

  /** Toque na esfera: liga; se já está falando ou pensando, interrompe e volta a ouvir (barge-in); se está ouvindo, encerra. */
  const toggle = useCallback(() => {
    if (!activeRef.current) return start();
    if (phaseRef.current === "speaking" || phaseRef.current === "thinking") {
      turn.current++; abort.current?.abort(); speaker.current?.cancel(); speaker.current?.reset();
      if (recCtor()) listen(); else setP("idle");
      return;
    }
    stop();
  }, [listen, start, stop]);

  const sendText = useCallback((t: string) => {
    const x = t.trim(); if (!x) return;
    if (!activeRef.current) { activeRef.current = true; setActive(true); spk().unlock(); }
    void ask(x);
  }, [ask]);

  useEffect(() => () => { activeRef.current = false; speaker.current?.cancel(); stopListening(); }, [stopListening]);

  const value = useMemo<Voice>(() => ({ active, phase, userText, botText, interim, panel, canListen, note, testVoice, toggle, stop, sendText, closePanel: () => setPanel(null) }),
    [active, phase, userText, botText, interim, panel, canListen, note, testVoice, toggle, stop, sendText]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
