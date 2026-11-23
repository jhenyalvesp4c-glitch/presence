import { nextCode, type CheckItem, type Demand } from "./demands";

/** Verificar demandas no WhatsApp: monta lotes de mensagens (grupos e conversas privadas), limpa o que a IA devolve e transforma os pedidos escolhidos no texto que vai para a Central. Funções puras. */
export type WaMessage = { id: string; chat: string; chat_name: string; is_group: boolean; sender_name: string; from_me: boolean; ts: number; text: string; kind: string; has_media?: boolean; media_mime?: string };
export type ImageRef = { n: number; chat: string; id: string; mime: string; ts: number; chatName: string };
export type Batch = { text: string; chats: string[]; count: number; images: ImageRef[] };
export type Priority = "alta" | "media" | "baixa";
/** Texto que alguém mandou (template, mensagem, lista, link, dados): vai inteiro, separado, para o Material da demanda. */
export type Conteudo = { titulo: string; texto: string };
export type Req = { key: string; chat: string; grupo: boolean; quem: string; titulo: string; detalhes: string; trecho: string; quando: string; prazo: string | null; prioridade: Priority; paraMim: "sim" | "talvez"; resolvido: boolean; imagens: number[]; confianca: "alta" | "media" | "baixa" ; tipo: "pedido" | "complemento"; demanda: string | null; passos: string[]; conteudos: Conteudo[] };

const pad = (n: number) => String(n).padStart(2, "0");
export const stamp = (ts: number) => { const d = new Date(ts * 1000); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const isFile = (m: WaMessage) => !!m.has_media && !!m.media_mime && (m.media_mime.startsWith("image/") || m.media_mime === "application/pdf");

/** Início do período em segundos: desde uma data/hora (última verificação) ou as últimas N horas. */
export const sinceSeconds = (period: "ultima" | "hoje" | "24h" | "3d" | "7d", last: number | null, now = new Date()): number => {
  const nowS = Math.floor(now.getTime() / 1000);
  if (period === "ultima") return last && last > 0 ? last : nowS - 86400;
  if (period === "hoje") { const d = new Date(now); d.setHours(0, 0, 0, 0); return Math.floor(d.getTime() / 1000); }
  return nowS - (period === "24h" ? 24 : period === "3d" ? 72 : 168) * 3600;
};

/** Agrupa por conversa e descarta as conversas em que só você falou. */
export function groupChats(msgs: WaMessage[], opts: { grupos: boolean; privadas: boolean }) {
  const m = new Map<string, { jid: string; name: string; grupo: boolean; msgs: WaMessage[] }>();
  for (const x of [...msgs].sort((a, b) => a.ts - b.ts)) {
    if (x.is_group ? !opts.grupos : !opts.privadas) continue;
    const g = m.get(x.chat) ?? { jid: x.chat, name: x.chat_name || x.chat.split("@")[0]!, grupo: x.is_group, msgs: [] };
    g.msgs.push(x); m.set(x.chat, g);
  }
  return [...m.values()].filter((c) => c.msgs.some((x) => !x.from_me && (x.text.trim() || isFile(x)))).sort((a, b) => b.msgs.length - a.msgs.length);
}

const lineOf = (x: WaMessage, n: number | null) => {
  const body = x.text.trim().replace(/\n+/g, " / ") || "", who = x.from_me ? "Eu" : x.sender_name || "Contato";
  const tag = n !== null ? `[${x.media_mime === "application/pdf" ? "pdf" : "imagem"} #${n}]` : x.kind && x.kind !== "texto" && !body ? `[${x.kind}]` : "";
  const text = [tag, body].filter(Boolean).join(" ");
  return text ? `[${stamp(x.ts)}] ${who}: ${text}` : "";
};

/** Quebra as conversas em lotes que cabem numa chamada da IA (por tamanho do texto) e numera as imagens/PDFs (as mais recentes de cada lote entram, até `maxImages`). */
export function buildBatches(chats: ReturnType<typeof groupChats>, opts: { maxChars?: number; maxImages?: number; withImages?: boolean } = {}): Batch[] {
  const maxChars = opts.maxChars ?? 40000, maxImages = opts.maxImages ?? 6, batches: Batch[] = [];
  let cur: Batch = { text: "", chats: [], count: 0, images: [] }, n = 0;
  const flush = () => { if (cur.text.trim()) batches.push(cur); cur = { text: "", chats: [], count: 0, images: [] }; };
  for (const c of chats) {
    const head = (cont: boolean) => `=== ${c.grupo ? "Grupo" : "Conversa privada"}: ${c.name}${cont ? " (continuação)" : ""} ===`;
    let block = head(false), blockImgs: ImageRef[] = [], blockCount = 0;
    const close = () => { if (blockCount) { if (cur.text.length + block.length > maxChars && cur.text) flush(); cur.text += `${cur.text ? "\n\n" : ""}${block}`; cur.chats.push(c.name); cur.count += blockCount; cur.images.push(...blockImgs); } block = head(true); blockImgs = []; blockCount = 0; };
    for (const x of c.msgs) {
      const img = opts.withImages !== false && isFile(x);
      const ref: ImageRef | null = img ? { n: ++n, chat: x.chat, id: x.id, mime: x.media_mime!, ts: x.ts, chatName: c.name } : null;
      const ln = lineOf(x, ref ? ref.n : null); if (!ln) { if (ref) n--; continue; }
      if (block.length + ln.length > maxChars - 200) close();
      block += `\n${ln}`; blockCount++; if (ref) blockImgs.push(ref);
    }
    close();
  }
  flush();
  // só as imagens mais recentes de cada lote seguem para a IA (custo); as outras ficam só como marcador no texto
  return batches.map((b) => ({ ...b, images: [...b.images].sort((x, y) => y.ts - x.ts).slice(0, maxImages).sort((x, y) => x.n - y.n) }));
}

/* ───────────── resposta da IA ───────────── */
const str = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const date = (v: unknown) => { const s = str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null; };
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
export const reqKey = (chat: string, quem: string, titulo: string, quando: string) => `wa:${hash(`${norm(chat)}|${norm(quem)}|${norm(titulo).slice(0, 70)}|${quando.slice(0, 5)}`)}`;

export function cleanRequests(raw: unknown, validImages: Set<number>): Req[] {
  const list = raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>)["pedidos"]) ? ((raw as Record<string, unknown>)["pedidos"] as unknown[]) : [];
  return list.flatMap((p): Req[] => {
    const x = p as Record<string, unknown> | null, titulo = str(x?.["titulo"], 200);
    if (!x || !titulo) return [];
    const chat = str(x["chat"], 120) || "Conversa", quem = str(x["quem"], 80) || "Alguém", quando = str(x["quando"], 20), pr = x["prioridade"], conf = x["confianca"];
    return [{ key: reqKey(chat, quem, titulo, quando), chat, grupo: x["grupo"] === true, quem, titulo, detalhes: str(x["detalhes"], 3000), trecho: str(x["trecho"], 500), quando, prazo: date(x["prazo"]), prioridade: pr === "alta" || pr === "baixa" ? pr : "media", paraMim: x["paraMim"] === "talvez" ? "talvez" : "sim", resolvido: x["resolvido"] === true,
      imagens: (Array.isArray(x["imagens"]) ? (x["imagens"] as unknown[]) : []).map(Number).filter((n) => validImages.has(n)).slice(0, 4), confianca: conf === "baixa" || conf === "media" ? conf : "alta", tipo: x["tipo"] === "complemento" ? "complemento" : "pedido", demanda: str(x["demanda"], 20).replace(/^#/, "").toUpperCase() || null,
      passos: (Array.isArray(x["passos"]) ? (x["passos"] as unknown[]) : []).map((t) => str(t, 400)).filter(Boolean).slice(0, 12),
      conteudos: (Array.isArray(x["conteudos"]) ? (x["conteudos"] as unknown[]) : []).flatMap((c): Conteudo[] => { const o = c as Record<string, unknown> | null, texto = str(o?.["texto"], 4000); return texto ? [{ titulo: str(o?.["titulo"], 120) || "Conteúdo recebido", texto }] : []; }).slice(0, 8) }];
  }).slice(0, 60);
}
/** Junta os pedidos de vários lotes, sem repetir, e põe os que são para você e ainda abertos primeiro. */
export function mergeRequests(lists: Req[][]): Req[] {
  const m = new Map<string, Req>();
  for (const r of lists.flat()) { const o = m.get(r.key); if (!o) m.set(r.key, r); else m.set(r.key, { ...o, imagens: [...new Set([...o.imagens, ...r.imagens])] }); }
  const rank = (r: Req) => (r.resolvido ? 4 : 0) + (r.paraMim === "talvez" ? 2 : 0) + (r.confianca === "baixa" ? 1 : 0);
  return [...m.values()].sort((a, b) => rank(a) - rank(b));
}

const dm = (iso: string) => iso.split("-").reverse().join("/");
/** Texto entregue à Central de entrada para os pedidos que você marcou como demanda. */
export function requestsToInboxText(reqs: Req[], fileNames: Record<number, string> = {}): string {
  const L = ["Pedidos recebidos pelo WhatsApp que viram DEMANDAS (cada um é uma demanda). Use o nome do grupo ou da pessoa para achar o projeto/polo, se der:"];
  for (const r of reqs) {
    const files = r.imagens.map((n) => fileNames[n]).filter(Boolean);
    L.push(`- ${r.titulo} — pedido por ${r.quem} ${r.grupo ? `no grupo "${r.chat}"` : `em conversa privada (${r.chat})`} em ${r.quando}.${r.detalhes ? ` ${r.detalhes}` : ""}${r.prazo ? ` Prazo: ${dm(r.prazo)}.` : ""} Prioridade ${r.prioridade === "media" ? "normal" : r.prioridade}.${r.trecho ? ` Mensagem original: "${r.trecho}"` : ""}${files.length ? ` Evidência (arquivo anexado): ${files.join(", ")}.` : ""}`);
  }
  return L.join("\n");
}

/* ───────────── o que conta como demanda (conhecimento + aprendizado) ───────────── */
export const DEFAULT_RULES = `Tudo que envolve o CRM / P4C e o atendimento dos clientes por WhatsApp é trabalho meu. Conta como demanda (mesmo que a pessoa não escreva "preciso": um relato de erro ou uma dúvida dessas já é um pedido de ajuda):
- Mensagem automática enviada ao lead com erro, ou mensagem automática que não está sendo enviada
- Mensagem fora do horário de funcionamento (ausência) que não está sendo enviada
- Trocar ou alterar mensagens automáticas, textos e configurações do atendimento
- Criar usuários, dar acesso, permissão ou alterar cadastro de usuário
- Dúvida de como fazer algo no CRM / P4C
- Criar templates, ver se o template foi aprovado, template reprovado ou com erro ao enviar
- Disparo de campanha em massa: fazer, programar, conferir, erro no disparo
- Problemas no fluxo de atendimento (filas, distribuição, transferência, chatbot, encerrar conversa)
- Erro ao enviar mensagem; erro ao enviar vídeos, imagens, áudios ou arquivos
- Conexão do número: QR Code caiu, reconectar, número bloqueado ou limitado, API oficial
Normalmente NÃO é demanda minha: anúncios pagos e tráfego (saldo de anúncios, verba, criativos), cobranças e faturas, conversa social e avisos sem pedido.`;

export type Example = { titulo: string; chat: string; trecho: string };
const ex = (l: Example[]) => l.slice(0, 12).map((e) => `- "${e.titulo}" (${e.chat})${e.trecho ? ` — mensagem: "${e.trecho.slice(0, 140)}"` : ""}`).join("\n");
/** Trecho do prompt com o que conta como demanda para esta pessoa e o que ela já aceitou ou descartou antes. */
export function rulesPrompt(rules: string, aceitos: Example[], descartados: Example[]): string {
  const r = (rules.trim() || DEFAULT_RULES).slice(0, 5000), parts = [`O QUE É DEMANDA PARA ESTA PESSOA (conhecimento do trabalho dela; siga):\n${r}`];
  if (aceitos.length) parts.push(`Pedidos que ela JÁ ACEITOU como demanda (liste coisas parecidas):\n${ex(aceitos)}`);
  if (descartados.length) parts.push(`Pedidos que ela DESCARTOU, não eram demanda (não liste coisas parecidas):\n${ex(descartados)}`);
  return parts.join("\n\n");
}


/* ───────────── organizar nas demandas: atualizar a que já existe (checklist + detalhes) ou criar ───────────── */
const kw = (t: string) => norm(t).split(" ").filter((w) => w.length >= 4);
/** O dossiê (polo) que o nome do grupo/conversa cita: o nome mais longo contido no nome da conversa. */
export function matchDossier(chat: string, dossiers: string[]): string | null {
  const c = ` ${norm(chat)} `;
  const hits = dossiers.filter((d) => { const n = norm(d); return n.length >= 3 && c.includes(` ${n} `); });
  return hits.sort((a, b) => b.length - a.length)[0] ?? null;
}

export type OrgCtx = { pid: string; name: string; demands: Demand[]; dossiers: string[] };
export type OrgAction =
  | { kind: "update"; pid: string; project: string; code: string; title: string; dossier: string | null; add: string[]; notes: string[]; material: string[]; keys: string[]; deadline: string | null; priority: Priority }
  | { kind: "create"; pid: string; project: string; code?: string; dossier: string | null; title: string; add: string[]; notes: string[]; material: string[]; keys: string[]; deadline: string | null; priority: Priority };

const RANKP: Record<Priority, number> = { alta: 3, media: 2, baixa: 1 };
const bestP = (a: Priority, b: Priority): Priority => (RANKP[a] >= RANKP[b] ? a : b);
/** Passos do checklist: as ações concretas que a IA detalhou (uma por linha); sem elas, o título do pedido com a primeira frase. */
const stepsOf = (r: Req): string[] => (r.passos.length ? r.passos : [`${r.titulo}${r.detalhes ? ` — ${r.detalhes.split(/\n|(?<=[.!?])\s/)[0]!.slice(0, 220)}` : ""}`]).map((t) => t.slice(0, 480));
/** Observação CURTA (só o registro de que veio do WhatsApp): o conteúdo completo vai para o Material, organizado. */
export const noteOf = (r: Req) => `WhatsApp · ${r.quando} · ${r.quem} ${r.grupo ? `(grupo ${r.chat})` : `(conversa)`} — ${r.titulo}`.slice(0, 400);
const sectionHead = (r: Req) => `WhatsApp · ${r.quando} · ${r.quem}${r.grupo ? ` (grupo ${r.chat})` : ` (conversa com ${r.chat})`}`;
/** Texto organizado para o Material da demanda: o que fazer, contexto e cada conteúdo recebido, separado e inteiro (para copiar). */
export function materialOf(r: Req): string {
  const L = ["━━━━━━━━━━━━━━━━━━━━", sectionHead(r), `Pedido: ${r.titulo}`];
  if (r.prazo) L.push(`Prazo: ${dm(r.prazo)}`);
  const passos = stepsOf(r);
  if (r.passos.length) L.push("", "O QUE FAZER", ...passos.map((p, i) => `${i + 1}. ${p}`));
  if (r.detalhes.trim()) L.push("", "CONTEXTO", r.detalhes.trim());
  if (r.conteudos.length) { L.push("", "CONTEÚDOS RECEBIDOS"); for (const c of r.conteudos) L.push("", `▸ ${c.titulo}`, c.texto.trim()); }
  else if (r.trecho) L.push("", `Mensagem original: "${r.trecho}"`);
  return L.join("\n").slice(0, 12000);
}
const deadlineOf = (iso: string | null) => (iso ? dm(iso).slice(0, 5) : null);

/** Decide, para cada pedido escolhido, onde ele entra. Pedidos do mesmo dossiê entram na MESMA demanda (nunca uma demanda nova por pedido). */
export function planOrganize(reqs: Req[], ctx: OrgCtx[]): OrgAction[] {
  const actions = new Map<string, OrgAction>();
  const allDossiers = ctx.flatMap((c) => c.dossiers.map((name) => ({ name, c })));
  for (const r of reqs) {
    const dn = matchDossier(r.chat, allDossiers.map((d) => d.name)) ?? matchDossier(`${r.titulo} ${r.detalhes}`, allDossiers.map((d) => d.name));
    const home = (dn && allDossiers.find((d) => d.name === dn)?.c) || ctx[0];
    if (!home) continue;
    const open = home.demands.filter((d) => d.status !== "done");
    // 1) a IA já ligou a uma demanda aberta (código)
    let target = r.demanda ? open.find((d) => d.id.replace(/^#/, "").toUpperCase() === r.demanda) ?? ctx.flatMap((c) => c.demands).find((d) => d.status !== "done" && d.id.replace(/^#/, "").toUpperCase() === r.demanda) : undefined;
    // 2) demanda aberta do mesmo dossiê: a que mais combina com o assunto; se nenhuma combina, a mais recente (não cria outra)
    if (!target && dn) {
      const mine = open.filter((d) => d.type === "polo" && d.polo && norm(d.polo) === norm(dn));
      if (mine.length) {
        const words = new Set(kw(`${r.titulo} ${r.detalhes}`));
        const scored = mine.map((d) => ({ d, hit: kw(`${d.title} ${d.desc}`).filter((w) => words.has(w)).length })).sort((a, b) => b.hit - a.hit || b.d.id.localeCompare(a.d.id));
        target = scored[0]!.d;
      }
    }
    const targetCtx = target ? ctx.find((c) => c.demands.some((d) => d.id === target!.id)) ?? home : home;
    const key = target ? `u:${targetCtx.pid}:${target.id}` : `c:${home.pid}:${dn ? norm(dn) : "geral"}`;
    const cur = actions.get(key);
    const steps = stepsOf(r), note = noteOf(r), mat = materialOf(r), dl = deadlineOf(r.prazo);
    if (cur) {
      for (const st of steps) if (!cur.add.some((x) => norm(x) === norm(st))) cur.add.push(st);
      cur.notes.push(note); cur.material.push(mat); cur.keys.push(r.key); cur.priority = bestP(cur.priority, r.prioridade);
      if (dl && (!cur.deadline || dl < cur.deadline)) cur.deadline = dl;
    } else if (target) {
      actions.set(key, { kind: "update", pid: targetCtx.pid, project: targetCtx.name, code: target.id, title: target.title, dossier: target.polo ?? dn, add: [...steps], notes: [note], material: [mat], keys: [r.key], deadline: dl, priority: r.prioridade });
    } else {
      actions.set(key, { kind: "create", pid: home.pid, project: home.name, dossier: dn, title: r.titulo, add: [...steps], notes: [note], material: [mat], keys: [r.key], deadline: dl, priority: r.prioridade });
    }
  }
  return [...actions.values()].map((a) => (a.kind === "create" && a.add.length > 1 ? { ...a, title: `${a.dossier ?? "WhatsApp"}: ${a.add.length} pedidos` } : a));
}

/** Aplica o plano nas demandas de UM projeto (devolve a lista nova). Atualiza checklist, observações, histórico, prioridade e prazo. */
export function applyOrganize(demands: Demand[], actions: OrgAction[], today: Date = new Date()): Demand[] {
  let out = [...demands];
  const label = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}`;
  for (const a of actions) {
    if (a.kind === "update") {
      out = out.map((d) => {
        if (d.id !== a.code) return d;
        const have = new Set((d.checklist ?? []).map((c) => norm(c.text)));
        const add: CheckItem[] = a.add.filter((t) => !have.has(norm(t))).map((text) => ({ text, done: false }));
        const notes = a.notes.filter((n) => !d.notes.some((x) => norm(x) === norm(n)));
        return { ...d, checklist: [...(d.checklist ?? []), ...add], notes: [...d.notes, ...notes], priority: bestP(d.priority, a.priority), deadline: d.deadline && d.deadline !== "—" ? d.deadline : (a.deadline ?? d.deadline),
          history: [...d.history, { d: label, text: `Atualizada pelo WhatsApp: +${add.length} ${add.length === 1 ? "passo" : "passos"} no checklist`, s: d.status }] };
      });
    } else {
      const type = a.dossier ? "polo" : "geral";
      const desc = `Criada a partir de pedidos no WhatsApp. O que fazer está no checklist; as mensagens, templates e dados recebidos estão organizados no Material.\n${a.notes.map((n) => `• ${n}`).join("\n")}`.slice(0, 5000);
      out = [{ id: a.code ?? nextCode(out, type), type, ...(a.dossier ? { polo: a.dossier } : {}), title: a.title.slice(0, 300), desc, priority: a.priority, status: "todo", deadline: a.deadline ?? "",
        history: [{ d: label, text: `Criada pelo WhatsApp com ${a.add.length} ${a.add.length === 1 ? "passo" : "passos"} no checklist`, s: "todo" }], notes: [...a.notes], checklist: a.add.map((text) => ({ text, done: false })) } as Demand, ...out];
    }
  }
  return out;
}

/** Dá o código às demandas que vão ser criadas (antes de gravar), para o Material poder ser ligado a elas. */
export function assignCodes(demands: Demand[], actions: OrgAction[]): OrgAction[] {
  let list = [...demands];
  return actions.map((a) => {
    if (a.kind !== "create") return a;
    const type = a.dossier ? "polo" : "geral", code = nextCode(list, type);
    list = [{ id: code, type } as Demand, ...list];
    return { ...a, code };
  });
}
