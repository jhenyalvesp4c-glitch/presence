import { describe, expect, it } from "vitest";

import { MAX_FILE_MB, isPdf, materialsKey, toMaterialFiles } from "@/lib/demand-materials";

const file = (name: string, type: string, size: number) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("anexos da demanda", () => {
  it(`arquivo acima de ${MAX_FILE_MB} MB fica de fora e é avisado`, () => {
    const { ok, tooBig } = toMaterialFiles([file("ok.pdf", "application/pdf", 1000), file("enorme.mp4", "video/mp4", 26 * 1024 * 1024)]);
    expect(ok.map((f) => f.name)).toEqual(["ok.pdf"]);
    expect(tooBig).toEqual(["enorme.mp4"]);
  });

  it("print colado (sem nome) ganha nome com data e hora", () => {
    const { ok } = toMaterialFiles([file("image.png", "image/png", 10)], new Date("2026-11-11T14:05:09Z"));
    expect(ok[0]!.name).toBe("print-2026-11-11-14-05-09.png");
  });

  it("anexos são separados por projeto e demanda", () => {
    expect(materialsKey("p1", "#G040")).not.toBe(materialsKey("p2", "#G040"));
  });

  it("reconhece PDF pelo tipo ou pela extensão", () => {
    expect(isPdf({ type: "", name: "Contrato.PDF" })).toBe(true);
    expect(isPdf({ type: "image/png", name: "a.png" })).toBe(false);
  });
});

import { folderOf, parseKey, pathOf } from "@/lib/demand-materials";

describe("anexos da demanda no Storage", () => {
  it("chave e caminho: um por projeto e demanda, nome do arquivo sem acento nem espaço", () => {
    expect(parseKey("p4c:#G040")).toEqual({ projectId: "p4c", code: "#G040" });
    const f = { id: "abc123", name: "Contrato Final (versão 2).pdf" };
    const p = pathOf("p4c", "#G040", f);
    expect(p.startsWith(`${folderOf("p4c", "#G040")}/abc123-`)).toBe(true);
    expect(p).toMatch(/Contrato_Final_versao_2_\.pdf$/);
    expect(folderOf("p4c", "#G040")).not.toBe(folderOf("p4c", "#G041"));
    expect(folderOf("p4c", "#G040")).not.toBe(folderOf("p2", "#G040"));
  });
});
