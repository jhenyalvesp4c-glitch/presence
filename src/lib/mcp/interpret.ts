/**
 * Interpretação da Central de entrada: manda o texto, os prints, PDFs e documentos para o Claude junto com
 * os projetos, polos (dossiês) e categorias REAIS do Presence, e recebe de volta registros estruturados.
 * Nada é gravado aqui. O cliente do Claude entra por parâmetro (`create`), o que deixa o fluxo testável.
 */
import { z } from "zod/v4";
import { rascunhoSchema } from "./records";
import type { ProjectInfo, DossierInfo, CategoryInfo } from "./lookup";

export const MODEL = "claude-opus-5-5";
export const MAX_ROUNDS = 3;

export const itemSchema = z.object({
  registro: rascunhoSchema,
  anexos: z.array(z.string().max(200)).max(6).optional().describe("Nomes dos arquivos enviados que servem de evidência desta demanda (só para registros do tipo demanda)."),
  motivo: z.string().max(300).optional().describe("Em uma frase: por que classificou neste módulo."),
});
export const outputSchema = z.object({
  resumo: z.string().max(600).describe("Resumo curto do que foi entendido."),
  itens: z.array(itemSchema).max(12).describe("Registros identificados. Vazio se faltar informação para qualquer registro."),
  duvidas: z.array(z.string().max(300)).max(10).describe("Perguntas à usuária quando algo não está claro (projeto, polo, data…). Nunca preencha por suposição."),
  pendencias: z.array(z.string().max(300)).max(10).describe("Informações que ficaram faltando ou que ela precisa providenciar."),
});
export type Output = z.infer<typeof outputSchema>;

export const TOOL_NAME = "organizar_informacoes";
const toolSchema = () => { const { $schema: _s, ...rest } = z.toJSONSchema(outputSchema, { target: "draft-2020-12" }) as Record<string, unknown>; return rest; };

export type InputFile = { name: string; mime: string; data: string };
export type Context = { today: string; weekday: string; projects: (ProjectInfo & { dossiers: DossierInfo[] })[]; categories: CategoryInfo[] };

export const SYSTEM = `Você é o classificador de entrada do Presence, o assistente pessoal e de projetos da usuária. Ela cola textos e envia prints, imagens, PDFs e documentos. Você transforma isso em REGISTROS estruturados para os módulos do Presence. Você NÃO grava nada: chame a ferramenta ${TOOL_NAME}; a usuária revisa, edita e confirma tudo antes.

COMO DECIDIR O DESTINO
- demanda: pedido de trabalho a executar dentro de um projeto. escopo "geral" (sem polo), "polo" (um polo/dossiê) ou "multipolo" (vários, cada um com andamento próprio). Passos a cumprir vão em "checklist"; quem deve fazer em "responsavel".
- compromisso: evento com data/horário (reunião, treinamento, consulta). "profissional" exige projeto; "pessoal" não leva projeto. Se for sobre uma demanda desta mesma entrada, ligue com demanda: "ref:<ref>".
- lembrete: algo para recordar em certo momento (com ou sem horário).
- tarefa: atividade pessoal ou avulsa que NÃO é demanda de projeto (categorias: rotina, comp, auto, saude, trab, casa, fin, pes). Atividade pessoal nunca vira demanda.
- rotina: hábito que se repete TODO DIA em um horário.
- anotacao: registro, observação ou contexto a guardar em um projeto (opcionalmente de um polo).
- documentacao: procedimento, orientação ou conhecimento a guardar para consulta futura (por projeto).
- Prints/arquivos que comprovam ou explicam uma demanda: não crie registro para eles; liste o nome do arquivo em "anexos" da demanda.
Uma entrada pode gerar vários itens relacionados (ex.: demanda + reunião + lembrete). Use "ref" e "ref:<ref>" para ligá-los. Não duplique a mesma informação em dois módulos sem necessidade.

REGRAS DE OURO
- Use SOMENTE projetos, polos (dossiês) e categorias da seção DADOS REAIS, com os ids e nomes exatamente como estão. Nunca invente nem "aproxime" um nome.
- Se o conteúdo cita um projeto ou polo que não existe, ou se há mais de uma possibilidade, deixe esse campo de fora e escreva a pergunta em "duvidas". Se faltar o projeto de uma demanda, não preencha: pergunte.
- Datas em AAAA-MM-DD e horas em HH:MM (24h, fuso de São Paulo). Resolva "amanhã", "sexta" etc. a partir de "Hoje". Se a data for ambígua, pergunte.
- Leia os prints e documentos com atenção: o texto dentro das imagens também é conteúdo.
- Não registre senhas, tokens ou dados de acesso; avise nas pendências se aparecerem.
- Responda SEMPRE chamando a ferramenta ${TOOL_NAME}, mesmo que só haja dúvidas (itens vazio). Escreva em português do Brasil.`;

export function contextText(c: Context): string {
  const projs = c.projects.map((p) => {
    const list = p.dossiers.length ? p.dossiers.map((d) => d.nome).join("; ") : "(nenhum cadastrado)";
    return `- projeto_id: ${p.id} | nome: ${p.nome} | os dossiês deste projeto se chamam "${p.rotulo_dossie.plural}": ${list}`;
  });
  return `DADOS REAIS
Hoje: ${c.weekday}, ${c.today} (São Paulo).
Projetos e seus polos/dossiês:
${projs.join("\n") || "(nenhum projeto)"}
Categorias de tarefa (slug): ${c.categories.map((x) => `${x.slug} (${x.nome})`).join(", ")}`;
}

type Block = { type: string; [k: string]: unknown };
export type Message = { stop_reason: string | null; content: Block[] };
export type Create = (params: Record<string, unknown>) => Promise<Message>;

export function userContent(text: string, files: InputFile[]): Block[] {
  const blocks: Block[] = [];
  for (const f of files) {
    if (f.mime.startsWith("image/")) blocks.push({ type: "image", source: { type: "base64", media_type: f.mime, data: f.data } });
    else if (f.mime === "application/pdf") blocks.push({ type: "document", title: f.name, source: { type: "base64", media_type: "application/pdf", data: f.data } });
    else blocks.push({ type: "text", text: `Arquivo "${f.name}":\n${Buffer.from(f.data, "base64").toString("utf-8").slice(0, 60_000)}` });
  }
  const names = files.map((f) => f.name);
  blocks.push({ type: "text", text: `${names.length ? `Arquivos enviados: ${names.join(", ")}.\n\n` : ""}${text.trim() || "(sem texto digitado: considere só os arquivos)"}` });
  return blocks;
}

export type Interpreted = { ok: true; output: Output } | { ok: false; error: string };

export async function interpret(create: Create, input: { text: string; files: InputFile[] }, ctx: Context): Promise<Interpreted> {
  const messages: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: userContent(input.text, input.files) }];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const res = await create({
      model: MODEL, max_tokens: 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: contextText(ctx) }],
      tools: [{ type: "custom", name: TOOL_NAME, description: "Devolve os registros identificados, dúvidas e pendências para a usuária revisar.", input_schema: toolSchema() }],
      messages,
    });
    if (res.stop_reason === "refusal") return { ok: false, error: "A IA recusou interpretar este conteúdo." };
    if (res.stop_reason === "max_tokens") return { ok: false, error: "O conteúdo é grande demais para interpretar de uma vez. Envie em partes." };
    const use = res.content.find((b) => b.type === "tool_use" && b["name"] === TOOL_NAME);
    messages.push({ role: "assistant", content: res.content });
    if (!use) {
      messages.push({ role: "user", content: `Responda chamando a ferramenta ${TOOL_NAME}.` });
      continue;
    }
    const parsed = outputSchema.safeParse(use["input"]);
    if (parsed.success) return { ok: true, output: parsed.data };
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`).join("; ");
    messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: use["id"], is_error: true, content: `Formato inválido: ${issues}. Corrija e chame a ferramenta de novo.` }] });
  }
  return { ok: false, error: "A IA não conseguiu organizar este conteúdo. Tente de novo ou escreva um pouco mais." };
}
