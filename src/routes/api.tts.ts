import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Texto → voz (ElevenLabs). Sem a chave, responde 501 e o navegador usa a voz do próprio aparelho.
const body = z.object({ text: z.string().trim().min(1).max(800) });
const json = (status: number, v: unknown) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      // Diagnóstico: confere a configuração do ElevenLabs sem expor nada secreto.
      GET: async ({ request }) => {
        const { guard } = await import("@/lib/voice/http");
        const blocked = guard(request, "tts");
        if (blocked) return blocked;
        const info = { chave: !!process.env["ELEVENLABS_API_KEY"], voz: !!process.env["ELEVENLABS_VOICE_ID"], modelo: process.env["ELEVENLABS_MODEL"] ?? "eleven_flash_v2_5", openai: !!process.env["OPENAI_API_KEY"] };
        if (!info.chave) return json(200, { ...info, ok: false, erro: "Sem ELEVENLABS_API_KEY no servidor." });
        try {
          const { elevenSpeak } = await import("@/lib/mcp/openai");
          const res = await elevenSpeak("Olá.");
          const bytes = res.ok ? (await res.arrayBuffer()).byteLength : 0;
          const erro = res.ok ? undefined : (await res.text().catch(() => "")).slice(0, 300);
          return json(200, { ...info, ok: res.ok && bytes > 200, status: res.status, tipo: res.headers.get("content-type"), bytes, ...(erro ? { erro } : {}) });
        } catch (e) { return json(200, { ...info, ok: false, erro: e instanceof Error ? e.message : "falha" }); }
      },
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
