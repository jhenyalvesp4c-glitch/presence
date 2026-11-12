import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Conversa por voz: recebe o histórico e devolve eventos em linhas JSON (texto, ações, painéis) enquanto a IA responde.
const body = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1).max(24) });

export const Route = createFileRoute("/api/voz")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { guard } = await import("@/lib/voice/http");
        const blocked = guard(request, "voz");
        if (blocked) return blocked;
        let parsed: z.infer<typeof body>;
        try { parsed = body.parse(await request.json()); } catch { return new Response(JSON.stringify({ error: "Pedido inválido." }), { status: 400, headers: { "content-type": "application/json" } }); }
        const { runAgent } = await import("@/lib/voice/agent");
        const enc = new TextEncoder();
        let closed = false;
        request.signal.addEventListener("abort", () => { closed = true; });
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const emit = (e: unknown) => { if (!closed) { try { controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`)); } catch { closed = true; } } };
            await runAgent(parsed.messages, emit);
            if (!closed) { try { controller.close(); } catch { /* já fechado */ } }
          },
        });
        return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" } });
      },
    },
  },
});
