/** Mapa de conexões: transforma tudo que o Orion guarda (projetos, dossiês, demandas, anotações, tarefas, ideias, reuniões, pedidos do WhatsApp, pessoas) em nós e ligações. Funções puras. */
export type Kind = "projeto" | "dossie" | "demanda" | "anotacao" | "doc" | "tarefa" | "ideia" | "reuniao" | "pessoa" | "conversa" | "pedido";
export type MapNode = { id: string; kind: Kind; label: string; sub: string; /** aberto = precisa de atenção */ open: boolean; urgent: boolean; link: string; degree: number; r: number; date?: string };
export type MapLink = { a: string; b: string; rel: "contem" | "cita" | "participa" | "origem" };
export type MapGraph = { nodes: MapNode[]; links: MapLink[]; counts: Record<Kind, number> };

export const KINDS: { k: Kind; label: string; color: string; base: number }[] = [
  { k: "projeto", label: "Projetos", color: "var(--violet)", base: 24 }, { k: "dossie", label: "Dossiês", color: "var(--cyan)", base: 15 }, { k: "demanda", label: "Demandas", color: "oklch(0.74 0.2 350)", base: 9 },
  { k: "anotacao", label: "Anotações", color: "oklch(0.8 0.15 75)", base: 6 }, { k: "doc", label: "Documentação", color: "var(--emerald)", base: 7 }, { k: "tarefa", label: "Tarefas", color: "oklch(0.78 0.16 70)", base: 6 },
  { k: "ideia", label: "Ideias", color: "oklch(0.82 0.16 95)", base: 8 }, { k: "reuniao", label: "Reuniões", color: "oklch(0.7 0.18 280)", base: 10 }, { k: "pessoa", label: "Pessoas", color: "oklch(0.8 0.1 210)", base: 8 },
  { k: "conversa", label: "Conversas", color: "oklch(0.75 0.17 160)", base: 9 }, { k: "pedido", label: "Pedidos WhatsApp", color: "oklch(0.72 0.19 25)", base: 6 },
];
export const KIND = Object.fromEntries(KINDS.map((x) => [x.k, x])) as Record<Kind, (typeof KINDS)[number]>;

export type MapData = {
  projects: { id: string; name: string }[]; dossiers: { project_id: string; id: string; name: string }[];
  demands: { project_id: string; code: string; type: string; title: string; status: string; priority: string; dossier_name: string | null }[];
  execs: { project_id: string; code: string; dossier_name: string; status: string }[];
  pnotes: { id: number | string; project_id: string; text: string; dossier_id: string | null }[];
  entries: { id: string; title: string; text: string; date: string; project_id: string | null; dossier_names: string[]; source: string }[];
  tasks: { id: string; title: string; done: boolean; project_id: string | null; dossier_id: string | null; due_date: string | null }[];
  ideas: { id: string; title: string; status: string; converted: { tipo: string; id: string }[] }[];
  meetings: { id: string; title: string; analysis: { participantes?: string[]; resumo?: string } | null; happened_on: string }[];
  requests: { key: string; title: string; asker: string; chat_name: string; is_group: boolean; status: string }[];
};
export const emptyData = (): MapData => ({ projects: [], dossiers: [], demands: [], execs: [], pnotes: [], entries: [], tasks: [], ideas: [], meetings: [], requests: [] });

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const CODE = /#?\b([GPM])0?(\d{2,3})\b/gi;
export const codesIn = (t: string) => [...new Set([...t.matchAll(CODE)].map((m) => `${m[1]!.toUpperCase()}0${m[2]!.padStart(2, "0").slice(-2)}`))];
const short = (s: string, n = 46) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t || "Sem título"; };

export function buildMap(d: MapData): MapGraph {
  const nodes = new Map<string, MapNode>(), links: MapLink[] = [], seen = new Set<string>();
  const node = (id: string, kind: Kind, label: string, o: Partial<MapNode> = {}) => { if (!nodes.has(id)) nodes.set(id, { id, kind, label: short(label), sub: "", open: false, urgent: false, link: "/cerebro", degree: 0, r: KIND[kind].base, ...o }); return id; };
  const link = (a: string, b: string, rel: MapLink["rel"]) => { if (a === b || !nodes.has(a) || !nodes.has(b)) return; const k = a < b ? `${a}|${b}` : `${b}|${a}`; if (seen.has(k)) return; seen.add(k); links.push({ a, b, rel }); };

  for (const p of d.projects) node(`p:${p.id}`, "projeto", p.name, { link: `/demandas?projeto=${encodeURIComponent(p.id)}`, sub: "Projeto" });
  const dossByName = new Map<string, string>(), dossById = new Map<string, string>(), dossierWords: { id: string; n: string }[] = [];
  for (const x of d.dossiers) {
    const id = node(`d:${x.project_id}:${x.id}`, "dossie", x.name, { link: `/demandas?projeto=${encodeURIComponent(x.project_id)}`, sub: "Dossiê" });
    dossByName.set(`${x.project_id}|${norm(x.name)}`, id); dossById.set(`${x.project_id}|${x.id}`, id); if (norm(x.name).length >= 4) dossierWords.push({ id, n: norm(x.name) });
    link(`p:${x.project_id}`, id, "contem");
  }
  const demandNode = new Map<string, string>(), demandByCode = new Map<string, string>();
  for (const x of d.demands) {
    const open = x.status !== "done", id = node(`m:${x.project_id}:${x.code}`, "demanda", x.title, { sub: `${x.code} · ${x.status === "done" ? "concluída" : x.status === "doing" ? "em andamento" : "a fazer"}`, open, urgent: open && x.priority === "alta", link: `/demandas?projeto=${encodeURIComponent(x.project_id)}` });
    demandNode.set(`${x.project_id}|${x.code}`, id); if (!demandByCode.has(x.code.toUpperCase())) demandByCode.set(x.code.toUpperCase(), id);
    link(id, `p:${x.project_id}`, "contem");
    if (x.dossier_name) { const dn = dossByName.get(`${x.project_id}|${norm(x.dossier_name)}`); if (dn) link(id, dn, "contem"); }
  }
  for (const e of d.execs) { const m = demandNode.get(`${e.project_id}|${e.code}`), dn = dossByName.get(`${e.project_id}|${norm(e.dossier_name)}`); if (m && dn) link(m, dn, "contem"); }

  /** Liga um texto às demandas (por código) e aos dossiês (pelo nome) que ele cita. */
  const mentions = (id: string, text: string, skipDossiers = false) => {
    for (const c of codesIn(text)) { const m = demandByCode.get(c); if (m) link(id, m, "cita"); }
    if (!skipDossiers) { const t = ` ${norm(text)} `; for (const w of dossierWords) if (t.includes(` ${w.n} `)) link(id, w.id, "cita"); }
  };

  for (const n of d.pnotes) {
    const id = node(`n:${n.id}`, "anotacao", n.text, { sub: "Nota do projeto", link: `/demandas?projeto=${encodeURIComponent(n.project_id)}` });
    link(id, `p:${n.project_id}`, "contem"); if (n.dossier_id) { const dn = dossById.get(`${n.project_id}|${n.dossier_id}`); if (dn) link(id, dn, "contem"); } mentions(id, n.text);
  }
  for (const e of d.entries) {
    const doc = e.source === "documentacao", id = node(`e:${e.id}`, doc ? "doc" : "anotacao", e.title || e.text, { sub: doc ? "Documentação" : "Segundo cérebro", date: e.date, link: "/cerebro" });
    if (e.project_id) link(id, `p:${e.project_id}`, "contem");
    for (const dn of e.dossier_names ?? []) { const t = e.project_id ? dossByName.get(`${e.project_id}|${norm(dn)}`) : [...dossByName.entries()].find(([k]) => k.endsWith(`|${norm(dn)}`))?.[1]; if (t) link(id, t, "contem"); }
    mentions(id, `${e.title} ${e.text}`.slice(0, 4000), true);
  }
  for (const t of d.tasks) {
    const id = node(`t:${t.id}`, "tarefa", t.title, { sub: t.done ? "Tarefa concluída" : `Tarefa${t.due_date ? ` · ${t.due_date.split("-").reverse().slice(0, 2).join("/")}` : ""}`, open: !t.done, link: "/tarefas" });
    if (t.project_id) link(id, `p:${t.project_id}`, "contem"); if (t.project_id && t.dossier_id) { const dn = dossById.get(`${t.project_id}|${t.dossier_id}`); if (dn) link(id, dn, "contem"); } mentions(id, t.title);
  }
  for (const i of d.ideas) {
    const id = node(`i:${i.id}`, "ideia", i.title, { sub: `Ideia · ${i.status}`, open: i.status !== "projeto" && i.status !== "arquivada", link: "/ideias" });
    for (const c of i.converted ?? []) if (c.tipo === "projeto") link(id, `p:${c.id}`, "origem"); mentions(id, i.title);
  }
  const people = new Map<string, string>(), person = (name: string) => { const k = norm(name); if (k.length < 2) return null; if (!people.has(k)) people.set(k, node(`s:${k}`, "pessoa", name, { sub: "Pessoa", link: "/reunioes" })); return people.get(k)!; };
  for (const m of d.meetings) {
    const id = node(`r:${m.id}`, "reuniao", m.title, { sub: "Reunião", date: m.happened_on, link: "/reunioes" });
    for (const p of m.analysis?.participantes ?? []) { const pid = person(p); if (pid) link(id, pid, "participa"); }
    mentions(id, `${m.title} ${m.analysis?.resumo ?? ""}`);
  }
  const chats = new Map<string, string>();
  for (const r of d.requests) {
    const open = r.status !== "descartada", id = node(`q:${r.key}`, "pedido", r.title, { sub: r.status === "enviada" ? "Pedido virou demanda" : "Pedido descartado", open: false, link: "/reunioes?aba=demandas" });
    void open;
    const ck = norm(r.chat_name); if (ck) { if (!chats.has(ck)) chats.set(ck, node(`c:${ck}`, "conversa", r.chat_name, { sub: r.is_group ? "Grupo do WhatsApp" : "Conversa privada", link: "/reunioes?aba=demandas" })); link(id, chats.get(ck)!, "origem"); }
    const pid = person(r.asker); if (pid) link(id, pid, "participa"); mentions(id, `${r.title} ${r.chat_name}`);
  }
  for (const [ck, cid] of chats) { const t = ` ${ck} `; for (const w of dossierWords) if (t.includes(` ${w.n} `)) link(cid, w.id, "cita"); }

  const list = [...nodes.values()];
  for (const l of links) { nodes.get(l.a)!.degree++; nodes.get(l.b)!.degree++; }
  for (const n of list) n.r = KIND[n.kind].base + Math.min(14, Math.sqrt(n.degree) * (n.kind === "projeto" || n.kind === "dossie" ? 1.8 : 1.2));
  const counts = Object.fromEntries(KINDS.map((k) => [k.k, 0])) as Record<Kind, number>; for (const n of list) counts[n.kind]++;
  return { nodes: list, links, counts };
}

/** Pequena rede inventada para ver como o mapa fica (não usa dados reais). */
export function demoData(): MapData {
  const d = emptyData(); d.projects = [{ id: "p4c", name: "P4C" }, { id: "casa", name: "Casa & Vida" }];
  const polos = ["Alagoinhas", "Petrolina", "Duque de Caxias", "BH Centro", "Juiz de Fora", "Redenção", "São Vicente", "Presidente Prudente", "Volta Redonda", "Itanhaém"];
  d.dossiers = polos.map((n, i) => ({ project_id: "p4c", id: `d${i}`, name: n }));
  const titles = ["Verificar mensagens automáticas", "Criar usuários da turma", "Reconectar o número", "Template reprovado", "Disparo de novembro", "Erro ao enviar vídeo", "Ajustar fluxo de atendimento", "Treinar equipe nova", "Relatório de entrega", "Mensagem fora do horário", "Configurar filas", "Migrar para API oficial"];
  d.demands = titles.flatMap((t, i) => [0, 1].map((k) => ({ project_id: "p4c", code: `${"GPM"[(i + k) % 3]}${String(40 + i * 2 + k).padStart(3, "0")}`, type: "polo", title: `${t} — ${polos[(i + k * 3) % polos.length]}`, status: (["todo", "doing", "done"] as const)[(i + k) % 3] ?? "todo", priority: i % 4 === 0 ? "alta" : "media", dossier_name: polos[(i + k * 3) % polos.length]! })));
  d.entries = polos.slice(0, 6).map((p, i) => ({ id: `e${i}`, title: `Ata do alinhamento com ${p}`, text: `Falamos do #${d.demands[i * 2]!.code} e do polo ${p}.`, date: "2026-11-1" + i, project_id: "p4c", dossier_names: [p], source: i % 2 ? "documentacao" : "orion" }));
  d.tasks = ["Comprar tomate", "Levar o carro na revisão", "Ligar para o contador", "Estudar templates"].map((t, i) => ({ id: `t${i}`, title: t, done: i === 1, project_id: i === 3 ? "p4c" : "casa", dossier_id: null, due_date: "2026-11-2" + i }));
  d.ideas = [{ id: "i1", title: "Painel de saúde do CRM", status: "solta", converted: [] }, { id: "i2", title: "Assistente de reuniões", status: "projeto", converted: [{ tipo: "projeto", id: "p4c" }] }];
  d.meetings = [{ id: "r1", title: "Alinhamento do disparo (P4C)", analysis: { participantes: ["Ana", "Bia", "Carlos"], resumo: "Disparo em Alagoinhas e Petrolina." }, happened_on: "2026-11-18" }];
  d.requests = [{ key: "q1", title: "Reconectar o número", asker: "Carla", chat_name: "P4C x Petrolina", is_group: true, status: "enviada" }, { key: "q2", title: "Criar usuário novo", asker: "Bruno", chat_name: "Bruno", is_group: false, status: "enviada" }];
  return d;
}
