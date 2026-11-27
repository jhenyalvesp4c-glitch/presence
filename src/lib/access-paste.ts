/** Lê acessos colados em texto livre (lista numerada ou blocos separados por linha em branco). Tudo local: as senhas nunca saem do navegador. */
export type PastedAccess = { name: string; kind: string; user: string; pass: string };

const KEY: [RegExp, keyof PastedAccess][] = [
  [/^(tipo(\s+de\s+acesso)?|perfil|fun[cç][aã]o|cargo|acesso)$/i, "kind"],
  [/^(e-?mail|login|usu[aá]rio|user(name)?|conta)$/i, "user"],
  [/^(senha|password|pass|senha\s+provis[oó]ria)$/i, "pass"],
  [/^nome$/i, "name"],
];
const clean = (l: string) => l.replace(/^[\s*•·▪◦–—-]+/, "").replace(/\*\*/g, "").trim();
const EMAIL = /[^\s@<>,;:()]+@[^\s@<>,;:()]+\.[^\s@<>,;:()]+/;
const TRIM = /^[\s\-–—/|:;,]+|[\s\-–—/|:;,]+$/g;
const blank = (): PastedAccess => ({ name: "", kind: "", user: "", pass: "" });

export function parseAccessPaste(text: string): PastedAccess[] {
  const out: PastedAccess[] = [];
  let cur: PastedAccess | null = null;
  const flush = () => { if (cur && (cur.user || cur.pass)) out.push(cur); cur = null; };
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    if (!raw.trim()) { if (cur && (cur.user || cur.pass)) flush(); continue; }
    const numbered = /^\s*\d+\s*[.)\-–]\s*(.+)$/.exec(raw);
    if (numbered && !/[:：]/.test(numbered[1]!)) { flush(); cur = { ...blank(), name: clean(numbered[1]!) }; continue; }
    const line = clean(numbered ? numbered[1]! : raw), m = /^([^:：]{1,30})[:：]\s*(.*)$/.exec(line);
    const hit = m ? KEY.find(([re]) => re.test(m[1]!.trim())) : undefined;
    if (m && hit) {
      if (!cur) cur = blank();
      const field = hit[1];
      // um novo "Nome:"/"E-mail:" depois de a pessoa já estar completa começa outra pessoa
      if ((field === "name" && cur.name) || (field === "user" && cur.user && cur.pass)) { flush(); cur = blank(); }
      cur[field] = m[2]!.trim();
      continue;
    }
    // sem rótulo: o que tem "@" é o e-mail; depois dele vem a senha; antes, o nome (e, se houver mais uma linha, o tipo)
    const em = EMAIL.exec(line);
    if (em) {
      if (cur && cur.user) flush();
      if (!cur) cur = blank();
      cur.user = em[0];
      const before = line.slice(0, em.index).replace(TRIM, ""), after = line.slice(em.index + em[0].length).replace(TRIM, "").replace(/^(senha|password|pass)(\s*:\s*|\s+)/i, "");
      if (before && !cur.name) cur.name = before;
      if (after) cur.pass = after;
      continue;
    }
    if (!cur) { cur = { ...blank(), name: line }; continue; }
    if (cur.user && !cur.pass) { cur.pass = line; continue; }
    if (cur.user && cur.pass) { flush(); cur = { ...blank(), name: line }; continue; }
    if (!cur.name) cur.name = line; else if (!cur.kind) cur.kind = line;
  }
  flush();
  return out;
}

/** Como o acesso vira os campos da ficha: "Onde" = (sistema ·) tipo; usuário = e-mail; observação = nome. */
export const accessFields = (a: PastedAccess, system = "") => ({ label: [system.trim(), a.kind].filter(Boolean).join(" · ") || "Acesso", username: a.user, note: a.name, pass: a.pass });
