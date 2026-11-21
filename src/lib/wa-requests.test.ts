import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, buildBatches, rulesPrompt, cleanRequests, groupChats, mergeRequests, reqKey, requestsToInboxText, sinceSeconds, stamp, type WaMessage } from "./wa-requests";

const base = Math.floor(new Date(2026, 10, 21, 14, 0).getTime() / 1000);
const m = (chat: string, name: string, group: boolean, id: string, ts: number, text: string, o: Partial<WaMessage> = {}): WaMessage => ({ id, chat, chat_name: name, is_group: group, sender_name: "Carla", from_me: false, ts, text, kind: "texto", ...o });
const msgs = [
  m("g1", "Polo Norte", true, "1", base, "Jheny, preciso do relatório até sexta"), m("g1", "Polo Norte", true, "2", base + 60, "", { kind: "imagem", has_media: true, media_mime: "image/jpeg" }), m("g1", "Polo Norte", true, "3", base + 120, "ok, mando", { from_me: true, sender_name: "Eu" }),
  m("p1", "Ana", false, "4", base + 10, "Me manda o orçamento?"), m("g2", "Só eu", true, "5", base + 20, "falando sozinha", { from_me: true }),
];

describe("wa-requests", () => {
  it("agrupa por conversa e ignora as em que só você falou; respeita o filtro", () => {
    const all = groupChats(msgs, { grupos: true, privadas: true }); expect(all.map((c) => c.name)).toEqual(["Polo Norte", "Ana"]);
    expect(groupChats(msgs, { grupos: false, privadas: true }).map((c) => c.name)).toEqual(["Ana"]); expect(groupChats(msgs, { grupos: true, privadas: false }).map((c) => c.name)).toEqual(["Polo Norte"]);
  });
  it("monta o lote com cabeçalhos, imagem numerada e identifica privadas", () => {
    const [b] = buildBatches(groupChats(msgs, { grupos: true, privadas: true }));
    expect(b!.text).toMatch(/=== Grupo: Polo Norte ===/); expect(b!.text).toMatch(/=== Conversa privada: Ana ===/); expect(b!.text).toMatch(/\[imagem #1\]/); expect(b!.images).toEqual([{ n: 1, chat: "g1", id: "2", mime: "image/jpeg", ts: base + 60, chatName: "Polo Norte" }]);
    expect(b!.text).toMatch(/Eu: ok, mando/);
  });
  it("divide em vários lotes quando passa do tamanho e limita as imagens", () => {
    const many = Array.from({ length: 60 }, (_, i) => m("g1", "Polo Norte", true, `x${i}`, base + i, `mensagem número ${i} com um texto razoavelmente comprido para encher`, i % 3 === 0 ? { has_media: true, media_mime: "image/png" } : {}));
    const bs = buildBatches(groupChats(many, { grupos: true, privadas: true }), { maxChars: 1500, maxImages: 2 });
    expect(bs.length).toBeGreaterThan(2); expect(bs.every((b) => b.images.length <= 2)).toBe(true); expect(bs.slice(1).every((b) => /continuação/.test(b.text))).toBe(true);
    const sem = buildBatches(groupChats(many, { grupos: true, privadas: true }), { withImages: false }); expect(sem.every((b) => b.images.length === 0)).toBe(true);
  });
  it("limpa a resposta da IA, valida imagens e junta lotes sem repetir", () => {
    const raw = { pedidos: [{ chat: "Polo Norte", grupo: true, quem: "Carla", titulo: "Enviar relatório", quando: "21/11 14:00", prazo: "2026-11-28", prioridade: "alta", paraMim: "sim", imagens: [1, 9], confianca: "alta" }, { titulo: "" }, { chat: "Ana", quem: "Ana", titulo: "Mandar orçamento", quando: "21/11 14:10", paraMim: "talvez", resolvido: true }] };
    const r = cleanRequests(raw, new Set([1])); expect(r).toHaveLength(2); expect(r[0]!.imagens).toEqual([1]); expect(r[1]!.paraMim).toBe("talvez");
    const merged = mergeRequests([r, [{ ...r[0]!, imagens: [2] }]]); expect(merged).toHaveLength(2); expect(merged[0]!.titulo).toBe("Enviar relatório"); expect(merged[0]!.imagens).toEqual([1, 2]); expect(merged.at(-1)!.resolvido).toBe(true);
    expect(reqKey("Polo Norte", "Carla", "Enviar relatório", "21/11 14:00")).toBe(r[0]!.key);
  });
  it("texto para a Central e período", () => {
    const [r] = cleanRequests({ pedidos: [{ chat: "Polo Norte", grupo: true, quem: "Carla", titulo: "Enviar relatório", quando: "21/11 14:00", prazo: "2026-11-28", trecho: "preciso do relatório", imagens: [1] }] }, new Set([1]));
    const t = requestsToInboxText([r!], { 1: "whatsapp-polo-norte-1.jpg" }); expect(t).toMatch(/Enviar relatório — pedido por Carla no grupo "Polo Norte"/); expect(t).toMatch(/Prazo: 28\/11\/2026/); expect(t).toMatch(/whatsapp-polo-norte-1\.jpg/);
    expect(sinceSeconds("ultima", 1234)).toBe(1234); expect(sinceSeconds("ultima", null, new Date(2026, 10, 21, 12))).toBe(Math.floor(new Date(2026, 10, 21, 12).getTime() / 1000) - 86400); expect(stamp(base)).toBe("21/11 14:00");
  });
  it("prompt de regras: padrão do CRM, personalizado e exemplos aprendidos", () => {
    expect(DEFAULT_RULES).toMatch(/template/i); expect(DEFAULT_RULES).toMatch(/fora do horário/i); expect(DEFAULT_RULES).toMatch(/usuários/i); expect(DEFAULT_RULES).toMatch(/disparo/i);
    expect(rulesPrompt("", [], [])).toContain("QR Code"); expect(rulesPrompt("só CRM", [], [])).toContain("só CRM"); expect(rulesPrompt("só CRM", [], [])).not.toContain("QR Code");
    const p = rulesPrompt("", [{ titulo: "Reconectar o número", chat: "Polo Norte", trecho: "o QR caiu" }], [{ titulo: "Pagar fatura", chat: "Financeiro", trecho: "" }]);
    expect(p).toMatch(/JÁ ACEITOU[\s\S]*Reconectar o número[\s\S]*o QR caiu/); expect(p).toMatch(/DESCARTOU[\s\S]*Pagar fatura/);
  });
});
