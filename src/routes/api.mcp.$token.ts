import { createFileRoute } from "@tanstack/react-router";

import { handleMcpRequest } from "@/lib/mcp/http";

// Mesmo endpoint, com o token no endereço (/api/mcp/<token>) para clientes que só aceitam uma URL (ex.: ChatGPT).
export const Route = createFileRoute("/api/mcp/$token")({
  server: {
    handlers: {
      GET: ({ request, params }) => handleMcpRequest(request, params.token),
      POST: ({ request, params }) => handleMcpRequest(request, params.token),
      DELETE: ({ request, params }) => handleMcpRequest(request, params.token),
      OPTIONS: ({ request, params }) => handleMcpRequest(request, params.token),
    },
  },
});
