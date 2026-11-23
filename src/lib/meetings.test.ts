import { describe, expect, it } from "vitest";
import { actionsToInboxText, analysisToMarkdown, byPerson, cleanAnalysis, sinceFor, waToText } from "./meetings";

describe("meetings", () => {
  const raw = { titulo: "Alinhamento P4C", resumo: "Falamos do disparo.", topicos: [{ assunto: "Disparo", pontos: ["Template aprovado", ""] }], decisoes: ["Usar API oficial"], participantes: ["Ana", "Bia"],
    acoes: [{ quem: "Ana", oQue: "Enviar template", prazo: "2026-11-25", prioridade: "alta", tipo: "demanda", minha: true }, { quem: "Bia", oQue: "Lembrar do cliente", prazo: "amanhã", tipo: "lembrete" }, { quem: "x", oQue: "" }],
    pendencias: ["Quem paga?"], proxima: { data: "2026-12-01", hora: "10:00", assunto: "Retorno" } };
  it("cleans the AI answer", () => {
    const a = cleanAnalysis(raw)!;
    expect(a.acoes).toHaveLength(2); expect(a.acoes[1]!.prazo).toBeNull(); expect(a.acoes[1]!.prioridade).toBe("media"); expect(a.topicos[0]!.pontos).toEqual(["Template aprovado"]);
    expect(a.proxima).toEqual({ data: "2026-12-01", hora: "10:00", assunto: "Retorno" }); expect(cleanAnalysis(null)).toBeNull(); expect(cleanAnalysis({})).toBeNull();
  });
  it("renders markdown and inbox text", () => {
    const a = cleanAnalysis(raw)!, md = analysisToMarkdown(a, "2026-11-21");
    expect(md).toMatch(/# Alinhamento P4C/); expect(md).toMatch(/\*\*Ana\*\*: Enviar template \(até 25\/11\/2026\)/); expect(md).toMatch(/Próxima reunião/);
    const t = actionsToInboxText(a.titulo, "2026-11-21", a.acoes, a.proxima); expect(t).toMatch(/Demanda \(Ana\)/); expect(t).toMatch(/Lembrete \(Bia\)/); expect(t).toMatch(/Compromisso: próxima reunião em 01\/12\/2026 às 10:00/);
  });
  it("groups actions by person with mine first", () => { const g = byPerson(cleanAnalysis(raw)!.acoes); expect(g[0]!.quem).toBe("Ana"); expect(g[0]!.minha).toBe(true); expect(g).toHaveLength(2); });
  it("formats WhatsApp messages in order", () => {
    const ts = Math.floor(new Date(2026, 10, 21, 14, 5).getTime() / 1000);
    const t = waToText([{ ts: ts + 60, sender_name: "Bia", from_me: false, text: "ok", kind: "text" }, { ts, sender_name: "", from_me: true, text: "Bom dia\npessoal", kind: "text" }, { ts: ts + 120, sender_name: "Ana", from_me: false, text: "", kind: "image" }]);
    expect(t.split("\n")).toEqual(["[21/11 14:05] Eu: Bom dia / pessoal", "[21/11 14:06] Bia: ok", "[21/11 14:07] Ana: [image]"]);
  });
  it("period start", () => { const now = new Date(2026, 10, 21, 15, 0); expect(sinceFor("hoje", now)).toBe(Math.floor(new Date(2026, 10, 21, 0, 0).getTime() / 1000)); expect(sinceFor("24h", now)).toBe(Math.floor(now.getTime() / 1000) - 86400); });
});

import { analysisToMarkdown as toMd, cleanAnalysis as clean } from "./meetings";
import { demoByKind } from "./meetings-demo";

describe("tipos de gravação e resumo detalhado", () => {
  it("guarda tipo, fatos exatos (com 'confirmar'), seções, expectativas, lembretes e perguntas", () => {
    const a = clean({ titulo: "Entrevista — X", resumo: "Longa ata.", tipo: "entrevista", fatos: [{ rotulo: "Salário", valor: "R$ 4.500", confirmar: false }, { rotulo: "Bônus", valor: "até 1 salário (confirmar)", confirmar: true }, { rotulo: "", valor: "vazio" }], secoes: [{ titulo: "A vaga", itens: ["Híbrido"] }, { titulo: "Vazia", itens: [] }], expectativas: ["Entregar relatório"], lembrar: ["Enviar portfólio"], perguntas: ["Como é o bônus?"] })!;
    expect(a.tipo).toBe("entrevista");
    expect(a.fatos).toEqual([{ rotulo: "Salário", valor: "R$ 4.500", confirmar: false }, { rotulo: "Bônus", valor: "até 1 salário (confirmar)", confirmar: true }]);
    expect(a.secoes).toEqual([{ titulo: "A vaga", itens: ["Híbrido"] }]);
    expect(a.expectativas).toEqual(["Entregar relatório"]); expect(a.lembrar).toHaveLength(1); expect(a.perguntas).toHaveLength(1);
  });
  it("análises antigas (sem os campos novos) continuam abrindo como reunião", () => {
    const a = clean({ titulo: "Velha", resumo: "ok" })!;
    expect(a.tipo).toBe("reuniao"); expect(a.fatos).toEqual([]); expect(a.secoes).toEqual([]);
  });
  it("só fatos ou só seções já contam como análise válida; tipo inválido vira reunião", () => {
    expect(clean({ fatos: [{ rotulo: "Salário", valor: "R$ 1" }], tipo: "xyz" })!.tipo).toBe("reuniao");
    expect(clean({})).toBeNull();
  });
  it("ata em Markdown inclui fatos, seções, expectativas, lembretes e perguntas", () => {
    const md = toMd(demoByKind("entrevista"), "2026-11-22");
    for (const t of ["## Fatos e números", "**Salário:** R$ 4.500 por mês", "_(confirmar)_", "## A empresa", "## Remuneração e benefícios", "## O que esperam de você", "## Para não esquecer", "## Perguntas sem resposta"]) expect(md).toContain(t);
  });
  it("exemplo de treinamento separa o que eu fiquei de enviar", () => {
    const a = demoByKind("treinamento");
    expect(a.acoes.filter((x) => x.minha)).toHaveLength(2);
    expect(a.secoes.map((s) => s.titulo)).toContain("Materiais e acessos prometidos");
  });
});
