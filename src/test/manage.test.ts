import { describe, expect, it } from "vitest";
import { deadlineText, multiStatus, pick, withStatus } from "../lib/voice/manage";
import type { Demand } from "../lib/demands";

const d = (over: Partial<Demand> = {}): Demand => ({ id: "#G042", type: "geral", title: "Preparar vídeos tutoriais", desc: "", priority: "media", status: "todo", deadline: "", history: [], notes: [], ...over });

describe("voz: achar demanda, tarefa ou lembrete", () => {
  const list = [d(), d({ id: "#P049", type: "polo", title: "Alterar o nome do usuário para Eliveuto" }), d({ id: "#P048", type: "polo", title: "Disparo em duas etapas — Juiz de Fora" }), d({ id: "#G041", title: "Disparo de teste" })];
  const run = (q: string) => pick(list, q, (x) => x.id, (x) => x.title, (x) => `${x.id} ${x.title}`);
  it("por código, com ou sem #", () => { expect(run("p049")).toMatchObject({ ok: true }); expect(run("#G042")).toMatchObject({ ok: true, item: { id: "#G042" } }); });
  it("por palavras do título", () => { expect(run("vídeos tutoriais")).toMatchObject({ ok: true, item: { id: "#G042" } }); expect(run("duas etapas")).toMatchObject({ ok: true, item: { id: "#P048" } }); });
  it("ambíguo devolve as opções", () => { const r = run("disparo"); expect(r.ok).toBe(false); if (!r.ok) expect(r.opcoes?.length).toBe(2); });
  it("não achou", () => { expect(run("zzz inexistente")).toMatchObject({ ok: false }); });
});

describe("voz: status e prazo como na tela", () => {
  it("concluir marca o histórico e os dossiês", () => {
    const m = d({ type: "multi", polos: [{ name: "A", status: "todo" }, { name: "B", status: "doing" }] });
    const n = withStatus(m, "done");
    expect(n.status).toBe("done"); expect(n.polos!.every((p) => p.status === "done")).toBe(true); expect(n.history.at(-1)!.text).toBe("Status alterado para Concluída");
  });
  it("concluir um dossiê só muda esse e recalcula a demanda", () => {
    const m = d({ type: "multi", polos: [{ name: "A", status: "done" }, { name: "B", status: "todo" }] });
    expect(withStatus(m, "done", "B").status).toBe("done");
    expect(withStatus(m, "doing", "B").status).toBe("doing");
  });
  it("multiStatus", () => { expect(multiStatus([])).toBe("todo"); expect(multiStatus([{ name: "A", status: "todo" }, { name: "B", status: "doing" }])).toBe("doing"); });
  it("prazo em vários formatos", () => { expect(deadlineText("2026-11-20")).toBe("20/11"); expect(deadlineText("5/3")).toBe("05/03"); expect(deadlineText("20/11/2026")).toBe("20/11"); });
});
