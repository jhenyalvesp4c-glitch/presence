import { createFileRoute } from "@tanstack/react-router";

import { handleMcpRequest } from "@/lib/mcp/http";

// Endpoint MCP (JSON-RPC sobre HTTP). Token no cabeçalho Authorization: Bearer. Veja docs/MCP.md.
export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      GET: ({ request }) => handleMcpRequest(request),
      POST: ({ request }) => handleMcpRequest(request),
      DELETE: ({ request }) => handleMcpRequest(request),
      OPTIONS: ({ request }) => handleMcpRequest(request),
    },
  },
});
