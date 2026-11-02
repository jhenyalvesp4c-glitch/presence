import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each([
    ["/saude", "/saude"],
    ["/saude/treino", "/saude_/treino"],
    ["/saude/dieta", "/saude_/dieta"],
    ["/treino", "/treino"],
    ["/treino/nova", "/treino_/nova"],
    ["/treino/exercicios", "/treino_/exercicios"],
    ["/dieta/nova", "/dieta/nova"],
    ["/medidas/nova", "/medidas/nova"],
    ["/hoje", "/hoje"],
    ["/progresso", "/progresso"],
    ["/resumo", "/resumo"],
    ["/calendario", "/calendario"],
    ["/habitos", "/habitos"],
    ["/analise", "/analise"],
    ["/projetos", "/projetos"],
    ["/demandas", "/demandas"],
  ])("matches %s to its own screen", (path, expectedId) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(expectedId);
  });
});
