import { createFileRoute } from "@tanstack/react-router";

// Chave pública dos avisos (não é segredo): o navegador usa para criar a inscrição deste aparelho.
export const Route = createFileRoute("/api/push/chave")({
  server: {
    handlers: {
      GET: async () => {
        const { json, publicKey } = await import("@/lib/push/server");
        try { const key = await publicKey(); return key ? json(200, { key }) : json(503, { error: "Avisos ainda não configurados." }); }
        catch { return json(503, { error: "Avisos indisponíveis agora." }); }
      },
    },
  },
});
