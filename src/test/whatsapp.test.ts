import { afterAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { normalizeMessage, mentionInfo, type Me } from "../../whatsapp-bridge/src/normalize.ts";
import { Store } from "../../whatsapp-bridge/src/store.ts";
import { createApi, type BridgeState } from "../../whatsapp-bridge/src/server.ts";

const me: Me = { jids: ["5511999990000:7@s.whatsapp.net", "123456789@lid"], name: "Jheny" };
const grupo = "120363000000000001@g.us";
const raw = (over: Record<string, unknown>) => ({ key: { remoteJid: grupo, id: `m${Math.random()}`, fromMe: false, participant: "5521988880000@s.whatsapp.net" }, messageTimestamp: 1_800_000_000, pushName: "Carlos", ...over });

describe("whatsapp: ler e entender mensagens", () => {
  it("texto simples de grupo", () => {
    const m = normalizeMessage(raw({ message: { conversation: "Bom dia, pessoal" } }), me, "Juiz de Fora")!;
    expect(m).toMatchObject({ chat: grupo, is_group: true, sender: "5521988880000@s.whatsapp.net", sender_name: "Carlos", text: "Bom dia, pessoal", kind: "texto", mentions_me: false, reply_to_me: false, chat_name: "Juiz de Fora" });
  });
  it("detecta quando marcam a pessoa (pelo número ou pelo id novo)", () => {
    const a = normalizeMessage(raw({ message: { extendedTextMessage: { text: "@5511999990000 viu isso?", contextInfo: { mentionedJid: ["5511999990000@s.whatsapp.net"] } } } }), me)!;
    expect(a.mentions_me).toBe(true);
    const b = normalizeMessage(raw({ message: { extendedTextMessage: { text: "@Jheny pode ver?", contextInfo: { mentionedJid: ["123456789@lid"] } } } }), me)!;
    expect(b.mentions_me).toBe(true);
    expect(mentionInfo({ conversation: "olá @jheny, tudo bem?" }, "olá @jheny, tudo bem?", me).mentions_me).toBe(true);
    expect(mentionInfo({ conversation: "falei com a Jheny ontem" }, "falei com a Jheny ontem", me).mentions_me).toBe(false);
  });
  it("detecta resposta a uma mensagem da pessoa", () => {
    const m = normalizeMessage(raw({ message: { extendedTextMessage: { text: "Combinado!", contextInfo: { participant: "5511999990000@s.whatsapp.net", quotedMessage: { conversation: "Posso mandar hoje?" } } } } }), me)!;
    expect(m.reply_to_me).toBe(true); expect(m.mentions_me).toBe(false);
  });
  it("mensagem temporária, legenda de imagem e áudio", () => {
    expect(normalizeMessage(raw({ message: { ephemeralMessage: { message: { conversation: "oi temporário" } } } }), me)!.text).toBe("oi temporário");
    const img = normalizeMessage(raw({ message: { imageMessage: { caption: "print do erro" } } }), me)!;
    expect(img.kind).toBe("imagem"); expect(img.text).toBe("print do erro");
    expect(normalizeMessage(raw({ message: { audioMessage: { ptt: true } } }), me)!.kind).toBe("audio de voz");
  });
  it("ignora status, reações, sistema e mensagens vazias", () => {
    expect(normalizeMessage(raw({ key: { remoteJid: "status@broadcast", id: "1" }, message: { conversation: "x" } }), me)).toBeNull();
    expect(normalizeMessage(raw({ message: { reactionMessage: { text: "👍" } } }), me)).toBeNull();
    expect(normalizeMessage(raw({ message: { protocolMessage: { type: 0 } } }), me)).toBeNull();
    expect(normalizeMessage(raw({ message: undefined }), me)).toBeNull();
  });
  it("conversa direta usa o contato como remetente; mensagem minha não conta como marcação", () => {
    const direta = normalizeMessage({ key: { remoteJid: "5531977770000@s.whatsapp.net", id: "d1", fromMe: false }, message: { conversation: "oi" }, messageTimestamp: 5, pushName: "Ana" }, me)!;
    expect(direta).toMatchObject({ is_group: false, sender: "5531977770000@s.whatsapp.net", sender_name: "Ana" });
    const minha = normalizeMessage(raw({ key: { remoteJid: grupo, id: "x", fromMe: true }, message: { extendedTextMessage: { text: "@5511999990000", contextInfo: { mentionedJid: ["5511999990000@s.whatsapp.net"] } } } }), me)!;
    expect(minha.from_me).toBe(true); expect(minha.mentions_me).toBe(false);
  });
});

describe("whatsapp: guardar e consultar", () => {
  const store = new Store(":memory:");
  const base = 1_800_000_000;
  const add = (id: string, ts: number, text: string, over: Record<string, unknown> = {}) => store.addMessage({ id, chat: grupo, chat_name: "Juiz de Fora", is_group: true, sender: "5521988880000@s.whatsapp.net", sender_name: "Carlos", from_me: false, ts, text, kind: "texto", mentions_me: false, reply_to_me: false, ...over } as never);
  add("1", base, "Bom dia"); add("2", base + 60, "Quem pode revisar o disparo?"); add("3", base + 120, "@Jheny preciso de você", { mentions_me: true }); add("4", base + 180, "Obrigado", { sender_name: "Marina", sender: "5521977771111@s.whatsapp.net" });
  store.addMessage({ id: "o1", chat: "5531977770000@s.whatsapp.net", chat_name: "Ana Souza", is_group: false, sender: "5531977770000@s.whatsapp.net", sender_name: "Ana", from_me: false, ts: base + 10, text: "Oi!", kind: "texto", mentions_me: false, reply_to_me: false });

  it("não duplica a mesma mensagem", () => { expect(add("1", base, "Bom dia")).toBe(false); expect(store.counts().messages).toBe(5); });
  it("acha a conversa pelo nome aproximado, sem acento", () => {
    expect(store.findChat("grupo juiz de fora")).toMatchObject({ ok: true, chat: { jid: grupo } });
    expect(store.findChat("JUIZ")).toMatchObject({ ok: true });
    expect(store.findChat("ana")).toMatchObject({ ok: true, chat: { name: "Ana Souza" } });
    expect(store.findChat("zzz")).toMatchObject({ ok: false });
  });
  it("lê as mensagens na ordem, com busca e só as novas", () => {
    const todas = store.messages(grupo);
    expect(todas.map((m) => m.text)).toEqual(["Bom dia", "Quem pode revisar o disparo?", "@Jheny preciso de você", "Obrigado"]);
    expect(store.messages(grupo, { q: "disparo" })).toHaveLength(1);
    expect(store.messages(grupo, { since: base + 100 })).toHaveLength(2);
    expect(store.chats().find((c) => c.jid === grupo)!.novas).toBe(4);
    store.markChecked(grupo, base + 120);
    expect(store.chats().find((c) => c.jid === grupo)!.novas).toBe(1);
    expect(store.messages(grupo, { onlyNew: true }).map((m) => m.text)).toEqual(["Obrigado"]);
  });
  it("lista as marcações", () => {
    const m = store.mentions(0); expect(m).toHaveLength(1); expect(m[0]).toMatchObject({ text: "@Jheny preciso de você", chat_name: "Juiz de Fora" });
    expect(store.mentions(base + 120)).toHaveLength(0);
  });
  it("apaga as antigas e limpa tudo", () => {
    const s = new Store(":memory:"); s.addMessage({ id: "a", chat: grupo, chat_name: "G", is_group: true, sender: "x@s.whatsapp.net", sender_name: "X", from_me: false, ts: 1000, text: "velha", kind: "texto", mentions_me: false, reply_to_me: false });
    expect(s.prune(30)).toBe(1); expect(s.counts().messages).toBe(0); s.clear(); expect(s.counts().chats).toBe(0);
  });
});

describe("whatsapp: API local", () => {
  const store = new Store(":memory:");
  store.addMessage({ id: "1", chat: grupo, chat_name: "Juiz de Fora", is_group: true, sender: "5521988880000@s.whatsapp.net", sender_name: "Carlos", from_me: false, ts: 1_800_000_000, text: "Oi grupo", kind: "texto", mentions_me: true, reply_to_me: false });
  const state: BridgeState = { phase: "conectado", qr: null, phone: "5511999990000", name: "Jheny", since: 1, paused: false };
  let paused = false;
  const server = createApi(store, state, "segredo", { logout: async () => undefined, pause: (on) => { paused = on; } });
  const ready = new Promise<number>((r) => server.listen(0, "127.0.0.1", () => r((server.address() as AddressInfo).port)));
  afterAll(() => { server.close(); });
  const call = async (path: string, init: RequestInit = {}, token = "segredo") => { const port = await ready; const r = await fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers: { "x-presence-token": token } }); return { status: r.status, body: await r.json() as Record<string, any> }; };

  it("recusa quem não tem a senha", async () => { expect((await call("/status", {}, "errada")).status).toBe(401); });
  it("status, conversas, mensagens e marcações", async () => {
    expect((await call("/status")).body).toMatchObject({ phase: "conectado", phone: "5511999990000", messages: 1 });
    expect((await call("/chats?q=juiz")).body["chats"]).toHaveLength(1);
    const m = (await call("/messages?chat=juiz&marcar=1")).body; expect(m["ok"]).toBe(true); expect(m["messages"][0].text).toBe("Oi grupo");
    expect((await call("/chats")).body["chats"][0].novas).toBe(0);
    expect((await call("/mentions?after=0")).body["mentions"]).toHaveLength(1);
    expect((await call("/messages?chat=naoexiste")).body["ok"]).toBe(false);
  });
  it("pausar e apagar; não existe rota para enviar", async () => {
    expect((await call("/pause?on=1", { method: "POST" })).body["paused"]).toBe(true); expect(paused).toBe(true);
    expect((await call("/clear", { method: "POST" })).status).toBe(200); expect(store.counts().messages).toBe(0);
    expect((await call("/send", { method: "POST" })).status).toBe(404);
    expect((await call("/sendMessage", { method: "POST" })).status).toBe(404);
  });
});

describe("whatsapp: acesso pelo navegador (site do Presence)", () => {
  const store = new Store(":memory:");
  const state: BridgeState = { phase: "conectado", qr: null, phone: "55", name: "J", since: 1, paused: false };
  const server = createApi(store, state, "segredo", { logout: async () => undefined, pause: () => undefined });
  const ready = new Promise<number>((r) => server.listen(0, "127.0.0.1", () => r((server.address() as AddressInfo).port)));
  afterAll(() => { server.close(); });
  const req = async (path: string, headers: Record<string, string> = {}, method = "GET") => { const port = await ready; const r = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers }); return { status: r.status, h: r.headers, body: await r.text() }; };

  it("entrega a senha só para o site permitido, com CORS", async () => {
    const ok = await req("/parear", { origin: "https://spark-mind-friend-htvx.vercel.app" });
    expect(ok.status).toBe(200); expect(JSON.parse(ok.body).token).toBe("segredo");
    expect(ok.h.get("access-control-allow-origin")).toBe("https://spark-mind-friend-htvx.vercel.app");
    const local = await req("/parear", { origin: "http://localhost:8080" }); expect(local.status).toBe(200);
  });
  it("não entrega para outros sites, nem parecidos", async () => {
    for (const o of ["https://evil.example.com", "https://spark-mind-friend-htvx-evil.vercel.app", "http://localhost.evil.com"]) {
      const r = await req("/parear", { origin: o }); expect(r.status).toBe(403); expect(r.h.get("access-control-allow-origin")).toBeNull(); expect(r.body).not.toContain("segredo");
    }
  });
  it("responde ao pré-pedido do navegador (inclusive acesso à rede local)", async () => {
    const r = await req("/status", { origin: "https://spark-mind-friend-htvx.vercel.app", "access-control-request-method": "GET", "access-control-request-headers": "x-presence-token" }, "OPTIONS");
    expect(r.status).toBe(204); expect(r.h.get("access-control-allow-private-network")).toBe("true"); expect(r.h.get("access-control-allow-headers")).toContain("x-presence-token");
    expect((await req("/status", { origin: "https://evil.example.com" }, "OPTIONS")).status).toBe(403);
  });
  it("dados continuam exigindo a senha", async () => {
    expect((await req("/status", { origin: "https://spark-mind-friend-htvx.vercel.app" })).status).toBe(401);
    expect((await req("/status", { origin: "https://spark-mind-friend-htvx.vercel.app", "x-presence-token": "segredo" })).status).toBe(200);
  });
});
