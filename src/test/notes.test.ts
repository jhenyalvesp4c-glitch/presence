import { describe, expect, it } from "vitest";
import { addNote, deleteNote, editNote, noteDossierName, unlinkDossier, type Note } from "@/lib/notes";

const dossiers = [{ id: "d3", name: "BH Centro" }, { id: "d9", name: "Santos" }];
const base: Note[] = [{ id: 1, text: "Geral", date: "01/11", color: "cyan" }];

describe("notas", () => {
  it("cria uma nota sem dossiê como nota geral", () => {
    const n = addNote(base, { text: "  Nova  ", color: "pink" }, "05/11", 2)[0]!;
    expect(n).toMatchObject({ id: 2, text: "Nova", date: "05/11", dossierId: undefined });
    expect(noteDossierName(n, dossiers)).toBeNull();
  });

  it("cria uma nota ligada a um dossiê", () => {
    const n = addNote(base, { text: "Treino", color: "pink", dossierId: "d3" }, "05/11", 2)[0]!;
    expect(noteDossierName(n, dossiers)).toBe("BH Centro");
  });

  it("edita texto e troca ou remove o dossiê", () => {
    const linked = editNote(base, 1, { text: "Mudou", color: "amber", dossierId: "d9" });
    expect(linked[0]).toMatchObject({ text: "Mudou", color: "amber", dossierId: "d9" });
    const unlinked = editNote(linked, 1, { text: "Mudou", color: "amber", dossierId: "" });
    expect(unlinked[0]!.dossierId).toBeUndefined();
  });

  it("exclui a nota", () => {
    expect(deleteNote(base, 1)).toHaveLength(0);
  });

  it("excluir um dossiê mantém a nota, mas ela vira geral", () => {
    const list = unlinkDossier([{ ...base[0]!, dossierId: "d3" }], "d3");
    expect(list).toHaveLength(1);
    expect(list[0]!.dossierId).toBeUndefined();
  });
});
