import { describe, expect, it } from "vitest";
import { clientTaskProgress } from "@/lib/client-progress";

describe("Porcentagem do cliente pelas tarefas", () => {
  const tasks = [{ client_id: "a", done: true }, { client_id: "a", done: false }, { client_id: "a", done: false }, { client_id: "b", done: true }, { client_id: null, done: true }];
  it("feitas ÷ criadas, só do cliente", () => {
    expect(clientTaskProgress(tasks, "a")).toEqual({ total: 3, done: 1, pct: 33 });
    expect(clientTaskProgress(tasks, "b")).toEqual({ total: 1, done: 1, pct: 100 });
  });
  it("sem tarefas não há porcentagem", () => { expect(clientTaskProgress(tasks, "c")).toEqual({ total: 0, done: 0, pct: 0 }); });
});
