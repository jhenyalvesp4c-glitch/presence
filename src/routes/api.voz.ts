import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Conversa por voz: recebe o histórico e devolve eventos em linhas JSON (texto, ações, painéis) enquanto a IA responde.
const body = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1).max(24) });

export const Route = createFileRoute("/api/voz")({
  server: {
    handlers: {
      // Diagnóstico: testa a IA da conversa (modelo e chave) com uma chamada mínima.
      GET: async ({ request }) => {
        const { guard } = await import("@/lib/voice/http");
        const blocked = guard(request, "voz");
        if (blocked) return blocked;
        const out = (v: unknown) => new Response(JSON.stringify(v), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
        const { DEFAULT_MODEL } = await import("@/lib/mcp/interpret");
        const model = process.env["OPENAI_VOICE_MODEL"]?.trim() || process.env["OPENAI_MODEL"]?.trim() || DEFAULT_MODEL;
        if (!process.env["OPENAI_API_KEY"]) return out({ ok: false, modelo: model, erro: "Sem OPENAI_API_KEY no servidor." });
        try {
          const { streamChat } = await import("@/lib/mcp/openai");
          const t0 = Date.now();
          let first = 0;
          const r = await streamChat({ model, messages: [{ role: "user", content: "Responda só: ok" }], max_completion_tokens: 20, reasoning_effort: "low", tools: [{ type: "function", function: { name: "ping", description: "teste", parameters: { type: "object", properties: {} } } }], tool_choice: "auto" }, () => { if (!first) first = Date.now() - t0; });
          return out({ ok: !!r.text, modelo: model, resposta: r.text.slice(0, 40), primeiro_texto_ms: first, total_ms: Date.now() - t0 });
        } catch (e) {
          const { OpenAIError, explain } = await import("@/lib/mcp/openai");
          return out({ ok: false, modelo: model, erro: e instanceof OpenAIError ? explain(e, model) : e instanceof Error ? e.message : "falha" });
        }
      },
      POST: async ({ request }) => {
        const { guard } = await import("@/lib/voice/http");
        const blocked = guard(request, "voz");
        if (blocked) return blocked;
        const { withUser } = await import("@/lib/server-auth");
        return withUser(request, async () => {
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
        });
      },
    },
  },
});
