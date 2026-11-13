/** Briefing: o que o Presence sabe sobre a pessoa (como chamar, jeito de conversar, trabalho, rotina) e o que aprende com o tempo. Puro, sem banco. */

export type Greeting = "esperar" | "saudacao" | "saudacao_hoje" | "saudacao_pergunta";
export type Briefing = {
  call_name: string; tone: string; greeting: Greeting; greeting_note: string;
  work: string; biggest_demand: string; routine: string; goals: string; preferences: string; completed_at: string | null;
};
export type MemoryKind = "aprendizado" | "preferencia" | "rotina" | "pessoa" | "regra";
export type Memory = { id: string; text: string; kind: MemoryKind; source: "conversa" | "briefing" | "manual"; created_at: string };

export const EMPTY_BRIEFING: Briefing = { call_name: "", tone: "", greeting: "esperar", greeting_note: "", work: "", biggest_demand: "", routine: "", goals: "", preferences: "", completed_at: null };

export const MEMORY_KINDS: MemoryKind[] = ["aprendizado", "preferencia", "rotina", "pessoa", "regra"];
export const MAX_MEMORIES = 150;

export const TONE_OPTIONS = [
  { v: "Direta e objetiva: vá ao ponto, sem enrolar.", label: "Direta e objetiva", hint: "Respostas curtas, sem rodeios" },
  { v: "Amigável e calorosa, como uma amiga que ajuda.", label: "Amigável e calorosa", hint: "Conversa leve e acolhedora" },
  { v: "Formal e profissional, sempre educada.", label: "Formal e profissional", hint: "Tom de trabalho, respeitoso" },
  { v: "Animada e bem-humorada, com leveza e bom humor.", label: "Animada e bem-humorada", hint: "Um toque de humor no dia" },
  { v: "Calma e tranquila, sem pressa e sem pressão.", label: "Calma e tranquila", hint: "Sem pressão, com serenidade" },
];

export const GREETING_OPTIONS: { v: Greeting; label: string; hint: string }[] = [
  { v: "saudacao_hoje", label: "Cumprimentar e mostrar meu dia", hint: "Já me diz o que tenho para hoje" },
  { v: "saudacao", label: "Só me cumprimentar", hint: "Uma saudação curta e espera eu falar" },
  { v: "saudacao_pergunta", label: "Cumprimentar e perguntar como ajudar", hint: "“Como posso te ajudar hoje?”" },
  { v: "esperar", label: "Esperar eu falar primeiro", hint: "Fica quieto até eu começar" },
];

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/** O briefing está completo o bastante para o Presence usar? (nome e jeito de conversar) */
export const isComplete = (b: Briefing | null): boolean => !!b?.completed_at;

/** Normaliza o que veio da tela antes de gravar. */
export function sanitize(b: Briefing): Briefing {
  const g: Greeting = (["esperar", "saudacao", "saudacao_hoje", "saudacao_pergunta"] as const).includes(b.greeting) ? b.greeting : "esperar";
  return {
    call_name: clean(b.call_name, 60), tone: clean(b.tone, 400), greeting: g, greeting_note: clean(b.greeting_note, 400),
    work: clean(b.work, 1500), biggest_demand: clean(b.biggest_demand, 1500), routine: clean(b.routine, 1500), goals: clean(b.goals, 1500),
    preferences: clean(b.preferences, 1500), completed_at: b.completed_at,
  };
}

/** Bloco do prompt do Presence com tudo que ela sabe sobre a pessoa. Vazio se não há nada. */
export function briefingPrompt(b: Briefing | null, memories: Pick<Memory, "text" | "kind">[]): string {
  const lines: string[] = [];
  if (b?.call_name) lines.push(`- Chame a pessoa de "${b.call_name}" (é assim que ela pediu; use de vez em quando, sem exagero).`);
  if (b?.tone) lines.push(`- Jeito de conversar que ela escolheu: ${b.tone}`);
  if (b?.work) lines.push(`- Com o que ela trabalha: ${b.work}`);
  if (b?.biggest_demand) lines.push(`- O que mais pesa no dia dela / maior demanda: ${b.biggest_demand}`);
  if (b?.routine) lines.push(`- Como é o dia a dia: ${b.routine}`);
  if (b?.goals) lines.push(`- O que ela quer conquistar com o Presence: ${b.goals}`);
  if (b?.preferences) lines.push(`- Preferências e regras que ela pediu para você seguir SEMPRE: ${b.preferences}`);
  const mem = memories.slice(0, 40).map((m) => `- (${m.kind}) ${m.text}`);
  if (!lines.length && !mem.length) return "";
  return [
    "SOBRE A PESSOA COM QUEM VOCÊ FALA (briefing dela; siga à risca e deixe isso moldar o seu jeito de falar e de ajudar):",
    ...lines,
    ...(mem.length ? ["O que você já aprendeu sobre ela ao longo do tempo:", ...mem] : []),
    "Quando ela contar algo duradouro sobre si (preferência, rotina, regra, fato do trabalho) ou corrigir o seu jeito, use a ferramenta lembrar para guardar. Não guarde pedidos do momento.",
  ].join("\n");
}

export const GREET_MARK = "[[inicio]]";

/** Instrução para a primeira fala da conversa, de acordo com o que a pessoa pediu no briefing. */
export function greetingDirective(b: Briefing | null): string {
  const note = b?.greeting_note ? ` Além disso, ela pediu: ${b.greeting_note}` : "";
  switch (b?.greeting) {
    case "saudacao": return `A conversa por voz acabou de começar. Cumprimente a pessoa em UMA frase curta e espere ela falar.${note}`;
    case "saudacao_hoje": return `A conversa por voz acabou de começar. Cumprimente em uma frase e, na mesma resposta, use resumo_do_dia e fale só os destaques do dia dela.${note}`;
    case "saudacao_pergunta": return `A conversa por voz acabou de começar. Cumprimente em uma frase e pergunte como pode ajudar.${note}`;
    default: return "";
  }
}

/** Evita guardar duas vezes quase a mesma coisa. */
export function isDuplicateMemory(text: string, existing: { text: string }[]): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const n = norm(text);
  if (!n) return true;
  return existing.some((m) => { const o = norm(m.text); return o === n || (o.length > 12 && (o.includes(n) || n.includes(o))); });
}
