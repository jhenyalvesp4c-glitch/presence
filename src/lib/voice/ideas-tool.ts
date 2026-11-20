/** Ferramenta de voz/chat "ideias": guarda, lista, resume, move, desenvolve e transforma ideias da caixa. */
import { createIdea, deleteIdea, ideaToDoc, ideaToProject, ideaToReminder, ideaToTask, listIdeas, updateIdea } from "../data/ideas";
import { developIdea } from "../ideas.functions";
import { STATUSES, digest, ideaText, linksIn, statusLabel, type Idea, type IdeaStatus } from "../ideas";
import type { Panel } from "./agent";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STATUS_WORDS: [RegExp, IdeaStatus][] = [[/arquiv/, "arquivada"], [/fazendo|andamento/, "fazendo"], [/valid/, "validando"], [/explor/, "explorando"], [/solta|nova/, "solta"]];
const openPanel = (titulo: string, itens: Idea[]): Panel => ({ titulo, secoes: [{ titulo: `${itens.length} ideia${itens.length === 1 ? "" : "s"}`, itens: itens.slice(0, 12).map((i) => ({ rotulo: i.title, detalhe: `${statusLabel(i.status)} · ${i.area === "negocios" ? "negócios" : "pessoal"}` })) }], abrir: { rotulo: "Abrir a caixa de ideias", para: "/ideias" } });

function find(all: Idea[], ref: string): Idea | { erro: string } {
  const q = norm(ref).trim();
  if (!q) return { erro: "Qual ideia?" };
  const hits = all.filter((i) => norm(i.title).includes(q) || q.includes(norm(i.title)));
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  const pool = hits.length ? hits : all.filter((i) => words.length && words.every((w) => norm(`${i.title} ${i.body}`).includes(w)));
  if (pool.length === 1) return pool[0]!;
  if (!pool.length) return { erro: `Não achei uma ideia parecida com "${ref}".` };
  return { erro: `Achei mais de uma: ${pool.slice(0, 4).map((i) => `"${i.title}"`).join(", ")}. Qual delas?` };
}

export async function runIdeasTool(args: Record<string, unknown>): Promise<{ result: Record<string, unknown>; panel?: Panel | undefined }> {
  const acao = String(args["acao"] ?? "listar"), str = (k: string) => String(args[k] ?? "").trim();
  const all = await listIdeas();

  if (acao === "guardar") {
    const titulo = str("titulo") || str("texto").slice(0, 80);
    if (titulo.length < 2) return { result: { ok: false, erro: "Qual é a ideia?" } };
    const texto = str("texto"), referencia = args["referencia"] === true, negocios = /neg[oó]cio|profission|trabalho|empresa/i.test(str("area"));
    const i = await createIdea({ title: titulo, body: texto && texto !== titulo ? texto : "", kind: referencia ? "referencia" : "ideia", area: negocios ? "negocios" : "pessoal", links: linksIn(texto), source: "orion" });
    return { result: { ok: true, guardada: i.title, tipo: referencia ? "referencia" : "ideia" }, panel: openPanel("Guardei", [i]) };
  }
  if (acao === "resumo") {
    const d = digest(all, new Date());
    return { result: { ok: true, resumo: d.texto, paradas: d.paradas.slice(0, 5).map((i) => i.title) }, panel: d.paradas.length ? openPanel("Ideias paradas", d.paradas) : undefined };
  }
  if (acao === "listar") {
    const f = norm(str("status")), st = STATUS_WORDS.find(([re]) => re.test(f))?.[1];
    const list = all.filter((i) => i.kind === (args["referencia"] === true ? "referencia" : "ideia") && (st ? i.status === st : i.status !== "arquivada"));
    return { result: { ok: true, total: list.length, ideias: list.slice(0, 15).map((i) => ({ titulo: i.title, estado: statusLabel(i.status), area: i.area })) }, panel: list.length ? openPanel("Suas ideias", list) : undefined };
  }

  const hit = find(all, str("item") || str("titulo"));
  if ("erro" in hit) return { result: { ok: false, erro: hit.erro } };

  if (acao === "estado") {
    const st = STATUS_WORDS.find(([re]) => re.test(norm(str("status"))))?.[1];
    if (!st || !STATUSES.some((s) => s.id === st)) return { result: { ok: false, erro: "Para qual estado? Solta, explorando, validando, fazendo ou arquivada." } };
    await updateIdea(hit.id, { status: st });
    return { result: { ok: true, ideia: hit.title, estado: statusLabel(st) } };
  }
  if (acao === "desenvolver") {
    const r = await developIdea({ data: { texto: ideaText({ ...hit, plan: null }), plano: hit.plan } });
    if (!r.ok) return { result: { ok: false, erro: r.error } };
    await updateIdea(hit.id, { plan: r.plano, ...(hit.status === "solta" ? { status: "explorando" as const } : {}) });
    const p = r.plano;
    return { result: { ok: true, ideia: hit.title, resumo: p.resumo, perguntas: p.perguntas.map((x) => x.q), riscos: p.riscos, passos: p.passos, precisa: p.precisa, proximo_passo: p.proximoPasso, aviso: "Estimativas a partir do que ela contou." },
      panel: { titulo: `Plano: ${hit.title}`, secoes: [{ titulo: "Perguntas que faltam", itens: p.perguntas.map((x) => ({ rotulo: x.q })) }, { titulo: "Primeiros passos", itens: p.passos.map((x) => ({ rotulo: x })) }, { titulo: "Riscos", itens: p.riscos.map((x) => ({ rotulo: x })) }], abrir: { rotulo: "Abrir a ideia", para: "/ideias" } } };
  }
  if (acao === "virar") {
    const tipo = norm(str("tipo"));
    if (/projeto/.test(tipo)) { const r = await ideaToProject(hit); return { result: { ok: true, ideia: hit.title, virou: "projeto", id: r.id } }; }
    if (/tarefa/.test(tipo)) { await ideaToTask(hit); return { result: { ok: true, ideia: hit.title, virou: "tarefa" } }; }
    if (/lembrete/.test(tipo)) { const d = str("data") || today(); await ideaToReminder(hit, d, str("hora") || null); return { result: { ok: true, ideia: hit.title, virou: "lembrete", data: d } }; }
    if (/doc/.test(tipo)) { await ideaToDoc(hit); return { result: { ok: true, ideia: hit.title, virou: "documentação" } }; }
    return { result: { ok: false, erro: "Virar o quê? Projeto, tarefa, lembrete ou documentação." } };
  }
  if (acao === "excluir") {
    if (args["confirmado"] !== true) return { result: { ok: false, precisa_confirmar: true, ideia: hit.title, aviso: "Pergunte se ela quer mesmo excluir; só repita com confirmado=true depois do sim." } };
    await deleteIdea(hit);
    return { result: { ok: true, excluida: hit.title } };
  }
  return { result: { ok: false, erro: "Ação desconhecida." } };
}
