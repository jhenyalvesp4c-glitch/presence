import { createFileRoute } from "@tanstack/react-router";

/** "Enviar aviso de teste": manda uma notificação para os aparelhos de quem está logado. */
export const Route = createFileRoute("/api/push/teste")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { json, sendOne } = await import("@/lib/push/server");
        const { withUser } = await import("@/lib/server-auth");
        return withUser(request, async (scope) => {
          const subs = await scope.client.from("push_subscriptions").select("endpoint, p256dh, auth");
          if (subs.error) return json(500, { error: "Não consegui ler os seus aparelhos." });
          const list = (subs.data ?? []) as { endpoint: string; p256dh: string; auth: string }[];
          if (!list.length) return json(200, { enviados: 0, aparelhos: 0, aviso: "Nenhum aparelho com avisos ligados." });
          const v = await scope.client.rpc("push_vapid_user");
          const vapid = v.data as { public: string; private: string } | null;
          if (!vapid?.public || !vapid.private) return json(503, { error: "Avisos ainda não configurados." });
          let ok = 0; const gone: string[] = [];
          await Promise.all(list.map(async (s) => { const r = await sendOne(s, { title: "Orion", body: "Teste: os avisos estão funcionando neste aparelho.", url: "/configuracoes", tag: "teste" }, vapid); if (r === "ok") ok++; else if (r === "gone") gone.push(s.endpoint); }));
          if (gone.length) await scope.client.from("push_subscriptions").delete().in("endpoint", gone);
          return json(200, { enviados: ok, aparelhos: list.length, removidos: gone.length });
        });
      },
    },
  },
});
