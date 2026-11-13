import { describe, expect, it } from "vitest";
import { classify, DEFAULT_CRM, DEFAULT_IGNORE } from "@/lib/whatsapp/relevance";

const rules = { names: [], crm: DEFAULT_CRM, ignore: DEFAULT_IGNORE };
const c = (text: string, x: object = {}) => classify({ text, ...x }, rules);

describe("avisos do WhatsApp", () => {
  it("pega o nome em qualquer grafia", () => {
    for (const n of ["Jheny", "jenny", "Jeny", "Jhenny", "jheni", "Jeni", "JENNY!", "Oi Jhenyy", "oi, jhéni?"]) expect(c(`${n} pode ver isso?`), n).toBe("nome");
    expect(c("a jheny viu")).toBe("nome");
  });
  it("não confunde com outros nomes", () => {
    for (const n of ["Jennifer", "Jenifer", "Jeniffer", "geni", "Henry"]) expect(c(`${n} chegou`), n).toBeNull();
  });
  it("marcação e resposta têm prioridade", () => {
    expect(c("oi", { mentions_me: true })).toBe("marcou");
    expect(c("oi", { reply_to_me: true })).toBe("respondeu");
    expect(c("jheny", { from_me: true })).toBeNull();
  });
  it("assuntos de CRM avisam", () => {
    for (const t of ["o CRM caiu", "P4C fora do ar", "problema na P4C?", "quem cria usuário novo?", "preciso de um disparo em massa", "template foi reprovado", "o qr code não conecta", "problema na conexão do whatsapp", "a Meta bloqueou o template"]) expect(c(t), t).toBe("crm");
  });
  it("campanhas e valores não avisam", () => {
    for (const t of ["disparo da campanha de hoje", "qual o valor do disparo?", "template da campanha nova", "CRM: saldo r$ 500", "meta do mês é 30 vendas", "bom dia grupo"]) expect(c(t), t).toBeNull();
  });
  it("nome e marcação avisam mesmo com assunto de campanha", () => {
    expect(c("Jheny, a campanha do valor novo")).toBe("nome");
  });
});
