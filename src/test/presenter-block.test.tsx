import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrainingPresenter } from "@/components/training-presenter";
import type { Script } from "@/lib/training-library";

const script: Script = { id: "s", title: "Segmentação", audience: "Iniciantes", goal: "Exportar leads", color: "cyan", blocks: [
  { id: "b1", title: "PARTE 1", minutes: 5, show: ["Clicar em Marketing"], examples: [], say: "Olá, pessoal!\n\nPara começar, acesse Marketing.",
    tables: [{ head: ["Categoria", "Permite"], rows: [["Tags", "Filtrar por tag"]] }], panels: [{ title: "Resultado", kind: "result", lines: ["5.272 leads"] }] },
] };

Element.prototype.scrollTo = () => {};

describe("Tela do bloco", () => {
  it("mostra o que falar, a tabela e o resultado na mesma tela do bloco", async () => {
    render(<TrainingPresenter script={script} examples={[]} shown={{}} onToggle={() => {}} onClose={() => {}} />);
    // avança da abertura para o bloco 1
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(await screen.findByTestId("falar-bloco")).toHaveTextContent("Para começar, acesse Marketing.");
    expect(screen.getByTestId("tabela-bloco")).toHaveTextContent("Filtrar por tag");
    expect(screen.getByTestId("quadro-bloco")).toHaveTextContent("5.272 leads");
    expect(screen.getByTestId("bloco-completo")).toHaveTextContent("Clicar em Marketing");
  });
});

import { fireEvent } from "@testing-library/react";

describe("Editar dentro da apresentação", () => {
  it("abre os campos, troca a fala e salva o bloco", async () => {
    let saved: import("@/lib/training-library").Block | undefined;
    render(<TrainingPresenter script={script} examples={[]} shown={{}} onToggle={() => {}} onClose={() => {}} onSaveBlock={(b) => { saved = b; }} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    fireEvent.click(await screen.findByTestId("editar-bloco"));
    fireEvent.change(screen.getByLabelText("O que falar"), { target: { value: "Fala nova, com espaço e → letras n g f." } });
    fireEvent.change(screen.getByLabelText("Passo 1"), { target: { value: "Clicar em Segmentação" } });
    fireEvent.change(screen.getByLabelText("Linha 1, coluna 2"), { target: { value: "Filtrar por etiqueta" } });
    fireEvent.click(screen.getByTestId("salvar-bloco-inline"));
    expect(saved?.say).toBe("Fala nova, com espaço e → letras n g f.");
    expect(saved?.show).toEqual(["Clicar em Segmentação"]);
    expect(saved?.tables?.[0]?.rows[0]).toEqual(["Tags", "Filtrar por etiqueta"]);
    expect(screen.queryByTestId("editar-bloco-inline")).toBeNull();
  });
});
