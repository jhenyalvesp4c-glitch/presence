/** "Ok Orion, muito obrigada", "pode fechar", "não preciso mais": a pessoa dispensou o que está na tela. Pura, testada. */
const norm = (t: string) => ` ${t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()} `;

const PATTERNS: RegExp[] = [
  /\bobrigad[oa]s?\b/, /\bvaleu\b/, /\bvalew\b/, /\bagradec/, /\bmuito bem\b/, /\btchau\b/, /\bate (mais|logo|amanha)\b/,
  /\b(pode|podes) (fechar|sumir|tirar|esconder)\b/, /\b(fecha|feche|fechar) (isso|isto|essa tela|a tela|esse painel|o painel|tudo)\b/, /\bpode fechar\b/,
  /\bnao (preciso|precisa|quero) mais\b/, /\bja (vi|entendi|deu|chega|basta)\b/, /\b(isso|era) (so|tudo)\b/, /\bpode parar\b/, /\bdeixa (pra la|assim)\b/,
];
/** Pedidos de verdade junto com o "obrigada" (ex.: "obrigada, agora me mostra as tarefas") NÃO fecham: o painel novo substitui o antigo. */
const REQUEST = /\b(mostra|mostre|abre|abra|cria|crie|anota|marca|me diz|me fala|qual|quais|quanto|quando|quem|onde|como|busca|procura|tem )\b/;

export function isDismiss(text: string): boolean {
  const t = norm(text);
  if (t.trim().length < 3 || t.length > 160) return false;
  if (REQUEST.test(t)) return false;
  return PATTERNS.some((r) => r.test(t));
}

/** Agradeceu ou se despediu: depois da resposta curta ("de nada, pode contar comigo") o Orion para de ouvir. "Pode fechar" sozinho só fecha a tela e continua ouvindo. */
const GOODBYE: RegExp[] = [/\bobrigad[oa]s?\b/, /\bvaleu\b/, /\bvalew\b/, /\bagradec/, /\btchau\b/, /\bate (mais|logo|amanha)\b/, /\bnao (preciso|precisa|quero) mais\b/, /\b(isso|era|e) (so|tudo)\b/, /\bpode (parar|encerrar)\b/, /\bpor enquanto (e|eh) so\b/, /\bja deu\b/];
export function endsConversation(text: string): boolean {
  const t = norm(text);
  if (t.trim().length < 3 || t.length > 160 || REQUEST.test(t) || /\?/.test(text)) return false;
  if (!GOODBYE.some((r) => r.test(t))) return false;
  // sobrou algo além de "ok, Orion, muito obrigada"? então tem um pedido junto ("valeu, e o financeiro") e a conversa continua
  let rest = t;
  for (const r of GOODBYE) rest = rest.replace(new RegExp(r.source, "g"), " ");
  const words = rest.split(" ").filter((w) => w && !FILLER.has(w));
  return words.length <= 1;
}
const FILLER = new Set(["ok", "orion", "muito", "muitissimo", "ta", "tah", "beleza", "certo", "entao", "por", "favor", "tudo", "bem", "de", "nada", "pra", "voce", "vc", "viu", "ne", "mesmo", "demais", "mais"]);
