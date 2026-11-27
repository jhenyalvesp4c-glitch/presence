import { describe, expect, it } from "vitest";

import { accessFields, parseAccessPaste } from "@/lib/access-paste";

// só dados inventados: nunca coloque acessos reais em testes
const TEXT = `1. Ana

* Tipo de acesso: Gestor
* E-mail: ana@exemplo.test
* Senha: senha-um

2. Beto

* Tipo de acesso: Vendedor
* E-mail: beto@exemplo.test
* Senha: senha dois

3. Carla

* Tipo de acesso: Vendedor
* E-mail: carla@exemplo.test
* Senha: senha-tres`;

describe("colar acessos", () => {
  it("lê a lista numerada com nome, tipo, e-mail e senha", () => {
    const r = parseAccessPaste(TEXT);
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ name: "Ana", kind: "Gestor", user: "ana@exemplo.test", pass: "senha-um" });
    expect(r[1]).toMatchObject({ name: "Beto", kind: "Vendedor", pass: "senha dois" });
    expect(r[2]?.user).toBe("carla@exemplo.test");
  });
  it("lê blocos sem número, separados por linha em branco", () => {
    const r = parseAccessPaste("Nome: Ana\nLogin: ana@x.test\nSenha: 123\n\nNome: Beto\nLogin: beto@x.test\nSenha: 456");
    expect(r.map((a) => [a.name, a.user, a.pass])).toEqual([["Ana", "ana@x.test", "123"], ["Beto", "beto@x.test", "456"]]);
  });
  it("monta os campos da ficha", () => {
    expect(accessFields({ name: "Ana", kind: "Gestor", user: "a@b.test", pass: "x" }, "Painel")).toEqual({ label: "Painel · Gestor", username: "a@b.test", note: "Ana", pass: "x" });
    expect(accessFields({ name: "N", kind: "", user: "a", pass: "" }).label).toBe("Acesso");
  });
  it("ignora texto sem usuário nem senha", () => { expect(parseAccessPaste("oi, tudo bem?")).toEqual([]); });
});
