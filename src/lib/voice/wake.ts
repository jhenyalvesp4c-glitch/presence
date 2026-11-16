/** Palavra de ativação ("Presence"), como "Alexa": detecção por texto e a preferência de ligar/desligar. */
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Como o reconhecimento costuma escrever "Presence" falado em português ou inglês: presence, presens, prisens, presença, prezens… */
const WAKE = /(?<![a-z])pr[eiy]+[sz]+[eiy]*n[cs][eai]?s?(?![a-z])/;

export const heardWake = (text: string): boolean => WAKE.test(strip(text));
/** O que foi dito depois da palavra de ativação ("Presence, que horas são?" → "que horas são?"), mantendo os acentos do texto original. */
export const afterWake = (text: string): string => {
  let flat = ""; const map: number[] = [];
  for (let i = 0; i < text.length; i++) for (const c of strip(text[i]!)) { flat += c; map.push(i); }
  const m = WAKE.exec(flat);
  if (!m) return "";
  const end = (map[m.index + m[0].length - 1] ?? text.length - 1) + 1;
  return text.slice(end).replace(/^[\s,.:;!?-]+/, "").trim();
};

export const wakeEnabled = (): boolean => { try { return localStorage.getItem("presence.voz.chamar") === "1"; } catch { return false; } };
export const setWakeEnabled = (v: boolean) => { try { localStorage.setItem("presence.voz.chamar", v ? "1" : "0"); } catch { /* sem armazenamento */ } };
