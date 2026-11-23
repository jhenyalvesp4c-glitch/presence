/** Papo rápido ("oi", "tudo bem?", "como você está?", "valeu"): a resposta sai direto, sem ferramentas, para ser instantânea.
 *  Estrito de propósito: se sobrar qualquer palavra fora da lista, NÃO é papo rápido e segue o fluxo normal (com ferramentas). */
const PHRASES = [
  "como voce tem passado", "como voce esta", "como voce ta", "como voce vai", "como vai voce", "como esta voce", "como vai", "como ta voce",
  "tudo bem", "tudo bom", "tudo certo", "tudo joia", "bom dia", "boa tarde", "boa noite", "e com voce", "e voce", "e vc", "que bom", "ta bom", "ta certo",
  "obrigado", "obrigada", "valeu", "beleza", "legal", "show", "ok", "certo", "entendi", "perfeito", "otimo", "massa",
  "oi", "ola", "opa", "e ai", "eai", "fala", "hoje", "orion", "tambem", "entao", "muito", "ne",
];

const norm = (t: string) => ` ${t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()} `;

export function isSmallTalk(text: string, names: (string | null | undefined)[] = []): boolean {
  if (!text || text.length > 70) return false;
  let s = norm(text);
  if (s.trim().length === 0) return false;
  for (const n of names) { const k = n ? norm(n).trim() : ""; if (k.length >= 2) s = s.replace(new RegExp(` ${k}(?= )`, "g"), " "); }
  for (const p of PHRASES) s = s.replace(new RegExp(` ${p}(?= )`, "g"), " ").replace(/\s+/g, " ");
  return s.trim() === "";
}
