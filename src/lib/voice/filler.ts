/** Frase curta falada quando o Orion vai demorar (consultar, pesquisar, mexer em algo), para nunca ficar em silêncio. Pura, sem IA. */
const LOOKUP = new Set(["buscar_no_orion", "consultar_registros", "resumo_do_dia", "whatsapp_mencoes", "financeiro"]);
const WHATS = new Set(["whatsapp_ler", "whatsapp_conversas", "whatsapp_marcar_lidas"]);
const DOING = new Set(["registrar", "atualizar_demanda", "gerenciar_tarefa", "documentar", "lembrar", "esquecer", "lista", "roteiro"]);

const VERIFY = ["Estou verificando para você.", "Já estou verificando, só um instante.", "Deixa eu verificar isso para você."];
const OPENING = ["Estou abrindo o seu WhatsApp, só um instante.", "Já estou olhando o seu WhatsApp, um instante."];
const WORKING = ["Pode deixar, já estou fazendo isso.", "Certo, já estou cuidando disso.", "Já estou fazendo, só um instante."];

const pick = <T,>(list: T[], seed: string): T => list[[...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % list.length]!;

/** O que dizer enquanto as ferramentas rodam. Vazio quando a ação é imediata (abrir tela, encerrar) ou o próprio pedido já explica. */
export function fillerFor(toolNames: string[], seed = ""): string {
  const names = toolNames.filter(Boolean);
  if (!names.length) return "";
  if (names.every((n) => !LOOKUP.has(n) && !WHATS.has(n) && !DOING.has(n))) return "";
  if (names.some((n) => WHATS.has(n))) return pick(OPENING, seed);
  if (names.some((n) => LOOKUP.has(n))) return pick(VERIFY, seed);
  return pick(WORKING, seed);
}

/** Frase para quando a resposta está demorando e ainda não se sabe o que será feito. */
export const SLOW_FILLER = "Um instante, estou verificando para você.";
export const SLOW_AFTER_MS = 2200;
