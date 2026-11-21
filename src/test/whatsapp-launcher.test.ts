// Liga a ponte em segundo plano: usa uma ponte de mentira (só responde /status e /encerrar) para conferir que o servidor a inicia sozinho, sem janela, e que não inicia duas vezes.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bridge } from "../lib/whatsapp/bridge";
import { startBridgeHidden } from "../lib/whatsapp/launcher";

const root = mkdtempSync(join(tmpdir(), "ponte-"));
const dataDir = join(root, "dados"), bridgeDir = join(root, "whatsapp-bridge");
const PORT = 39571;

beforeAll(() => {
  mkdirSync(join(bridgeDir, "src"), { recursive: true }); mkdirSync(join(bridgeDir, "node_modules"), { recursive: true }); mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(bridgeDir, "src", "index.ts"), `
import { createServer } from "node:http"; import { writeFileSync } from "node:fs"; import { join } from "node:path";
const token = "t0k3n";
const s = createServer((req, res) => {
  if (req.headers["x-presence-token"] !== token) { res.writeHead(401); return res.end(); }
  if (req.url === "/status") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ phase: "aguardando_qr" })); }
  if (req.url === "/encerrar" && req.method === "POST") { res.writeHead(200); res.end("{}"); setTimeout(() => process.exit(0), 50); return; }
  res.writeHead(404); res.end();
});
s.listen(${PORT}, "127.0.0.1", () => writeFileSync(join(process.env.PRESENCE_WHATSAPP_DIR!, "bridge.json"), JSON.stringify({ port: ${PORT}, token })));
`);
  process.env["PRESENCE_WHATSAPP_DIR"] = dataDir; process.env["PRESENCE_BRIDGE_DIR"] = bridgeDir; delete process.env["WHATSAPP_BRIDGE_URL"]; delete process.env["WHATSAPP_BRIDGE_TOKEN"];
});
afterAll(async () => { await bridge("/encerrar", "POST").catch(() => undefined); await new Promise((r) => setTimeout(r, 200)); rmSync(root, { recursive: true, force: true }); });

describe("ligar a ponte em segundo plano", () => {
  it("inicia a ponte e depois reconhece que já está ligada", async () => {
    const a = await startBridgeHidden();
    expect(a).toEqual({ ok: true, ja: false });
    expect((await bridge<{ phase: string }>("/status"))).toMatchObject({ ok: true, data: { phase: "aguardando_qr" } });
    expect(await startBridgeHidden()).toEqual({ ok: true, ja: true });
  }, 20000);
  it("sem a pasta da ponte (site publicado) devolve a orientação", async () => {
    await bridge("/encerrar", "POST"); await new Promise((r) => setTimeout(r, 400));
    process.env["PRESENCE_BRIDGE_DIR"] = join(root, "nao-existe");
    const r = await startBridgeHidden();
    expect(r.ok).toBe(false); expect(r.ok ? "" : r.erro).toMatch(/whatsapp-fundo\.cmd/);
  }, 20000);
});
