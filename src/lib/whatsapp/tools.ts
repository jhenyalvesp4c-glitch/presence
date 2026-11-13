/** Ações de voz do WhatsApp. Rodam no servidor (app local) ou no navegador (site publicado), conforme onde a ponte é alcançada. */
import { periodOf } from "../orion";
import type { ChatView, Panel } from "../voice/agent";

export type WaMessage = { sender_name: string; from_me: boolean; ts: number; text: string; kind: string; mentions_me: boolean; reply_to_me: boolean; is_group: boolean; chat_name: string };
export type Fetcher = (path: string, method?: "GET" | "POST") => Promise<{ ok: true; data: unknown } | { ok: false; erro: string; offline?: boolean }>;
export const WA_TOOLS = new Set(["whatsapp_conversas", "whatsapp_ler", "whatsapp_mencoes", "whatsapp_marcar_lidas"]);
export type ToolOut = { result: Record<string, unknown>; panel?: Panel; offline?: boolean };

/** "hoje", "ontem", "esta semana"… ou AAAA-MM-DD → segundos desde 1970 (início do dia, horário de Brasília). */
export function sinceOf(v: unknown, today: string): number | undefined {
  const t = String(v ?? "").trim();
  if (!t) return undefined;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : periodOf(t, today)?.from;
  return day ? Math.floor(new Date(`${day}T00:00:00-03:00`).getTime() / 1000) : undefined;
}
const when = (ts: number) => new Date(ts * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export async function runWhatsAppTool(name: string, args: Record<string, unknown>, fetcher: Fetcher, today: string): Promise<ToolOut> {
  const fail = (r: { erro: string; offline?: boolean }): ToolOut => ({ result: { ok: false, erro: r.erro }, ...(r.offline ? { offline: true } : {}) });

  if (name === "whatsapp_conversas") {
    const r = await fetcher(`/chats?q=${encodeURIComponent(String(args["busca"] ?? ""))}&limit=15`);
    if (!r.ok) return fail(r);
    const chats = (r.data as { chats: { name: string; is_group: boolean; novas: number; last_ts: number }[] }).chats ?? [];
    return { result: { ok: true, conversas: chats.map((c) => ({ nome: c.name, tipo: c.is_group ? "grupo" : "contato", mensagens_novas: c.novas, ultima: c.last_ts ? new Date(c.last_ts * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "sem mensagens guardadas" })), total_novas: chats.reduce((n, c) => n + c.novas, 0) } };
  }

  if (name === "whatsapp_ler") {
    const since = sinceOf(args["desde"], today);
    const params = new URLSearchParams({ chat: String(args["conversa"] ?? ""), limit: String(Math.min(60, Math.max(1, Number(args["limite"]) || 30))) });
    if (since) params.set("since", String(since));
    if (args["so_novas"] === true) { params.set("novas", "1"); params.set("marcar", "1"); }
    if (args["buscar"]) params.set("q", String(args["buscar"]));
    const r = await fetcher(`/messages?${params}`);
    if (!r.ok) return fail(r);
    const d = r.data as { ok: boolean; erro?: string; opcoes?: string[]; chat?: { name: string; is_group: boolean }; messages?: WaMessage[] };
    if (!d.ok) return { result: { ok: false, erro: d.erro, ...(d.opcoes ? { opcoes: d.opcoes } : {}) } };
    const msgs = d.messages ?? [];
    const who = (m: WaMessage) => (m.from_me ? "Você" : m.sender_name || "Alguém");
    const day = (ts: number) => new Date(ts * 1000).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
    const hour = (ts: number) => new Date(ts * 1000).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
    const chat: ChatView = { nome: d.chat?.name ?? "", grupo: !!d.chat?.is_group, mensagens: msgs.map((m) => ({ quem: m.from_me ? "Você" : m.sender_name || "Alguém", minha: m.from_me, dia: day(m.ts), hora: hour(m.ts), texto: m.text.slice(0, 1500), tipo: m.kind, marcou: m.mentions_me || m.reply_to_me })) };
    const panel: Panel | undefined = msgs.length ? { titulo: `WhatsApp · ${d.chat?.name ?? ""}`, secoes: [], chat } : undefined;
    return { ...(panel ? { panel } : {}), result: { ok: true, conversa: d.chat?.name, grupo: !!d.chat?.is_group, total: msgs.length, mensagens: msgs.map((m) => ({ quem: who(m), quando: when(m.ts), texto: (m.text || `(${m.kind})`).slice(0, 500), marcou_voce: m.mentions_me || m.reply_to_me })),
      dica: msgs.length ? "Diga quantas mensagens há e leia: cite quem falou e o que disse. Se forem muitas, resuma e ofereça ler tudo." : "Diga que não há mensagens nesse período." } };
  }

  if (name === "whatsapp_marcar_lidas") {
    const chat = String(args["conversa"] ?? "").trim();
    const r = await fetcher(`/marcar-lidas${chat ? `?chat=${encodeURIComponent(chat)}` : ""}`, "POST");
    if (!r.ok) return fail(r);
    const d = r.data as { ok?: boolean; erro?: string; opcoes?: string[]; conversas?: number; nome?: string };
    if (d.ok === false || d.erro) return { result: { ok: false, erro: d.erro, ...(d.opcoes ? { opcoes: d.opcoes } : {}) } };
    return { result: { ok: true, marcadas: d.conversas ?? 0, conversa: d.nome, aviso: "Só o controle do Presence foi marcado; o WhatsApp do celular não mudou." } };
  }

  if (name === "whatsapp_mencoes") {
    const since = sinceOf(args["desde"], today) ?? Math.floor(Date.now() / 1000) - 86400;
    const r = await fetcher(`/mentions?after=${since}&limit=30`);
    if (!r.ok) return fail(r);
    const m = (r.data as { mentions: WaMessage[] }).mentions ?? [];
    return { result: { ok: true, total: m.length, mencoes: m.map((x) => ({ quem: x.sender_name || "Alguém", onde: x.is_group ? `grupo ${x.chat_name}` : "conversa direta", texto: (x.text || `(${x.kind})`).slice(0, 400), tipo: x.mentions_me ? "marcou você" : "respondeu a você" })) } };
  }

  return { result: { ok: false, erro: "ferramenta desconhecida" } };
}
