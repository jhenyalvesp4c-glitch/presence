import { beforeEach, describe, expect, it } from "vitest";
import { accessLoginId, loginsOfDossier, passwordOfAccess, readLoginDocs, removeAccessLogin, saveAccessLogin } from "@/lib/login-store";

describe("logins e senhas (só neste navegador)", () => {
  beforeEach(() => localStorage.clear());
  it("acesso criado na ficha vira login do dossiê, com a senha", () => {
    saveAccessLogin({ accessId: "abc", label: "Painel de anúncios", user: "ana@x.com", pass: "S3nha!", owner: "Ana", dossier: "Maceió" });
    expect(accessLoginId("abc")).toBe("a-abc"); expect(passwordOfAccess("abc")).toBe("S3nha!");
    const l = loginsOfDossier("maceió"); expect(l).toHaveLength(1); expect(l[0]).toMatchObject({ title: "Painel de anúncios", user: "ana@x.com", pass: "S3nha!", owner: "Ana" });
    const doc = readLoginDocs()[0]!; expect(doc.kind).toBe("Login"); expect(doc.login?.dossier).toBe("Maceió");
  });
  it("atualizar não duplica e apagar tira o login", () => {
    saveAccessLogin({ accessId: "1", label: "A", user: "u", pass: "1", owner: "", dossier: "Niterói" });
    saveAccessLogin({ accessId: "1", label: "A", user: "u", pass: "2", owner: "", dossier: "Niterói" });
    expect(readLoginDocs()).toHaveLength(1); expect(passwordOfAccess("1")).toBe("2");
    removeAccessLogin("1"); expect(readLoginDocs()).toHaveLength(0); expect(passwordOfAccess("1")).toBeNull();
  });
  it("mantém os logins que já existiam na Documentação", () => {
    localStorage.setItem("presence.logins.v1", JSON.stringify([{ id: "l-Santos", title: "Santos", desc: "", kind: "Login", color: "amber", updated: "x", login: { user: "s@p4c.com", pass: "p", owner: "Juliana", dossier: "Santos" } }]));
    saveAccessLogin({ accessId: "2", label: "Novo", user: "u", pass: "p", owner: "", dossier: "Santos" });
    expect(readLoginDocs().map((d) => d.id).sort()).toEqual(["a-2", "l-Santos"]); expect(loginsOfDossier("Santos")).toHaveLength(2);
  });
});
