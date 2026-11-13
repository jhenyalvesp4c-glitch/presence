/** Decide se uma mensagem de WhatsApp merece avisar a pessoa: marcação, nome (mesmo escrito errado) ou assunto de CRM. Só texto, sem IA. */

export type Reason = "marcou" | "respondeu" | "nome" | "crm";
export type Rules = { names: string[]; crm: string[]; ignore: string[] };

const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Jheny, Jenny, Jeny, Jhenny, Jheni, Jenni… (com ou sem H, com Y ou I, letras repetidas). Não pega "Jennifer". */
const NAME_RE = /(?<![a-z0-9])j+h*e+n+[iy]+(?![a-z0-9])/;

export const DEFAULT_CRM = [
  "crm", "p4c", "disparo", "disparos", "dispare", "disparar", "envio em massa", "envios em massa", "mensagem em massa", "mensagens em massa",
  "template", "templates", "api oficial", "whatsapp business", "waba", "qr code", "qrcode",
  "usuario", "usuarios", "fila", "filas", "conexao", "conexoes", "reconectar", "integracao", "webhook", "chatbot",
  "permissao", "permissoes", "login", "acesso ao sistema", "plataforma de atendimento",
];
export const DEFAULT_IGNORE = [
  "campanha", "campanhas", "anuncio", "anuncios", "trafego pago", "valor", "valores", "preco", "precos", "orcamento", "verba", "investimento",
  "saldo", "r$", "cpc", "cpl", "roas", "cpm", "criativo", "criativos", "fatura", "boleto", "reembolso",
];

const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const termRe = (terms: string[]) => {
  const t = terms.map((x) => strip(x).trim()).filter(Boolean);
  return t.length ? new RegExp(`(?<![a-z0-9])(?:${t.map(esc).join("|")})(?![a-z0-9])`) : null;
};

/** "Meta" sozinha é comum em outros sentidos (meta do mês): só conta junto de assuntos do CRM da Meta. */
const META_RE = /(?<![a-z0-9])meta(?![a-z0-9]).{0,40}(template|api|verific|business|conta|numero|bloque|qualidade|limite)|(template|api|verific|business|conta|numero|bloque|qualidade|limite).{0,40}(?<![a-z0-9])meta(?![a-z0-9])/;

export function classify(m: { text: string; mentions_me?: boolean; reply_to_me?: boolean; from_me?: boolean }, rules: Rules): Reason | null {
  if (m.from_me) return null;
  if (m.mentions_me) return "marcou";
  if (m.reply_to_me) return "respondeu";
  const t = strip(m.text || "");
  if (!t.trim()) return null;
  if (NAME_RE.test(t)) return "nome";
  const extra = termRe(rules.names);
  if (extra?.test(t)) return "nome";
  const crm = termRe(rules.crm);
  if (!(crm?.test(t) || META_RE.test(t))) return null;
  const ign = termRe(rules.ignore);
  if (ign?.test(t)) return null;
  return "crm";
}

export const reasonText = (r: Reason) => (r === "marcou" ? "te marcou" : r === "respondeu" ? "respondeu a você" : r === "nome" ? "falou o seu nome" : "falou de CRM");
