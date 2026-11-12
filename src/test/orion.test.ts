import { describe, expect, it } from "vitest";
import { keywords, mentionedDossiers, periodOf, rank, scoreDoc, snippet, type OrionDoc } from "@/lib/orion";

const doc = (id: string, title: string, text: string, date?: string, kind: OrionDoc["kind"] = "demanda"): OrionDoc => ({ id, kind, title, text, date, link: "/" });

describe("Orion", () => {
  it("palavras-chave ignoram palavras comuns e acentos", () => {
    expect(keywords("Qual foi a média de falhas nos disparos de Maceió?")).toEqual(["disparos", "maceio"]);
  });

  it("período citado na pergunta", () => {
    expect(periodOf("o que fiz hoje", "2026-11-12")).toMatchObject({ from: "2026-11-12", to: "2026-11-12" });
    expect(periodOf("ontem teve erro?", "2026-11-12")?.from).toBe("2026-11-11");
    expect(periodOf("semana passada", "2026-11-12")).toMatchObject({ from: "2026-11-02", to: "2026-11-08" });
    expect(periodOf("no mês passado", "2026-11-12")).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(periodOf("neste mês", "2026-11-12")).toMatchObject({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodOf("erro de cartão", "2026-11-12")).toBeNull();
  });

  it("ordena por relevância e dá preferência às anotações do Orion", () => {
    const docs = [
      doc("a", "Disparo Niterói", "Tudo certo.", "2026-11-01"),
      doc("b", "Anotação", "Disparo de Maceió deu erro de pagamento no cartão", "2026-11-10", "registro"),
      doc("c", "Outra coisa", "Nada a ver", "2026-11-11"),
    ];
    const r = rank(docs, "teve erro de pagamento no disparo de Maceió?", "2026-11-12");
    expect(r.docs.map((d) => d.id)[0]).toBe("b");
    expect(r.docs.map((d) => d.id)).not.toContain("c");
  });

  it("sem palavras-chave lista os mais recentes do período", () => {
    const docs = [doc("a", "x", "x", "2026-11-12"), doc("b", "y", "y", "2026-11-12"), doc("c", "z", "z", "2026-11-01")];
    expect(rank(docs, "o que aconteceu hoje?", "2026-11-12").docs.map((d) => d.id).sort()).toEqual(["a", "b"]);
  });

  it("tolera plural e flexão pelo radical", () => {
    expect(scoreDoc(doc("a", "t", "houve falhas no disparo"), ["disparos"])).toBeGreaterThan(0);
  });

  it("trecho centrado na palavra e etiqueta de dossiês", () => {
    const long = `${"abc ".repeat(80)}erro de pagamento ${"def ".repeat(80)}`;
    expect(snippet(long, ["pagamento"])).toContain("pagamento");
    expect(mentionedDossiers("Disparo em Juiz de Fora e Maceió", ["Maceió", "Juiz de Fora", "Santos"])).toEqual(["Maceió", "Juiz de Fora"]);
  });
});

import { audioExt, transcribe } from "@/lib/mcp/openai";
describe("Transcrição de áudio", () => {
  it("escolhe a extensão pelo tipo gravado", () => {
    expect(audioExt("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExt("audio/mp4")).toBe("m4a");
    expect(audioExt("audio/ogg;codecs=opus")).toBe("ogg");
  });
  it("envia o áudio com modelo, idioma e chave, e devolve o texto", async () => {
    const orig = globalThis.fetch;
    let seen: { url: string; auth: string | null; model: unknown; lang: unknown; file: unknown } | undefined;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      const f = init.body as FormData;
      seen = { url, auth: (init.headers as Record<string, string>)["authorization"] ?? null, model: f.get("model"), lang: f.get("language"), file: (f.get("file") as File).name };
      return new Response(JSON.stringify({ text: " olá mundo " }), { status: 200 });
    }) as typeof fetch;
    try {
      const text = await transcribe(new Uint8Array([1, 2, 3]), "audio/webm;codecs=opus", { OPENAI_API_KEY: "k", OPENAI_BASE_URL: "http://x/v1" });
      expect(text).toBe("olá mundo");
      expect(seen).toEqual({ url: "http://x/v1/audio/transcriptions", auth: "Bearer k", model: "whisper-1", lang: "pt", file: "audio.webm" });
    } finally { globalThis.fetch = orig; }
  });
});

import { buildGraph, codesIn } from "@/components/brain/BrainGraph";
import type { BrainEntry } from "@/lib/data/brain";
const entry = (o: Partial<BrainEntry>): BrainEntry => ({ id: "1", title: "", text: "", date: "2026-11-12", dossiers: [], source: "orion", refId: null, summary: "", attachments: [], createdAt: "", ...o });
describe("Mapa do segundo cérebro", () => {
  it("acha códigos de demanda no texto", () => {
    expect(codesIn("Ver #P048 e G42, também m7")).toEqual(["#P048", "#G042", "#M007"]);
    expect(codesIn("sem códigos aqui")).toEqual([]);
  });
  it("liga anotações a dossiês e demandas", () => {
    const g = buildGraph([entry({ id: "a", text: "Disparo #P048", dossiers: ["Maceió"] }), entry({ id: "b", text: "outro", dossiers: ["Maceió", "Santos"] })]);
    expect(g.nodes.filter((n) => n.kind === "dossie").map((n) => n.label).sort()).toEqual(["Maceió", "Santos"]);
    expect(g.nodes.some((n) => n.kind === "demanda" && n.label === "#P048")).toBe(true);
    expect(g.edges.length).toBe(4);
  });
});
