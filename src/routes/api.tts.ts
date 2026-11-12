import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Texto → voz (ElevenLabs). Sem a chave, responde 501 e o navegador usa a voz do próprio aparelho.
const body = z.object({ text: z.string().trim().min(1).max(800) });
const json = (status: number, v: unknown) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { guard } = await import("@/lib/voice/http");
        const blocked = guard(request, "tts");
        if (blocked) return blocked;
        if (!process.env["ELEVENLABS_API_KEY"]) return json(501, { error: "Voz do ElevenLabs não configurada." });
        let text: string;
        try { text = body.parse(await request.json()).text; } catch { return json(400, { error: "Texto inválido." }); }
        try {
          const { elevenSpeak } = await import("@/lib/mcp/openai");
          const res = await elevenSpeak(text);
          if (!res.ok || !res.body) { const t = await res.text().catch(() => ""); console.error("[tts] ElevenLabs", res.status, t.slice(0, 200)); return json(502, { error: "A voz não respondeu.", status: res.status }); }
          return new Response(res.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
        } catch (e) { console.error("[tts]", e instanceof Error ? e.message : e); return json(502, { error: "A voz não respondeu." }); }
      },
    },
  },
});
