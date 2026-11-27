import { describe, expect, it } from "vitest";

import { newUserSteps } from "@/lib/data/people";

describe("pessoas do cliente", () => {
  it("os passos de novo usuário levam o nome da pessoa, em ordem", () => {
    expect(newUserSteps("Jenny")).toEqual(["Criar usuário — Jenny", "Enviar acessos — Jenny", "Confirmar acesso — Jenny"]);
  });
});
