/** Assistente de reuniões: tipos, limpeza do que a IA devolve, texto do WhatsApp, ata em Markdown e o texto que vai para a Central de entrada (demandas e lembretes). Funções puras. */
export type Priority = "alta" | "media" | "baixa";
export type ActionKind = "demanda" | "lembrete" | "tarefa";
export type MAction = { quem: string; oQue: string; prazo: string | null; prioridade: Priority; tipo: ActionKind; contexto: string; minha: boolean };
export type Topic = { assunto: string; pontos: string[] };
export type GroupSummary = { nome: string; resumo: string; destaques: string[]; pedidos: string[] };
export type Analysis = {
  titulo: string; resumo: string; topicos: Topic[]; decisoes: string[]; acoes: MAction[]; pendencias: string[]; participantes: string[];
  proxima: { data: string | null; hora: string | null; assunto: string } | null; grupos: GroupSummary[];
};
export type Mode = "reuniao" | "grupo";
export type Source = "texto" | "voz" | "whatsapp";

const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const strs = (v: unknown, n: number, max = 400) => (Array.isArray(v) ? v : []).map((x) => str(x, max)).filter(Boolean).slice(0, n);
const date = (v: unknown) => { const s = str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
const time = (v: unknown) => { const s = str(v, 5); return /^\d{2}:\d{2}$/.test(s) ? s : null; };

export function cleanAnalysis(raw: unknown): Analysis | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const acoes = (Array.isArray(o["acoes"]) ? (o["acoes"] as unknown[]) : []).flatMap((a): MAction[] => {
    const x = a as Record<string, unknown> | null, oQue = str(x?.["oQue"], 400);
    if (!x || !oQue) return [];
    const tipo = x["tipo"] === "lembrete" || x["tipo"] === "tarefa" ? (x["tipo"] as ActionKind) : "demanda", pr = x["prioridade"];
    return [{ quem: str(x["quem"], 80) || "A definir", oQue, prazo: date(x["prazo"]), prioridade: pr === "alta" || pr === "baixa" ? pr : "media", tipo, contexto: str(x["contexto"], 300), minha: x["minha"] === true }];
  }).slice(0, 60);
  const topicos = (Array.isArray(o["topicos"]) ? (o["topicos"] as unknown[]) : []).flatMap((t): Topic[] => { const x = t as Record<string, unknown> | null, a = str(x?.["assunto"], 160); return x && a ? [{ assunto: a, pontos: strs(x["pontos"], 12) }] : []; }).slice(0, 20);
  const grupos = (Array.isArray(o["grupos"]) ? (o["grupos"] as unknown[]) : []).flatMap((g): GroupSummary[] => { const x = g as Record<string, unknown> | null, n = str(x?.["nome"], 120); return x && n ? [{ nome: n, resumo: str(x["resumo"], 1200), destaques: strs(x["destaques"], 10), pedidos: strs(x["pedidos"], 12) }] : []; }).slice(0, 12);
  const p = o["proxima"] as Record<string, unknown> | null | undefined;
  const proxima = p && typeof p === "object" && (date(p["data"]) || str(p["assunto"], 200)) ? { data: date(p["data"]), hora: time(p["hora"]), assunto: str(p["assunto"], 200) } : null;
  const a: Analysis = { titulo: str(o["titulo"], 160) || "Reunião", resumo: str(o["resumo"], 3000), topicos, decisoes: strs(o["decisoes"], 30), acoes, pendencias: strs(o["pendencias"], 20), participantes: strs(o["participantes"], 40, 80), proxima, grupos };
  return a.resumo || a.acoes.length || a.topicos.length || a.decisoes.length || a.grupos.length ? a : null;
}

/* ───────────── WhatsApp → texto ───────────── */
export type WaLine = { ts: number; sender_name: string; from_me: boolean; text: string; kind: string };
const pad = (n: number) => String(n).padStart(2, "0");
/** Mensagens do WhatsApp em ordem de horário, uma por linha: `[21/11 14:05] Nome: texto`. */
export function waToText(msgs: WaLine[]): string {
  return [...msgs].sort((a, b) => a.ts - b.ts).map((m) => {
    const d = new Date(m.ts * 1000), body = m.text.trim() || (m.kind && m.kind !== "text" ? `[${m.kind}]` : "");
    return body ? `[${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}] ${m.from_me ? "Eu" : m.sender_name || "Contato"}: ${body.replace(/\n+/g, " / ")}` : "";
  }).filter(Boolean).join("\n");
}
/** Início do período (segundos desde 1970): hoje 00:00 ou as últimas N horas. */
export function sinceFor(period: "hoje" | "24h" | "3d" | "7d", now = new Date()): number {
  if (period === "hoje") { const d = new Date(now); d.setHours(0, 0, 0, 0); return Math.floor(d.getTime() / 1000); }
  const h = period === "24h" ? 24 : period === "3d" ? 72 : 168;
  return Math.floor(now.getTime() / 1000) - h * 3600;
}

/* ───────────── saídas ───────────── */
const dm = (iso: string) => iso.split("-").reverse().join("/");
const PR: Record<Priority, string> = { alta: "alta", media: "normal", baixa: "baixa" };
export function analysisToMarkdown(a: Analysis, dateIso: string): string {
  const L: string[] = [`# ${a.titulo}`, `_${dm(dateIso)}_${a.participantes.length ? ` · Participantes: ${a.participantes.join(", ")}` : ""}`, ""];
  if (a.resumo) L.push("## Resumo", a.resumo, "");
  for (const t of a.topicos) L.push(`### ${t.assunto}`, ...t.pontos.map((p) => `- ${p}`), "");
  for (const g of a.grupos) L.push(`## Grupo: ${g.nome}`, g.resumo, ...g.destaques.map((d) => `- ${d}`), ...(g.pedidos.length ? ["", "Pedidos:", ...g.pedidos.map((p) => `- ${p}`)] : []), "");
  if (a.decisoes.length) L.push("## Decisões", ...a.decisoes.map((d) => `- ${d}`), "");
  if (a.acoes.length) { L.push("## Quem faz o quê"); for (const x of a.acoes) L.push(`- **${x.quem}**: ${x.oQue}${x.prazo ? ` (até ${dm(x.prazo)})` : ""} — prioridade ${PR[x.prioridade]}`); L.push(""); }
  if (a.pendencias.length) L.push("## Pendências em aberto", ...a.pendencias.map((d) => `- ${d}`), "");
  if (a.proxima) L.push("## Próxima reunião", `${a.proxima.data ? dm(a.proxima.data) : "A definir"}${a.proxima.hora ? ` às ${a.proxima.hora}` : ""}${a.proxima.assunto ? ` — ${a.proxima.assunto}` : ""}`, "");
  return L.join("\n").trim();
}
/** Texto entregue à Central de entrada: o que virou ação e a próxima reunião, para ela classificar em demanda, lembrete, tarefa e compromisso. */
export function actionsToInboxText(title: string, dateIso: string, acoes: MAction[], proxima: Analysis["proxima"]): string {
  const L = [`Da reunião "${title}" de ${dm(dateIso)}. Crie demandas para o trabalho de projeto e lembretes/tarefas para o resto:`];
  for (const x of acoes) L.push(`- ${x.tipo === "lembrete" ? "Lembrete" : x.tipo === "tarefa" ? "Tarefa" : "Demanda"} (${x.quem}): ${x.oQue}${x.prazo ? `. Prazo: ${dm(x.prazo)}` : ""}. Prioridade ${PR[x.prioridade]}.${x.contexto ? ` Contexto: ${x.contexto}` : ""}`);
  if (proxima?.data) L.push(`- Compromisso: próxima reunião em ${dm(proxima.data)}${proxima.hora ? ` às ${proxima.hora}` : ""}${proxima.assunto ? ` — ${proxima.assunto}` : ""}`);
  return L.join("\n");
}
/** Quem faz o quê, agrupado por pessoa (as suas ações primeiro). */
export function byPerson(acoes: MAction[]): { quem: string; minha: boolean; itens: { a: MAction; i: number }[] }[] {
  const m = new Map<string, { quem: string; minha: boolean; itens: { a: MAction; i: number }[] }>();
  acoes.forEach((a, i) => { const k = a.quem.toLowerCase(); const g = m.get(k) ?? { quem: a.quem, minha: false, itens: [] }; g.minha ||= a.minha; g.itens.push({ a, i }); m.set(k, g); });
  return [...m.values()].sort((x, y) => Number(y.minha) - Number(x.minha) || y.itens.length - x.itens.length);
}
