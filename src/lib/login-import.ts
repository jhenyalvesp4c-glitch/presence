/**
 * Importar logins por polo a partir de um texto colado (ex.: a lista "ACESSOS POLOS" do WhatsApp).
 * Só funções puras: nada aqui grava nem envia nada. As senhas seguem a regra combinada no grupo
 * ("fecaf" + nome do polo), que é o trecho do e-mail entre o @ e o ".com.br".
 */

export type ParsedLogin = {
  email: string; polo: string; owner: string;
  /** Senha pelo padrão "fecaf + polo"; vazia quando o e-mail não segue o padrão. */
  pass: string;
};

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const STOP = new Set(["de", "da", "do", "dos", "das", "e"]);
const flat = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** "Barra da Tijuca" → "barratijuca" (sem acento, espaços nem "de/da/do"). */
const squash = (s: string) => flat(s).split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w)).join("");

export function parseLogins(text: string): ParsedLogin[] {
  const seen = new Set<string>(), out: ParsedLogin[] = [];
  for (const m of text.match(EMAIL) ?? []) {
    const email = m.replace(/[.,;:]+$/, "").toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    const [local, domain = ""] = email.split("@");
    const label = domain.split(".")[0] ?? "";
    const followsPattern = /^fecaf.+/.test(label);
    out.push({
      email,
      polo: followsPattern ? label.slice("fecaf".length) : local?.startsWith("polo.") ? local.slice(5) : "", // "polo.tabuleirodomartins@fecaf.com.br": o polo está no começo
      owner: local && !local.includes(".") ? local[0]!.toUpperCase() + local.slice(1) : "",
      pass: followsPattern ? label : "",
    });
  }
  return out;
}

/** Dossiê cadastrado que corresponde ao trecho do e-mail ("juizfora" → "Juiz de Fora"). Só vale se for UM. */
export function matchDossier(slug: string, names: string[]): string | null {
  const s = squash(slug);
  if (s.length < 3) return null;
  const hit = names.filter((n) => { const k = squash(n); return k === s || k.startsWith(s) || (k.length >= 4 && s.startsWith(k)); });
  return hit.length === 1 ? hit[0]! : null;
}

/** Nome apresentável quando o polo ainda não existe nos dossiês ("vilavelha" fica "Vilavelha": a pessoa ajusta). */
export const prettySlug = (slug: string) => (slug ? slug[0]!.toUpperCase() + slug.slice(1) : "");
