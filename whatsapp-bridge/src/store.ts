// Guarda as mensagens só neste computador (SQLite embutido no Node). Leitura e busca; nada é enviado para fora daqui.
import type { DatabaseSync as DB } from "node:sqlite";
import type { Msg } from "./normalize.ts";

export const norm = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9@ ]+/g, " ").replace(/\s+/g, " ").trim();

/** Palavras que a pessoa diz mas não fazem parte do nome ("o grupo de Juiz de Fora"). */
const FILLER = new Set(["grupo", "conversa", "chat", "do", "da", "de", "dos", "das", "o", "a", "os", "as", "no", "na", "com", "meu", "minha"]);
export const nameWords = (q: string): string[] => { const all = norm(q).split(" ").filter(Boolean); const core = all.filter((w) => !FILLER.has(w)); return core.length ? core : all; };

export type ChatRow = { jid: string; name: string; is_group: number; last_ts: number; checked_ts: number };
export type ChatInfo = { jid: string; name: string; is_group: boolean; last_ts: number; novas: number };

// Carrega o SQLite embutido do Node sem import estático (o Vite dos testes não conhece esse módulo).
const { DatabaseSync } = (process as unknown as { getBuiltinModule(n: string): typeof import("node:sqlite") }).getBuiltinModule("node:sqlite");

export class Store {
  db: DB;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(`
      pragma journal_mode = wal;
      create table if not exists chats (jid text primary key, name text not null default '', is_group integer not null default 0, last_ts integer not null default 0, checked_ts integer not null default 0);
      create table if not exists messages (
        chat text not null, id text not null, sender text not null default '', sender_name text not null default '', from_me integer not null default 0,
        ts integer not null, text text not null default '', kind text not null default 'texto', mentions_me integer not null default 0, reply_to_me integer not null default 0,
        primary key (chat, id)
      );
      create index if not exists messages_ts_idx on messages (ts);
      create index if not exists messages_chat_ts_idx on messages (chat, ts);
      create table if not exists names (jid text primary key, name text not null);
    `);
  }

  setChatName(jid: string, name: string, isGroup?: boolean) {
    const n = name.trim();
    if (!n) return;
    this.db.prepare("insert into chats (jid, name, is_group) values (?, ?, ?) on conflict(jid) do update set name = excluded.name").run(jid, n, isGroup ?? jid.endsWith("@g.us") ? 1 : 0);
  }
  setContactName(jid: string, name: string) { if (name.trim()) this.db.prepare("insert into names (jid, name) values (?, ?) on conflict(jid) do update set name = excluded.name").run(jid, name.trim()); }
  nameOf(jid: string): string { const r = this.db.prepare("select name from names where jid = ?").get(jid) as { name: string } | undefined; return r?.name ?? ""; }

  /** Guarda a mensagem (ignora repetidas). Devolve true se era nova. */
  addMessage(m: Msg): boolean {
    const known = this.db.prepare("select name from chats where jid = ?").get(m.chat) as { name: string } | undefined;
    if (!known) this.db.prepare("insert into chats (jid, name, is_group) values (?, ?, ?)").run(m.chat, m.chat_name || "", m.is_group ? 1 : 0);
    else if (m.chat_name && !known.name) this.setChatName(m.chat, m.chat_name, m.is_group);
    if (m.sender_name && m.sender) this.setContactName(m.sender, m.sender_name);
    const r = this.db.prepare("insert or ignore into messages (chat, id, sender, sender_name, from_me, ts, text, kind, mentions_me, reply_to_me) values (?,?,?,?,?,?,?,?,?,?)")
      .run(m.chat, m.id, m.sender, m.sender_name, m.from_me ? 1 : 0, m.ts, m.text, m.kind, m.mentions_me ? 1 : 0, m.reply_to_me ? 1 : 0);
    if (Number(r.changes) > 0) { this.db.prepare("update chats set last_ts = max(last_ts, ?) where jid = ?").run(m.ts, m.chat); return true; }
    return false;
  }

  /** Conversas, da mais recente para a mais antiga, com quantas mensagens novas (que a Presence ainda não leu). */
  chats(q = "", limit = 40): ChatInfo[] {
    const rows = this.db.prepare(`
      select c.jid, c.name, c.is_group, c.last_ts,
        (select count(*) from messages m where m.chat = c.jid and m.ts > c.checked_ts and m.from_me = 0) as novas
      from chats c order by c.last_ts desc limit 500`).all() as (ChatRow & { novas: number })[];
    const words = nameWords(q);
    return rows
      .filter((r) => !words.length || words.every((w) => norm(`${r.name} ${r.jid}`).includes(w)))
      .slice(0, limit).map((r) => ({ jid: r.jid, name: r.name || this.nameOf(r.jid) || r.jid.split("@")[0]!, is_group: !!r.is_group, last_ts: r.last_ts, novas: Number(r.novas) }));
  }

  /** Acha uma conversa pelo nome (aproximado) ou pelo número. */
  findChat(query: string): { ok: true; chat: ChatInfo } | { ok: false; erro: string; opcoes?: string[] } {
    const q = query.trim();
    if (!q) return { ok: false, erro: "Diga o nome da conversa ou do grupo." };
    const direct = this.chats("", 500).find((c) => c.jid === q);
    if (direct) return { ok: true, chat: direct };
    const all = this.chats(q, 500);
    if (!all.length) return { ok: false, erro: `Não achei nenhuma conversa com "${q}".` };
    const exact = all.filter((c) => norm(c.name) === norm(q) || nameWords(c.name).join(" ") === nameWords(q).join(" "));
    if (exact.length === 1) return { ok: true, chat: exact[0]! };
    if (all.length === 1) return { ok: true, chat: all[0]! };
    return { ok: false, erro: "Achei mais de uma conversa parecida. Pergunte qual.", opcoes: all.slice(0, 6).map((c) => c.name) };
  }

  messages(jid: string, o: { since?: number; limit?: number; q?: string; onlyNew?: boolean } = {}): Msg[] {
    const chat = this.db.prepare("select name, checked_ts, is_group from chats where jid = ?").get(jid) as { name: string; checked_ts: number; is_group: number } | undefined;
    const since = o.onlyNew ? Math.max(o.since ?? 0, chat?.checked_ts ?? 0) : (o.since ?? 0);
    const rows = this.db.prepare("select * from messages where chat = ? and ts > ? order by ts desc limit ?").all(jid, since, Math.min(o.limit ?? 40, 200)) as Record<string, unknown>[];
    const words = norm(o.q ?? "").split(" ").filter(Boolean);
    return rows.reverse().map((r) => this.toMsg(r, chat?.name ?? "", !!chat?.is_group)).filter((m) => !words.length || words.every((w) => norm(`${m.text} ${m.sender_name}`).includes(w)));
  }

  /** Mensagens que marcam a pessoa ou respondem a ela, depois de `after` (segundos). */
  mentions(after: number, limit = 50): Msg[] {
    const rows = this.db.prepare("select m.*, c.name as chat_name, c.is_group as is_group from messages m join chats c on c.jid = m.chat where (m.mentions_me = 1 or m.reply_to_me = 1) and m.ts > ? order by m.ts asc limit ?").all(after, limit) as Record<string, unknown>[];
    return rows.map((r) => this.toMsg(r, String(r["chat_name"] ?? ""), !!r["is_group"]));
  }

  /** Marca a conversa como lida PELA PRESENCE (só aqui; não muda nada no seu WhatsApp). */
  markChecked(jid: string, upTo?: number) {
    this.db.prepare("update chats set checked_ts = max(checked_ts, ?) where jid = ?").run(upTo ?? Math.floor(Date.now() / 1000), jid);
  }

  /** Marca TODAS as conversas como lidas pela Presence (só aqui; o WhatsApp não muda). Depois disso, "novas" conta só o que chegar daqui para frente. */
  markAllChecked(upTo?: number): number {
    const ts = upTo ?? Math.floor(Date.now() / 1000);
    const r = this.db.prepare("update chats set checked_ts = max(checked_ts, ?)").run(ts);
    return Number(r.changes);
  }

  counts(): { chats: number; messages: number } {
    const c = this.db.prepare("select (select count(*) from chats) as chats, (select count(*) from messages) as messages").get() as { chats: number; messages: number };
    return { chats: Number(c.chats), messages: Number(c.messages) };
  }

  /** Apaga mensagens antigas (padrão: mais de 30 dias). */
  prune(days = 30): number {
    const r = this.db.prepare("delete from messages where ts < ?").run(Math.floor(Date.now() / 1000) - days * 86400);
    return Number(r.changes);
  }
  clear() { this.db.exec("delete from messages; delete from chats; delete from names;"); }
  close() { this.db.close(); }

  private toMsg(r: Record<string, unknown>, chatName: string, group: boolean): Msg {
    const sender = String(r["sender"] ?? "");
    return {
      id: String(r["id"]), chat: String(r["chat"]), chat_name: chatName || this.nameOf(String(r["chat"])), is_group: group, sender,
      sender_name: String(r["sender_name"] || this.nameOf(sender) || sender.split("@")[0] || ""), from_me: !!r["from_me"], ts: Number(r["ts"]), text: String(r["text"] ?? ""),
      kind: String(r["kind"] ?? "texto"), mentions_me: !!r["mentions_me"], reply_to_me: !!r["reply_to_me"],
    };
  }
}
