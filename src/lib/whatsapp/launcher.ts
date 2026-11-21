/** Servidor: liga a ponte do WhatsApp em segundo plano (sem janela), a partir do app instalado no computador. No site publicado não existe pasta da ponte, então devolve um aviso. */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { bridge } from "./bridge";

export type StartResult = { ok: true; ja: boolean } | { ok: false; erro: string };
const bridgeDir = () => process.env["PRESENCE_BRIDGE_DIR"] ?? join(process.cwd(), "whatsapp-bridge");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function install(cwd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("npm", ["install", "--no-audit", "--no-fund"], { cwd, shell: true, windowsHide: true, stdio: "ignore" });
    const t = setTimeout(() => { p.kill(); resolve(false); }, 240_000);
    p.on("exit", (c) => { clearTimeout(t); resolve(c === 0); });
    p.on("error", () => { clearTimeout(t); resolve(false); });
  });
}

export async function startBridgeHidden(): Promise<StartResult> {
  if ((await bridge("/status")).ok) return { ok: true, ja: true };
  const dir = bridgeDir();
  if (!existsSync(join(dir, "src", "index.ts"))) return { ok: false, erro: "Só dá para ligar daqui no app instalado no computador. No site publicado, dê dois cliques em whatsapp-fundo.cmd (uma vez) na pasta do Orion." };
  if (!existsSync(join(dir, "node_modules")) && !(await install(dir))) return { ok: false, erro: "Não consegui instalar as peças da ponte (npm install). Rode whatsapp.cmd uma vez para ver o erro." };
  const logDir = process.env["PRESENCE_WHATSAPP_DIR"] ?? join(homedir(), ".presence", "whatsapp");
  mkdirSync(logDir, { recursive: true });
  const log = openSync(join(logDir, "ponte.log"), "a");
  try {
    const child = spawn(process.execPath, ["src/index.ts"], { cwd: dir, detached: true, windowsHide: true, stdio: ["ignore", log, log] });
    child.unref();
  } catch (e) { return { ok: false, erro: `Não consegui iniciar a ponte: ${e instanceof Error ? e.message : "erro"}` }; }
  for (let i = 0; i < 24; i++) { await wait(500); if ((await bridge("/status")).ok) return { ok: true, ja: false }; }
  return { ok: false, erro: `A ponte não respondeu. Veja o arquivo ${join(logDir, "ponte.log")} (precisa do Node 22.18 ou mais novo).` };
}
