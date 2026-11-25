/** Edição de roteiros de treinamento por conversa (voz): regras puras, sem banco. A tela usa o mesmo formato (Script/Block). */
import { COLORS, newId, removeBlock, removeScript, upsertBlock, upsertScript, type Block, type Faq, type Library, type Script } from "./training-library";
import { score } from "./checklist";

export type BlocoIn = { titulo: string; minutos?: number | undefined; mostrar?: string[] | undefined; dica?: string | undefined; falar?: string | undefined; porque?: string[] | undefined; perguntas?: { pergunta: string; resposta: string }[] | undefined };
export type ScriptArgs = {
  acao: string; roteiro?: string; titulo?: string; publico?: string; objetivo?: string; blocos?: BlocoIn[];
  bloco?: string; depois_de?: string; novo_titulo?: string; minutos?: number; mostrar_incluir?: string[]; mostrar_tirar?: string[];
  dica?: string; falar?: string; porque_incluir?: string[]; perguntas_incluir?: { pergunta: string; resposta: string }[]; confirmado?: boolean;
};
export type Edit = { lib?: Library; result: Record<string, unknown>; script?: Script };

const clean = (s: unknown, n = 400) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const list = (v: unknown, n = 300) => (Array.isArray(v) ? v.map((x) => clean(x, n)).filter(Boolean) : []);

export function blockFrom(b: BlocoIn): Block {
  const out: Block = { id: newId("b"), title: clean(b.titulo, 120) || "Novo bloco", minutes: Math.min(240, Math.max(1, Math.round(Number(b.minutos) || 10))), show: list(b.mostrar), examples: [] };
  if (clean(b.dica)) out.tip = clean(b.dica, 600);
  if (clean(b.falar, 12000)) out.say = clean(b.falar, 12000);
  const why = list(b.porque); if (why.length) out.why = why;
  const faq: Faq[] = (b.perguntas ?? []).map((p) => ({ q: clean(p.pergunta), a: clean(p.resposta, 800) })).filter((p) => p.q && p.a);
  if (faq.length) out.faq = faq;
  return out;
}

function pick<T>(items: T[], label: (x: T) => string, query: string): { item?: T; ambiguo?: T[] } {
  const ranked = items.map((i) => ({ i, s: score(label(i), query) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  if (!ranked.length) return {};
  const top = ranked.filter((x) => x.s === ranked[0]!.s);
  return top.length === 1 || ranked[0]!.s >= 100 ? { item: ranked[0]!.i } : { ambiguo: top.map((x) => x.i) };
}
export const findScript = (lib: Library, q: string) => pick(lib.scripts, (s) => s.title, q);

export function describeScript(s: Script) {
  return { roteiro: s.title, publico: s.audience, objetivo: s.goal, blocos: s.blocks.map((b, i) => ({ n: i + 1, titulo: b.title, minutos: b.minutes, mostrar: b.show, dica: b.tip, falar: b.say ? true : undefined, porque: b.why?.length, perguntas: b.faq?.length })) };
}

export function editScript(lib: Library, a: ScriptArgs): Edit {
  const acao = a.acao;
  if (acao === "listar") return { result: { ok: true, roteiros: lib.scripts.map((s) => ({ roteiro: s.title, publico: s.audience, blocos: s.blocks.length })) } };

  if (acao === "criar") {
    const title = clean(a.titulo, 120);
    if (!title) return { result: { ok: false, erro: "Diga o nome do roteiro." } };
    if (lib.scripts.some((s) => score(s.title, title) >= 100)) return { result: { ok: false, erro: `Já existe um roteiro chamado "${title}". Se quiser mudar, peça para editar.` } };
    const script: Script = { id: newId("s"), title, audience: clean(a.publico, 160), goal: clean(a.objetivo, 400), color: COLORS[lib.scripts.length % COLORS.length]!, blocks: (a.blocos ?? []).map(blockFrom) };
    return { lib: upsertScript(lib, script), script, result: { ok: true, acao: "criado", ...describeScript(script) } };
  }

  const f = findScript(lib, clean(a.roteiro));
  if (f.ambiguo) return { result: { ok: false, erro: "Mais de um roteiro parecido. Pergunte qual.", opcoes: f.ambiguo.map((s) => s.title) } };
  if (!f.item) return { result: { ok: false, erro: a.roteiro ? `Não achei o roteiro "${a.roteiro}".` : "Diga qual roteiro.", opcoes: lib.scripts.map((s) => s.title) } };
  let s = f.item;

  if (acao === "mostrar") return { script: s, result: { ok: true, ...describeScript(s) } };

  if (acao === "excluir") {
    if (a.confirmado !== true) return { result: { ok: false, precisa_confirmar: true, aviso: `Vai excluir o roteiro "${s.title}" com ${s.blocks.length} blocos.` } };
    return { lib: removeScript(lib, s.id), result: { ok: true, acao: "excluido", roteiro: s.title } };
  }

  if (acao === "editar") {
    const mudou: string[] = [];
    if (clean(a.novo_titulo ?? a.titulo, 120)) { s = { ...s, title: clean(a.novo_titulo ?? a.titulo, 120) }; mudou.push("título"); }
    if (a.publico !== undefined) { s = { ...s, audience: clean(a.publico, 160) }; mudou.push("público"); }
    if (a.objetivo !== undefined) { s = { ...s, goal: clean(a.objetivo, 400) }; mudou.push("objetivo"); }
    if (!mudou.length) return { result: { ok: false, erro: "O que mudar no roteiro? Título, público ou objetivo." } };
    return { lib: upsertScript(lib, s), script: s, result: { ok: true, acao: "editado", mudou, ...describeScript(s) } };
  }

  if (acao === "adicionar_bloco") {
    const incoming = (a.blocos ?? []).map(blockFrom);
    if (!incoming.length && clean(a.titulo)) incoming.push(blockFrom({ titulo: a.titulo!, minutos: a.minutos, mostrar: a.mostrar_incluir, dica: a.dica, falar: a.falar, porque: a.porque_incluir, perguntas: a.perguntas_incluir }));
    if (!incoming.length) return { result: { ok: false, erro: "Qual bloco incluir? Passe os blocos com título e o que mostrar." } };
    const seen = new Set(s.blocks.map((b) => b.title.toLowerCase()));
    const novos = incoming.filter((b) => !seen.has(b.title.toLowerCase()));
    if (!novos.length) return { result: { ok: false, erro: "Esses blocos já existem no roteiro." } };
    const at = a.depois_de ? s.blocks.findIndex((b) => b.id === pick(s.blocks, (x) => x.title, a.depois_de!).item?.id) : -1;
    const blocks = at >= 0 ? [...s.blocks.slice(0, at + 1), ...novos, ...s.blocks.slice(at + 1)] : [...s.blocks, ...novos];
    s = { ...s, blocks };
    return { lib: upsertScript(lib, s), script: s, result: { ok: true, acao: "blocos_adicionados", adicionados: novos.map((b) => b.title), ...describeScript(s) } };
  }

  // daqui para baixo: mexe num bloco existente
  const fb = pick(s.blocks, (b) => b.title, clean(a.bloco));
  if (fb.ambiguo) return { result: { ok: false, erro: "Mais de um bloco parecido. Pergunte qual.", opcoes: fb.ambiguo.map((b) => b.title) } };
  if (!fb.item) return { result: { ok: false, erro: a.bloco ? `Não achei o bloco "${a.bloco}" neste roteiro.` : "Diga qual bloco.", opcoes: s.blocks.map((b) => b.title) } };
  let b = fb.item;

  if (acao === "remover_bloco") {
    if (a.confirmado !== true) return { result: { ok: false, precisa_confirmar: true, aviso: `Vai tirar o bloco "${b.title}" do roteiro "${s.title}".` } };
    const lib2 = removeBlock(lib, s.id, b.id);
    return { lib: lib2, script: lib2.scripts.find((x) => x.id === s.id)!, result: { ok: true, acao: "bloco_removido", bloco: b.title } };
  }

  if (acao === "editar_bloco") {
    const mudou: string[] = [], naoAchei: string[] = [];
    if (clean(a.novo_titulo, 120)) { b = { ...b, title: clean(a.novo_titulo, 120) }; mudou.push("título"); }
    if (a.minutos !== undefined && Number(a.minutos) > 0) { b = { ...b, minutes: Math.min(240, Math.round(Number(a.minutos))) }; mudou.push("duração"); }
    if (a.dica !== undefined) { const t = clean(a.dica, 600); if (t) b = { ...b, tip: t }; else { const { tip: _t, ...r } = b; b = r; } mudou.push("dica"); }
    if (a.falar !== undefined) { const t = clean(a.falar, 12000); if (t) b = { ...b, say: t }; else { const { say: _s, ...r } = b; b = r; } mudou.push("o que falar"); }
    const inc = list(a.mostrar_incluir).filter((x) => !b.show.some((y) => score(y, x) >= 100));
    if (inc.length) { b = { ...b, show: [...b.show, ...inc] }; mudou.push(`${inc.length} passo(s) em "o que mostrar"`); }
    for (const q of list(a.mostrar_tirar)) {
      const r = pick(b.show.map((t, i) => ({ t, i })), (x) => x.t, q);
      if (r.item) { const i = r.item.i; b = { ...b, show: b.show.filter((_, k) => k !== i), media: undefined === b.media ? undefined : shiftMediaSafe(b.media, i) }; mudou.push(`tirou "${r.item.t}"`); } else naoAchei.push(q);
    }
    const why = list(a.porque_incluir); if (why.length) { b = { ...b, why: [...(b.why ?? []), ...why.filter((w) => !(b.why ?? []).includes(w))] }; mudou.push("por quê"); }
    const faq: Faq[] = (a.perguntas_incluir ?? []).map((p) => ({ q: clean(p.pergunta), a: clean(p.resposta, 800) })).filter((p) => p.q && p.a);
    if (faq.length) { b = { ...b, faq: [...(b.faq ?? []), ...faq] }; mudou.push("perguntas frequentes"); }
    if (!mudou.length && !naoAchei.length) return { result: { ok: false, erro: "O que mudar no bloco?" } };
    const lib2 = upsertBlock(lib, s.id, b);
    return { lib: lib2, script: lib2.scripts.find((x) => x.id === s.id)!, result: { ok: mudou.length > 0, acao: "bloco_editado", bloco: b.title, mudou, nao_achei: naoAchei, passos: b.show } };
  }

  return { result: { ok: false, erro: "Ação desconhecida." } };
}

function shiftMediaSafe(media: NonNullable<Block["media"]>, removed: number): Block["media"] {
  const out: NonNullable<Block["media"]> = {};
  for (const [k, v] of Object.entries(media)) { const i = Number(k); if (i === removed) continue; out[String(i > removed ? i - 1 : i)] = v; }
  return Object.keys(out).length ? out : undefined;
}
