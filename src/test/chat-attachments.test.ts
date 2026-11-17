import { describe, expect, it } from "vitest";
import { MAX_ANEXOS, anexosTotal, buildUserContent, stripBinary, type ChatPart } from "@/lib/voice/attachments";

const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("conversa escrita: anexos", () => {
  it("sem anexos a mensagem continua sendo só o texto", () => { expect(buildUserContent("oi", [])).toBe("oi"); });
  it("imagem e PDF viram partes da mensagem; texto entra como texto", () => {
    const c = buildUserContent("analisa", [
      { name: "tela.jpg", mime: "image/jpeg", data: "AAAA" }, { name: "x.pdf", mime: "application/pdf", data: "BBBB" }, { name: "n.txt", mime: "text/plain", data: b64("olá mundo") },
    ]) as ChatPart[];
    expect(c[0]).toMatchObject({ type: "text" });
    expect((c[0] as { text: string }).text).toContain("analisa"); expect((c[0] as { text: string }).text).toContain("olá mundo"); expect((c[0] as { text: string }).text).toContain("tela.jpg");
    expect(c.filter((p) => p.type === "image_url")).toHaveLength(1);
    expect((c.find((p) => p.type === "image_url") as { image_url: { url: string } }).image_url.url).toBe("data:image/jpeg;base64,AAAA");
    expect((c.find((p) => p.type === "file") as { file: { filename: string } }).file.filename).toBe("x.pdf");
  });
  it("só arquivos, sem texto digitado: pede para considerar os arquivos", () => {
    const c = buildUserContent("  ", [{ name: "a.png", mime: "image/png", data: "AA" }]) as ChatPart[];
    expect((c[0] as { text: string }).text).toContain("considere só os arquivos");
  });
  it("tira o peso (imagens e PDFs) do estado que volta ao navegador", () => {
    const msgs = [{ role: "system", content: "x" }, { role: "user", content: buildUserContent("oi", [{ name: "a.png", mime: "image/png", data: "A".repeat(1000) }, { name: "b.pdf", mime: "application/pdf", data: "B".repeat(1000) }]) }];
    const out = stripBinary(msgs), json = JSON.stringify(out);
    expect(json).not.toContain("AAAA"); expect(json).toContain("[imagem enviada]"); expect(json).toContain("b.pdf");
    expect(out[0]).toEqual(msgs[0]);
  });
  it("limites: até 6 arquivos e ~4 MB juntos", () => { expect(MAX_ANEXOS).toBe(6); expect(anexosTotal([{ name: "a", mime: "x", data: "abc" }, { name: "b", mime: "x", data: "de" }])).toBe(5); });
});
