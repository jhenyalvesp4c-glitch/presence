/** Playbooks: roteiros que criam, de uma vez, dossiê, cliente, pasta com documentos, tarefas, demandas e checklist. Regras puras (sem rede). */
import { addDays } from "./central";

export type StepKind = "tarefa" | "demanda";
export type PlaybookStep = { id: string; kind: StepKind; title: string; desc?: string; days: number; time?: string; priority: "baixa" | "media" | "alta"; on: boolean };
export type StarterDoc = { kind: string; title: string; desc: string; rules?: string[]; steps?: string[] };
export type Playbook = {
  id: string; name: string; tagline: string; tone: "cyan" | "violet" | "emerald" | "amber";
  docs: StarterDoc[]; checklist: string[]; steps: PlaybookStep[];
};

const s = (id: string, kind: StepKind, title: string, days: number, priority: PlaybookStep["priority"] = "media", extra: Partial<PlaybookStep> = {}): PlaybookStep => ({ id, kind, title, days, priority, on: true, ...extra });

export const PLAYBOOKS: Playbook[] = [
  {
    id: "onboarding-cliente", name: "Onboarding de cliente", tagline: "Do fechamento ao primeiro mês: dossiê, ficha, pasta com documentos, prazos, demandas e checklist, tudo ligado.", tone: "cyan",
    docs: [
      { kind: "Ficha do cliente", title: "Ficha do cliente", desc: "Quem é o cliente, responsáveis, horários e combinados.", rules: ["Preferências de contato", "Horário para ligações", "Quem aprova entregas"], steps: ["Responsável principal — contato", "Financeiro — contato", "Quem acompanha no dia a dia"] },
      { kind: "Contrato", title: "Contrato (modelo)", desc: "Resumo do contrato: partes, objeto, valor, vigência e renovação.", rules: ["Reajuste anual", "Aviso prévio", "Multa e rescisão"], steps: ["Assinatura", "Início da vigência", "Data de renovação"] },
      { kind: "Briefing", title: "Briefing inicial", desc: "O que o cliente precisa, objetivos e prazos.", rules: ["Objetivo principal", "O que não pode acontecer"], steps: ["Reunir informações", "Validar com o cliente"] },
      { kind: "Ata", title: "Ata do kickoff", desc: "O que foi falado e decidido na reunião de início.", rules: ["Decisões"], steps: ["Quem faz o quê, até quando"] },
    ],
    checklist: ["Contrato assinado", "Dados de contato completos", "Acessos recebidos (sem anotar senhas aqui)", "Briefing preenchido", "Kickoff realizado", "Grupo no WhatsApp criado", "Cobrança configurada", "Relatório inicial enviado"],
    steps: [
      s("boasvindas", "tarefa", "Enviar mensagem de boas-vindas", 0, "alta"),
      s("kickoff", "tarefa", "Reunião de kickoff", 1, "alta", { time: "10:00" }),
      s("docs", "demanda", "Coletar documentos e acessos do cliente", 2),
      s("contrato", "demanda", "Enviar contrato e proposta para assinatura", 3, "alta"),
      s("contas", "tarefa", "Configurar contas e acessos do cliente", 4),
      s("plano", "demanda", "Entregar plano de ação dos primeiros 30 dias", 7, "alta"),
      s("alinhamento", "tarefa", "Reunião de alinhamento da 1ª semana", 8),
      s("checkin", "tarefa", "Check-in de satisfação com o cliente", 14),
      s("revisao", "demanda", "Revisão do primeiro mês e relatório", 30),
    ],
  },
];

export type RunInput = { clientName: string; contactName: string; email: string; phone: string; monthlyValue: number; contractEnd: string | null; start: string };
export type PlannedStep = PlaybookStep & { date: string };
export type Plan = { clientName: string; slug: string; steps: PlannedStep[]; docs: StarterDoc[]; checklistTitle: string; checklist: string[] };

export const slugOf = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cliente";
/** "dd/mm" (formato de prazo das demandas). */
export const deadlineLabel = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Aplica as datas relativas ao início e deixa só os passos marcados. */
export function buildPlan(p: Playbook, input: RunInput, steps: PlaybookStep[] = p.steps): Plan {
  const name = input.clientName.trim();
  return {
    clientName: name, slug: slugOf(name), docs: p.docs, checklistTitle: `${p.name} — ${name}`, checklist: p.checklist,
    steps: steps.filter((x) => x.on && x.title.trim()).map((x) => ({ ...x, title: x.title.trim(), date: addDays(input.start, Math.max(0, Math.round(x.days))) })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Resumo do que será criado (para mostrar antes de executar). */
export function summarizePlan(plan: Plan) {
  return { tarefas: plan.steps.filter((x) => x.kind === "tarefa").length, demandas: plan.steps.filter((x) => x.kind === "demanda").length, documentos: plan.docs.length, checklist: plan.checklist.length, ultimaData: plan.steps.at(-1)?.date ?? null };
}

/** Passos guardados pela usuária (modelo dela). Ignora o que não tiver o formato certo; sem nada válido, devolve `fallback`. */
export function sanitizeSteps(raw: unknown, fallback: PlaybookStep[]): PlaybookStep[] {
  if (!Array.isArray(raw)) return fallback;
  type Raw = { id?: unknown; kind?: unknown; title?: unknown; days?: unknown; priority?: unknown; on?: unknown; time?: unknown; desc?: unknown };
  const out: PlaybookStep[] = [], seen = new Set<string>();
  for (const x of raw as Raw[]) {
    if (!x || typeof x !== "object" || typeof x.title !== "string" || !x.title.trim()) continue;
    const id = typeof x.id === "string" && x.id && !seen.has(x.id) ? x.id : `x-${out.length}-${Math.random().toString(36).slice(2, 6)}`;
    seen.add(id);
    const kind: StepKind = x.kind === "demanda" ? "demanda" : "tarefa", priority = x.priority === "alta" || x.priority === "baixa" ? x.priority : "media";
    const days = typeof x.days === "number" && Number.isFinite(x.days) ? Math.max(0, Math.min(365, Math.round(x.days))) : 0;
    out.push({ id, kind, title: x.title.trim().slice(0, 200), days, priority, on: x.on !== false, ...(typeof x.time === "string" && /^\d{2}:\d{2}$/.test(x.time) ? { time: x.time } : {}), ...(typeof x.desc === "string" && x.desc ? { desc: x.desc.slice(0, 500) } : {}) });
  }
  return out.length || (Array.isArray(raw) && raw.length === 0) ? out : fallback;
}
export const stepsKey = (playbookId: string) => `orion.playbook.${playbookId}.steps.v1`;


/* ───────────── playbooks da pessoa (editar, excluir, criar) ───────────── */
export type PlaybookRow = { id: string; name: string; tagline: string; tone: string; docs: unknown; checklist: unknown; steps: unknown; deleted: boolean; position: number };
const TONES: Playbook["tone"][] = ["cyan", "violet", "emerald", "amber"];

export function sanitizeDocs(raw: unknown): StarterDoc[] {
  if (!Array.isArray(raw)) return [];
  const strs = (v: unknown, n: number) => (Array.isArray(v) ? v.map((x) => String(x ?? "").trim().slice(0, 300)).filter(Boolean).slice(0, n) : []);
  return (raw as Record<string, unknown>[]).flatMap((d): StarterDoc[] => {
    const title = typeof d?.["title"] === "string" ? d["title"].trim().slice(0, 200) : "";
    if (!title) return [];
    const rules = strs(d["rules"], 12), steps = strs(d["steps"], 20);
    return [{ kind: String(d["kind"] ?? "Documento").trim().slice(0, 40) || "Documento", title, desc: String(d["desc"] ?? "").trim().slice(0, 600), ...(rules.length ? { rules } : {}), ...(steps.length ? { steps } : {}) }];
  }).slice(0, 20);
}
const sanitizeLines = (raw: unknown) => (Array.isArray(raw) ? raw.map((x) => String(x ?? "").trim().slice(0, 200)).filter(Boolean).slice(0, 40) : []);

/** O que a pessoa vê: os modelos do Orion (menos os excluídos, com as edições dela por cima) e os playbooks que ela criou. */
export function mergePlaybooks(builtins: Playbook[], rows: PlaybookRow[]): Playbook[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const fromRow = (r: PlaybookRow, base?: Playbook): Playbook => ({
    id: r.id, name: r.name, tagline: r.tagline, tone: TONES.includes(r.tone as Playbook["tone"]) ? (r.tone as Playbook["tone"]) : (base?.tone ?? "cyan"),
    docs: sanitizeDocs(r.docs), checklist: sanitizeLines(r.checklist), steps: sanitizeSteps(r.steps, base?.steps ?? []),
  });
  const out: { p: Playbook; pos: number }[] = [];
  builtins.forEach((b, i) => { const r = byId.get(b.id); if (r?.deleted) return; out.push({ p: r ? fromRow(r, b) : b, pos: r ? r.position : i - 1000 }); });
  for (const r of rows) if (!r.deleted && !builtins.some((b) => b.id === r.id)) out.push({ p: fromRow(r), pos: r.position });
  return out.sort((a, b) => a.pos - b.pos).map((x) => x.p);
}
export const newPlaybookId = (name: string) => `${slugOf(name).slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
