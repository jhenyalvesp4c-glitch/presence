import { describe, expect, it } from "vitest";
import { applyOrganize, assignCodes, materialOf, matchDossier, planOrganize, type OrgCtx, type Req } from "@/lib/wa-requests";
import type { Demand } from "@/lib/demands";

const req = (p: Partial<Req>): Req => ({ key: `k${Math.random()}`, chat: "P4C | Maceió", grupo: true, quem: "Ana", titulo: "Fazer disparo", detalhes: "Template promo_nov, base com 1.250 contatos (base_maceio.xlsx), colunas nome e telefone.", trecho: "segue a base", quando: "23/11 14:30", prazo: null, prioridade: "media", paraMim: "sim", resolvido: false, imagens: [], confianca: "alta", tipo: "pedido", demanda: null, passos: [], conteudos: [], ...p } as Req);
const dem = (id: string, polo: string, title: string, extra: Partial<Demand> = {}): Demand => ({ id, type: "polo", polo, title, desc: "", priority: "media", status: "todo", deadline: "", history: [], notes: [], ...extra });
const ctx = (demands: Demand[]): OrgCtx[] => [{ pid: "p4c", name: "Demandas gerais", demands, dossiers: ["Maceió", "Lauro de Freitas", "Niterói"] }];

describe("organizar pedidos do WhatsApp nas demandas", () => {
  it("acha o dossiê pelo nome do grupo", () => {
    expect(matchDossier("P4C | Maceió - suporte", ["Maceió", "Niterói"])).toBe("Maceió");
    expect(matchDossier("Lauro de Freitas atendimento", ["Lauro", "Lauro de Freitas"])).toBe("Lauro de Freitas");
    expect(matchDossier("Grupo da família", ["Maceió"])).toBeNull();
  });
  it("atualiza a demanda aberta do mesmo dossiê em vez de criar outra", () => {
    const c = ctx([dem("#P060", "Maceió", "Acompanhar fila, disparo e aprovação"), dem("#P061", "Niterói", "Outra")]);
    const plan = planOrganize([req({ titulo: "Disparar template promo_nov para a base" }), req({ titulo: "Conferir aprovação do template" })], c);
    expect(plan).toHaveLength(1); expect(plan[0]!.kind).toBe("update"); expect((plan[0] as { code: string }).code).toBe("#P060"); expect(plan[0]!.add).toHaveLength(2);
    const out = applyOrganize(c[0]!.demands, plan, new Date(2026, 10, 23));
    const d = out.find((x) => x.id === "#P060")!;
    expect(d.checklist).toHaveLength(2); expect(d.notes[0]!.length).toBeLessThan(200); expect(d.notes[0]).toContain("Disparar template promo_nov"); expect(d.history.at(-1)!.text).toContain("+2 passos");
    expect(out).toHaveLength(2);
  });
  it("não duplica passo nem observação já existentes", () => {
    const c = ctx([dem("#P060", "Maceió", "Disparo")]);
    const r = req({ titulo: "Disparar template" });
    const once = applyOrganize(c[0]!.demands, planOrganize([r], c));
    const twice = applyOrganize(once, planOrganize([r], ctx(once)));
    expect(twice[0]!.checklist).toHaveLength(1); expect(twice[0]!.notes).toHaveLength(1);
  });
  it("cria uma demanda só (com checklist) quando não existe nenhuma do dossiê, juntando os pedidos do mesmo grupo", () => {
    const c = ctx([dem("#P060", "Niterói", "Outra")]);
    const plan = planOrganize([req({ titulo: "Criar usuário", chat: "Lauro de Freitas atendimento" }), req({ titulo: "Criar fila de renegociação", chat: "Lauro de Freitas atendimento" })], c);
    expect(plan).toHaveLength(1); expect(plan[0]!.kind).toBe("create"); expect(plan[0]!.title).toBe("Lauro de Freitas: 2 pedidos");
    const out = applyOrganize(c[0]!.demands, plan);
    const nova = out.find((x) => x.polo === "Lauro de Freitas")!;
    expect(nova.type).toBe("polo"); expect(nova.checklist).toHaveLength(2); expect(nova.desc).toContain("Material"); expect(nova.id).toMatch(/^#P0/);
  });
  it("complemento ligado pela IA ao código da demanda", () => {
    const c = ctx([dem("#P059", "Lauro de Freitas", "Criar fila"), dem("#P060", "Lauro de Freitas", "Treinar equipe")]);
    const plan = planOrganize([req({ chat: "Grupo sem nome do polo", tipo: "complemento", demanda: "P059", titulo: "Usar a base enviada" })], c);
    expect(plan[0]!.kind).toBe("update"); expect((plan[0] as { code: string }).code).toBe("#P059");
  });
  it("prioridade e prazo sobem na demanda", () => {
    const c = ctx([dem("#P060", "Maceió", "Disparo")]);
    const out = applyOrganize(c[0]!.demands, planOrganize([req({ prioridade: "alta", prazo: "2026-11-25" })], c));
    expect(out[0]!.priority).toBe("alta"); expect(out[0]!.deadline).toBe("25/11");
  });
  it("o conteúdo completo vai organizado para o Material (versões separadas) e as observações ficam curtas", () => {
    const r = req({ titulo: "Criar e enviar para aprovação as mensagens de renegociação", passos: ["Criar o template com o texto da Versão 1", "Enviar para aprovação e avisar o Daniel"],
      conteudos: [{ titulo: "Versão 1", texto: "Olá, {{nome}}!\nIdentificamos pendências." }, { titulo: "Versão 2", texto: "Oi {{nome}}, tudo bem?" }], detalhes: "Daniel enviou duas versões; combinou de avisar após aprovar." });
    const m = materialOf(r);
    expect(m).toContain("O QUE FAZER"); expect(m).toContain("1. Criar o template"); expect(m).toContain("▸ Versão 1\nOlá, {{nome}}!\nIdentificamos pendências."); expect(m).toContain("▸ Versão 2"); expect(m).toContain("CONTEXTO");
    const c = ctx([dem("#P060", "Maceió", "Acompanhar fila")]);
    const plan = planOrganize([r], c);
    expect(plan[0]!.add).toEqual(r.passos); expect(plan[0]!.notes[0]!.length).toBeLessThan(200); expect(plan[0]!.material[0]).toBe(m);
  });
  it("demanda nova recebe o código antes de gravar (para ligar o Material)", () => {
    const c = ctx([dem("#P060", "Niterói", "Outra")]);
    const acts = assignCodes(c[0]!.demands, planOrganize([req({ chat: "Lauro de Freitas atendimento" })], c));
    const code = (acts[0] as { code?: string }).code!;
    expect(code).toMatch(/^#P0/); expect(applyOrganize(c[0]!.demands, acts).some((x) => x.id === code)).toBe(true);
  });
  it("observação antiga com o texto inteiro vira linha curta e o conteúdo vai para o Material (nada se perde)", () => {
    const velha = `WhatsApp · 23/11 16:31 · Daniel (grupo UniFECAF)\nCriar e enviar as mensagens\n${"Versão 1: Olá {{nome}}. ".repeat(30)}`;
    const c = ctx([dem("#P060", "Maceió", "Acompanhar fila", { notes: [velha, "anotação minha"] })]);
    const plan = planOrganize([req({ titulo: "Criar e enviar as mensagens" })], c);
    const a = plan[0]!;
    expect(a.material[0]).toContain("REGISTRO ANTERIOR"); expect(a.material[0]).toContain("Versão 1: Olá {{nome}}.");
    const d = applyOrganize(c[0]!.demands, plan)[0]!;
    expect(d.notes[0]!.length).toBeLessThan(260); expect(d.notes[0]).toContain("conteúdo no Material"); expect(d.notes).toContain("anotação minha");
  });
});
