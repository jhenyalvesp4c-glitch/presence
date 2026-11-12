/** Divide o texto que chega aos pedaços em frases prontas para falar, para a voz começar antes da resposta terminar. */
const BOUNDARY = /([.!?…]+["')\]]*|\n+)(\s+|$)/g;

/** Tira marcações que não devem ser faladas (markdown, emojis, links). */
export const cleanForSpeech = (t: string) =>
  t.replace(/```[\s\S]*?```/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_`#>~]+/g, "").replace(/https?:\/\/\S+/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s+/g, " ").trim();

/**
 * Tira de `buffer` as frases completas. A primeira frase sai mais cedo (a partir de `firstMin` letras, também em vírgula)
 * para reduzir a espera; as seguintes só em fim de frase. `flush` solta o que sobrou.
 */
export function takeSentences(buffer: string, opts: { first: boolean; flush?: boolean; firstMin?: number; min?: number }): { chunks: string[]; rest: string; first: boolean } {
  const chunks: string[] = [];
  let rest = buffer, first = opts.first;
  const min = opts.min ?? 12, firstMin = opts.firstMin ?? 28;
  for (;;) {
    let cut = -1;
    for (const m of rest.matchAll(BOUNDARY)) {
      const end = m.index + m[0].length;
      if (m.index + m[1]!.length >= min || rest.length > 140) { cut = end; break; }
    }
    if (cut < 0 && first) { const c = /[,;:—]\s+/.exec(rest); if (c && c.index >= firstMin) cut = c.index + c[0].length; }
    if (cut < 0) break;
    const piece = cleanForSpeech(rest.slice(0, cut));
    rest = rest.slice(cut);
    if (piece) { chunks.push(piece); first = false; }
  }
  if (opts.flush) { const t = cleanForSpeech(rest); if (t) chunks.push(t); rest = ""; }
  return { chunks, rest, first };
}
