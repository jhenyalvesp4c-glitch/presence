// Ponte do WhatsApp para o Presence (roda só no seu computador). Inicie com: node src/index.ts  (ou dê dois cliques em whatsapp.cmd)
import { mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Store } from "./store.ts";
import { createApi, type BridgeState } from "./server.ts";
import { startConnection } from "./connection.ts";

const dir = process.env["PRESENCE_WHATSAPP_DIR"] ?? join(homedir(), ".presence", "whatsapp");
const port = Number(process.env["PRESENCE_WHATSAPP_PORT"] ?? 3939);
const days = Number(process.env["PRESENCE_WHATSAPP_DIAS"] ?? 30);
mkdirSync(dir, { recursive: true });

const token = randomBytes(24).toString("hex");
const store = new Store(join(dir, "mensagens.db"));
const state: BridgeState = { phase: "desligado", qr: null, phone: "", name: "", since: 0, paused: false };
const conn = startConnection(store, state, join(dir, "auth"));
const server = createApi(store, state, token, { logout: () => conn.logout(), pause: (on) => conn.pause(on) });

server.listen(port, "127.0.0.1", () => {
  const info = { port, token, pid: process.pid, started: new Date().toISOString() };
  const file = join(dir, "bridge.json");
  writeFileSync(file, JSON.stringify(info));
  try { chmodSync(file, 0o600); } catch { /* Windows */ }
  console.log(`Ponte do WhatsApp ligada em http://127.0.0.1:${port} (só neste computador).`);
  console.log(`Dados em: ${dir}`);
  console.log("Abra o Presence → Configurações → WhatsApp para ler o QR Code com o seu celular.");
  void conn.start().catch((e) => console.error("Falha ao conectar:", e instanceof Error ? e.message : e));
});

const prune = () => { try { const n = store.prune(days); if (n) console.log(`Apaguei ${n} mensagens com mais de ${days} dias.`); } catch { /* ok */ } };
prune(); setInterval(prune, 6 * 3600_000);
process.on("SIGINT", () => { conn.stop(); store.close(); process.exit(0); });
