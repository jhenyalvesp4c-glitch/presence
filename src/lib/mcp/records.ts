/**
 * Registros que o assistente pode propor ao Presence: formato de entrada (zod), validações que não
 * dependem do banco e funções puras (normalização de texto, semelhança, datas, resumo).
 */
import { randomInt } from "node:crypto";
import { z } from "zod/v4";

export const TZ = "America/Sao_Paulo";
export const CATEGORY_SLUGS = ["rotina", "comp", "auto", "saude", "trab", "casa", "fin", "pes"] as const;
export const NOTE_COLORS = ["violet", "cyan", "emerald", "amber", "pink"] as const;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD").describe("Data AAAA-MM-DD");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM (24h)").describe("Hora HH:MM (24h)");
const prio = z.enum(["alta", "media", "baixa"]).describe("Prioridade; use media se não houver indicação.");
const projeto = z.string().min(1).max(80).describe("ID do projeto, exatamente como veio de listar_projetos.");
const demandaRef = z.string().min(1).max(60).describe("Código de uma demanda existente (ex.: #G041) ou 'ref:<ref>' de uma demanda desta mesma proposta.");
const base = {
  ref: z.string().min(1).max(40).optional().describe("Nome local deste registro para outros da mesma proposta apontarem para ele (ex.: 'd1')."),
  permitir_duplicado: z.boolean().optional().describe("Só use depois de o usuário confirmar que quer criar mesmo havendo um registro equivalente."),
};

export const demandaSchema = z.object({
  tipo: z.literal("demanda"), ...base, projeto_id: projeto,
  escopo: z.enum(["geral", "polo", "multipolo"]).describe("geral = sem polo; polo = um único polo/dossiê; multipolo = vários, cada um com andamento próprio."),
  dossie: z.string().max(120).optional().describe("Nome exato do polo/dossiê (escopo polo)."),
  dossies: z.array(z.string().max(120)).max(60).optional().describe("Nomes exatos dos polos/dossiês (escopo multipolo)."),
  titulo: z.string().min(1).max(300), descricao: z.string().max(5000).optional(), prioridade: prio.optional(),
  prazo: date.optional(), checklist: z.array(z.string().min(1).max(300)).max(40).optional().describe("Itens a cumprir; entram na descrição."),
  responsavel: z.string().max(120).optional(),
});
export const compromissoSchema = z.object({
  tipo: z.literal("compromisso"), ...base,
  titulo: z.string().min(1).max(200), descricao: z.string().max(2000).optional(), data: date, inicio: time.optional(), fim: time.optional(),
  local: z.string().max(200).optional(), escopo: z.enum(["pessoal", "profissional"]).describe("profissional exige projeto_id."),
  projeto_id: projeto.optional(), dossie: z.string().max(120).optional(), demanda: demandaRef.optional(),
  cor: z.enum(["cyan", "violet", "emerald", "amber", "pink"]).optional(),
  lembrete_minutos_antes: z.number().int().min(5).max(10080).optional().describe("Cria também um lembrete vinculado, X minutos antes do início (exige inicio)."),
});
export const lembreteSchema = z.object({
  tipo: z.literal("lembrete"), ...base,
  texto: z.string().min(1).max(200).describe("O que lembrar."), detalhes: z.string().max(2000).optional(),
  data: date.optional(), hora: time.optional().describe("Exige data."), prioridade: prio.optional(),
  projeto_id: projeto.optional(), dossie: z.string().max(120).optional(), demanda: demandaRef.optional(),
  compromisso: z.string().max(60).optional().describe("'ref:<ref>' de um compromisso desta proposta."),
  categoria: z.enum(CATEGORY_SLUGS).optional(),
});
export const tarefaSchema = z.object({
  tipo: z.literal("tarefa"), ...base,
  titulo: z.string().min(1).max(200), descricao: z.string().max(2000).optional(),
  categoria: z.enum(CATEGORY_SLUGS).optional().describe("rotina, comp, auto (autocuidado), saude, trab, casa, fin, pes (pessoal)."),
  prioridade: prio.optional(), data: date.optional(), hora: time.optional().describe("Exige data."),
});
export const rotinaSchema = z.object({
  tipo: z.literal("rotina"), ...base,
  titulo: z.string().min(1).max(120), hora: time, descricao: z.string().max(300).optional(),
  recorrencia: z.literal("diaria").describe("Só existe rotina diária no Presence."),
  natureza: z.enum(["habito", "autocuidado", "treino", "financeiro", "pausa", "tarefa", "compromisso", "extra"]).optional(),
});
export const anotacaoSchema = z.object({
  tipo: z.literal("anotacao"), ...base, projeto_id: projeto, dossie: z.string().max(120).optional(),
  texto: z.string().min(1).max(5000), cor: z.enum(NOTE_COLORS).optional(),
});
export const documentacaoSchema = z.object({
  tipo: z.literal("documentacao"), ...base, projeto_id: projeto,
  titulo: z.string().min(1).max(200), situacao: z.string().max(1000).optional().describe("Quando usar / contexto."),
  texto: z.string().min(1).max(5000).describe("O procedimento, orientação ou texto a guardar."),
  categoria: z.string().max(60).optional().describe("Agrupa na biblioteca (ex.: Etiquetas, Funil, Atendimento)."),
});
export const evidenciaSchema = z.object({
  tipo: z.literal("evidencia"), ...base, projeto_id: projeto, demanda: demandaRef,
  nome: z.string().max(200).optional().describe("Nome do arquivo (obrigatório com conteudo_base64)."),
  mime: z.string().max(100).optional(), conteudo_base64: z.string().max(6_000_000).optional().describe("Arquivo ou print em base64 (até 4 MB)."),
  texto: z.string().max(20000).optional().describe("Texto/transcrição a juntar ao corpo da demanda."), legenda: z.string().max(200).optional(),
});

export const registroSchema = z.discriminatedUnion("tipo", [
  demandaSchema, compromissoSchema, lembreteSchema, tarefaSchema, rotinaSchema, anotacaoSchema, documentacaoSchema, evidenciaSchema,
]);
export type Registro = z.infer<typeof registroSchema>;
export type Tipo = Registro["tipo"];

/** Ordem de criação: o que os outros referenciam vem antes. */
export const RANK: Record<Tipo, number> = { demanda: 0, compromisso: 1, tarefa: 2, lembrete: 3, anotacao: 4, documentacao: 5, rotina: 6, evidencia: 7 };
export const TIPO_LABEL: Record<Tipo, string> = {
  demanda: "Demanda", compromisso: "Calendário", lembrete: "Lembrete", tarefa: "Minhas Tarefas", rotina: "Rotina diária", anotacao: "Anotação", documentacao: "Documentação", evidencia: "Evidência",
};

/* ───────────── texto ───────────── */
export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Equivalentes: iguais depois de normalizar, ou muito parecidos (≥ 85% das palavras em comum). */
export function similar(a: string, b: string): boolean {
  const x = normalize(a), y = normalize(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const ta = new Set(x.split(" ")), tb = new Set(y.split(" "));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  return inter / (ta.size + tb.size - inter) >= 0.85;
}

/* ───────────── datas (sempre no fuso de São Paulo) ───────────── */
export const isoDay = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(d);
export const hhmmNow = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
export const weekdayPt = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" }).format(d);
export const ddmm = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d);
export const deadlineLabel = (iso: string | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
export const isRealDate = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso; };
export const minusMinutes = (date: string, hhmm: string, min: number): { date: string; time: string } => {
  const t = new Date(`${date}T${hhmm}:00Z`).getTime() - min * 60_000;
  const d = new Date(t);
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) };
};

export const makeCode = () => String(randomInt(1000, 10000));

/* ───────────── validação sem banco ───────────── */
export const isCode = (s: string) => /^#[GPM]\d+$/.test(s);
export const isRef = (s: string) => s.startsWith("ref:");

/** Problemas que dependem só do próprio registro (o resto é conferido contra o banco). */
export function structuralProblems(r: Registro): string[] {
  const p: string[] = [];
  const need = (ok: boolean, msg: string) => { if (!ok) p.push(msg); };
  switch (r.tipo) {
    case "demanda":
      if (r.escopo === "geral") need(!r.dossie && !(r.dossies?.length), "demanda geral não leva polo/dossiê (use escopo polo ou multipolo)");
      if (r.escopo === "polo") need(!!r.dossie && !(r.dossies?.length), "demanda de um polo precisa de 'dossie' (um só)");
      if (r.escopo === "multipolo") need(!!r.dossies?.length && !r.dossie, "demanda multipolo precisa de 'dossies' (lista de polos)");
      if (r.prazo) need(isRealDate(r.prazo), `prazo inválido: ${r.prazo}`);
      break;
    case "compromisso":
      if (r.escopo === "profissional") need(!!r.projeto_id, "compromisso profissional precisa de projeto_id (pergunte ao usuário qual projeto)");
      if (r.escopo === "pessoal") need(!r.projeto_id && !r.dossie && !r.demanda, "compromisso pessoal não se vincula a projeto/polo/demanda");
      need(isRealDate(r.data), `data inválida: ${r.data}`);
      need(!(r.fim && !r.inicio), "'fim' exige 'inicio'");
      if (r.inicio && r.fim) need(r.fim > r.inicio, "'fim' precisa ser depois de 'inicio'");
      need(!(r.lembrete_minutos_antes && !r.inicio), "lembrete_minutos_antes exige 'inicio'");
      need(!(r.dossie && !r.projeto_id), "dossie exige projeto_id");
      need(!(r.demanda && !r.projeto_id), "demanda exige projeto_id");
      break;
    case "lembrete":
      need(!(r.hora && !r.data), "'hora' exige 'data'");
      if (r.data) need(isRealDate(r.data), `data inválida: ${r.data}`);
      need(!(r.dossie && !r.projeto_id), "dossie exige projeto_id");
      need(!(r.demanda && !r.projeto_id), "demanda exige projeto_id");
      break;
    case "tarefa":
      need(!(r.hora && !r.data), "'hora' exige 'data'");
      if (r.data) need(isRealDate(r.data), `data inválida: ${r.data}`);
      break;
    case "evidencia":
      need(!!r.conteudo_base64 || !!r.texto?.trim(), "evidência precisa de 'conteudo_base64' ou 'texto'");
      if (r.conteudo_base64) {
        need(!!r.nome, "evidência com arquivo precisa de 'nome'");
        need(Math.floor((r.conteudo_base64.length * 3) / 4) <= MAX_FILE_BYTES, "arquivo maior que 4 MB");
      }
      break;
    default:
      break;
  }
  if ("demanda" in r && r.demanda) need(isCode(r.demanda) || isRef(r.demanda), "'demanda' deve ser um código (#G041) ou 'ref:<ref>'");
  return p;
}

/** Referências internas: cada 'ref:x' precisa existir na proposta, ser do tipo certo e não ser circular. */
export function refProblems(list: Registro[]): string[] {
  const byRef = new Map<string, Registro>();
  const p: string[] = [];
  for (const r of list) {
    if (!r.ref) continue;
    if (byRef.has(r.ref)) p.push(`ref repetida: ${r.ref}`);
    byRef.set(r.ref, r);
  }
  const check = (label: string, value: string | undefined, want: Tipo) => {
    if (!value || !isRef(value)) return;
    const t = byRef.get(value.slice(4));
    if (!t) p.push(`${label} aponta para ${value}, que não existe nesta proposta`);
    else if (t.tipo !== want) p.push(`${label} aponta para ${value}, que é ${t.tipo} (esperado ${want})`);
  };
  for (const r of list) {
    if (r.tipo === "compromisso" || r.tipo === "lembrete" || r.tipo === "evidencia") check(`${r.tipo}.demanda`, r.demanda, "demanda");
    if (r.tipo === "lembrete") check("lembrete.compromisso", r.compromisso, "compromisso");
  }
  return p;
}
