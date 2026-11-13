import { describe, it, expect } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { streamChat } from "../lib/mcp/openai";

const MSG = "Function tools with reasoning effort are not supported for gpt-6.1-terra in v1/chat/completions. Use /v1/responses.";

async function run(accept: (e: unknown) => boolean) {
  const seen: unknown[] = [];
  const srv = createServer((req, res) => {
    let b = ""; req.on("data", (c) => (b += c));
    req.on("end", () => {
      const e = (JSON.parse(b) as Record<string, unknown>)["reasoning_effort"]; seen.push(e);
      if (!accept(e)) { res.writeHead(400, { "content-type": "application/json" }); res.end(JSON.stringify({ error: { message: MSG } })); return; }
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(`data: ${JSON.stringify({ choices: [{ delta: { content: "oi" } }] })}\n\ndata: [DONE]\n\n`);
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  const port = (srv.address() as AddressInfo).port;
  const out = await streamChat({ model: "m", messages: [], reasoning_effort: "low" }, () => {}, { OPENAI_API_KEY: "k", OPENAI_BASE_URL: `http://127.0.0.1:${port}/v1` });
  srv.close();
  return { out, seen };
}

describe("streamChat com modelo que recusa reasoning_effort + tools", () => {
  it("tira o parâmetro", async () => { const r = await run((e) => e === undefined); expect(r.out.text).toBe("oi"); expect(r.seen).toEqual(["low", undefined]); });
  it("usa none se o modelo exige", async () => { const r = await run((e) => e === "none"); expect(r.out.text).toBe("oi"); expect(r.seen).toEqual(["low", undefined, "none"]); });
});
