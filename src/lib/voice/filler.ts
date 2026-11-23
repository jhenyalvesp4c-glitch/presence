/** Frase curta falada quando o Orion vai demorar (consultar, pesquisar, mexer em algo), para nunca ficar em silêncio. Pura, sem IA. */
const LOOKUP = new Set(["buscar_no_orion", "consultar_registros", "resumo_do_dia", "whatsapp_mencoes", "financeiro", "planejamento", "analise_corporal", "acerto", "ideias"]);
const WHATS = new Set(["whatsapp_ler", "whatsapp_conversas", "whatsapp_marcar_lidas"]);
const DOING = new Set(["registrar", "atualizar_demanda", "gerenciar_tarefa", "documentar", "lembrar", "esquecer", "lista", "roteiro"]);

const VERIFY = ["Já estou buscando.", "Vou dar uma olhada para você.", "Deixa eu ver isso.", "Estou procurando aqui."];
const OPENING = ["Já estou abrindo o WhatsApp.", "Vou olhar o WhatsApp agora."];
const WORKING = ["Pode deixar, já estou fazendo.", "Certo, já estou cuidando disso.", "Estou fazendo agora."];

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
export const SLOW_FILLER = "Só um instante.";
export const SLOW_AFTER_MS = 4500;
