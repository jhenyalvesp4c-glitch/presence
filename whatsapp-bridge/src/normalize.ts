// Interpreta mensagens do WhatsApp (formato do Baileys) e descobre quem marcou a pessoa. Sem rede, só leitura.
// Escrito em TypeScript "apagável" para rodar direto no Node 22.18+/24.

export type Me = { jids: string[]; name: string };
export type Msg = {
  id: string; chat: string; chat_name: string; is_group: boolean; sender: string; sender_name: string; from_me: boolean;
  ts: number; text: string; kind: string; mentions_me: boolean; reply_to_me: boolean;
  /** Nomes de quem foi marcado na mensagem (preenchido ao ler do banco). */
  marcados?: string[];
};

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** "5511999999999:12@s.whatsapp.net" → "5511999999999" */
export const jidUser = (j: string | undefined | null): string => String(j ?? "").split("@")[0]!.split(":")[0]!;
export const isGroupJid = (j: string): boolean => j.endsWith("@g.us");

/** Tira os "envelopes" (mensagem temporária, ver uma vez, documento com legenda…). */
export function unwrap(message: Json | null | undefined): Json {
  let m: Json = message ?? {};
  for (let i = 0; i < 5; i++) {
    const inner = m["ephemeralMessage"]?.message ?? m["viewOnceMessage"]?.message ?? m["viewOnceMessageV2"]?.message ?? m["documentWithCaptionMessage"]?.message ?? m["editedMessage"]?.message;
    if (!inner) break;
    m = inner;
  }
  return m;
}

export function textOf(message: Json | null | undefined): string {
  const m = unwrap(message);
  return String(m["conversation"] ?? m["extendedTextMessage"]?.text ?? m["imageMessage"]?.caption ?? m["videoMessage"]?.caption ?? m["documentMessage"]?.caption
    ?? m["buttonsResponseMessage"]?.selectedDisplayText ?? m["listResponseMessage"]?.title ?? m["protocolMessage"]?.editedMessage?.conversation ?? "");
}

export function kindOf(message: Json | null | undefined): string {
  const m = unwrap(message);
  if (m["conversation"] || m["extendedTextMessage"]) return "texto";
  if (m["imageMessage"]) return "imagem";
  if (m["videoMessage"]) return "video";
  if (m["audioMessage"]) return m["audioMessage"].ptt ? "audio de voz" : "audio";
  if (m["documentMessage"]) return "documento";
  if (m["stickerMessage"]) return "figurinha";
  if (m["contactMessage"] || m["contactsArrayMessage"]) return "contato";
  if (m["locationMessage"] || m["liveLocationMessage"]) return "localizacao";
  if (m["pollCreationMessage"] || m["pollCreationMessageV3"]) return "enquete";
  return "outro";
}

function contextOf(message: Json | null | undefined): Json {
  const m = unwrap(message);
  for (const k of Object.keys(m)) { const ci = m[k]?.contextInfo; if (ci) return ci; }
  return {};
}

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Decide se a mensagem marca a pessoa (@menção) ou responde a uma mensagem dela. */
export function mentionInfo(message: Json | null | undefined, text: string, me: Me): { mentions_me: boolean; reply_to_me: boolean } {
  const ci = contextOf(message);
  const mine = new Set(me.jids.map(jidUser).filter(Boolean));
  const mentioned: string[] = Array.isArray(ci["mentionedJid"]) ? ci["mentionedJid"] : [];
  let mentions = mentioned.some((j) => mine.has(jidUser(j)));
  if (!mentions) for (const n of mine) if (n.length >= 6 && text.includes(`@${n}`)) { mentions = true; break; }
  if (!mentions && me.name) { const nm = stripAccents(me.name).toLowerCase().trim(); if (nm.length >= 3 && stripAccents(text).toLowerCase().includes(`@${nm}`)) mentions = true; }
  const reply = !!ci["quotedMessage"] && mine.has(jidUser(ci["participant"]));
  return { mentions_me: mentions, reply_to_me: reply };
}

/** Converte uma mensagem do Baileys no nosso formato. Devolve null para o que não interessa (status, sistema, vazias). */
export function normalizeMessage(m: Json, me: Me, chatName = ""): Msg | null {
  const key = m["key"] ?? {};
  const chat = String(key["remoteJid"] ?? "");
  if (!chat || chat === "status@broadcast" || chat.endsWith("@broadcast") || chat.endsWith("@newsletter")) return null;
  const message = m["message"];
  if (!message) return null;
  const um = unwrap(message);
  if (um["protocolMessage"] && !um["protocolMessage"].editedMessage) return null; // apagar/histórico: ignora
  if (um["reactionMessage"] || um["senderKeyDistributionMessage"]) return null;
  const text = textOf(message).trim();
  const kind = kindOf(message);
  if (!text && kind === "outro") return null;
  const group = isGroupJid(chat);
  const fromMe = !!key["fromMe"];
  const sender = fromMe ? (me.jids[0] ?? "") : (group ? String(key["participant"] ?? m["participant"] ?? "") : chat);
  const tsRaw = m["messageTimestamp"];
  const ts = Number(typeof tsRaw === "object" && tsRaw && "toNumber" in tsRaw ? (tsRaw as { toNumber(): number }).toNumber() : tsRaw) || Math.floor(Date.now() / 1000);
  const { mentions_me, reply_to_me } = fromMe ? { mentions_me: false, reply_to_me: false } : mentionInfo(message, text, me);
  return {
    id: String(key["id"] ?? `${chat}-${ts}`), chat, chat_name: chatName, is_group: group, sender, sender_name: fromMe ? (me.name || "Você") : String(m["pushName"] ?? ""),
    from_me: fromMe, ts, text: text.slice(0, 4000), kind, mentions_me, reply_to_me,
  };
}
