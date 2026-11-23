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
