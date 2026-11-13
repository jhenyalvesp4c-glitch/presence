// API local da ponte: só escuta neste computador (127.0.0.1), exige a senha (token) e só LÊ. Não existe rota para enviar mensagens.
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { Store } from "./store.ts";

export type Phase = "desligado" | "aguardando_qr" | "conectando" | "conectado" | "pausado";
export type BridgeState = { phase: Phase; qr: string | null; phone: string; name: string; since: number; paused: boolean; erro?: string };
export type Controls = { logout(): Promise<void>; pause(on: boolean): void };

const json = (res: ServerResponse, status: number, body: unknown) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(body)); };

export function createApi(store: Store, state: BridgeState, token: string, controls: Controls): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.headers["x-presence-token"] !== token) return json(res, 401, { error: "não autorizado" });
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const q = url.searchParams;
      const n = (k: string, d = 0) => { const v = Number(q.get(k)); return Number.isFinite(v) && q.get(k) !== null && q.get(k) !== "" ? v : d; };
      const route = `${req.method} ${url.pathname}`;

      if (route === "GET /status") return json(res, 200, { ...state, ...store.counts(), now: Math.floor(Date.now() / 1000) });

      if (route === "GET /chats") return json(res, 200, { chats: store.chats(q.get("q") ?? "", n("limit", 40)) });

      if (route === "GET /messages") {
        const f = store.findChat(q.get("chat") ?? "");
        if (!f.ok) return json(res, 200, f);
        const onlyNew = q.get("novas") === "1";
        const messages = store.messages(f.chat.jid, { since: n("since"), limit: n("limit", 40), q: q.get("q") ?? "", onlyNew });
        if (q.get("marcar") === "1" && messages.length) store.markChecked(f.chat.jid, Math.max(...messages.map((m) => m.ts)));
        return json(res, 200, { ok: true, chat: f.chat, messages, total: messages.length });
      }

      if (route === "GET /mentions") return json(res, 200, { mentions: store.mentions(n("after"), n("limit", 50)), now: Math.floor(Date.now() / 1000) });

      if (route === "POST /pause") { const on = q.get("on") === "1"; controls.pause(on); return json(res, 200, { ok: true, paused: on }); }
      if (route === "POST /logout") { await controls.logout(); return json(res, 200, { ok: true }); }
      if (route === "POST /clear") { store.clear(); return json(res, 200, { ok: true }); }

      return json(res, 404, { error: "rota desconhecida" });
    } catch (e) {
      return json(res, 500, { error: e instanceof Error ? e.message : "erro" });
    }
  });
}
