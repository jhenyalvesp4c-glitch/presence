import { describe, expect, it } from "vitest";
import { groupByPolo } from "@/lib/task-polo";

const t = (title: string, client: string | undefined, date: string, done = false) => ({ title, client, date, time: "—", done });

describe("Tarefas separadas por polo", () => {
  const rows = [t("Criar usuários", "Presidente Prudente", "2026-11-28"), t("Realizar implantação", "Ribeirão Preto", ""), t("Realizar implantação", "Presidente Prudente", "2026-11-26"),
    t("Enviar acesso", "Ribeirão Preto", "2026-11-27"), t("Avulsa", undefined, ""), t("Feita", "Ribeirão Preto", "2026-11-20", true)];
  const g = groupByPolo(rows);
  it("um bloco por polo, em ordem alfabética, com as sem polo no fim", () => {
    expect(g.map((x) => x.name)).toEqual(["Presidente Prudente", "Ribeirão Preto", "Sem polo"]);
  });
  it("dentro do polo: pendentes primeiro, por data (sem data por último), e conta as pendentes", () => {
    expect(g[0]!.rows.map((r) => r.title)).toEqual(["Realizar implantação", "Criar usuários"]);
    expect(g[1]!.rows.map((r) => r.title)).toEqual(["Enviar acesso", "Realizar implantação", "Feita"]);
    expect(g.map((x) => x.pend)).toEqual([2, 2, 1]);
  });
});
