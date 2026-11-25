/** Quanto silêncio o Orion espera antes de achar que a pessoa TERMINOU de falar. Pedidos longos e frases que ficaram no meio ("…porque eu", "…e") pedem mais paciência. Puro, testado. */
export const BASE_SILENCE_MS = 2600;
const MAX_SILENCE_MS = 6500;
/** Terminou numa palavra de ligação ou de hesitação: a frase provavelmente continua. */
const OPEN = /(?:^|\s)(?:e|mas|porque|pq|que|então|entao|tipo|pra|para|o|a|os|as|um|uma|de|do|da|dos|das|no|na|em|com|se|quando|como|ou|só|so|também|tambem|né|ne|aí|ai|é|eh|ahn|hum|hm+|tá|ta|então|por|meu|minha|me)$/i;

export function silenceFor(text: string): number {
  const t = text.trim();
  if (!t) return BASE_SILENCE_MS;
  const words = t.split(/\s+/).length;
  let ms = BASE_SILENCE_MS + Math.min(2000, Math.max(0, words - 6) * 70); // quanto mais longo o pedido, mais pausa entre as ideias
  if (OPEN.test(t.replace(/[.,;!?…]+$/, ""))) ms += 1800;                   // parou no meio da frase
  if (/[?]$/.test(t) && words <= 10) ms -= 600;                              // pergunta curta e completa: responde mais cedo
  return Math.max(1800, Math.min(MAX_SILENCE_MS, ms));
}

/** Na gravação (só o áudio, sem texto): a pausa tolerada cresce com o quanto a pessoa já falou. */
export const silenceForSpeech = (speechMs: number): number => Math.min(MAX_SILENCE_MS, BASE_SILENCE_MS + Math.min(2600, speechMs / 6));
