import { Mic, Square } from "lucide-react";
import { useSpeech } from "@/lib/use-speech";

/** Microfone para ditar dentro de um campo de texto: o que você falar é acrescentado ao que já está escrito. Coloque dentro de um `relative`. */
export function DictateButton({ onText, label = "Falar", className = "right-2 top-2" }: { onText: (spoken: string) => void; label?: string; className?: string }) {
  const sp = useSpeech(onText);
  if (!sp.supported) return null;
  return (
    <button type="button" onClick={() => (sp.listening ? sp.stop() : sp.start())} aria-label={sp.listening ? "Parar de ouvir" : `${label} (ditar)`} aria-pressed={sp.listening} data-testid="ditar-campo"
      title={sp.listening ? "Ouvindo… toque para parar" : "Ditar com a voz"}
      className={`absolute z-10 grid h-8 w-8 place-items-center rounded-full border transition active:scale-90 ${className} ${sp.listening ? "border-emerald/60 bg-emerald/20 text-emerald shadow-[0_0_18px_-4px_var(--emerald)] animate-pulse" : "border-white/15 bg-background/70 text-muted-foreground hover:border-cyan/50 hover:text-cyan hover:shadow-[0_0_14px_-4px_var(--cyan)]"}`}>
      {sp.listening ? <Square size={11} fill="currentColor" /> : <Mic size={14} />}
    </button>
  );
}

/** Junta o que foi falado ao texto atual, com um espaço ou quebra de linha no meio. */
export const appendSpoken = (cur: string, spoken: string, sep = " ") => `${cur}${cur.trim() ? sep : ""}${spoken.trim()}`;
