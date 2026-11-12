/**
 * MCP (Model Context Protocol) sobre HTTP, sem estado: cada POST traz uma mensagem JSON-RPC 2.0 e recebe a
 * resposta em JSON. Implementa o que clientes como o ChatGPT usam: initialize, ping, tools/list e tools/call.
 * Aqui não há acesso ao banco: as ferramentas chegam por `ToolSet`, o que deixa tudo testável.
 */
export const SERVER_INFO = { name: "presence", title: "Presence", version: "1.0.0" };
export const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export type ToolAnnotations = { title?: string; readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
export type ToolResult = { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
export type ToolDef = {
  name: string; title: string; description: string; inputSchema: Record<string, unknown>; annotations: ToolAnnotations;
  run: (args: unknown, ctx: { client: string }) => Promise<ToolResult>;
};
export type ToolSet = { tools: ToolDef[]; instructions: string };

type Id = string | number | null;
type RpcRequest = { jsonrpc?: string; id?: Id; method?: string; params?: Record<string, unknown> };
export type RpcResponse = { jsonrpc: "2.0"; id: Id; result?: unknown; error?: { code: number; message: string; data?: unknown } };

const err = (id: Id, code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

export const negotiate = (requested: unknown) =>
  typeof requested === "string" && (SUPPORTED_VERSIONS as readonly string[]).includes(requested) ? requested : SUPPORTED_VERSIONS[0];

/** Trata uma mensagem. Devolve `null` para notificações (sem `id`), que não têm resposta. */
export async function handleMessage(msg: unknown, set: ToolSet, ctx: { client: string }): Promise<RpcResponse | null> {
  if (!msg || typeof msg !== "object" || Array.isArray(msg)) return err(null, -32600, "Requisição inválida.");
  const m = msg as RpcRequest;
  const isNotification = m.id === undefined;
  const id = m.id ?? null;
  if (m.jsonrpc !== "2.0" || typeof m.method !== "string") return isNotification ? null : err(id, -32600, "Requisição inválida.");
  if (isNotification) return null; // notifications/initialized, notifications/cancelled...

  switch (m.method) {
    case "initialize":
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: negotiate(m.params?.["protocolVersion"]),
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: set.instructions,
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0", id,
        result: { tools: set.tools.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations })) },
      };
    case "tools/call": {
      const name = m.params?.["name"];
      const tool = set.tools.find((t) => t.name === name);
      if (!tool) return err(id, -32602, `Ferramenta desconhecida: ${String(name)}`);
      try {
        return { jsonrpc: "2.0", id, result: await tool.run(m.params?.["arguments"] ?? {}, ctx) };
      } catch (e) {
        // Erro da ferramenta volta como resultado (isError) para o assistente poder se corrigir.
        const message = e instanceof Error ? e.message : "Erro inesperado.";
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Erro: ${message}` }], isError: true } satisfies ToolResult };
      }
    }
    default:
      return err(id, -32601, `Método não suportado: ${m.method}`);
  }
}

/** Corpo do POST: uma mensagem ou um lote. */
export async function handleBody(body: unknown, set: ToolSet, ctx: { client: string }): Promise<{ status: number; body: unknown }> {
  if (Array.isArray(body)) {
    if (!body.length) return { status: 400, body: err(null, -32600, "Lote vazio.") };
    const out = (await Promise.all(body.map((b) => handleMessage(b, set, ctx)))).filter((r): r is RpcResponse => r !== null);
    return out.length ? { status: 200, body: out } : { status: 202, body: null };
  }
  const r = await handleMessage(body, set, ctx);
  return r ? { status: 200, body: r } : { status: 202, body: null };
}
