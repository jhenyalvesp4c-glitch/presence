import { createFileRoute } from "@tanstack/react-router";

// Ponte entre a tela (Configurações, avisos) e a ponte local do WhatsApp. Só leitura e controles; nunca envia mensagens.
const READ = new Set(["status", "chats", "messages", "mentions"]);
const WRITE = new Set(["pause", "logout", "clear", "marcar-lidas"]);
const json = (status: number, v: unknown) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

export const Route = createFileRoute("/api/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { guard } = await import("@/lib/voice/http");
        const blocked = guard(request, "wa");
        if (blocked) return blocked;
        const { withUser } = await import("@/lib/server-auth");
        return withUser(request, async () => {
          const u = new URL(request.url);
          const r = u.searchParams.get("r") ?? "";
          if (!READ.has(r)) return json(400, { error: "pedido inválido" });
          const rest = new URLSearchParams(u.searchParams); rest.delete("r");
          const { bridge } = await import("@/lib/whatsapp/bridge");
          const out = await bridge(`/${r}?${rest.toString()}`);
          return out.ok ? json(200, out.data) : json(out.offline ? 503 : 502, { error: out.erro, offline: !!out.offline });
        });
      },
      POST: async ({ request }) => {
        const { guard } = await import("@/lib/voice/http");
        const blocked = guard(request, "wa");
        if (blocked) return blocked;
        const { withUser } = await import("@/lib/server-auth");
        return withUser(request, async () => {
          const u = new URL(request.url);
          const r = u.searchParams.get("r") ?? "";
          if (!WRITE.has(r)) return json(400, { error: "pedido inválido" });
          const rest = new URLSearchParams(u.searchParams); rest.delete("r");
          const { bridge } = await import("@/lib/whatsapp/bridge");
          const out = await bridge(`/${r}?${rest.toString()}`, "POST");
          return out.ok ? json(200, out.data) : json(out.offline ? 503 : 502, { error: out.erro, offline: !!out.offline });
        });
      },
    },
  },
});
