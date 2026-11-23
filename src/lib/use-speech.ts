import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

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

const dictation = (on: boolean) => { try { window.dispatchEvent(new CustomEvent("orion:ditado", { detail: on })); } catch { /* sem window */ } };
const WHY: Record<string, string> = {
  "not-allowed": "O navegador bloqueou o microfone. Libere o microfone para este site (cadeado ao lado do endereço) e tente de novo.",
  "service-not-allowed": "O navegador bloqueou o reconhecimento de voz neste site.",
  "audio-capture": "Não encontrei um microfone funcionando. Confira se ele está conectado e liberado.",
  network: "O reconhecimento de voz do navegador precisa de internet e não conseguiu falar com o serviço. Tente de novo.",
  "no-speech": "Não ouvi nada. Fale perto do microfone logo depois de tocar em Ditar.",
};

/** Fala → texto em pt-BR. `onFinal` recebe a frase completa quando ela termina de falar. */
export function useSpeech(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => setSupported(!!getRecognitionCtor()), []);

  const stop = useCallback(() => recRef.current?.stop(), []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recRef.current) return false;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let partial = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText += r[0]!.transcript;
        else partial += r[0]!.transcript;
      }
      setInterim(finalText + partial);
    };
    // antes o erro era engolido: o botão ficava "Ouvindo…" e sumia sem explicar
    rec.onerror = (e) => { const m = WHY[e.error]; if (m && !finalText.trim()) toast.error(m, { duration: 7000 }); };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim("");
      dictation(false); // devolve o microfone para a escuta de "Orion"
      const text = finalText.trim();
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
  }, []);

  return { listening, interim, supported, start, stop };
}
