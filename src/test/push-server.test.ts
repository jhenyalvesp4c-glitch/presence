import { createECDH, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as webpush from "web-push";
import { sendOne } from "@/lib/push/server";

const browserSub = () => { const e = createECDH("prime256v1"); e.generateKeys(); return { endpoint: "https://push.example/abc", p256dh: e.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") }; };
const vapid = () => { const k = webpush.generateVAPIDKeys(); return { public: k.publicKey, private: k.privateKey }; };
const payload = { title: "Orion", body: "Teste", url: "/tarefas" };
const ok = (async () => ({ statusCode: 201, body: "", headers: {} })) as unknown as typeof webpush.sendNotification;
const fail = (code: number) => (async () => { throw Object.assign(new Error("push"), { statusCode: code }); }) as unknown as typeof webpush.sendNotification;

describe("envio de avisos (Web Push)", () => {
  it("monta o pedido criptografado e assinado (VAPID), com validade de 1 hora", () => {
    const s = browserSub(), v = vapid();
    const d = webpush.generateRequestDetails({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { vapidDetails: { subject: "https://orion.example", publicKey: v.public, privateKey: v.private }, TTL: 3600, urgency: "high" });
    const h = d.headers as Record<string, string>;
    expect(h["Authorization"]).toMatch(/^vapid t=.+, k=.+/i);
    expect(h["Content-Encoding"]).toBe("aes128gcm");
    expect(Number(h["TTL"])).toBe(3600);
    expect(Buffer.isBuffer(d.body) && d.body.length > 100).toBe(true); // o texto não vai em claro
    expect(d.body.toString("utf8")).not.toContain("Teste");
  });
  it("entrega ok → 'ok'", async () => { expect(await sendOne(browserSub(), payload, vapid(), ok)).toBe("ok"); });
  it("410 e 404 = aparelho que saiu ('gone', será removido); outros erros = 'erro' (tenta de novo)", async () => {
    expect(await sendOne(browserSub(), payload, vapid(), fail(410))).toBe("gone");
    expect(await sendOne(browserSub(), payload, vapid(), fail(404))).toBe("gone");
    expect(await sendOne(browserSub(), payload, vapid(), fail(503))).toBe("erro");
  });
});
