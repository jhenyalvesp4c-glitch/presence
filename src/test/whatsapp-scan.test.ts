import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

import { mediaInfo } from "../../whatsapp-bridge/src/normalize.ts";
import { createApi, type BridgeState } from "../../whatsapp-bridge/src/server.ts";
import { Store } from "../../whatsapp-bridge/src/store.ts";

const grupo = "120363000000000001@g.us", priv = "5531977770000@s.whatsapp.net", base = 1_800_000_000;
const root = mkdtempSync(join(tmpdir(), "midia-")), mediaDir = join(root, "media");
mkdirSync(join(mediaDir, "chat"), { recursive: true });
const store = new Store(":memory:"); store.mediaRoot = mediaDir;
const add = (chat: string, id: string, ts: number, text: string, group: boolean, from_me = false, kind = "texto") => store.addMessage({ id, chat, chat_name: group ? "Polo Norte" : "Ana Souza", is_group: group, sender: group ? "5521988880000@s.whatsapp.net" : chat, sender_name: from_me ? "Jheny" : "Carla", from_me, ts, text, kind, mentions_me: false, reply_to_me: false });
add(grupo, "g1", base, "Jheny, preciso do relatório de entrega até sexta", true); add(grupo, "g2", base + 60, "[print do erro]", true, false, "imagem"); add(priv, "p1", base + 120, "Me manda o orçamento revisado?", false); add(priv, "p2", base + 180, "Mando hoje", false, true);
writeFileSync(join(mediaDir, "chat", "g2.jpg"), Buffer.from("fake-jpeg-bytes")); store.setMedia(grupo, "g2", join(mediaDir, "chat", "g2.jpg"), "image/jpeg");
writeFileSync(join(root, "segredo.txt"), "nao deve sair"); add(grupo, "g3", base + 240, "outra", true); store.setMedia(grupo, "g3", join(root, "segredo.txt"), "text/plain");

const state: BridgeState = { phase: "conectado", qr: null, phone: "5511999990000", name: "Jheny", since: 1, paused: false };
const server = createApi(store, state, "segredo", { logout: async () => undefined, pause: () => undefined, shutdown: () => undefined });
const ready = new Promise<number>((r) => server.listen(0, "127.0.0.1", () => r((server.address() as AddressInfo).port)));
afterAll(() => { server.close(); rmSync(root, { recursive: true, force: true }); });
const call = async (path: string) => { const port = await ready; const r = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { "x-presence-token": "segredo" } }); return r.json() as Promise<Record<string, any>>; };

describe("whatsapp: varredura de pedidos e mídia", () => {
  it("varredura traz grupos e conversas diretas, de todos, em ordem, e indica quem tem arquivo", async () => {
    const r = await call(`/varredura?since=${base - 1}`);
    expect(r["messages"].map((m: any) => m.id)).toEqual(["g1", "g2", "p1", "p2", "g3"]);
    expect(r["messages"].filter((m: any) => m.is_group).length).toBe(3); expect(r["messages"].some((m: any) => !m.is_group)).toBe(true);
    expect(r["messages"].find((m: any) => m.id === "g2")).toMatchObject({ has_media: true, media_mime: "image/jpeg", kind: "imagem" });
    expect(r["truncated"]).toBe(false);
  });
  it("respeita o início do período e o limite", async () => {
    expect((await call(`/varredura?since=${base + 100}`))["messages"].map((m: any) => m.id)).toEqual(["p1", "p2", "g3"]);
    const r = await call(`/varredura?since=${base - 1}&limit=2`); expect(r["messages"].length).toBe(2); expect(r["truncated"]).toBe(true);
  });
  it("entrega a imagem guardada em base64", async () => {
    const r = await call(`/midia?chat=${encodeURIComponent(grupo)}&id=g2`);
    expect(r["ok"]).toBe(true); expect(r["mime"]).toBe("image/jpeg"); expect(Buffer.from(r["data"], "base64").toString()).toBe("fake-jpeg-bytes");
  });
  it("não entrega arquivo fora da pasta de mídia nem de mensagem sem arquivo", async () => {
    expect((await call(`/midia?chat=${encodeURIComponent(grupo)}&id=g3`))["ok"]).toBe(false);
    expect((await call(`/midia?chat=${encodeURIComponent(grupo)}&id=g1`))["ok"]).toBe(false);
  });
  it("reconhece imagem e PDF para baixar", () => {
    expect(mediaInfo({ imageMessage: { mimetype: "image/jpeg", fileLength: 1200 } })).toEqual({ mime: "image/jpeg", size: 1200 });
    expect(mediaInfo({ documentMessage: { mimetype: "application/pdf", fileLength: "5000" } })).toEqual({ mime: "application/pdf", size: 5000 });
    expect(mediaInfo({ documentMessage: { mimetype: "application/zip" } })).toBeNull(); expect(mediaInfo({ conversation: "oi" })).toBeNull();
  });
});

describe("whatsapp: conversas sem nome, busca e renomear", () => {
  const s2 = new Store(":memory:");
  const lid = "169007013449846@lid", fone = "5531988887777@s.whatsapp.net";
  s2.addMessage({ id: "1", chat: lid, chat_name: "", is_group: false, sender: lid, sender_name: "", from_me: false, ts: base, text: "Oi Jheny, o disparo de ontem deu erro", kind: "texto", mentions_me: false, reply_to_me: false });
  s2.addMessage({ id: "2", chat: fone, chat_name: "Bruno", is_group: false, sender: fone, sender_name: "Bruno", from_me: false, ts: base + 5, text: "Consegue criar o usuário?", kind: "texto", mentions_me: false, reply_to_me: false });
  it("mostra a última mensagem e marca o que não tem nome", () => {
    const c = s2.chats("", 10); const sem = c.find((x) => x.jid === lid)!;
    expect(sem.sem_nome).toBe(true); expect(sem.preview).toMatch(/disparo de ontem/); expect(c.find((x) => x.jid === fone)!.sem_nome).toBeUndefined();
  });
  it("busca por nome ou por pedaço do número, em todas as conversas", () => {
    expect(s2.chats("bruno").map((x) => x.jid)).toEqual([fone]); expect(s2.chats("31988887777").map((x) => x.jid)).toEqual([fone]); expect(s2.chats("9007013").map((x) => x.jid)).toEqual([lid]);
  });
  it("dar nome a uma conversa vale na lista e nas mensagens", () => {
    expect(s2.renameChat(lid, "Romulo")).toBe(true); expect(s2.renameChat("nao-existe", "X")).toBe(false); expect(s2.renameChat(lid, "  ")).toBe(false);
    const c = s2.chats("romulo"); expect(c).toHaveLength(1); expect(c[0]!.sem_nome).toBeUndefined();
    expect(s2.messages(lid, { since: 0 })[0]!.chat_name).toBe("Romulo");
  });
});
