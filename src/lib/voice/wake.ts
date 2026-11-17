/** Palavra de ativação ("Orion"), como "Alexa": detecção por texto e a preferência de ligar/desligar. */
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Letras parecidas viram uma só (y→i, sem h, letras dobradas viram uma) e tira o "s" do plural: "Hórion", "Orions", "Oryan" → orion/orian. */
const phon = (w: string) => w.replace(/y/g, "i").replace(/h/g, "").replace(/(.)\1+/g, "$1").replace(/s$/, "");
/** Como o reconhecimento costuma escrever "Orion" falado. Não entram "aria", "origem", "oriente", "Marion"… */
const VARIANTS = new Set(["orion", "orian", "oriam", "oriom", "orium", "orio", "orioa", "oriao", "oria", "auria", "aurion", "aurian", "ourion", "ourian", "orien"]);

const lev = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
};
export const isOrionWord = (raw: string): boolean => {
  const w = phon(raw);
  if (w.length < 4 || w.length > 7) return false;
  return VARIANTS.has(w) || (w.length === 5 && lev(w, "orion") === 1);
};

/** Quantos tokens do começo podem vir antes de "Orion" ("ei", "oi", "bom dia"…): chamar é no começo da fala, não no meio de uma conversa. */
const START_WINDOW = 3;
const PREFIX_JOIN = 3; // "o rian" / "ori on": junta dois pedaços curtos

type Tok = { w: string; start: number; end: number };
const tokens = (flat: string): Tok[] => [...flat.matchAll(/[a-z]+/g)].map((m) => ({ w: m[0], start: m.index!, end: m.index! + m[0].length }));

/** Onde está a palavra de ativação (em `flat`, o texto sem acentos), ou null. */
function find(flat: string): { start: number; end: number; count: number } | null {
  const t = tokens(flat); let hit: { start: number; end: number } | null = null, count = 0;
  for (let i = 0; i < t.length; i++) {
    const one = isOrionWord(t[i]!.w), two = !one && i + 1 < t.length && t[i]!.w.length <= PREFIX_JOIN && t[i + 1]!.w.length <= 4 && isOrionWord(t[i]!.w + t[i + 1]!.w);
    if (!one && !two) continue;
    count++;
    if (!hit && i < START_WINDOW) hit = { start: t[i]!.start, end: t[two ? i + 1 : i]!.end };
    if (two) i++;
  }
  // 3 ou mais "Orion" numa fala só é a IA repetindo a dica do prompt (ruído virando texto), não uma pessoa chamando
  return hit && count < 3 ? { ...hit, count } : null;
}

const flatOf = (text: string) => { let flat = ""; const map: number[] = []; for (let i = 0; i < text.length; i++) for (const c of strip(text[i]!)) { flat += c; map.push(i); } return { flat, map }; };

export const heardWake = (text: string): boolean => find(flatOf(text).flat) !== null;
/** O que foi dito depois da palavra de ativação ("Orion, que horas são?" → "que horas são?"), mantendo os acentos do texto original. */
export const afterWake = (text: string): string => {
  const { flat, map } = flatOf(text), m = find(flat);
  if (!m) return "";
  const end = (map[m.end - 1] ?? text.length - 1) + 1;
  return text.slice(end).replace(/^[\s,.:;!?-]+/, "").trim();
};

export const wakeEnabled = (): boolean => { try { return localStorage.getItem("presence.voz.chamar") === "1"; } catch { return false; } };
export const setWakeEnabled = (v: boolean) => { try { localStorage.setItem("presence.voz.chamar", v ? "1" : "0"); } catch { /* sem armazenamento */ } };
