/**
 * Orion (segundo cérebro): funções puras para montar o "acervo" pesquisável e ordenar por relevância.
 * Sem acesso ao banco aqui; quem lê as tabelas é orion.functions.ts.
 */
export type OrionKind = "registro" | "demanda" | "tarefa" | "nota" | "conversa" | "treinamento";

export type OrionDoc = {
  id: string;
  kind: OrionKind;
  title: string;
  text: string;
  /** AAAA-MM-DD, quando houver. */
  date?: string | undefined;
  /** Projeto / dossiê a que o registro se refere (texto livre, entra na busca). */
  where?: string | undefined;
  link: string;
};

export type OrionSource = { n: number; id: string; kind: OrionKind; title: string; snippet: string; date?: string | undefined; where?: string | undefined; link: string };

export const KIND_LABEL: Record<OrionKind, string> = {
  registro: "Anotação", demanda: "Demanda", tarefa: "Tarefa", nota: "Nota", conversa: "Conversa com a assistente", treinamento: "Treinamento",
};

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const STOP = new Set(("a o as os um uma uns umas de do da dos das em no na nos nas por para com sem sobre entre ate que qual quais quando onde como quem " +
  "e ou mas se foi fui era ser tem teve tinha houve eu me meu minha meus minhas voce seu sua ele ela eles elas isso isto esse essa esses essas aquele aquela " +
  "mais menos muito muita ja nao sim so tambem ainda mesmo hoje ontem anteontem semana mes ano dia dias passado passada proximo proxima este esta estes estas " +
  "fiz fez fazer feito feita alguma algum alguns algumas qualquer todo toda todos todas lembro lembrar lembra preciso quero quanto quantas quantos media " +
  "houve aconteceu aconteceram falhas falha").split(" "));

/** Palavras que importam na pergunta (sem acento, sem palavras comuns). */
export function keywords(q: string): string[] {
  const out: string[] = [];
  for (const w of normalize(q).split(" ")) if (w.length >= 3 && !STOP.has(w) && !out.includes(w)) out.push(w);
  return out;
}

const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Período citado na pergunta ("hoje", "ontem", "semana passada", "mês passado"…). `today` = AAAA-MM-DD. */
export function periodOf(q: string, today: string): { from: string; to: string; label: string } | null {
  const n = normalize(q);
  const t = new Date(`${today}T12:00:00Z`);
  const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12));
  if (/\bhoje\b/.test(n)) return { from: today, to: today, label: "hoje" };
  if (/\banteontem\b/.test(n)) { const d = iso(addDays(t, -2)); return { from: d, to: d, label: "anteontem" }; }
  if (/\bontem\b/.test(n)) { const d = iso(addDays(t, -1)); return { from: d, to: d, label: "ontem" }; }
  if (/semana passada/.test(n)) {
    const dow = (t.getUTCDay() + 6) % 7; // segunda = 0
    const mon = addDays(t, -dow - 7);
    return { from: iso(mon), to: iso(addDays(mon, 6)), label: "semana passada" };
  }
  if (/(esta|essa) semana/.test(n)) {
    const dow = (t.getUTCDay() + 6) % 7;
    const mon = addDays(t, -dow);
    return { from: iso(mon), to: iso(addDays(mon, 6)), label: "esta semana" };
  }
  if (/mes passado/.test(n)) {
    const first = monthStart(t);
    const prev = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1, 12));
    return { from: iso(prev), to: iso(addDays(first, -1)), label: "mês passado" };
  }
  if (/(este|esse) mes/.test(n)) {
    const first = monthStart(t);
    const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1, 12));
    return { from: iso(first), to: iso(addDays(next, -1)), label: "este mês" };
  }
  return null;
}

const hay = (s: string) => ` ${normalize(s)} `;

/** Pontua um documento para as palavras da pergunta (título pesa mais; prefixo de 5 letras tolera plural/flexão). */
export function scoreDoc(d: OrionDoc, kws: string[]): number {
  if (!kws.length) return 0;
  const title = hay(`${d.title} ${d.where ?? ""}`), body = hay(d.text);
  let s = 0, hit = 0;
  for (const k of kws) {
    const stem = k.length > 5 ? k.slice(0, 5) : k;
    const exactT = title.includes(` ${k} `), exactB = body.includes(` ${k} `);
    const partT = title.includes(` ${stem}`), partB = body.includes(` ${stem}`);
    const v = (exactT ? 3 : partT ? 2 : 0) + (exactB ? 1.5 : partB ? 1 : 0);
    if (v) hit++;
    s += v;
  }
  // Documentos que casam com mais palavras da pergunta valem bem mais.
  return hit ? s * (0.5 + hit / kws.length) : 0;
}

/** Escolhe os documentos mais relevantes (ou, sem palavras-chave, os mais recentes do período). */
export function rank(docs: OrionDoc[], question: string, today: string, limit = 40): { docs: OrionDoc[]; period: ReturnType<typeof periodOf>; kws: string[] } {
  const kws = keywords(question);
  const period = periodOf(question, today);
  const inPeriod = (d: OrionDoc) => !period || (!!d.date && d.date >= period.from && d.date <= period.to);
  const pool = period ? docs.filter(inPeriod) : docs;
  const byDate = (a: OrionDoc, b: OrionDoc) => (b.date ?? "").localeCompare(a.date ?? "");
  if (!kws.length) return { docs: [...pool].sort(byDate).slice(0, limit), period, kws };
  const scored = pool
    .map((d) => ({ d, s: scoreDoc(d, kws) * (d.kind === "registro" ? 1.4 : 1) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || byDate(a.d, b.d));
  return { docs: scored.slice(0, limit).map((x) => x.d), period, kws };
}

/** Trecho curto do texto, centrado na primeira palavra encontrada. */
export function snippet(text: string, kws: string[], max = 260): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const low = normalize(t);
  let at = -1;
  for (const k of kws) { const i = low.indexOf(k); if (i >= 0) { at = i; break; } }
  if (at < 0 || low.length !== t.length) return `${t.slice(0, max).trimEnd()}…`;
  const from = Math.max(0, at - Math.floor(max / 3));
  return `${from > 0 ? "…" : ""}${t.slice(from, from + max).trim()}${from + max < t.length ? "…" : ""}`;
}

export const toSources = (docs: OrionDoc[], kws: string[]): OrionSource[] =>
  docs.map((d, i) => ({ n: i + 1, id: d.id, kind: d.kind, title: d.title, snippet: snippet(d.text, kws), date: d.date, where: d.where, link: d.link }));

/** Texto das fontes para a IA (limitado, com número e data para citar). */
export function sourcesForAi(docs: OrionDoc[], maxChars = 24_000): string {
  let out = "";
  docs.forEach((d, i) => {
    const block = `[${i + 1}] ${KIND_LABEL[d.kind]}${d.date ? ` · ${d.date}` : ""}${d.where ? ` · ${d.where}` : ""} · ${d.title}\n${d.text.replace(/\s+/g, " ").slice(0, 1500)}\n\n`;
    if (out.length + block.length <= maxChars) out += block;
  });
  return out.trim();
}

/** Dossiês (polos) citados no texto, pelo nome inteiro. */
export function mentionedDossiers(text: string, names: string[]): string[] {
  const t = hay(text);
  return [...new Set(names.filter((n) => n.trim() && t.includes(hay(n))))];
}

export const SYSTEM = `Você é o Orion, o "segundo cérebro" da usuária: ele responde com base nas FONTES que o Presence reúne (anotações que ela documentou, demandas e seu histórico, tarefas e compromissos, notas de projeto, conversas com a assistente).
Regras:
- Responda SOMENTE com o que está nas fontes. Se não houver informação suficiente, diga isso com clareza e sugira o que ela poderia documentar; nunca invente.
- Cite as fontes pelo número entre colchetes, ex.: [2]. Datas sempre no formato dia/mês/ano.
- Para contagens, somas e médias (ex.: falhas em disparos), mostre a conta com os números que encontrou nas fontes e avise se podem estar faltando registros.
- Seja direto e organizado (frases curtas; lista quando houver vários itens). Português do Brasil.`;
