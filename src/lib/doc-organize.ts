/** Organiza o que a usuária fala ou escreve (passo a passo solto) em um documento estruturado. Sem rede aqui; a IA fica em doc-organize.functions.ts. */
import { z } from "zod/v4";

export const KINDS_ORGANIZE = ["Tutorial", "Processo", "Guia", "Checklist", "Manual"] as const;
export const organizedSchema = z.object({
  titulo: z.string().min(1).max(120).describe("Título curto e claro do tutorial (ex.: 'Como configurar o horário de atendimento')."),
  descricao: z.string().max(600).describe("Uma ou duas frases: o que a pessoa aprende ou consegue fazer ao final."),
  antes: z.array(z.string().min(1).max(200)).max(8).describe("Antes de começar: pré-requisitos e cuidados que a usuária MENCIONOU. Vazio se não houve."),
  passos: z.array(z.string().min(1).max(300)).min(1).max(40).describe("Passo a passo na ordem em que é feito. Cada passo começa com verbo no infinitivo e tem uma ação só."),
  dicas: z.array(z.string().min(1).max(200)).max(6).optional().describe("Observações ou erros comuns que ela mencionou. Opcional."),
});
export type Organized = z.infer<typeof organizedSchema>;
export const TOOL_NAME = "organizar_passo_a_passo";

export const SYSTEM = `Você organiza explicações faladas ou escritas em um tutorial claro, em português do Brasil.
Regras:
- Use SOMENTE o que a pessoa disse. Não invente passos, telas, botões nem detalhes. Se algo estiver ambíguo, mantenha como foi dito.
- Tire vícios de fala, repetições e "né/tipo", sem mudar o sentido.
- Passos na ordem em que são feitos, cada um com uma ação e verbo no infinitivo (Abrir, Clicar, Escolher…). Junte frases que são a mesma ação; separe ações diferentes.
- "antes" = pré-requisitos e cuidados que ela mencionou (ex.: ter o acesso de administrador). Vazio se não houve.
- Título curto e específico. Descrição em 1 ou 2 frases.
- Nunca inclua senhas, tokens ou dados pessoais: se aparecerem, substitua por [omitido].`;

export const toolSchema = () => ({
  type: "object", additionalProperties: false, required: ["titulo", "descricao", "antes", "passos"],
  properties: {
    titulo: { type: "string" }, descricao: { type: "string" },
    antes: { type: "array", items: { type: "string" } }, passos: { type: "array", items: { type: "string" } }, dicas: { type: "array", items: { type: "string" } },
  },
});

const STARTS = /^(?:passo\s*\d+\s*[:.\-–)]?\s*|\d+\s*[.)\-–:]\s*|[-•*]\s*|primeiro(?:\s*,)?\s*|depois(?:\s*,)?\s*|em seguida(?:\s*,)?\s*|por fim(?:\s*,)?\s*|então(?:\s*,)?\s*|aí(?:\s*,)?\s*|e\s+)/i;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Organização simples, sem IA (usada se a IA estiver desligada ou falhar): separa em passos por linha, numeração ou frase. */
export function localOrganize(text: string): Organized {
  const raw = text.replace(/\r/g, "").trim();
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const parts = (lines.length > 1 ? lines : raw.split(/(?<=[.!?])\s+(?=\S)/)).flatMap((l) => (lines.length > 1 ? [l] : l.split(/\s+(?=(?:depois|em seguida|por fim|aí|então)\b)/i)));
  const clean = (s: string) => cap(s.replace(STARTS, "").replace(STARTS, "").replace(/\s+/g, " ").replace(/[.;,]+$/, "").trim());
  const passos = parts.map(clean).filter((s) => s.length > 2).slice(0, 40);
  const first = passos[0] ?? "Passo a passo";
  return { titulo: first.length > 70 ? `${first.slice(0, 67)}…` : first, descricao: "", antes: [], passos: passos.length ? passos : [clean(raw) || "Passo a passo"] };
}

/** Texto do documento (descrição) a partir do rascunho: descrição + dicas. */
export const descOf = (o: Organized) => [o.descricao.trim(), ...(o.dicas?.length ? ["", "Dicas:", ...o.dicas.map((d) => `• ${d}`)] : [])].join("\n").trim();
