import { createFileRoute } from "@tanstack/react-router";

// Versão publicada do app (o código do commit na Vercel). O navegador compara com a que ele carregou e avisa quando há uma nova.
export const Route = createFileRoute("/api/versao")({
  server: {
    handlers: {
      GET: async () => new Response(JSON.stringify({ id: process.env["VERCEL_GIT_COMMIT_SHA"] ?? process.env["VERCEL_DEPLOYMENT_ID"] ?? "dev" }), { headers: { "content-type": "application/json", "cache-control": "no-store" } }),
    },
  },
});
