import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/training-images", () => ({ primePaths: async () => false, mediaUrl: () => undefined }));
import { TaskFilePicker, TaskThumbs, type TaskFiles } from "@/components/TaskFiles";

const att = (name: string, mime = "image/png") => ({ path: `u/tarefas/${name}`, name, mime, size: 10 });
const fake = (kept: ReturnType<typeof att>[], pending: { key: string; name: string; preview?: string }[] = []) => {
  const calls: string[] = [];
  const f = { pending, kept, count: kept.length + pending.length, add: async (l: File[]) => { calls.push(`add:${l.map((x) => x.name).join(",")}`); }, setKept: (fn: (l: ReturnType<typeof att>[]) => ReturnType<typeof att>[]) => { calls.push(`kept:${fn(kept).length}`); }, removePending: (k: string) => { calls.push(`rm:${k}`); } } as unknown as TaskFiles;
  return { f, calls };
};

describe("Imagens e arquivos nas tarefas", () => {
  it("o botão escolhe arquivos; as miniaturas dos já salvos e dos novos podem ser tiradas", () => {
    const { f, calls } = fake([att("a.png")], [{ key: "p1", name: "nova.png", preview: "data:image/png;base64,AA" }]);
    render(<TaskFilePicker files={f} />);
    expect(screen.getByTestId("tarefa-anexar")).toHaveTextContent("Anexar imagem ou arquivo");
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe(""); // qualquer arquivo
    fireEvent.change(input, { target: { files: [new File(["x"], "foto.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByLabelText("Tirar a.png"));
    fireEvent.click(screen.getByLabelText("Tirar nova.png"));
    expect(calls).toEqual(["add:foto.png", "kept:0", "rm:p1"]);
    expect(screen.getAllByTestId("tarefa-imagem-nova")).toHaveLength(1);
  });
  it("na lista, mostra até 4 miniaturas e abre a imagem ao tocar", () => {
    render(<TaskThumbs title="Criar usuários" files={[att("1.png"), att("2.png"), att("3.png"), att("4.png"), att("5.png"), att("doc.pdf", "application/pdf")]} />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
