import { describe, expect, it } from "vitest";
import { matchDossier, parseLogins, prettySlug } from "@/lib/login-import";

const texto = `ACESSOS POLOS
        carla@fecafsinop.com.br
fecafsinop ( esse é o padrão de senha ) sempre fecaf+nome polo
leo@fecafbarra.com.br
Demostenes@fecafpetrolina.com.br
polo.tabuleirodomartins@fecaf.com.br
[30/06/2026] EMAIL: [NOME]@FECAF[NOMEPOLO].COM.BR
leo@fecafbarra.com.br`;

describe("Importar logins por polo", () => {
  it("extrai e-mails, polo, responsável e senha pelo padrão fecaf+polo", () => {
    const r = parseLogins(texto);
    expect(r.map((x) => x.email)).toEqual(["carla@fecafsinop.com.br", "leo@fecafbarra.com.br", "demostenes@fecafpetrolina.com.br", "polo.tabuleirodomartins@fecaf.com.br"]);
    expect(r[0]).toEqual({ email: "carla@fecafsinop.com.br", polo: "sinop", owner: "Carla", pass: "fecafsinop" });
    expect(r[2]).toMatchObject({ polo: "petrolina", owner: "Demostenes", pass: "fecafpetrolina" });
  });
  it("e-mail fora do padrão fica sem senha (a pessoa preenche)", () => {
    expect(parseLogins(texto)[3]).toEqual({ email: "polo.tabuleirodomartins@fecaf.com.br", polo: "tabuleirodomartins", owner: "", pass: "" });
  });
  it("liga o trecho do e-mail ao dossiê cadastrado", () => {
    const names = ["Barra da Tijuca", "BH Centro", "BH Floresta", "Juiz de Fora", "São Vicente", "Lauro de Freitas", "Vila Velha", "Santos", "Sinop"];
    expect(matchDossier("barra", names)).toBe("Barra da Tijuca");
    expect(matchDossier("bhfloresta", names)).toBe("BH Floresta");
    expect(matchDossier("juizfora", names)).toBe("Juiz de Fora");
    expect(matchDossier("saovicente", names)).toBe("São Vicente");
    expect(matchDossier("lauro", names)).toBe("Lauro de Freitas");
    expect(matchDossier("vilavelha", names)).toBe("Vila Velha");
    expect(matchDossier("bh", names)).toBeNull(); // ambíguo (e curto)
    expect(matchDossier("cuiaba", names)).toBeNull(); // não cadastrado
    expect(prettySlug("cuiaba")).toBe("Cuiaba");
  });
});
