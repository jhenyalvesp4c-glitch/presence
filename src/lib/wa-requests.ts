/** Verificar demandas no WhatsApp: monta lotes de mensagens (grupos e conversas privadas), limpa o que a IA devolve e transforma os pedidos escolhidos no texto que vai para a Central. Funções puras. */
export type WaMessage = { id: string; chat: string; chat_name: string; is_group: boolean; sender_name: string; from_me: boolean; ts: number; text: string; kind: string; has_media?: boolean; media_mime?: string };
export type ImageRef = { n: number; chat: string; id: string; mime: string; ts: number; chatName: string };
export type Batch = { text: string; chats: string[]; count: number; images: ImageRef[] };
export type Priority = "alta" | "media" | "baixa";
export type Req = { key: string; chat: string; grupo: boolean; quem: string; titulo: string; detalhes: string; trecho: string; quando: string; prazo: string | null; prioridade: Priority; paraMim: "sim" | "talvez"; resolvido: boolean; imagens: number[]; confianca: "alta" | "media" | "baixa" };

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
    return [{ key: reqKey(chat, quem, titulo, quando), chat, grupo: x["grupo"] === true, quem, titulo, detalhes: str(x["detalhes"], 800), trecho: str(x["trecho"], 500), quando, prazo: date(x["prazo"]), prioridade: pr === "alta" || pr === "baixa" ? pr : "media", paraMim: x["paraMim"] === "talvez" ? "talvez" : "sim", resolvido: x["resolvido"] === true,
      imagens: (Array.isArray(x["imagens"]) ? (x["imagens"] as unknown[]) : []).map(Number).filter((n) => validImages.has(n)).slice(0, 4), confianca: conf === "baixa" || conf === "media" ? conf : "alta" }];
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
