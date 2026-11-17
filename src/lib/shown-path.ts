import { useRouterState } from "@tanstack/react-router";

/**
 * Caminho da tela que está DE FATO na tela (a última já carregada).
 * Durante a troca de página, `location` já aponta para a tela nova enquanto a antiga ainda está desenhada: quem decidia
 * a barra lateral e os botões flutuantes por `location` trocava antes do conteúdo, e por uns instantes apareciam duas barras
 * juntas (ou nenhuma). `resolvedLocation` só muda quando a tela nova entra, então tudo troca junto.
 */
export const useShownPath = (): string => useRouterState({ select: (s) => (s.resolvedLocation ?? s.location).pathname });
