import { describe, expect, it } from "vitest";
import { cleanLinks, cleanPlan, cleanTags, daysSince, demandsFromPlan, digest, ideaText, linksIn, staleIdeas, type Idea } from "@/lib/ideas";

const now = new Date("2026-11-20T12:00:00Z");
const day = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
const idea = (p: Partial<Idea> & { id: string }): Idea => ({ title: "x", body: "", kind: "ideia", area: "pessoal", status: "solta", tags: [], links: [], attachments: [], plan: null, converted: [], source: "texto", touchedAt: day(1), createdAt: day(1), ...p });

describe("Caixa de ideias", () => {
  it("ideias paradas: só as em aberto e sem mexer há 30 dias ou mais", () => {
    const list = [idea({ id: "a", touchedAt: day(45) }), idea({ id: "b", touchedAt: day(31), status: "explorando" }), idea({ id: "c", touchedAt: day(60), status: "arquivada" }), idea({ id: "d", touchedAt: day(60), status: "fazendo" }), idea({ id: "e", touchedAt: day(10) }), idea({ id: "f", touchedAt: day(90), kind: "referencia" })];
    expect(staleIdeas(list, now).map((i) => i.id)).toEqual(["a", "b"]);
    expect(daysSince(day(30), now)).toBe(30);
  });
  it("resumo semanal conta e pergunta o que fazer com as paradas", () => {
    const d = digest([idea({ id: "a", touchedAt: day(45), createdAt: day(50) }), idea({ id: "b", createdAt: day(2) }), idea({ id: "c", status: "arquivada", createdAt: day(40) }), idea({ id: "r", kind: "referencia" })], now);
    expect(d).toMatchObject({ total: 3, abertas: 2, novasNaSemana: 1 }); expect(d.paradas.map((i) => i.id)).toEqual(["a"]);
    expect(d.texto).toContain("1 parada há mais de 30 dias: continuar, arquivar ou virar projeto?");
  });
  it("limpa etiquetas e links", () => {
    expect(cleanTags(["#Viagem", " viagem ", "Casa", "", 5])).toEqual(["viagem", "casa", "5"]);
    expect(cleanLinks(["https://a.com/x", "javascript:alert(1)", "texto", "http://b.org"])).toEqual(["https://a.com/x", "http://b.org"]);
    expect(linksIn("veja https://a.com/x e (https://b.org/y)")).toEqual(["https://a.com/x", "https://b.org/y"]);
  });
  it("plano da IA: aceita o formato, limita e ignora lixo", () => {
    expect(cleanPlan(null)).toBeNull(); expect(cleanPlan({})).toBeNull();
    const p = cleanPlan({ resumo: " Abrir uma loja ", perguntas: ["Quem compra?", { q: "Qual o preço?", a: "R$ 50" }, ""], riscos: ["Estoque"], passos: ["Pesquisar", "Montar catálogo"], precisa: { tempo: "2 meses", dinheiro: "R$ 3 mil" }, proximo_passo: "Falar com 5 clientes" })!;
    expect(p.resumo).toBe("Abrir uma loja"); expect(p.perguntas).toEqual([{ q: "Quem compra?", a: "" }, { q: "Qual o preço?", a: "R$ 50" }]); expect(p.precisa).toEqual({ tempo: "2 meses", dinheiro: "R$ 3 mil", pessoas: "" }); expect(p.proximoPasso).toBe("Falar com 5 clientes");
  });
  it("o texto da ideia leva tudo para a IA e para a busca", () => {
    const t = ideaText(idea({ id: "a", title: "Loja de velas", body: "Vender no Instagram", area: "negocios", tags: ["velas"], plan: cleanPlan({ resumo: "Boa", riscos: ["Estoque"], passos: ["Testar"], precisa: { dinheiro: "R$ 1 mil" } }) }));
    for (const s of ["Loja de velas", "negócios", "velas", "Riscos: Estoque", "Primeiros passos: Testar", "dinheiro: R$ 1 mil"]) expect(t).toContain(s);
  });
  it("os primeiros passos viram demandas do projeto (a 1ª é a mais importante)", () => {
    const ds = demandsFromPlan({ title: "Loja", plan: cleanPlan({ resumo: "x", passos: ["Pesquisar", "Catálogo", "Site"], proximo_passo: "Ligar para 5 clientes" }) }, (n) => `#G0${40 + n}`);
    expect(ds.map((d) => [d.id, d.title, d.priority])).toEqual([["#G040", "Pesquisar", "alta"], ["#G041", "Catálogo", "media"], ["#G042", "Site", "media"]]);
    expect(ds[0]!.desc).toContain("Ligar para 5 clientes");
    expect(demandsFromPlan({ title: "Loja", plan: null }, (n) => `#G${n}`)[0]!.title).toBe("Começar: Loja");
  });
});
