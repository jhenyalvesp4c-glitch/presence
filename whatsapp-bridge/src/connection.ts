// Liga ao WhatsApp como um "aparelho conectado" (igual ao WhatsApp Web), só para LER. Nunca envia mensagem, nunca marca como lida,
// nunca aparece "online" (as notificações continuam chegando no seu celular).
// ATENÇÃO: usa uma biblioteca NÃO oficial. O WhatsApp pode não gostar de acessos automáticos; existe risco de o número ser limitado.
import { rmSync } from "node:fs";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import { normalizeMessage, type Me } from "./normalize.ts";
import type { Store } from "./store.ts";
import type { BridgeState } from "./server.ts";

const quiet: any = { level: "silent", trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {}, child() { return quiet; } };

const log = (...a: unknown[]) => console.log("[whatsapp]", ...a);

export function startConnection(store: Store, state: BridgeState, authDir: string) {
  let sock: any = null;
  let stopped = false;
  let me: Me = { jids: [], name: "" };

  async function connect() {
    if (stopped) return;
    state.phase = "conectando";
    log("Conectando ao WhatsApp…");
    const { state: auth, saveCreds } = await useMultiFileAuthState(authDir);
    let version: number[] | undefined;
    try { ({ version } = await fetchLatestBaileysVersion()); log("Versão do WhatsApp Web:", version?.join(".")); } catch (e) { log("Não consegui buscar a versão mais nova (segue com a padrão):", e instanceof Error ? e.message : e); }
    sock = makeWASocket({ auth, ...(version ? { version } : {}), logger: quiet, browser: Browsers.macOS("Presence"), markOnlineOnConnect: false, syncFullHistory: false, printQRInTerminal: false, generateHighQualityLinkPreview: false });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (u: any) => {
      if (u.connection) log("Estado da conexão:", u.connection);
      if (u.qr) { state.qr = await QRCode.toDataURL(u.qr, { margin: 1, width: 280 }); state.phase = "aguardando_qr"; state.erro = ""; log("QR Code pronto: abra Configurações → WhatsApp no Presence e leia com o celular."); }
      if (u.connection === "open") {
        state.qr = null; state.erro = ""; log("Conectado ao WhatsApp."); state.phase = state.paused ? "pausado" : "conectado"; state.since = Math.floor(Date.now() / 1000);
        const user = sock.user ?? {};
        me = { jids: [user.id, user.lid].filter(Boolean), name: String(user.name ?? "") };
        state.phone = String(user.id ?? "").split("@")[0]!.split(":")[0]!; state.name = me.name;
        try { const groups = await sock.groupFetchAllParticipating(); for (const g of Object.values<any>(groups)) store.setChatName(g.id, g.subject ?? "", true); } catch { /* sem nomes de grupos por enquanto */ }
      }
      if (u.connection === "close") {
        const code = u.lastDisconnect?.error?.output?.statusCode;
        const why = u.lastDisconnect?.error?.message ?? "sem detalhe";
        state.erro = `A conexão caiu (código ${code ?? "?"}): ${why}`;
        log(state.erro);
        if (code === DisconnectReason.loggedOut) { try { rmSync(authDir, { recursive: true, force: true }); } catch { /* ok */ } state.phone = ""; state.name = ""; }
        state.phase = "desligado";
        if (!stopped) setTimeout(() => void retry(), 3000);
      }
    });

    const save = (raw: any) => { if (state.paused) return; const m = normalizeMessage(raw, me, ""); if (m) store.addMessage({ ...m, chat_name: store.chats(m.chat, 1)[0]?.name ?? "" }); };
    sock.ev.on("messages.upsert", ({ messages }: any) => { for (const m of messages ?? []) save(m); });
    sock.ev.on("messaging-history.set", ({ chats, contacts, messages }: any) => {
      for (const c of chats ?? []) if (c.name) store.setChatName(c.id, c.name);
      for (const c of contacts ?? []) if (c.id && (c.name || c.notify)) store.setContactName(c.id, c.name || c.notify);
      for (const m of messages ?? []) save(m);
    });
    sock.ev.on("groups.upsert", (gs: any[]) => { for (const g of gs ?? []) store.setChatName(g.id, g.subject ?? "", true); });
    sock.ev.on("groups.update", (gs: any[]) => { for (const g of gs ?? []) if (g.subject) store.setChatName(g.id, g.subject, true); });
    sock.ev.on("chats.upsert", (cs: any[]) => { for (const c of cs ?? []) if (c.name) store.setChatName(c.id, c.name); });
    sock.ev.on("contacts.upsert", (cs: any[]) => { for (const c of cs ?? []) if (c.id && (c.name || c.notify)) store.setContactName(c.id, c.name || c.notify); });
  }

  async function retry() { try { await connect(); } catch (e) { state.erro = `Falha ao conectar: ${e instanceof Error ? e.message : e}`; log(state.erro); if (!stopped) setTimeout(() => void retry(), 8000); } }

  return {
    start: () => retry(),
    pause(on: boolean) { state.paused = on; state.phase = on ? "pausado" : (sock?.user ? "conectado" : state.phase); },
    async logout() {
      try { await sock?.logout(); } catch { /* já desconectado */ }
      try { rmSync(authDir, { recursive: true, force: true }); } catch { /* ok */ }
      state.phone = ""; state.name = ""; state.qr = null; state.phase = "desligado";
      setTimeout(() => void retry(), 1000);
    },
    stop() { stopped = true; try { sock?.end?.(undefined); } catch { /* ok */ } },
  };
}
