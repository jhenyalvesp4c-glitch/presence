/**
 * Central de entrada (tela inicial): tipos e funções puras compartilhadas entre a tela e o servidor.
 * Cada "item" é um rascunho de registro que o usuário revisa antes de ir para o módulo certo.
 */
import { TIPO_LABEL, type Tipo } from "./mcp/records";

/** Rascunho editável. Só vira registro de verdade depois da validação no servidor. */
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
export type Draft = { tipo: Tipo; [campo: string]: Json };
export type InboxItem = { key: string; registro: Draft; anexos?: string[]; motivo?: string; duplicadoOk?: boolean };
export type InboxFile = { name: string; mime: string; size: number; data: string };

export const MAX_FILES = 6;
export const MAX_TOTAL_CHARS = 4_000_000; // base64 somado; o limite de corpo da função na Vercel é 4,5 MB
export const MAX_TEXT_FILE_CHARS = 60_000;

/** Destinos, na ordem em que aparecem na revisão. */
export const DESTINOS: { tipo: Tipo; label: string; sub: string; cor: string }[] = [
  { tipo: "demanda", label: "Demandas", sub: "Projeto · polo · dossiê", cor: "cyan" },
  { tipo: "compromisso", label: "Calendário", sub: "Eventos e compromissos", cor: "violet" },
  { tipo: "lembrete", label: "Lembretes", sub: "Para recordar", cor: "amber" },
  { tipo: "tarefa", label: "Tarefas", sub: "Minhas Tarefas", cor: "emerald" },
  { tipo: "rotina", label: "Rotinas", sub: "Todo dia", cor: "pink" },
  { tipo: "anotacao", label: "Anotações", sub: "Notas do projeto", cor: "amber" },
  { tipo: "documentacao", label: "Documentação", sub: "Procedimentos e orientações", cor: "violet" },
  { tipo: "evidencia", label: "Evidências", sub: "Anexos de uma demanda", cor: "cyan" },
];

export const newKey = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const text = (v: unknown) => (typeof v === "string" ? v : "");
const clean = (o: Record<string, unknown>): Draft => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length))) as Draft;

export const titleOf = (d: Draft) => text(d["titulo"]) || text(d["texto"]) || "";

/** Muda o destino de um rascunho aproveitando o que já foi preenchido (corrigir uma classificação errada). */
export function convertTipo(d: Draft, to: Tipo): Draft {
  if (d.tipo === to) return d;
  const title = titleOf(d);
  const projeto = text(d["projeto_id"]);
  const dossie = text(d["dossie"]);
  const data = text(d["data"]) || text(d["prazo"]);
  const hora = text(d["hora"]) || text(d["inicio"]);
  const detalhe = text(d["descricao"]) || text(d["detalhes"]) || (d.tipo === "anotacao" || d.tipo === "documentacao" ? text(d["texto"]) : "");
  const keep = typeof d["ref"] === "string" ? { ref: d["ref"] } : {};
  switch (to) {
    case "demanda": return clean({ ...keep, tipo: "demanda", projeto_id: projeto, escopo: dossie ? "polo" : "geral", dossie, titulo: title, descricao: detalhe, prazo: data, prioridade: d["prioridade"] });
    case "compromisso": return clean({ ...keep, tipo: "compromisso", titulo: title, escopo: projeto ? "profissional" : "pessoal", projeto_id: projeto, dossie, data, inicio: hora, fim: d["fim"], local: d["local"], descricao: detalhe });
    case "lembrete": return clean({ ...keep, tipo: "lembrete", texto: title, data, hora, projeto_id: projeto, dossie, detalhes: detalhe, prioridade: d["prioridade"] });
    case "tarefa": return clean({ ...keep, tipo: "tarefa", titulo: title, descricao: detalhe, categoria: d["categoria"], prioridade: d["prioridade"], data, hora });
    case "rotina": return clean({ ...keep, tipo: "rotina", titulo: title, hora, recorrencia: "diaria", descricao: detalhe });
    case "anotacao": return clean({ ...keep, tipo: "anotacao", projeto_id: projeto, dossie, texto: [title, detalhe].filter(Boolean).join("\n") });
    case "documentacao": return clean({ ...keep, tipo: "documentacao", projeto_id: projeto, titulo: title, texto: detalhe || title, categoria: d["categoria"] });
    case "evidencia": return d;
  }
}

/** Dá um `ref` a cada demanda que vai receber anexos, para a evidência apontar para ela. */
export function withRefs(items: InboxItem[]): InboxItem[] {
  let n = 0;
  return items.map((it) => (it.registro.tipo === "demanda" && it.anexos?.length && !it.registro["ref"] ? { ...it, registro: { ...it.registro, ref: `dem${++n}` } } : it));
}

/**
 * Lista final de registros: os itens + uma evidência por arquivo anexado a cada demanda.
 * `owner[i]` diz de qual item (cartão) veio o registro i. Com `placeholder`, os arquivos reais não são
 * necessários (usado só para validar).
 */
export function buildRecords(items: InboxItem[], files: InboxFile[], opts: { placeholder?: boolean } = {}): { records: Draft[]; owner: number[] } {
  const records: Draft[] = [];
  const owner: number[] = [];
  withRefs(items).forEach((it, idx) => {
    const reg: Draft = it.duplicadoOk ? { ...it.registro, permitir_duplicado: true } : it.registro;
    records.push(reg); owner.push(idx);
    if (it.registro.tipo !== "demanda") return;
    for (const nome of it.anexos ?? []) {
      const f = files.find((x) => x.name === nome);
      if (!f && !opts.placeholder) continue;
      const mime = f?.mime ?? "application/octet-stream";
      const base = { tipo: "evidencia" as const, projeto_id: it.registro["projeto_id"], demanda: `ref:${String(it.registro["ref"])}`, mime };
      const isText = mime.startsWith("text/");
      const body = opts.placeholder ? { nome, conteudo_base64: "AAAA" } : isText ? { texto: new TextDecoder().decode(Uint8Array.from(atob(f!.data), (c) => c.charCodeAt(0))) } : { nome: f!.name, conteudo_base64: f!.data };
      records.push({ ...base, ...body } as Draft); owner.push(idx);
    }
  });
  return { records, owner };
}

/** "#3 Demanda: ..." -> mapa índice(0) -> mensagens. */
export function messagesByIndex(lines: string[]): { byIndex: Map<number, string[]>; general: string[] } {
  const byIndex = new Map<number, string[]>();
  const general: string[] = [];
  for (const l of lines) {
    const m = /^#(\d+)\s+[^:]*:\s*(.*)$/s.exec(l);
    if (!m) { general.push(l); continue; }
    const i = Number(m[1]) - 1;
    byIndex.set(i, [...(byIndex.get(i) ?? []), m[2]!]);
  }
  return { byIndex, general };
}

const val = (v: unknown): string => (Array.isArray(v) ? v.join(", ") : v === undefined || v === null ? "" : String(v));

/** Texto organizado para copiar (Markdown), agrupado por destino. */
export function itemsToMarkdown(items: InboxItem[], names: { project: (id: string) => string }): string {
  const parts: string[] = [];
  for (const dest of DESTINOS) {
    const list = items.filter((i) => i.registro.tipo === dest.tipo);
    if (!list.length) continue;
    parts.push(`## ${dest.label}`);
    for (const it of list) {
      const d = it.registro;
      const lines = [`- **${titleOf(d)}**`];
      const add = (k: string, label: string, f: (v: string) => string = (x) => x) => { const v = val(d[k]); if (v) lines.push(`  - ${label}: ${f(v)}`); };
      add("projeto_id", "Projeto", names.project);
      add("escopo", "Escopo"); add("dossie", "Polo/dossiê"); add("dossies", "Polos/dossiês");
      add("data", "Data"); add("prazo", "Prazo"); add("inicio", "Início"); add("fim", "Fim"); add("hora", "Hora"); add("local", "Local");
      add("categoria", "Categoria"); add("prioridade", "Prioridade"); add("responsavel", "Responsável");
      add("descricao", "Descrição"); add("detalhes", "Detalhes"); add("situacao", "Situação");
      if (d.tipo === "anotacao" || d.tipo === "documentacao") add("texto", "Texto");
      if (Array.isArray(d["checklist"]) && d["checklist"].length) lines.push(`  - Checklist: ${(d["checklist"] as string[]).map((c) => `[ ] ${c}`).join("; ")}`);
      if (it.anexos?.length) lines.push(`  - Anexos: ${it.anexos.join(", ")}`);
      parts.push(lines.join("\n"));
    }
    parts.push("");
  }
  return parts.join("\n").trim();
}

export const destinoLabel = (t: Tipo) => TIPO_LABEL[t];
