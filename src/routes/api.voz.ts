import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Conversa por voz: recebe o histórico e devolve eventos em linhas JSON (texto, ações, painéis) enquanto a IA responde.
const body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(6000) })).min(1).max(24),
  // Conversa escrita (tela): texto, imagens, PDFs e arquivos de texto anexados à última mensagem.
  modo: z.enum(["voz", "chat"]).optional(),
  anexos: z.array(z.object({ name: z.string().min(1).max(200), mime: z.string().min(1).max(100), data: z.string().max(4_200_000) })).max(6).optional()
    .refine((l) => !l || l.reduce((n, f) => n + f.data.length, 0) <= 4_000_000, "Arquivos grandes demais (máx. ~3 MB no total)."),
  // Continuação depois que o navegador executou ferramentas (WhatsApp): o estado da rodada + os resultados.
  continuar: z.object({
    estado: z.array(z.record(z.string(), z.unknown())).min(2).max(60).refine((e) => e[0]?.["role"] === "system" && e.every((m) => ["system", "user", "assistant", "tool"].includes(String(m["role"]))), "estado inválido"),
    resultados: z.array(z.object({ id: z.string().max(100), content: z.string().max(20000) })).min(1).max(10),
  }).optional(),
});

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
            await runAgent(parsed.messages, emit, parsed.continuar, { modo: parsed.modo ?? "voz", anexos: parsed.anexos ?? [] });
            if (!closed) { try { controller.close(); } catch { /* já fechado */ } }
          },
        });
        return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" } });
        });
      },
    },
  },
});
