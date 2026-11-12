/**
 * Roteiro de treinamento criado pela IA a partir do que a usuária conta (texto, voz) e dos prints/arquivos que envia.
 * Aqui ficam o formato que a IA devolve, as instruções, a montagem do conteúdo enviado e a conversão para um Script do app.
 * Nada aqui fala com a rede (a chamada fica em training-ai.functions.ts).
 */
import { z } from "zod/v4";
import { COLORS, newId, type Block, type Example, type MediaFile, type Script, type Visual } from "./training-library";

const pin = z.object({
  x: z.number().min(0).max(100).describe("Posição horizontal do ponto, em % da largura da imagem (0 = borda esquerda)."),
  y: z.number().min(0).max(100).describe("Posição vertical do ponto, em % da altura da imagem (0 = topo)."),
  label: z.string().max(60), text: z.string().max(300),
});
const visual = z.object({
  imagem: z.number().int().min(1).describe("Número da imagem enviada (1, 2, 3…), conforme 'Imagem N' no conteúdo."),
  titulo: z.string().max(80), legenda: z.string().max(200),
  pontos: z.array(pin).max(6).describe("Pontos numerados sobre a imagem. Só onde você enxerga o elemento com clareza; senão, deixe vazio."),
});
const example = z.object({
  titulo: z.string().max(80), situacao: z.string().max(300), texto: z.string().max(800),
  categoria: z.string().max(30).describe("Uma palavra: ex. Disparo, Funil, Atendimento, Etiquetas, Configurações."),
});
const block = z.object({
  titulo: z.string().min(1).max(100),
  minutos: z.number().int().min(1).max(90),
  falar: z.string().max(1500).describe("O que a pessoa vai FALAR neste bloco, em texto natural de fala (2 a 6 frases)."),
  mostrar: z.array(z.union([z.string().min(1).max(200), z.object({ passo: z.string().min(1).max(200), imagem: z.number().int().min(1).optional().describe("Número da imagem enviada que mostra exatamente este passo (vira um botão que abre a imagem na apresentação).") })])).min(1).max(10)
    .describe("Passos curtos que aparecem na tela, cada um começando com verbo no infinitivo, na ordem em que são feitos. Use { passo, imagem } quando um print mostra aquele passo."),
  dica: z.string().max(600).optional().describe("Lembretes só para o apresentador (a turma não vê). Ex.: 'Não esquecer de avisar que o número precisa estar com +55'."),
  porque: z.array(z.string().max(250)).max(5).optional().describe("Por que isso importa no dia a dia (só se a usuária deu motivo ou for evidente)."),
  situacao: z.object({ situacao: z.string().max(300), antes: z.string().max(400), depois: z.string().max(400), rotuloAntes: z.string().max(30).optional(), rotuloDepois: z.string().max(30).optional() }).optional(),
  perguntas: z.array(z.object({ pergunta: z.string().max(200), resposta: z.string().max(500) })).max(4).optional(),
  imagens: z.array(visual).max(3).optional(),
  exemplos: z.array(example).max(3).optional(),
});
export const draftSchema = z.object({
  titulo: z.string().min(1).max(120),
  publico: z.string().max(120).describe("Para quem é o treinamento."),
  objetivo: z.string().max(400).describe("O que a pessoa sabe fazer ao final."),
  blocos: z.array(block).min(1).max(12),
  duvidas: z.array(z.string().max(300)).max(8).describe("O que ficou faltando ou ambíguo e a usuária deve conferir. Nunca invente para preencher."),
});
export type Draft = z.infer<typeof draftSchema>;

export const TOOL_NAME = "montar_roteiro";
export const toolSchema = () => { const { $schema: _s, ...rest } = z.toJSONSchema(draftSchema, { target: "draft-2020-12" }) as Record<string, unknown>; return rest; };

export const SYSTEM = `Você monta ROTEIROS DE TREINAMENTO para a usuária apresentar em slides ou gravar em vídeo. Ela descreve do jeito dela (às vezes bagunçado) o que precisa ensinar e envia prints e arquivos. Você organiza tudo e chama a função ${TOOL_NAME}.
Regras:
- Blocos na ORDEM EXATA em que as tarefas são feitas (do primeiro ao último passo). Geralmente 4 a 8 blocos; cada bloco é uma etapa completa que se explica de uma vez.
- "mostrar": passos curtos, cada um começando com verbo (Importar a base, Marcar a coluna do telefone…). "falar": como se fala em voz alta, natural, sem repetir a lista inteira.
- Todo aviso importante que a usuária mencionar (ex.: "o número tem que ter +55", "a planilha precisa ter a coluna igual à variável do template") DEVE aparecer no bloco certo: como passo em "mostrar" e como lembrete em "dica".
- NÃO invente telas, botões, menus ou funções que ela não citou e que não aparecem nas imagens. Se faltar informação, escreva em "duvidas" (ex.: "Qual o nome exato do menu de importação?").
- Quando um print mostra exatamente um passo, ligue-o ao passo com { passo, imagem: N } em "mostrar": na apresentação o passo vira um botão que abre aquela imagem. Cada imagem pode servir a um passo e também aparecer em "imagens" com pontos.
- Use "imagens" só com as imagens enviadas (campo imagem = número). Pontos: coordenadas em % do canto superior esquerdo, no centro do elemento, e apenas para o que você vê com clareza.
- "exemplos": modelos prontos que ela citou (texto de mensagem, nome de etiqueta). Não crie exemplos soltos.
- "situacao" (antes/depois), "porque" e "perguntas": só se houver base no que ela contou. Melhor menos e correto.
- Português do Brasil. Se ela deu o nome ou o público, use exatamente.`;

export type BriefFile = { name: string; mime: string; data: string };
type Part = { type: string; [k: string]: unknown };

/** Conteúdo enviado à IA: cada imagem vem rotulada "Imagem N" (a mesma numeração que a IA devolve). */
export function briefContent(brief: string, files: BriefFile[], hints: { title?: string; audience?: string }): Part[] {
  const parts: Part[] = [];
  let n = 0;
  for (const f of files) {
    if (f.mime.startsWith("image/")) { n++; parts.push({ type: "input_text", text: `Imagem ${n}: ${f.name}` }, { type: "input_image", image_url: `data:${f.mime};base64,${f.data}`, detail: "high" }); }
    else if (f.mime === "application/pdf") parts.push({ type: "input_file", filename: f.name, file_data: `data:application/pdf;base64,${f.data}` });
    else parts.push({ type: "input_text", text: `Arquivo "${f.name}":\n${new TextDecoder().decode(Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0))).slice(0, 40_000)}` });
  }
  const lines = [hints.title ? `Nome do roteiro: ${hints.title}` : "", hints.audience ? `Público: ${hints.audience}` : "", `O QUE ELA CONTOU:\n${brief.trim()}`].filter(Boolean);
  parts.push({ type: "input_text", text: lines.join("\n") });
  return parts;
}

const trim = (s: string | undefined) => (s ?? "").trim();
export const showItem = (i: Draft["blocos"][number]["mostrar"][number]) => (typeof i === "string" ? { passo: i, imagem: undefined } : { passo: i.passo, imagem: i.imagem });
/** Números das imagens que o rascunho usa (em passos ou em "imagens"). */
export const usedImages = (d: Draft): number[] => [...new Set(d.blocos.flatMap((b) => [...(b.imagens ?? []).map((v) => v.imagem), ...b.mostrar.map((m) => showItem(m).imagem).filter((n): n is number => !!n)]))].sort((a, b) => a - b);
const asVisual = (v: NonNullable<Draft["blocos"][number]["imagens"]>[number], path: string): Visual => ({
  img: `storage:${path}`, title: trim(v.titulo) || "Imagem", caption: trim(v.legenda),
  pins: v.pontos.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, label: trim(p.label), text: trim(p.text) })).filter((p) => p.label || p.text),
});

/** Converte o rascunho da IA em um roteiro do app. `images[n-1]` é o arquivo guardado da "Imagem n". */
export function buildScript(draft: Draft, opts: { images: (MediaFile | undefined)[]; folder?: string | undefined; color?: string | undefined; title?: string | undefined; audience?: string | undefined }): { script: Script; examples: Example[] } {
  const examples: Example[] = [];
  const blocks: Block[] = draft.blocos.map((b) => {
    const exIds = (b.exemplos ?? []).map((e) => {
      const ex: Example = { id: newId("e"), title: trim(e.titulo) || "Exemplo", situation: trim(e.situacao), text: trim(e.texto), cat: trim(e.categoria) || "Geral", color: opts.color ?? "cyan" };
      examples.push(ex); return ex.id;
    });
    const visuals = (b.imagens ?? []).flatMap((v) => { const img = opts.images[v.imagem - 1]; return img ? [asVisual(v, img.path)] : []; });
    const items = b.mostrar.map(showItem).map((x) => ({ text: trim(x.passo), file: x.imagem ? opts.images[x.imagem - 1] : undefined })).filter((x) => x.text);
    const media: Record<string, MediaFile[]> = {};
    items.forEach((x, i) => { if (x.file) media[String(i)] = [x.file]; });
    const sc = b.situacao;
    return {
      id: newId("b"), title: trim(b.titulo), minutes: b.minutos, show: items.map((x) => x.text), media: Object.keys(media).length ? media : undefined, examples: exIds,
      say: trim(b.falar) || undefined, tip: trim(b.dica) || undefined,
      why: b.porque?.length ? b.porque.map(trim).filter(Boolean) : undefined,
      scenario: sc && (trim(sc.situacao) || trim(sc.antes) || trim(sc.depois)) ? { situation: trim(sc.situacao), before: trim(sc.antes), after: trim(sc.depois), beforeLabel: trim(sc.rotuloAntes) || "Antes", afterLabel: trim(sc.rotuloDepois) || "Depois" } : undefined,
      faq: b.perguntas?.length ? b.perguntas.map((q) => ({ q: trim(q.pergunta), a: trim(q.resposta) })).filter((q) => q.q) : undefined,
      visuals: visuals.length ? visuals : undefined,
    };
  });
  const script: Script = {
    id: newId("s"), title: trim(opts.title) || trim(draft.titulo), audience: trim(opts.audience) || trim(draft.publico), goal: trim(draft.objetivo),
    color: opts.color ?? COLORS[Math.floor(Math.random() * COLORS.length)]!, blocks, folder: opts.folder?.trim() || undefined,
  };
  return { script, examples };
}
